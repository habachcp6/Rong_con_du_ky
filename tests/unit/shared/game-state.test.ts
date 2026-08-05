import { describe, expect, it } from "vitest";
import {
  QUEST_ORDER,
  createInitialGameState,
  hydrateGameState,
  isJourneyComplete,
  transitionQuest,
  updatePlayerPosition,
  updatePreferences,
} from "../../../src/shared/game-state.js";
import {
  LANDMARK_GAME_DEFINITION_COUNT,
  LANDMARK_GAME_DEFINITIONS,
  getLandmarkGameDefinitionByLocationKey,
  getLandmarkGameDefinitionByQuestId,
  validateLandmarkGameDefinitions,
  type LandmarkGameDefinition,
} from "../../../src/shared/landmark-game-definitions.js";

describe("game-state domain", () => {
  it("defines one canonical landmark binding for every campaign quest", () => {
    expect(QUEST_ORDER).toEqual([
      "dragon_bridge_lights",
      "my_khe_clean_wave",
      "marble_five_elements",
      "son_tra_traces",
      "han_river_bridge_turn",
      "linh_ung_quiet_path",
      "cham_museum_relic_match",
      "non_nuoc_carving_pattern",
      "han_market_basket_sort",
      "ba_na_golden_bridge",
    ]);
    expect(LANDMARK_GAME_DEFINITIONS).toHaveLength(10);
    expect(
      new Set(
        LANDMARK_GAME_DEFINITIONS.map((definition) => definition.locationKey),
      ).size,
    ).toBe(10);
    expect(
      new Set(LANDMARK_GAME_DEFINITIONS.map((definition) => definition.questId))
        .size,
    ).toBe(10);
    expect(
      new Set(
        LANDMARK_GAME_DEFINITIONS.map(
          (definition) => definition.mapIconAssetId,
        ),
      ).size,
    ).toBe(10);
    expect(
      new Set(
        LANDMARK_GAME_DEFINITIONS.map(
          (definition) => definition.postcardAssetId,
        ),
      ).size,
    ).toBe(10);

    for (const definition of LANDMARK_GAME_DEFINITIONS) {
      expect(definition.mapIconAssetId).toBe(
        `landmark_icon_${definition.locationKey}`,
      );
      expect(definition.postcardAssetId).toBe(
        `landmark_${definition.locationKey}`,
      );
      expect(getLandmarkGameDefinitionByQuestId(definition.questId)).toBe(
        definition,
      );
      expect(
        getLandmarkGameDefinitionByLocationKey(definition.locationKey),
      ).toBe(definition);
    }
  });

  it("validates canonical landmark bindings", () => {
    expect(validateLandmarkGameDefinitions()).toEqual({
      valid: true,
      errors: [],
    });

    const copyDefinitions = (): LandmarkGameDefinition[] =>
      LANDMARK_GAME_DEFINITIONS.map((definition) => ({
        ...definition,
        mapPosition: { ...definition.mapPosition },
      }));

    const missingFields = copyDefinitions();
    missingFields[0] = {
      ...missingFields[0],
      locationKey: "",
      questId: "",
      sceneKey: "",
      mapIconAssetId: "",
      postcardAssetId: "",
      mechanicId: "",
    };
    const missingResult = validateLandmarkGameDefinitions(missingFields);
    expect(missingResult.valid).toBe(false);
    for (const field of [
      "locationKey",
      "questId",
      "sceneKey",
      "mapIconAssetId",
      "postcardAssetId",
      "mechanicId",
    ]) {
      expect(missingResult.errors.join("\n")).toContain(`missing ${field}`);
    }

    const duplicateAndShort = copyDefinitions().slice(0, -1);
    duplicateAndShort[1] = {
      ...duplicateAndShort[1],
      locationKey: duplicateAndShort[0].locationKey,
      questId: duplicateAndShort[0].questId,
      sceneKey: duplicateAndShort[0].sceneKey,
      mapIconAssetId: duplicateAndShort[2].mapIconAssetId,
      postcardAssetId: duplicateAndShort[2].postcardAssetId,
      mechanicId: duplicateAndShort[0].mechanicId,
    };
    const duplicateResult = validateLandmarkGameDefinitions(duplicateAndShort);
    expect(duplicateResult.valid).toBe(false);
    expect(duplicateResult.errors.join("\n")).toContain(
      `Expected ${LANDMARK_GAME_DEFINITION_COUNT} landmark game definitions`,
    );
    for (const field of [
      "locationKey",
      "questId",
      "sceneKey",
      "mapIconAssetId",
      "postcardAssetId",
      "mechanicId",
    ]) {
      expect(duplicateResult.errors.join("\n")).toContain(
        `duplicates ${field}`,
      );
    }
    expect(duplicateResult.errors.join("\n")).toContain(
      "mapIconAssetId must be",
    );
    expect(duplicateResult.errors.join("\n")).toContain(
      "postcardAssetId must be",
    );
  });

  it("starts the V2 campaign with all quests available", () => {
    const initial = createInitialGameState("vi", "2026-08-03T00:00:00.000Z");

    expect(initial.version).toBe(2);
    expect(Object.keys(initial.quests)).toEqual([...QUEST_ORDER]);
    expect(
      QUEST_ORDER.every((questId) => initial.quests[questId] === "AVAILABLE"),
    ).toBe(true);
  });

  it("awards a memory fragment once and unlocks only the next quest", () => {
    const initial = createInitialGameState("vi", "2026-08-03T00:00:00.000Z");
    const active = transitionQuest(
      initial,
      "dragon_bridge_lights",
      "ACTIVE",
      "2026-08-03T00:01:00.000Z",
    );
    const completed = active.ok
      ? transitionQuest(
          active.state,
          "dragon_bridge_lights",
          "COMPLETED",
          "2026-08-03T00:02:00.000Z",
        )
      : active;
    const rewarded = completed.ok
      ? transitionQuest(
          completed.state,
          "dragon_bridge_lights",
          "REWARDED",
          "2026-08-03T00:03:00.000Z",
        )
      : completed;

    expect(rewarded.ok).toBe(true);
    if (!rewarded.ok) return;
    expect(rewarded.state.memoryFragments).toBe(1);
    expect(rewarded.state.unlockedPostcards).toEqual(["dragon_bridge"]);
    expect(rewarded.state.quests.my_khe_clean_wave).toBe("AVAILABLE");

    const repeatedReward = transitionQuest(
      rewarded.state,
      "dragon_bridge_lights",
      "REWARDED",
    );
    expect(repeatedReward).toMatchObject({ ok: true, changed: false });
    expect(repeatedReward.state.memoryFragments).toBe(1);
  });

  it("rejects a skipped quest transition without mutating state", () => {
    const initial = createInitialGameState();
    const result = transitionQuest(
      initial,
      "dragon_bridge_lights",
      "COMPLETED",
    );

    expect(result).toMatchObject({
      ok: false,
      changed: false,
      reason: "INVALID_TRANSITION",
      state: initial,
    });
  });

  it("sanitizes persisted state and preserves valid local preferences", () => {
    const hydrated = hydrateGameState({
      version: 1,
      language: "en",
      player: { scene: "OverworldScene", x: 12.7, y: 30.2 },
      quests: {
        dragon_bridge_lights: "REWARDED",
        my_khe_clean_wave: "AVAILABLE",
      },
      unlockedPostcards: ["dragon_bridge", "forged"],
      memoryFragments: 999,
      preferences: {
        budgetVnd: 50001.2,
        dietary: "vegetarian",
        interests: ["food", "food", 12],
      },
      updatedAt: "2026-08-03T00:00:00.000Z",
    });

    expect(hydrated.player).toEqual({ scene: "OverworldScene", x: 13, y: 30 });
    expect(hydrated.unlockedPostcards).toEqual(["dragon_bridge"]);
    expect(hydrated.memoryFragments).toBe(1);
    expect(hydrated.preferences).toEqual({
      budgetVnd: 50001,
      dietary: "vegetarian",
      interests: ["food"],
    });
    expect(hydrated.version).toBe(2);
    expect(hydrated.quests.han_river_bridge_turn).toBe("AVAILABLE");
  });

  it("migrates contiguous V1 rewards without losing earned postcards", () => {
    const migrated = hydrateGameState({
      version: 1,
      language: "en",
      player: { scene: "OverworldScene", x: 320, y: 480 },
      quests: {
        dragon_bridge_lights: "REWARDED",
        my_khe_clean_wave: "REWARDED",
        marble_five_elements: "REWARDED",
        son_tra_traces: "REWARDED",
      },
      unlockedPostcards: [
        "dragon_bridge",
        "my_khe_beach",
        "marble_mountains",
        "son_tra_peninsula",
      ],
      memoryFragments: 4,
      preferences: { interests: ["heritage"] },
      updatedAt: "2026-08-03T00:00:00.000Z",
    });

    expect(migrated).toMatchObject({
      version: 2,
      language: "en",
      player: { scene: "OverworldScene", x: 320, y: 480 },
      preferences: { interests: ["heritage"] },
      memoryFragments: 4,
      unlockedPostcards: [
        "dragon_bridge",
        "my_khe_beach",
        "marble_mountains",
        "son_tra_peninsula",
      ],
    });
    expect(
      QUEST_ORDER.slice(0, 4).every(
        (questId) => migrated.quests[questId] === "REWARDED",
      ),
    ).toBe(true);
    expect(migrated.quests.han_river_bridge_turn).toBe("AVAILABLE");
    expect(
      QUEST_ORDER.slice(5).every(
        (questId) => migrated.quests[questId] === "AVAILABLE",
      ),
    ).toBe(true);
  });

  it("does not let a V1 save pre-unlock future campaign rewards", () => {
    const migrated = hydrateGameState({
      version: 1,
      quests: {
        dragon_bridge_lights: "REWARDED",
        my_khe_clean_wave: "REWARDED",
        marble_five_elements: "REWARDED",
        son_tra_traces: "REWARDED",
        han_river_bridge_turn: "REWARDED",
      },
    });

    expect(migrated.quests.han_river_bridge_turn).toBe("AVAILABLE");
    expect(migrated.memoryFragments).toBe(4);
    expect(migrated.unlockedPostcards).not.toContain("han_river_bridge");
  });

  it("does not accept an invalid player write and debounces data at the caller boundary", () => {
    const initial = createInitialGameState();
    expect(updatePlayerPosition(initial, { scene: "", x: 0, y: 0 })).toBe(
      initial,
    );
    expect(
      updatePreferences(initial, { interests: ["beach", " beach ", ""] })
        .preferences.interests,
    ).toEqual(["beach"]);
  });

  it("unlocks the ending only after every deterministic reward", () => {
    let state = createInitialGameState("vi", "2026-08-03T00:00:00.000Z");
    expect(isJourneyComplete(state)).toBe(false);

    for (const questId of QUEST_ORDER) {
      const active = transitionQuest(state, questId, "ACTIVE");
      expect(active.ok).toBe(true);
      if (!active.ok) return;
      const completed = transitionQuest(active.state, questId, "COMPLETED");
      expect(completed.ok).toBe(true);
      if (!completed.ok) return;
      const rewarded = transitionQuest(completed.state, questId, "REWARDED");
      expect(rewarded.ok).toBe(true);
      if (!rewarded.ok) return;
      state = rewarded.state;
    }

    expect(state.memoryFragments).toBe(10);
    expect(isJourneyComplete(state)).toBe(true);
  });
});
