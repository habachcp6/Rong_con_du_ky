export type Language = "vi" | "en";

export type QuestStatus =
  "LOCKED" | "AVAILABLE" | "ACTIVE" | "COMPLETED" | "REWARDED";

export type GamePlayerPosition = { scene: string; x: number; y: number };

export type GamePreferences = {
  budgetVnd?: number;
  dietary?: "any" | "vegetarian";
  interests: string[];
};

type GameStateFields = {
  language: Language;
  player: GamePlayerPosition;
  quests: Record<string, QuestStatus>;
  unlockedPostcards: string[];
  memoryFragments: number;
  preferences: GamePreferences;
  updatedAt: string;
};

/** The persisted shape used by the original four-landmark campaign. */
export type GameStateV1 = GameStateFields & {
  version: 1;
};

/** The normalized ten-landmark campaign state used by all current callers. */
export type GameState = GameStateFields & {
  version: 2;
};

export type PersistedGameState = GameStateV1 | GameState;

export type PlaceCard = {
  /** A verified Google Place ID is optional in Starter; never persist card data. */
  placeId: string | null;
  placeIdStatus: "verified" | "unverified";
  landmarkKey: string;
  name: string;
  description: string;
  address: string;
  priceRange: string;
  dietary: "any" | "vegetarian";
  googleMapsUri: string;
  sourceIds: string[];
};

export type GameToUiEvent =
  | { type: "DIALOGUE_OPEN"; npcId: string; nodeId: string }
  | { type: "QUEST_UPDATED"; questId: string; state: QuestStatus }
  | { type: "POSTCARD_UNLOCKED"; placeKey: string }
  | { type: "PLAYER_NEAR_INTERACTABLE"; label: string | null }
  | { type: "OVERWORLD_READY" }
  | { type: "OPEN_LANDMARK_DETAIL"; locationKey: string }
  | {
      type: "LANDMARK_CHALLENGE_OPEN";
      questId: string;
      placeKey: string;
    };

export type UiToGameEvent =
  | { type: "DIALOGUE_CLOSE" }
  | { type: "POSTCARD_CLOSE" }
  | { type: "SET_LANGUAGE"; language: Language }
  | { type: "START_QUEST"; questId: string }
  | {
      type: "OPEN_LANDMARK_CHALLENGE";
      questId: string;
      placeKey: string;
    }
  | { type: "SET_INPUT_ENABLED"; enabled: boolean };
