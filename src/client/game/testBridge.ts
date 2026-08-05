import { bridge } from "../app/PhaserBridge";
import { gameSession, type QuestMutation } from "./state/GameStateStore";
import { QUEST_INTERACTABLES } from "./world";
import { QUESTS } from "../../shared/quests";
import type { GameState } from "../../shared/types";

export type GameTestBridge = Readonly<{
  version: "2";
  getState(): GameState;
  teleportTo(placeKey: string): boolean;
  startQuest(questId: string): boolean;
  completeQuest(questId: string): boolean;
}>;

declare global {
  interface Window {
    __GAME_TEST__?: GameTestBridge;
  }
}

const publishQuestMutation = (questId: string, mutation: QuestMutation) => {
  bridge.emitGameToUi({
    type: "QUEST_UPDATED",
    questId,
    state: mutation.current,
  });
  if (mutation.current === "REWARDED") {
    const placeKey = QUESTS[questId]?.landmarkKey;
    if (placeKey) {
      bridge.emitGameToUi({ type: "POSTCARD_UNLOCKED", placeKey });
    }
  }
};

const applyQuestMutation = (
  questId: string,
  mutate: () => QuestMutation | null,
): boolean => {
  const mutation = mutate();
  if (!mutation) return false;
  publishQuestMutation(questId, mutation);
  return true;
};

/**
 * A deliberately narrow automation boundary for local Vite E2E only. It uses
 * the same deterministic reducer as gameplay and is dynamically imported only
 * when `VITE_ENABLE_E2E_BRIDGE=true` in a development build.
 */
export const installGameTestBridge = (): (() => void) => {
  const api: GameTestBridge = Object.freeze({
    version: "2",
    getState: () => gameSession.getState(),
    teleportTo: (placeKey) => {
      const destination = QUEST_INTERACTABLES.find(
        (interactable) => interactable.placeKey === placeKey,
      );
      if (!destination) return false;

      gameSession.updatePlayer("OverworldScene", destination.x, destination.y);
      gameSession.flush();
      bridge.emitGameToUi({
        type: "PLAYER_NEAR_INTERACTABLE",
        label: destination.label,
      });
      return true;
    },
    startQuest: (questId) =>
      applyQuestMutation(questId, () => gameSession.startQuest(questId)),
    completeQuest: (questId) => {
      // Test automation may advance a currently eligible quest, but it cannot
      // bypass the production reducer or reward a locked/later quest.
      for (let step = 0; step < 3; step += 1) {
        const status = gameSession.getState().quests[questId];
        if (status === "REWARDED") return true;
        const advanced =
          status === "AVAILABLE"
            ? applyQuestMutation(questId, () => gameSession.startQuest(questId))
            : status === "ACTIVE"
              ? applyQuestMutation(questId, () =>
                  gameSession.completeQuest(questId),
                )
              : status === "COMPLETED"
                ? applyQuestMutation(questId, () =>
                    gameSession.rewardQuest(questId),
                  )
                : false;
        if (!advanced) return false;
      }
      return gameSession.getState().quests[questId] === "REWARDED";
    },
  });

  window.__GAME_TEST__ = api;
  return () => {
    if (window.__GAME_TEST__ === api) {
      delete window.__GAME_TEST__;
    }
  };
};
