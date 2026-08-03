import { INITIAL_QUESTS_STATE, QUESTS, canTransitionQuest } from "./quests.js";
import type { GameState, Language, QuestStatus } from "./types.js";

export const GAME_STATE_VERSION = 1 as const;

export const QUEST_ORDER = [
  "dragon_bridge_lights",
  "my_khe_clean_wave",
  "marble_five_elements",
  "son_tra_traces",
] as const;

export type QuestId = (typeof QUEST_ORDER)[number];

export type GameStateMutation =
  | { ok: true; state: GameState; changed: boolean }
  | { ok: false; state: GameState; changed: false; reason: string };

export type GameStateStore = {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
};

const isQuestId = (value: string): value is QuestId => value in QUESTS;

const isQuestStatus = (value: unknown): value is QuestStatus =>
  value === "LOCKED" ||
  value === "AVAILABLE" ||
  value === "ACTIVE" ||
  value === "COMPLETED" ||
  value === "REWARDED";

const nowIso = () => new Date().toISOString();

const cloneQuests = (
  quests: Record<string, QuestStatus>,
): Record<string, QuestStatus> => ({ ...quests });

export function createInitialGameState(
  language: Language = "vi",
  updatedAt = nowIso(),
): GameState {
  return {
    version: GAME_STATE_VERSION,
    language,
    player: { scene: "OverworldScene", x: 248, y: 772 },
    quests: cloneQuests(INITIAL_QUESTS_STATE),
    unlockedPostcards: [],
    memoryFragments: 0,
    preferences: { interests: [] },
    updatedAt,
  };
}

export function getNextQuestId(questId: QuestId): QuestId | undefined {
  const index = QUEST_ORDER.indexOf(questId);
  return index >= 0 ? QUEST_ORDER[index + 1] : undefined;
}

/** The ending is earned only by the deterministic quest reducer, never by UI
 * state or a model response. */
export function isJourneyComplete(state: GameState): boolean {
  return QUEST_ORDER.every((questId) => state.quests[questId] === "REWARDED");
}

function withUpdatedAt(state: GameState, updatedAt = nowIso()): GameState {
  return { ...state, updatedAt };
}

/**
 * Applies a single deterministic quest-state transition. Reward side effects are
 * intentionally here, rather than in a Gemini response or a Phaser scene.
 */
export function transitionQuest(
  state: GameState,
  questId: string,
  nextStatus: QuestStatus,
  updatedAt = nowIso(),
): GameStateMutation {
  if (!isQuestId(questId)) {
    return { ok: false, state, changed: false, reason: "UNKNOWN_QUEST" };
  }

  const currentStatus = state.quests[questId];
  if (currentStatus === nextStatus) {
    return { ok: true, state, changed: false };
  }

  if (
    !isQuestStatus(currentStatus) ||
    !canTransitionQuest(currentStatus, nextStatus)
  ) {
    return { ok: false, state, changed: false, reason: "INVALID_TRANSITION" };
  }

  const quests = cloneQuests(state.quests);
  quests[questId] = nextStatus;
  let unlockedPostcards = state.unlockedPostcards;
  let memoryFragments = state.memoryFragments;

  if (nextStatus === "REWARDED") {
    const placeKey = QUESTS[questId].landmarkKey;
    if (!unlockedPostcards.includes(placeKey)) {
      unlockedPostcards = [...unlockedPostcards, placeKey];
      memoryFragments += 1;
    }

    const nextQuestId = getNextQuestId(questId);
    if (nextQuestId && quests[nextQuestId] === "LOCKED") {
      quests[nextQuestId] = "AVAILABLE";
    }
  }

  return {
    ok: true,
    changed: true,
    state: {
      ...withUpdatedAt(state, updatedAt),
      quests,
      unlockedPostcards,
      memoryFragments,
    },
  };
}

export function updatePlayerPosition(
  state: GameState,
  player: GameState["player"],
  updatedAt = nowIso(),
): GameState {
  if (
    !Number.isFinite(player.x) ||
    !Number.isFinite(player.y) ||
    player.scene.trim().length === 0
  ) {
    return state;
  }

  return {
    ...withUpdatedAt(state, updatedAt),
    player: {
      scene: player.scene,
      x: Math.round(player.x),
      y: Math.round(player.y),
    },
  };
}

