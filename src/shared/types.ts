export type Language = "vi" | "en";

export type QuestStatus =
  "LOCKED" | "AVAILABLE" | "ACTIVE" | "COMPLETED" | "REWARDED";

export type GameState = {
  version: 1;
  language: Language;
  player: { scene: string; x: number; y: number };
  quests: Record<string, QuestStatus>;
  unlockedPostcards: string[];
  memoryFragments: number;
  preferences: {
    budgetVnd?: number;
    dietary?: "any" | "vegetarian";
    interests: string[];
  };
  updatedAt: string;
};

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
  | { type: "PLAYER_NEAR_INTERACTABLE"; label: string | null };

export type UiToGameEvent =
  | { type: "DIALOGUE_CLOSE" }
  | { type: "POSTCARD_CLOSE" }
  | { type: "SET_LANGUAGE"; language: Language }
  | { type: "START_QUEST"; questId: string }
  | { type: "SET_INPUT_ENABLED"; enabled: boolean };
