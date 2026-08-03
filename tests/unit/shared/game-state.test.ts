import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  hydrateGameState,
  isJourneyComplete,
  transitionQuest,
  updatePlayerPosition,
  updatePreferences,
} from "../../../src/shared/game-state.js";

describe("game-state domain", () => {
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

    for (const questId of [
      "dragon_bridge_lights",
      "my_khe_clean_wave",
      "marble_five_elements",
      "son_tra_traces",
    ]) {
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

    expect(state.memoryFragments).toBe(4);
    expect(isJourneyComplete(state)).toBe(true);
  });
});