export function updatePreferences(
  state: GameState,
  preferences: Partial<GameState["preferences"]>,
  updatedAt = nowIso(),
): GameState {
  const budgetVnd = preferences.budgetVnd;
  const safeBudget =
    typeof budgetVnd === "number" && Number.isFinite(budgetVnd) && budgetVnd > 0
      ? Math.round(budgetVnd)
      : state.preferences.budgetVnd;
  const dietary =
    preferences.dietary === "any" || preferences.dietary === "vegetarian"
      ? preferences.dietary
      : state.preferences.dietary;
  const interests = preferences.interests
    ? [
        ...new Set(
          preferences.interests
            .filter((interest) => interest.trim().length > 0)
            .map((interest) => interest.trim()),
        ),
      ].slice(0, 12)
    : state.preferences.interests;

  return {
    ...withUpdatedAt(state, updatedAt),
    preferences: {
      ...(safeBudget === undefined ? {} : { budgetVnd: safeBudget }),
      ...(dietary === undefined ? {} : { dietary }),
      interests,
    },
  };
}

export function setLanguage(
  state: GameState,
  language: Language,
  updatedAt = nowIso(),
): GameState {
  return state.language === language
    ? state
    : { ...withUpdatedAt(state, updatedAt), language };
}

/**
 * Accepts persisted JSON defensively. This is a migration boundary, not a game
 * authority: invalid values fall back to the first-run state instead of blocking play.
 */
export function hydrateGameState(
  value: unknown,
  fallbackLanguage: Language = "vi",
): GameState {
  const fallback = createInitialGameState(fallbackLanguage);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<GameState>;
  if (candidate.version !== GAME_STATE_VERSION) {
    return fallback;
  }

  const language: Language = candidate.language === "en" ? "en" : "vi";
  const quests = cloneQuests(INITIAL_QUESTS_STATE);
  if (candidate.quests && typeof candidate.quests === "object") {
    for (const questId of QUEST_ORDER) {
      const status = candidate.quests[questId];
      if (isQuestStatus(status)) {
        quests[questId] = status;
      }
    }
  }

  // The campaign is intentionally linear. A stale or hand-edited save cannot
  // jump to a later mini-game before the preceding reward has been earned.
  for (let index = 1; index < QUEST_ORDER.length; index += 1) {
    const previousQuest = QUEST_ORDER[index - 1];
    const questId = QUEST_ORDER[index];
    if (quests[previousQuest] !== "REWARDED") {
      quests[questId] = "LOCKED";
    }
  }

  const rewardedPlaceKeys = QUEST_ORDER.filter(
    (questId) => quests[questId] === "REWARDED",
  ).map((questId) => QUESTS[questId].landmarkKey);
  const requestedPostcards = Array.isArray(candidate.unlockedPostcards)
    ? candidate.unlockedPostcards.filter(
        (placeKey): placeKey is string => typeof placeKey === "string",
      )
    : [];
  const unlockedPostcards = rewardedPlaceKeys.filter((placeKey) =>
    requestedPostcards.includes(placeKey),
  );

  const rawPlayer = candidate.player;
  const player = {
    scene:
      rawPlayer &&
      typeof rawPlayer.scene === "string" &&
      rawPlayer.scene.trim().length > 0
        ? rawPlayer.scene
        : fallback.player.scene,
    x:
      rawPlayer && Number.isFinite(rawPlayer.x)
        ? Math.round(rawPlayer.x)
        : fallback.player.x,
    y:
      rawPlayer && Number.isFinite(rawPlayer.y)
        ? Math.round(rawPlayer.y)
        : fallback.player.y,
  };

  const rawPreferences = candidate.preferences;
  const preferences = {
    ...(rawPreferences &&
    typeof rawPreferences.budgetVnd === "number" &&
    rawPreferences.budgetVnd > 0
      ? { budgetVnd: Math.round(rawPreferences.budgetVnd) }
      : {}),
    ...(rawPreferences?.dietary === "any" ||
    rawPreferences?.dietary === "vegetarian"
      ? { dietary: rawPreferences.dietary }
      : {}),
    interests: Array.isArray(rawPreferences?.interests)
      ? [
          ...new Set(
            rawPreferences.interests.filter(
              (interest): interest is string => typeof interest === "string",
            ),
          ),
        ].slice(0, 12)
      : [],
  };

  return {
    version: GAME_STATE_VERSION,
    language,
    player,
    quests,
    unlockedPostcards,
    memoryFragments: unlockedPostcards.length,
    preferences,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : fallback.updatedAt,
  };
}
