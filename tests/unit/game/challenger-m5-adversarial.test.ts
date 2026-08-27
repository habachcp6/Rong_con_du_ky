import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_QUEST_ID,
  MY_KHE_TRASH,
  collectTrash,
  createCleanupAttempt,
  getCleanupOutcome,
  remainingCleanupSeconds,
  validateMyKheLayout,
  type MyKheTrash,
} from "../../../src/client/game/my-khe.js";
import {
  ATTEMPT_DURATION_MS,
  SON_TRA_TRACE_IDS,
  createSonTraObservationState,
  observeTrace,
  remainingTraces,
} from "../../../src/client/game/son-tra.js";

describe("Challenger M5 Adversarial Stress Tests", () => {
  const myKhePath = path.join(
    process.cwd(),
    "src/client/game/scenes/MyKheCleanupScene.ts",
  );
  const sonTraPath = path.join(
    process.cwd(),
    "src/client/game/scenes/SonTraWildlifeScene.ts",
  );

  const myKheContent = fs.readFileSync(myKhePath, "utf-8");
  const sonTraContent = fs.readFileSync(sonTraPath, "utf-8");

  describe("1. Zero Gemini / AI Imports Invariant", () => {
    it("MyKheCleanupScene.ts has zero Gemini/AI imports or API calls", () => {
      expect(myKheContent).not.toMatch(/from ["'].*gemini.*["']/i);
      expect(myKheContent).not.toMatch(/from ["'].*generative-ai.*["']/i);
      expect(myKheContent).not.toMatch(/fetch\s*\(/);
    });

    it("SonTraWildlifeScene.ts has zero Gemini/AI imports or API calls", () => {
      expect(sonTraContent).not.toMatch(/from ["'].*gemini.*["']/i);
      expect(sonTraContent).not.toMatch(/from ["'].*generative-ai.*["']/i);
      expect(sonTraContent).not.toMatch(/fetch\s*\(/);
    });
  });

  describe("2. My Khe Beach Cleanup Stress Tests", () => {
    it("verify rule constants match specification (90s duration, 8 items)", () => {
      expect(MY_KHE_CLEANUP_RULES.maximumDurationMs).toBe(90_000);
      expect(MY_KHE_CLEANUP_RULES.requiredTrash).toBe(8);
      expect(MY_KHE_QUEST_ID).toBe("my_khe_clean_wave");
    });

    it("handles boundary time checks precisely", () => {
      const startTime = 10_000;
      let attempt = createCleanupAttempt(startTime);

      // Collect all 8 items before deadline
      for (const trash of MY_KHE_TRASH) {
        attempt = collectTrash(attempt, trash.id).attempt;
      }

      // At exactly 1ms before 90s deadline -> SUCCESS
      expect(getCleanupOutcome(attempt, startTime + 89_999)).toBe("SUCCESS");

      // At exactly 90s deadline -> FAILED (time expiry wins tie)
      expect(getCleanupOutcome(attempt, startTime + 90_000)).toBe("FAILED");

      // After deadline -> FAILED
      expect(getCleanupOutcome(attempt, startTime + 100_000)).toBe("FAILED");
    });

    it("remaining cleanup seconds never goes negative and rounds up", () => {
      const deadline = 100_000;
      expect(remainingCleanupSeconds(deadline, 10_000)).toBe(90);
      expect(remainingCleanupSeconds(deadline, 99_001)).toBe(1);
      expect(remainingCleanupSeconds(deadline, 100_000)).toBe(0);
      expect(remainingCleanupSeconds(deadline, 105_000)).toBe(0);
    });

    it("rejects invalid collections (unknown ID, duplicate ID, already complete)", () => {
      let attempt = createCleanupAttempt(1_000);

      // Unknown ID
      const unknownRes = collectTrash(attempt, "bogus_trash_id");
      expect(unknownRes.accepted).toBe(false);
      expect(unknownRes.reason).toBe("UNKNOWN_TRASH");

      // First collection valid
      const valid1 = collectTrash(attempt, MY_KHE_TRASH[0].id);
      expect(valid1.accepted).toBe(true);
      attempt = valid1.attempt;

      // Duplicate collection rejected
      const dupRes = collectTrash(attempt, MY_KHE_TRASH[0].id);
      expect(dupRes.accepted).toBe(false);
      expect(dupRes.reason).toBe("ALREADY_COLLECTED");

      // Collect remaining 7 items
      for (let i = 1; i < MY_KHE_TRASH.length; i++) {
        attempt = collectTrash(attempt, MY_KHE_TRASH[i].id).attempt;
      }

      // Further collection of collected trash returns ALREADY_COLLECTED
      const overflowRes = collectTrash(attempt, MY_KHE_TRASH[0].id);
      expect(overflowRes.accepted).toBe(false);
      expect(overflowRes.reason).toBe("ALREADY_COLLECTED");
    });

    it("layout validator catches invalid custom trash configurations", () => {
      // 1. Wrong count
      expect(validateMyKheLayout(MY_KHE_TRASH.slice(0, 7))).toEqual({
        valid: false,
        reason: "TRASH_COUNT",
      });

      // 2. Duplicate ID
      const dupTrash: MyKheTrash[] = MY_KHE_TRASH.map((item, idx) =>
        idx === 1 ? { ...item, id: MY_KHE_TRASH[0].id } : item,
      );
      expect(validateMyKheLayout(dupTrash)).toEqual({
        valid: false,
        reason: "DUPLICATE_TRASH_ID",
      });

      // 3. Out of bounds
      const oobTrash: MyKheTrash[] = MY_KHE_TRASH.map((item, idx) =>
        idx === 0 ? { ...item, x: 0 } : item,
      );
      expect(validateMyKheLayout(oobTrash)).toEqual({
        valid: false,
        reason: "TRASH_OUT_OF_BOUNDS",
      });

      // 4. Overlaps obstacle (sandcastle at x: 245, y: 170)
      const overlapTrash: MyKheTrash[] = MY_KHE_TRASH.map((item, idx) =>
        idx === 0 ? { ...item, x: 245, y: 170 } : item,
      );
      expect(validateMyKheLayout(overlapTrash)).toEqual({
        valid: false,
        reason: "TRASH_OVERLAPS_OBSTACLE",
      });
    });
  });

  describe("3. Son Tra Wildlife Observation Stress Tests", () => {
    it("verify observation rules constants (90s duration, 3 trace IDs)", () => {
      expect(ATTEMPT_DURATION_MS).toBe(90_000);
      expect(SON_TRA_TRACE_IDS).toEqual(["canopy", "footprint", "fruit"]);
    });

    it("properly handles invalid and duplicate observation attempts", () => {
      let state = createSonTraObservationState();
      expect(state.found).toHaveLength(0);
      expect(remainingTraces(state)).toBe(3);

      // Invalid trace ID
      const invalidRes = observeTrace(state, "unknown_animal");
      expect(invalidRes.kind).toBe("INVALID");
      expect(invalidRes.state.found).toHaveLength(0);

      // First valid trace
      const trace1 = observeTrace(state, "canopy");
      expect(trace1.kind).toBe("FOUND");
      state = trace1.state;
      expect(state.found).toEqual(["canopy"]);
      expect(remainingTraces(state)).toBe(2);

      // Duplicate observation
      const trace1Dup = observeTrace(state, "canopy");
      expect(trace1Dup.kind).toBe("DUPLICATE");
      expect(trace1Dup.state.duplicateAttempts).toBe(1);
      expect(trace1Dup.state.found).toEqual(["canopy"]);
      state = trace1Dup.state;

      // Second valid trace
      const trace2 = observeTrace(state, "footprint");
      expect(trace2.kind).toBe("FOUND");
      state = trace2.state;
      expect(remainingTraces(state)).toBe(1);

      // Final valid trace -> COMPLETE
      const trace3 = observeTrace(state, "fruit");
      expect(trace3.kind).toBe("COMPLETE");
      state = trace3.state;
      expect(remainingTraces(state)).toBe(0);
      expect(state.found).toEqual(["canopy", "footprint", "fruit"]);
      expect(state.duplicateAttempts).toBe(1);
    });
  });

  describe("4. Scene Registration and Structure Checks", () => {
    it("MyKheCleanupScene source defines correct class and key", () => {
      expect(myKheContent).toContain(
        "export class MyKheCleanupScene extends Phaser.Scene",
      );
      expect(myKheContent).toContain('super({ key: "MyKheCleanupScene" })');
    });

    it("SonTraWildlifeScene source defines correct class and key", () => {
      expect(sonTraContent).toContain(
        "export class SonTraWildlifeScene extends Phaser.Scene",
      );
      expect(sonTraContent).toContain('super({ key: "SonTraWildlifeScene" })');
    });
  });
});
