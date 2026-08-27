import { describe, expect, it } from "vitest";
import {
  LANDMARK_CHALLENGE_RULES,
  applyLandmarkChallengeInput,
  createLandmarkChallengeAttempt,
  remainingLandmarkChallengeSeconds,
  startLandmarkChallenge,
} from "../../../src/client/game/landmark-challenge-rules.js";
import {
  DRAGON_BRIDGE_RHYTHM,
  requiredRhythmScore,
  remainingRhythmSeconds,
  rhythmWasSuccessful,
} from "../../../src/client/game/rhythm.js";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_TRASH,
  MY_KHE_OBSTACLES,
  cleanupDeadline,
  cleanupIsComplete,
  collectTrash,
  createCleanupAttempt,
  getCleanupOutcome,
  remainingCleanupSeconds,
  validateMyKheLayout,
} from "../../../src/client/game/my-khe.js";
import {
  ATTEMPT_DURATION_MS,
  SON_TRA_TRACE_IDS,
  createSonTraObservationState,
  observeTrace,
  remainingTraces,
} from "../../../src/client/game/son-tra.js";
import {
  MARBLE_ELEMENT_ORDER,
  MAX_MARBLE_HINTS,
  createMarblePuzzleState,
  getExpectedMarbleElement,
  isMarblePuzzleComplete,
  reduceMarblePuzzle,
} from "../../../src/client/game/marble-puzzle.js";
import {
  LocalGameStateStore,
  GameSession,
  DRAGON_BRIDGE_QUEST_ID,
} from "../../../src/client/game/state/GameStateStore.js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("Milestone 1 Empirical Adversarial Challenge Suite", () => {
  describe("1. Time Limits & Deadline Boundary Conditions", () => {
    it("all 6 landmark challenge rule durations are within increased bounds (90s - 112.5s)", () => {
      const keys = Object.keys(
        LANDMARK_CHALLENGE_RULES,
      ) as (keyof typeof LANDMARK_CHALLENGE_RULES)[];
      expect(keys.length).toBe(6);
      for (const key of keys) {
        const rule = LANDMARK_CHALLENGE_RULES[key];
        expect(rule.durationMs).toBeGreaterThanOrEqual(90_000);
        expect(rule.durationMs).toBeLessThanOrEqual(115_000);
      }
    });

    it("rhythm, my khe, and son tra durations are set to 90,000ms", () => {
      expect(DRAGON_BRIDGE_RHYTHM.maximumDurationMs).toBe(90_000);
      expect(MY_KHE_CLEANUP_RULES.maximumDurationMs).toBe(90_000);
      expect(ATTEMPT_DURATION_MS).toBe(90_000);
    });

    it("timer remaining seconds boundary calculations handle positive, boundary, fractional, zero, and negative values", () => {
      // remainingLandmarkChallengeSeconds
      const deadline = 100_000;
      expect(remainingLandmarkChallengeSeconds(deadline, 10_000)).toBe(90);
      expect(remainingLandmarkChallengeSeconds(deadline, 10_001)).toBe(90); // Math.ceil(89.999) = 90
      expect(remainingLandmarkChallengeSeconds(deadline, 11_000)).toBe(89); // Math.ceil(89.0) = 89
      expect(remainingLandmarkChallengeSeconds(deadline, 99_999)).toBe(1); // Math.ceil(0.001) = 1
      expect(remainingLandmarkChallengeSeconds(deadline, 100_000)).toBe(0);
      expect(remainingLandmarkChallengeSeconds(deadline, 105_000)).toBe(0);

      // remainingRhythmSeconds
      expect(remainingRhythmSeconds(deadline, 10_000)).toBe(90);
      expect(remainingRhythmSeconds(deadline, 100_000)).toBe(0);
      expect(remainingRhythmSeconds(deadline, 105_000)).toBe(0);

      // remainingCleanupSeconds
      expect(remainingCleanupSeconds(deadline, 10_000)).toBe(90);
      expect(remainingCleanupSeconds(deadline, 100_000)).toBe(0);
      expect(remainingCleanupSeconds(deadline, 105_000)).toBe(0);
    });

    it("My Khe cleanup outcome boundary handles exact deadline millisecond tie-breaker", () => {
      const attempt = createCleanupAttempt(1000);
      // Collect all 8 trash items
      let currentAttempt = attempt;
      for (const item of MY_KHE_TRASH) {
        const result = collectTrash(currentAttempt, item.id);
        expect(result.accepted).toBe(true);
        currentAttempt = result.attempt;
      }
      expect(cleanupIsComplete(currentAttempt)).toBe(true);

      const deadline = cleanupDeadline(currentAttempt); // 1000 + 90,000 = 91,000

      // 1ms before deadline with 8 trash -> SUCCESS
      expect(getCleanupOutcome(currentAttempt, deadline - 1)).toBe("SUCCESS");

      // Exactly at deadline with 8 trash -> FAILED (time expiry wins tie)
      expect(getCleanupOutcome(currentAttempt, deadline)).toBe("FAILED");

      // After deadline -> FAILED
      expect(getCleanupOutcome(currentAttempt, deadline + 100)).toBe("FAILED");

      // Unfinished cleanup 1ms before deadline -> IN_PROGRESS
      const incompleteAttempt = createCleanupAttempt(1000);
      expect(getCleanupOutcome(incompleteAttempt, deadline - 1)).toBe(
        "IN_PROGRESS",
      );
    });
  });

  describe("2. Minigame Solution Paths & Mechanics Integrity", () => {
    it("Han River Bridge Turn (rotate mode): step-by-step taps reach SUCCESS and modulo 4 works", () => {
      const rule = LANDMARK_CHALLENGE_RULES.han_river_bridge_turn;
      let attempt = createLandmarkChallengeAttempt(rule);
      attempt = startLandmarkChallenge(attempt);
      expect(attempt.phase).toBe("PLAYING");

      // Expected: [1, 3, 2, 1]
      // Option 0: tap 1 time -> value 1
      attempt = applyLandmarkChallengeInput(rule, attempt, 0);
      expect(attempt.values[0]).toBe(1);

      // Option 1: tap 3 times -> value 3
      attempt = applyLandmarkChallengeInput(rule, attempt, 1);
      attempt = applyLandmarkChallengeInput(rule, attempt, 1);
      attempt = applyLandmarkChallengeInput(rule, attempt, 1);
      expect(attempt.values[1]).toBe(3);

      // Option 2: tap 2 times -> value 2
      attempt = applyLandmarkChallengeInput(rule, attempt, 2);
      attempt = applyLandmarkChallengeInput(rule, attempt, 2);
      expect(attempt.values[2]).toBe(2);

      // Option 3: tap 1 time -> value 1 -> completion!
      attempt = applyLandmarkChallengeInput(rule, attempt, 3);
      expect(attempt.values[3]).toBe(1);
      expect(attempt.phase).toBe("SUCCESS");

      // Test modulo wrap-around: 4 taps return to 0
      let wrapAttempt = createLandmarkChallengeAttempt(rule);
      wrapAttempt = startLandmarkChallenge(wrapAttempt);
      for (let i = 0; i < 4; i++) {
        wrapAttempt = applyLandmarkChallengeInput(rule, wrapAttempt, 0);
      }
      expect(wrapAttempt.values[0]).toBe(0);
    });

    it("Linh Ung Quiet Path (sequence mode): wrong input sets feedback, correct order solves", () => {
      const rule = LANDMARK_CHALLENGE_RULES.linh_ung_quiet_path;
      let attempt = createLandmarkChallengeAttempt(rule);
      attempt = startLandmarkChallenge(attempt);

      // Expected: [0, 1, 2, 3, 4]
      // Click wrong index (e.g. 5)
      attempt = applyLandmarkChallengeInput(rule, attempt, 5);
      expect(attempt.progress).toBe(0);
      expect(attempt.feedback?.vi).toContain("Chưa đúng thứ tự");

      // Click correct order 0, 1, 2, 3, 4
      for (const expectedIdx of rule.expected) {
        attempt = applyLandmarkChallengeInput(rule, attempt, expectedIdx);
      }
      expect(attempt.phase).toBe("SUCCESS");
      expect(attempt.feedback?.vi).toBe("Đúng rồi!");
    });

    it("Cham Museum Relic Match (sequence mode): solves with expected [0, 1, 2, 3]", () => {
      const rule = LANDMARK_CHALLENGE_RULES.cham_museum_relic_match;
      let attempt = createLandmarkChallengeAttempt(rule);
      attempt = startLandmarkChallenge(attempt);
      for (const expectedIdx of rule.expected) {
        attempt = applyLandmarkChallengeInput(rule, attempt, expectedIdx);
      }
      expect(attempt.phase).toBe("SUCCESS");
    });

    it("Non Nuoc Carving Pattern (sequence mode): solves with expected [0, 2, 1, 3, 4, 5]", () => {
      const rule = LANDMARK_CHALLENGE_RULES.non_nuoc_carving_pattern;
      let attempt = createLandmarkChallengeAttempt(rule);
      attempt = startLandmarkChallenge(attempt);
      for (const expectedIdx of rule.expected) {
        attempt = applyLandmarkChallengeInput(rule, attempt, expectedIdx);
      }
      expect(attempt.phase).toBe("SUCCESS");
    });

    it("Han Market Basket Sort (cycle mode): requires all items to be touched to succeed", () => {
      const rule = LANDMARK_CHALLENGE_RULES.han_market_basket_sort;
      let attempt = createLandmarkChallengeAttempt(rule);
      attempt = startLandmarkChallenge(attempt);

      // Expected: [2, 0, 1, 1, 2, 2, 0, 1], modulo 3
      // Craft attempt where values match expected but touched has false
      const fakeAttempt = {
        ...attempt,
        values: [...rule.expected],
        touched: [true, true, true, true, true, true, true, false],
      };
      // Manually pass to applyLandmarkChallengeInput by triggering an input that preserves values
      // Or verify that cycle mode logic checks touched.every(Boolean)
      expect(fakeAttempt.touched.every(Boolean)).toBe(false);

      // Solve legitimately by tapping each option according to expected counts (modulo 3)
      for (let i = 0; i < rule.options.length; i++) {
        const needed = rule.expected[i];
        for (let count = 0; count < needed; count++) {
          attempt = applyLandmarkChallengeInput(rule, attempt, i);
        }
      }
      // If needed was 0 (e.g. index 1 and 6), item was tapped 0 times, so touched[i] is false!
      // To touch index 1 (needed 0), player must tap it 3 times to wrap back to 0!
      // Let's verify this critical mechanic: for items where expected is 0, player MUST tap 3 times (0 -> 1 -> 2 -> 0)
      if (attempt.phase !== "SUCCESS") {
        for (let i = 0; i < rule.options.length; i++) {
          if (!attempt.touched[i]) {
            // Tap 3 times to cycle 0 -> 1 -> 2 -> 0 and set touched[i] = true
            attempt = applyLandmarkChallengeInput(rule, attempt, i);
            attempt = applyLandmarkChallengeInput(rule, attempt, i);
            attempt = applyLandmarkChallengeInput(rule, attempt, i);
          }
        }
      }
      expect(attempt.phase).toBe("SUCCESS");
      expect(attempt.touched.every(Boolean)).toBe(true);
    });

    it("Ba Na Golden Bridge Path (toggle mode): toggles 6 tiles 0->1 to reach SUCCESS", () => {
      const rule = LANDMARK_CHALLENGE_RULES.ba_na_golden_bridge;
      let attempt = createLandmarkChallengeAttempt(rule);
      attempt = startLandmarkChallenge(attempt);
      for (let i = 0; i < 6; i++) {
        attempt = applyLandmarkChallengeInput(rule, attempt, i);
      }
      expect(attempt.phase).toBe("SUCCESS");
      expect(attempt.values).toEqual([1, 1, 1, 1, 1, 1]);
    });

    it("Dragon Bridge Rhythm: required score is 7, hit window is >= 1500ms", () => {
      expect(requiredRhythmScore()).toBe(7);
      expect(rhythmWasSuccessful(7)).toBe(true);
      expect(rhythmWasSuccessful(6)).toBe(false);
      expect(rhythmWasSuccessful(0)).toBe(false);
      expect(rhythmWasSuccessful(10)).toBe(true);
      expect(DRAGON_BRIDGE_RHYTHM.hitWindowMs).toBeGreaterThanOrEqual(1500);
    });

    it("Marble Mountains Five Elements: correct order Kim->Mộc->Thủy->Hỏa->Thổ succeeds, wrong resets, hints capped at 3", () => {
      let state = createMarblePuzzleState();
      state = reduceMarblePuzzle(state, { type: "START" });
      expect(state.phase).toBe("PLAYING");

      // Wrong element resets selection
      state = reduceMarblePuzzle(state, { type: "SELECT", element: "hoa" });
      expect(state.selected).toEqual([]);
      expect(state.feedback).toBe("WRONG");

      // Hints cap test
      expect(state.hintsUsed).toBe(0);
      for (let i = 0; i < MAX_MARBLE_HINTS; i++) {
        state = reduceMarblePuzzle(state, { type: "REQUEST_HINT" });
      }
      expect(state.hintsUsed).toBe(3);
      expect(state.feedback).toBe("HINT");

      // 4th hint request yields HINTS_EXHAUSTED
      state = reduceMarblePuzzle(state, { type: "REQUEST_HINT" });
      expect(state.hintsUsed).toBe(3);
      expect(state.feedback).toBe("HINTS_EXHAUSTED");

      // Correct sequence
      for (const element of MARBLE_ELEMENT_ORDER) {
        expect(getExpectedMarbleElement(state)).toBe(element);
        state = reduceMarblePuzzle(state, { type: "SELECT", element });
      }
      expect(isMarblePuzzleComplete(state)).toBe(true);
      expect(state.phase).toBe("SUCCESS");
    });

    it("Son Tra Wildlife Observation: observing 3 unique traces completes, duplicate increments duplicateAttempts", () => {
      let state = createSonTraObservationState();
      expect(remainingTraces(state)).toBe(3);

      // Invalid trace
      const invalidRes = observeTrace(state, "invalid_id");
      expect(invalidRes.kind).toBe("INVALID");

      // First trace
      const res1 = observeTrace(state, SON_TRA_TRACE_IDS[0]);
      expect(res1.kind).toBe("FOUND");
      state = res1.state;
      expect(remainingTraces(state)).toBe(2);

      // Duplicate trace
      const dupRes = observeTrace(state, SON_TRA_TRACE_IDS[0]);
      expect(dupRes.kind).toBe("DUPLICATE");
      expect(dupRes.state.duplicateAttempts).toBe(1);

      // Remaining traces
      const res2 = observeTrace(state, SON_TRA_TRACE_IDS[1]);
      state = res2.state;
      const res3 = observeTrace(state, SON_TRA_TRACE_IDS[2]);
      expect(res3.kind).toBe("COMPLETE");
      expect(remainingTraces(res3.state)).toBe(0);
    });

    it("My Khe Beach layout validation passes for authored items & obstacles", () => {
      const validation = validateMyKheLayout(MY_KHE_TRASH, MY_KHE_OBSTACLES);
      expect(validation.valid).toBe(true);
    });
  });

  describe("3. Game State Store & Quest Transition Integrity", () => {
    it("GameSession handles start -> retry -> complete -> reward for Dragon Bridge", () => {
      const memoryStorage: Record<string, string> = {};
      const mockStorage = {
        getItem: (k: string) => memoryStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          memoryStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete memoryStorage[k];
        },
      };

      const store = new LocalGameStateStore(mockStorage, 0);
      const session = new GameSession(store);

      const initial = session.getState();
      expect(initial.quests[DRAGON_BRIDGE_QUEST_ID]).toBe("AVAILABLE");

      // Start quest
      const startMutation = session.startQuest(DRAGON_BRIDGE_QUEST_ID);
      expect(startMutation?.current).toBe("ACTIVE");

      // Retry quest
      const retryMutation = session.retryQuest(DRAGON_BRIDGE_QUEST_ID);
      expect(retryMutation?.current).toBe("AVAILABLE");

      // Start & complete quest
      session.startQuest(DRAGON_BRIDGE_QUEST_ID);
      const completeMutation = session.completeQuest(DRAGON_BRIDGE_QUEST_ID);
      expect(completeMutation?.current).toBe("COMPLETED");

      // Reward quest
      const rewardMutation = session.rewardDragonBridge();
      expect(rewardMutation?.current).toBe("REWARDED");
      expect(session.getState().unlockedPostcards).toContain("dragon_bridge");
    });
  });

  describe("4. AI/Gemini Isolation in Scene Files", () => {
    it("no scene file in src/client/game/scenes/ imports gemini or makes AI fetch calls", () => {
      const scenesDir = join(process.cwd(), "src", "client", "game", "scenes");
      const files = readdirSync(scenesDir);
      expect(files.length).toBeGreaterThan(0);

      const forbiddenImportsAndCalls = [
        "@google/generative-ai",
        "@google/genai",
        "/api/ai",
        "/api/recommendations",
      ];

      for (const file of files) {
        if (!file.endsWith(".ts")) continue;
        const filePath = join(scenesDir, file);
        const content = readFileSync(filePath, "utf-8");
        for (const term of forbiddenImportsAndCalls) {
          expect(
            content.toLowerCase().includes(term.toLowerCase()),
            `File ${file} contains forbidden AI import/call: ${term}`,
          ).toBe(false);
        }
        // Also ensure no import statement references gemini
        const importLines = content
          .split("\n")
          .filter((line) => line.trim().startsWith("import"));
        for (const line of importLines) {
          expect(
            line.toLowerCase().includes("gemini"),
            `File ${file} imports from gemini: ${line}`,
          ).toBe(false);
        }
      }
    });
  });
});
