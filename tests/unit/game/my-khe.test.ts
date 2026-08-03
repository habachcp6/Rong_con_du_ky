import { describe, expect, it } from "vitest";
import {
  DRAGON_BRIDGE_QUEST_ID,
  GameSession,
  LocalGameStateStore,
  type StorageLike,
} from "../../../src/client/game/state/GameStateStore.js";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_POSTCARD_KEY,
  MY_KHE_QUEST_ID,
  MY_KHE_TRASH,
  collectTrash,
  createCleanupAttempt,
  getCleanupOutcome,
  remainingCleanupSeconds,
  retryCleanupAttempt,
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
    expect(getCleanupOutcome(attempt, 60_999)).toBe("SUCCESS");
    expect(getCleanupOutcome(attempt, 61_000)).toBe("FAILED");
    expect(remainingCleanupSeconds(61_000, 60_001)).toBe(1);
    expect(remainingCleanupSeconds(61_000, 62_000)).toBe(0);
  });

  it("resets retry progress and awards the My Khe postcard exactly once", () => {
    const reset = retryCleanupAttempt(9_000);
    expect(reset).toEqual({ startedAtMs: 9_000, collectedIds: [] });

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
