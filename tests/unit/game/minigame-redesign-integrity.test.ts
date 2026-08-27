import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LANDMARK_CHALLENGE_RULES,
  applyLandmarkChallengeInput,
  createLandmarkChallengeAttempt,
  failLandmarkChallenge,
  startLandmarkChallenge,
} from "../../../src/client/game/landmark-challenge-rules.js";
import {
  MARBLE_ELEMENT_ORDER,
  MAX_MARBLE_HINTS,
} from "../../../src/client/game/marble-puzzle.js";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_TRASH,
} from "../../../src/client/game/my-khe.js";
import { DRAGON_BRIDGE_RHYTHM } from "../../../src/client/game/rhythm.js";
import { SON_TRA_TRACE_IDS } from "../../../src/client/game/son-tra.js";
import { GameSession } from "../../../src/client/game/state/GameStateStore.js";

describe("Minigame Redesign Integrity (TC-5.1 through TC-5.12)", () => {
  it("TC-5.1: Landmark challenge mode types unchanged", () => {
    expect(LANDMARK_CHALLENGE_RULES.han_river_bridge_turn.mode).toBe("rotate");
    expect(LANDMARK_CHALLENGE_RULES.linh_ung_quiet_path.mode).toBe("sequence");
    expect(LANDMARK_CHALLENGE_RULES.cham_museum_relic_match.mode).toBe(
      "sequence",
    );
    expect(LANDMARK_CHALLENGE_RULES.non_nuoc_carving_pattern.mode).toBe(
      "sequence",
    );
    expect(LANDMARK_CHALLENGE_RULES.han_market_basket_sort.mode).toBe("cycle");
    expect(LANDMARK_CHALLENGE_RULES.ba_na_golden_bridge.mode).toBe("toggle");
  });

  it("TC-5.2: Expected solution arrays unchanged for all 6 challenge quests", () => {
    expect(LANDMARK_CHALLENGE_RULES.han_river_bridge_turn.expected).toEqual([
      1, 3, 2, 1,
    ]);
    expect(LANDMARK_CHALLENGE_RULES.linh_ung_quiet_path.expected).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(LANDMARK_CHALLENGE_RULES.cham_museum_relic_match.expected).toEqual([
      0, 1, 2, 3,
    ]);
    expect(LANDMARK_CHALLENGE_RULES.non_nuoc_carving_pattern.expected).toEqual([
      0, 2, 1, 3, 4, 5,
    ]);
    expect(LANDMARK_CHALLENGE_RULES.han_market_basket_sort.expected).toEqual([
      2, 0, 1, 1, 2, 2, 0, 1,
    ]);
    expect(LANDMARK_CHALLENGE_RULES.ba_na_golden_bridge.expected).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);
  });

  it("TC-5.3: Cycle labels for Han Market unchanged (Đặc sản, Quà tặng, Dùng ngay)", () => {
    const labels = LANDMARK_CHALLENGE_RULES.han_market_basket_sort.cycleLabels;
    expect(labels).toHaveLength(3);
    expect(labels?.map((label) => label.vi)).toEqual([
      "Đặc sản",
      "Quà tặng",
      "Dùng ngay",
    ]);
    expect(labels?.map((label) => label.en)).toEqual([
      "Local food",
      "Gift",
      "Ready now",
    ]);
  });

  it("TC-5.4: Option counts unchanged for all 6 challenges", () => {
    expect(LANDMARK_CHALLENGE_RULES.han_river_bridge_turn.options).toHaveLength(
      4,
    );
    expect(LANDMARK_CHALLENGE_RULES.linh_ung_quiet_path.options).toHaveLength(
      7,
    );
    expect(
      LANDMARK_CHALLENGE_RULES.cham_museum_relic_match.options,
    ).toHaveLength(6);
    expect(
      LANDMARK_CHALLENGE_RULES.non_nuoc_carving_pattern.options,
    ).toHaveLength(7);
    expect(
      LANDMARK_CHALLENGE_RULES.han_market_basket_sort.options,
    ).toHaveLength(8);
    expect(LANDMARK_CHALLENGE_RULES.ba_na_golden_bridge.options).toHaveLength(
      6,
    );
  });

  it("TC-5.5: Marble element order unchanged (kim, moc, thuy, hoa, tho)", () => {
    expect(MARBLE_ELEMENT_ORDER).toEqual(["kim", "moc", "thuy", "hoa", "tho"]);
  });

  it("TC-5.6: Marble max hints unchanged (3)", () => {
    expect(MAX_MARBLE_HINTS).toBe(3);
  });

  it("TC-5.7: Dragon Bridge total beats unchanged (10)", () => {
    expect(DRAGON_BRIDGE_RHYTHM.totalBeats).toBe(10);
  });

  it("TC-5.8: My Khe trash count unchanged (8)", () => {
    expect(MY_KHE_TRASH).toHaveLength(8);
    expect(MY_KHE_CLEANUP_RULES.requiredTrash).toBe(8);
  });

  it("TC-5.9: Son Tra trace IDs unchanged (canopy, footprint, fruit)", () => {
    expect(SON_TRA_TRACE_IDS).toEqual(["canopy", "footprint", "fruit"]);
  });

  it("TC-5.10: Zero Gemini / AI API imports in scene files (src/client/game/scenes/)", () => {
    const scenesDir = path.resolve(process.cwd(), "src/client/game/scenes");
    const files = fs
      .readdirSync(scenesDir)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

    const prohibitedPatterns = [
      /import\s+.*from\s+["'].*gemini.*/i,
      /import\s+.*from\s+["'].*@google\/generative-ai.*/i,
      /import\s+.*from\s+["'].*@google\/genai.*/i,
      /require\s*\(\s*["'].*gemini.*/i,
      /fetch\s*\(\s*["'`].*ai/i,
    ];

    for (const file of files) {
      const filePath = path.join(scenesDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      for (const pattern of prohibitedPatterns) {
        expect(
          pattern.test(content),
          `Prohibited AI pattern ${pattern} found in scene file: ${file}`,
        ).toBe(false);
      }
    }
  });

  it("TC-5.11: All 10 scene keys preserved", () => {
    const expectedSceneKeys = [
      "DragonBridgeQuestScene",
      "MyKheCleanupScene",
      "MarbleMountainsPuzzleScene",
      "SonTraWildlifeScene",
      "HanRiverBridgeQuestScene",
      "LinhUngQuestScene",
      "ChamMuseumQuestScene",
      "NonNuocQuestScene",
      "HanMarketQuestScene",
      "BaNaGoldenBridgeQuestScene",
    ];

    const scenesDir = path.resolve(process.cwd(), "src/client/game/scenes");
    const files = fs
      .readdirSync(scenesDir)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

    const combinedContent = files
      .map((file) => fs.readFileSync(path.join(scenesDir, file), "utf-8"))
      .join("\n");

    for (const key of expectedSceneKeys) {
      expect(
        combinedContent.includes(key),
        `Scene key "${key}" not found in scene files`,
      ).toBe(true);
    }
  });

  it("TC-5.12: Quest state machine functions and signatures untouched", () => {
    expect(typeof applyLandmarkChallengeInput).toBe("function");
    expect(typeof startLandmarkChallenge).toBe("function");
    expect(typeof failLandmarkChallenge).toBe("function");
    expect(typeof createLandmarkChallengeAttempt).toBe("function");

    expect(typeof GameSession.prototype.startQuest).toBe("function");
    expect(typeof GameSession.prototype.completeQuest).toBe("function");
    expect(typeof GameSession.prototype.rewardQuest).toBe("function");
    expect(typeof GameSession.prototype.retryQuest).toBe("function");
    expect(typeof GameSession.prototype.getState).toBe("function");
  });
});
