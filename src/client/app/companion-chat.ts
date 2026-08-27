import { getDialogueContent } from "../content";
import type { GameState, Language } from "../../shared/types";
import { QUEST_ORDER } from "../../shared/game-state";

export type ChatResult = {
  dialogue: string;
  hint?: string;
  source: "gemini" | "fallback" | "authored";
};

const text = (language: Language, vi: string, en: string): string =>
  language === "vi" ? vi : en;

/** Every canonical quest has an authored dialogue node. Keeping this total
 * mapping beside the companion entry point makes a missing new-landmark hint a
 * type error rather than silently falling back to Dragon Bridge copy. */
export const DIALOGUE_NODE_BY_QUEST: Record<
  (typeof QUEST_ORDER)[number],
  string
> = {
  dragon_bridge_lights: "dragon_bridge_npc",
  my_khe_clean_wave: "my_khe_npc",
  marble_five_elements: "marble_npc",
  son_tra_traces: "son_tra_npc",
  han_river_bridge_turn: "han_river_bridge_guide",
  linh_ung_quiet_path: "linh_ung_guide",
  cham_museum_relic_match: "cham_museum_guide",
  non_nuoc_carving_pattern: "non_nuoc_guide",
  han_market_basket_sort: "han_market_guide",
  ba_na_golden_bridge: "ba_na_guide",
};

/** Prefer a live challenge for a hint, then the one available campaign
 * frontier. The order comes from the canonical game state, never a UI list. */
export const getCompanionQuestId = (
  state: GameState,
): (typeof QUEST_ORDER)[number] | undefined =>
  QUEST_ORDER.find((questId) => state.quests[questId] === "ACTIVE") ??
  QUEST_ORDER.find((questId) => state.quests[questId] === "AVAILABLE");

export const createCompanionChatRequest = (
  state: GameState,
  message: string,
) => {
  const questId = getCompanionQuestId(state);
  return {
    language: state.language,
    message,
    unlockedPostcards: state.unlockedPostcards,
    ...(questId ? { questId } : {}),
  };
};

export const authoredChat = (state: GameState): ChatResult => {
  const questId = getCompanionQuestId(state);
  const npcId = questId ? DIALOGUE_NODE_BY_QUEST[questId] : undefined;
  const node = npcId ? getDialogueContent(state.language, npcId) : undefined;
  return {
    dialogue:
      node?.questPrompt ??
      text(
        state.language,
        "Hãy đến gần một địa danh và nhấn E hoặc Space để bắt đầu thử thách.",
        "Walk to a landmark and press E or Space to begin a challenge.",
      ),
    hint: node?.failureMessage,
    source: "authored",
  };
};
