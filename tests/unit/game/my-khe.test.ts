import { describe, expect, it } from "vitest";
import {
  DRAGON_BRIDGE_QUEST_ID,
  GameSession,
  LocalGameStateStore,
  type StorageLike,
} from "../../../src/client/game/state/GameStateStore.js";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_OBSTACLES,
  MY_KHE_POSTCARD_KEY,
  MY_KHE_QUEST_ID,
  MY_KHE_TRASH,
  cleanupElapsedMs,
  cleanupDeadline,
  collectTrash,
  createCleanupAttempt,
  getMyKheObstacleCollider,
  getCleanupOutcome,
  pauseCleanupAttempt,
  remainingCleanupAttemptSeconds,
  remainingCleanupSeconds,
  retryCleanupAttempt,
  resumeCleanupAttempt,
  validateMyKheLayout,
} from "../../../src/client/game/my-khe.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("My Khe cleanup deterministic rules", () => {
  it("keeps the authored eight-item layout reachable and rejects invalid edits", () => {
    expect(validateMyKheLayout()).toEqual({ valid: true });

    const duplicate = MY_KHE_TRASH.map((item) => ({ ...item }));
    duplicate[7] = { ...duplicate[7], id: duplicate[0].id };
    expect(validateMyKheLayout(duplicate)).toEqual({
      valid: false,
      reason: "DUPLICATE_TRASH_ID",
    });

    const outside = MY_KHE_TRASH.map((item) => ({ ...item }));
    outside[0] = { ...outside[0], x: 4 };
    expect(validateMyKheLayout(outside)).toEqual({
      valid: false,
      reason: "TRASH_OUT_OF_BOUNDS",
    });
  });

  it("keeps every static obstacle collider at its authored world coordinates", () => {
    expect(MY_KHE_OBSTACLES.map(getMyKheObstacleCollider)).toEqual([
      { x: 245, y: 170, width: 72, height: 44 },
      { x: 458, y: 225, width: 82, height: 46 },
      { x: 302, y: 286, width: 84, height: 34 },
    ]);
  });

  it("collects only known items once and resolves the timer deterministically", () => {
    let attempt = createCleanupAttempt(1_000);
    expect(collectTrash(attempt, "not-on-the-beach")).toMatchObject({
      accepted: false,
      reason: "UNKNOWN_TRASH",
    });

    const first = collectTrash(attempt, MY_KHE_TRASH[0].id);
    expect(first).toMatchObject({ accepted: true, reason: "COLLECTED" });
    attempt = first.attempt;
    expect(collectTrash(attempt, MY_KHE_TRASH[0].id)).toMatchObject({
      accepted: false,
      reason: "ALREADY_COLLECTED",
    });

    for (const trash of MY_KHE_TRASH.slice(1)) {
      attempt = collectTrash(attempt, trash.id).attempt;
    }
    expect(attempt.collectedIds).toHaveLength(
      MY_KHE_CLEANUP_RULES.requiredTrash,
    );
    expect(getCleanupOutcome(attempt, 90_999)).toBe("SUCCESS");
    expect(getCleanupOutcome(attempt, 91_000)).toBe("FAILED");
    expect(remainingCleanupSeconds(91_000, 90_001)).toBe(1);
    expect(remainingCleanupSeconds(91_000, 92_000)).toBe(0);
  });

  it("TC-3.1: Cleanup deadline increased to 90s", () => {
    expect(MY_KHE_CLEANUP_RULES.maximumDurationMs).toBe(90_000);
  });

  it("TC-3.2: Required trash count unchanged", () => {
    expect(MY_KHE_CLEANUP_RULES.requiredTrash).toBe(8);
  });

  it("TC-3.3: Success/fail boundary at new deadline (90s)", () => {
    const attempt = createCleanupAttempt(1_000);
    // Collect all trash items
    let completedAttempt = attempt;
    for (const trash of MY_KHE_TRASH) {
      completedAttempt = collectTrash(completedAttempt, trash.id).attempt;
    }
    expect(getCleanupOutcome(completedAttempt, 90_999)).toBe("SUCCESS");
    expect(getCleanupOutcome(completedAttempt, 91_000)).toBe("FAILED");
  });

  it("pauses and resumes the deterministic cleanup clock without losing progress", () => {
    let attempt = createCleanupAttempt(1_000);
    attempt = pauseCleanupAttempt(attempt, 40_000);

    expect(cleanupElapsedMs(attempt, 100_000)).toBe(39_000);
    expect(remainingCleanupAttemptSeconds(attempt, 100_000)).toBe(51);
    expect(getCleanupOutcome(attempt, 100_000)).toBe("IN_PROGRESS");
    expect(pauseCleanupAttempt(attempt, 120_000)).toEqual(attempt);

    attempt = resumeCleanupAttempt(attempt, 100_000);
    expect(attempt.pausedAtMs).toBeNull();
    expect(attempt.pausedDurationMs).toBe(60_000);
    expect(cleanupDeadline(attempt)).toBe(151_000);

    for (const trash of MY_KHE_TRASH) {
      attempt = collectTrash(attempt, trash.id).attempt;
    }
    expect(getCleanupOutcome(attempt, 150_999)).toBe("SUCCESS");
    expect(getCleanupOutcome(attempt, 151_000)).toBe("FAILED");
  });

  it("resets retry progress and awards the My Khe postcard exactly once", () => {
    const reset = retryCleanupAttempt(9_000);
    expect(reset).toEqual({
      startedAtMs: 9_000,
      collectedIds: [],
      pausedAtMs: null,
      pausedDurationMs: 0,
    });

    const session = new GameSession(
      new LocalGameStateStore(new MemoryStorage(), 1),
    );
    session.startQuest(DRAGON_BRIDGE_QUEST_ID);
    session.completeQuest(DRAGON_BRIDGE_QUEST_ID);
    session.rewardQuest(DRAGON_BRIDGE_QUEST_ID);

    expect(session.startQuest(MY_KHE_QUEST_ID)?.current).toBe("ACTIVE");
    expect(session.retryQuest(MY_KHE_QUEST_ID)?.current).toBe("AVAILABLE");
    expect(session.startQuest(MY_KHE_QUEST_ID)?.current).toBe("ACTIVE");
    expect(session.completeQuest(MY_KHE_QUEST_ID)?.current).toBe("COMPLETED");
    expect(session.rewardQuest(MY_KHE_QUEST_ID)?.current).toBe("REWARDED");
    expect(session.rewardQuest(MY_KHE_QUEST_ID)).toBeNull();

    const state = session.getState();
    expect(state.unlockedPostcards).toContain(MY_KHE_POSTCARD_KEY);
    expect(state.memoryFragments).toBe(2);
    expect(state.quests.marble_five_elements).toBe("AVAILABLE");
  });
});
