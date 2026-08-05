import { describe, expect, it } from "vitest";
import {
  authoredChat,
  createCompanionChatRequest,
  getCompanionQuestId,
} from "../../../src/client/app/TravelToolsPanel.js";
import {
  createInitialGameState,
  QUEST_ORDER,
} from "../../../src/shared/game-state.js";
import { LANDMARK_GAME_DEFINITIONS } from "../../../src/shared/landmark-game-definitions.js";

const EXPECTED_DIALOGUE_MARKERS = [
  ["dragon_bridge_lights", "ít nhất 7 trong 10 nhịp"],
  ["my_khe_clean_wave", "tám vật thể rác"],
  ["marble_five_elements", "Kim, Mộc, Thủy, Hỏa và Thổ"],
  ["son_tra_traces", "ba dấu vết"],
  ["han_river_bridge_turn", "bốn nhịp cầu"],
  ["linh_ung_quiet_path", "năm điểm dừng"],
  ["cham_museum_relic_match", "bốn motif"],
  ["non_nuoc_carving_pattern", "sáu nét đục"],
  ["han_market_basket_sort", "tám vật phẩm"],
  ["ba_na_golden_bridge", "6 tile"],
] as const;

const stateAtAvailableQuest = (targetQuestId: (typeof QUEST_ORDER)[number]) => {
  const targetIndex = QUEST_ORDER.indexOf(targetQuestId);
  const state = createInitialGameState("vi", "2026-08-04T00:00:00.000Z");

  QUEST_ORDER.forEach((questId, index) => {
    state.quests[questId] =
      index < targetIndex
        ? "REWARDED"
        : index === targetIndex
          ? "AVAILABLE"
          : "LOCKED";
  });
  state.unlockedPostcards = LANDMARK_GAME_DEFINITIONS.slice(0, targetIndex).map(
    ({ locationKey }) => locationKey,
  );
  state.memoryFragments = targetIndex;
  return state;
};

describe("Journey companion landmark dialogue", () => {
  it("selects every canonical available frontier and its authored dialogue", () => {
    for (const [questId, expectedMarker] of EXPECTED_DIALOGUE_MARKERS) {
      const state = stateAtAvailableQuest(questId);

      expect(getCompanionQuestId(state)).toBe(questId);
      expect(authoredChat(state)).toMatchObject({
        source: "authored",
        dialogue: expect.stringContaining(expectedMarker),
      });
    }
  });

  it("includes the active or available canonical quest in the chat request", () => {
    const state = stateAtAvailableQuest("han_market_basket_sort");

    expect(createCompanionChatRequest(state, "Cho mình một gợi ý")).toEqual({
      language: "vi",
      message: "Cho mình một gợi ý",
      unlockedPostcards: [
        "dragon_bridge",
        "my_khe_beach",
        "marble_mountains",
        "son_tra_peninsula",
        "han_river_bridge",
        "linh_ung_son_tra",
        "cham_museum",
        "non_nuoc_stone_village",
      ],
      questId: "han_market_basket_sort",
    });

    state.quests.han_market_basket_sort = "ACTIVE";
    expect(getCompanionQuestId(state)).toBe("han_market_basket_sort");
  });
});
