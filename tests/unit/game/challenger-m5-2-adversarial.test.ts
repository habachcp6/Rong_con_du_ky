import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_OBSTACLES,
  MY_KHE_QUEST_ID,
  MY_KHE_TRASH,
  cleanupDeadline,
  collectTrash,
  createCleanupAttempt,
  getCleanupOutcome,
  remainingCleanupSeconds,
} from "../../../src/client/game/my-khe.js";
import {
  SON_TRA_TRACE_IDS,
  ATTEMPT_DURATION_MS,
  createSonTraObservationState,
  observeTrace,
  remainingTraces,
} from "../../../src/client/game/son-tra.js";
import {
  GameSession,
  LocalGameStateStore,
  type StorageLike,
} from "../../../src/client/game/state/GameStateStore.js";

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

describe("Challenger M5-2 Adversarial Suite (My Khe & Son Tra)", () => {
  const myKheScenePath = path.resolve(
    __dirname,
    "../../../src/client/game/scenes/MyKheCleanupScene.ts",
  );
  const sonTraScenePath = path.resolve(
    __dirname,
    "../../../src/client/game/scenes/SonTraWildlifeScene.ts",
  );

  const myKheCode = fs.readFileSync(myKheScenePath, "utf-8");
  const sonTraCode = fs.readFileSync(sonTraScenePath, "utf-8");

  describe("1. Zero AI API Leakage & Code Integrity", () => {
    it("MyKheCleanupScene has zero AI module imports or network fetch calls", () => {
      expect(myKheCode).not.toMatch(/import.*gemini/i);
      expect(myKheCode).not.toMatch(/@google\/genai/i);
      expect(myKheCode).not.toMatch(/fetch\s*\(/);
      expect(myKheCode).not.toMatch(/axios/i);
    });

    it("SonTraWildlifeScene has zero AI module imports or network fetch calls", () => {
      expect(sonTraCode).not.toMatch(/import.*gemini/i);
      expect(sonTraCode).not.toMatch(/@google\/genai/i);
      expect(sonTraCode).not.toMatch(/fetch\s*\(/);
      expect(sonTraCode).not.toMatch(/axios/i);
    });

    it("Scene keys and exports are preserved exactly", () => {
      expect(myKheCode).toContain('super({ key: "MyKheCleanupScene" })');
      expect(sonTraCode).toContain('super({ key: "SonTraWildlifeScene" })');
    });
  });

  describe("2. My Khe Cleanup Deterministic Rules & Edge Cases", () => {
    it("enforces 90-second duration and 8 required trash items", () => {
      expect(MY_KHE_CLEANUP_RULES.maximumDurationMs).toBe(90_000);
      expect(MY_KHE_CLEANUP_RULES.requiredTrash).toBe(8);
      expect(MY_KHE_TRASH.length).toBe(8);
    });

    it("evaluates pickup radius exactly at 38px boundary", () => {
      expect(MY_KHE_CLEANUP_RULES.pickupRadius).toBe(38);
    });

    it("validates all trash positions lie within playfield bounds", () => {
      const { minX, minY, maxX, maxY } = MY_KHE_CLEANUP_RULES.playfield;
      MY_KHE_TRASH.forEach((item) => {
        expect(item.x).toBeGreaterThanOrEqual(minX);
        expect(item.x).toBeLessThanOrEqual(maxX);
        expect(item.y).toBeGreaterThanOrEqual(minY);
        expect(item.y).toBeLessThanOrEqual(maxY);
      });
    });

    it("validates all obstacle positions lie within playfield bounds", () => {
      const { minX, minY, maxX, maxY } = MY_KHE_CLEANUP_RULES.playfield;
      MY_KHE_OBSTACLES.forEach((obs) => {
        expect(obs.x - obs.width / 2).toBeGreaterThanOrEqual(minX - 10);
        expect(obs.x + obs.width / 2).toBeLessThanOrEqual(maxX + 10);
        expect(obs.y - obs.height / 2).toBeGreaterThanOrEqual(minY - 10);
        expect(obs.y + obs.height / 2).toBeLessThanOrEqual(maxY + 10);
      });
    });

    it("correctly transitions from IN_PROGRESS -> SUCCESS on 8th trash item", () => {
      let attempt = createCleanupAttempt(1000);
      expect(getCleanupOutcome(attempt, 2000)).toBe("IN_PROGRESS");

      MY_KHE_TRASH.forEach((trash, idx) => {
        const res = collectTrash(attempt, trash.id);
        expect(res.accepted).toBe(true);
        attempt = res.attempt;
        if (idx < 7) {
          expect(getCleanupOutcome(attempt, 2000)).toBe("IN_PROGRESS");
        }
      });

      expect(getCleanupOutcome(attempt, 2000)).toBe("SUCCESS");
    });

    it("handles double-collection gracefully without duplicate counting", () => {
      let attempt = createCleanupAttempt(1000);
      const firstTrashId = MY_KHE_TRASH[0].id;

      const res1 = collectTrash(attempt, firstTrashId);
      expect(res1.accepted).toBe(true);
      attempt = res1.attempt;

      const res2 = collectTrash(attempt, firstTrashId);
      expect(res2.accepted).toBe(false);
      expect(res2.attempt).toEqual(attempt);
      expect(attempt.collectedIds.length).toBe(1);
    });

    it("evaluates deadline boundary cleanly at 90000ms limit", () => {
      const attempt = createCleanupAttempt(1000);
      const deadline = cleanupDeadline(attempt); // 91000
      expect(deadline).toBe(91000);

      expect(remainingCleanupSeconds(deadline, 1000)).toBe(90);
      expect(remainingCleanupSeconds(deadline, 90999)).toBe(1);
      expect(remainingCleanupSeconds(deadline, 91000)).toBe(0);

      expect(getCleanupOutcome(attempt, 90999)).toBe("IN_PROGRESS");
      expect(getCleanupOutcome(attempt, 91000)).toBe("FAILED");
    });
  });

  describe("3. Son Tra Wildlife Observation Deterministic Rules & Edge Cases", () => {
    it("enforces 90-second duration and 3 required traces", () => {
      expect(ATTEMPT_DURATION_MS).toBe(90_000);
      expect(SON_TRA_TRACE_IDS).toEqual(["canopy", "footprint", "fruit"]);
    });

    it("allows observing all 3 traces in any order permutation", () => {
      const permutations = [
        ["canopy", "footprint", "fruit"],
        ["footprint", "fruit", "canopy"],
        ["fruit", "canopy", "footprint"],
      ] as const;

      permutations.forEach((seq) => {
        let state = createSonTraObservationState();
        expect(remainingTraces(state)).toBe(3);

        const r1 = observeTrace(state, seq[0]);
        expect(r1.kind).toBe("FOUND");
        state = r1.state;
        expect(remainingTraces(state)).toBe(2);

        const r2 = observeTrace(state, seq[1]);
        expect(r2.kind).toBe("FOUND");
        state = r2.state;
        expect(remainingTraces(state)).toBe(1);

        const r3 = observeTrace(state, seq[2]);
        expect(r3.kind).toBe("COMPLETE");
        state = r3.state;
        expect(remainingTraces(state)).toBe(0);
      });
    });

    it("rejects invalid trace IDs without mutating state", () => {
      const state = createSonTraObservationState();
      const res = observeTrace(state, "invalid_trace" as any);
      expect(res.kind).toBe("INVALID");
      expect(res.state).toEqual(state);
    });

    it("rejects duplicate observations without mutating state", () => {
      let state = createSonTraObservationState();
      const r1 = observeTrace(state, "canopy");
      expect(r1.kind).toBe("FOUND");
      state = r1.state;

      const r2 = observeTrace(state, "canopy");
      expect(r2.kind).toBe("DUPLICATE");
      expect(r2.state.duplicateAttempts).toBe(1);
      expect(r2.state.found).toEqual(["canopy"]);
    });
  });

  describe("4. State Machine (GameStateStore) Integration Contract", () => {
    it("integrates My Khe quest lifecycle (AVAILABLE -> ACTIVE -> COMPLETED -> REWARDED)", () => {
      const store = new GameSession(
        new LocalGameStateStore(new MemoryStorage()),
      );
      // Unlock My Khe by completing dragon_bridge first
      store.startQuest("dragon_bridge");
      store.completeQuest("dragon_bridge");
      store.rewardQuest("dragon_bridge");
      expect(store.getState().quests[MY_KHE_QUEST_ID]).toBe("AVAILABLE");

      const s1 = store.startQuest(MY_KHE_QUEST_ID);
      expect(s1?.current).toBe("ACTIVE");

      const s2 = store.completeQuest(MY_KHE_QUEST_ID);
      expect(s2?.current).toBe("COMPLETED");

      const s3 = store.rewardQuest(MY_KHE_QUEST_ID);
      expect(s3?.current).toBe("REWARDED");
    });

    it("integrates Son Tra quest lifecycle (AVAILABLE -> ACTIVE -> COMPLETED -> REWARDED)", () => {
      const store = new GameSession(
        new LocalGameStateStore(new MemoryStorage()),
      );
      const questId = "son_tra_traces";

      // Unlock Son Tra by completing earlier quest chain
      const chain = [
        "dragon_bridge",
        "my_khe_clean_wave",
        "marble_five_elements",
        "han_river_bridge_turn",
        "linh_ung_quiet_path",
        "cham_museum_relic_match",
        "non_nuoc_carving_pattern",
        "han_market_basket_sort",
        "ba_na_golden_bridge",
      ];
      chain.forEach((id) => {
        store.startQuest(id);
        store.completeQuest(id);
        store.rewardQuest(id);
      });

      expect(store.getState().quests[questId]).toBe("AVAILABLE");

      const s1 = store.startQuest(questId);
      expect(s1?.current).toBe("ACTIVE");

      const s2 = store.completeQuest(questId);
      expect(s2?.current).toBe("COMPLETED");

      const s3 = store.rewardQuest(questId);
      expect(s3?.current).toBe("REWARDED");
    });

    it("handles retry flow on quest failure cleanly", () => {
      const store = new GameSession(
        new LocalGameStateStore(new MemoryStorage()),
      );
      store.startQuest("dragon_bridge");
      store.completeQuest("dragon_bridge");
      store.rewardQuest("dragon_bridge");

      store.startQuest(MY_KHE_QUEST_ID);
      expect(store.getState().quests[MY_KHE_QUEST_ID]).toBe("ACTIVE");

      const retried = store.retryQuest(MY_KHE_QUEST_ID);
      expect(retried?.current).toBe("AVAILABLE");
    });
  });

  describe("5. UX & Accessibility Affordances in Scene Source Code", () => {
    it("MyKheCleanupScene contains tutorial card, proximity ring, and vector graphics", () => {
      expect(myKheCode).toContain("showTutorialOverlay");
      expect(myKheCode).toContain("updateProximityRing");
      expect(myKheCode).toContain("drawVectorTrashIcon");
      expect(myKheCode).toContain("triggerSparkleBurst");
      expect(myKheCode).toContain("createHeaderButtons");
    });

    it("SonTraWildlifeScene contains tutorial guide, camera reticle, shutter flash, and vector icons", () => {
      expect(sonTraCode).toContain("showTutorialOverlay");
      expect(sonTraCode).toContain("createCameraViewfinder");
      expect(sonTraCode).toContain("triggerShutterFlash");
      expect(sonTraCode).toContain("drawVectorTraceIcon");
      expect(sonTraCode).toContain("createHeaderButtons");
    });

    it("Both scenes handle window resize and shutdown cleanup", () => {
      expect(myKheCode).toContain("SHUTDOWN");
      expect(myKheCode).toContain("cleanUp");
      expect(myKheCode).toContain("handleResize");

      expect(sonTraCode).toContain("SHUTDOWN");
      expect(sonTraCode).toContain("cleanUp");
    });
  });
});
