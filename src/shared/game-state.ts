import {
  LANDMARK_GAME_DEFINITIONS,
  getLandmarkGameDefinitionByQuestId,
  type LandmarkQuestId,
} from "./landmark-game-definitions.js";
import { INITIAL_QUESTS_STATE, canTransitionQuest } from "./quests.js";
import type { GameState, Language, QuestStatus } from "./types.js";

export const GAME_STATE_VERSION = 2 as const;
export const LEGACY_GAME_STATE_VERSION = 1 as const;

/** The campaign order is derived from the canonical landmark/game bindings. */
export const QUEST_ORDER: readonly LandmarkQuestId[] =
  LANDMARK_GAME_DEFINITIONS.map((definition) => definition.questId);

/** V1 stored only the original Dragon Bridge through Son Tra vertical slice. */
export const LEGACY_QUEST_ORDER: readonly LandmarkQuestId[] = QUEST_ORDER.slice(
  0,
  4,
);

export type QuestId = LandmarkQuestId;

export type GameStateMutation =
  | { ok: true; state: GameState; changed: boolean }
  | { ok: false; state: GameState; changed: false; reason: string };

export type GameStateStore = {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
};

type PersistedStateCandidate = Partial<Omit<GameState, "version">> & {
  version?: unknown;
  quests?: unknown;
  unlockedPostcards?: unknown;
  player?: unknown;
  preferences?: unknown;
  updatedAt?: unknown;
  language?: unknown;
};

const isQuestId = (value: string): value is QuestId =>
  getLandmarkGameDefinitionByQuestId(value) !== undefined;

const isQuestStatus = (value: unknown): value is QuestStatus =>
  value === "LOCKED" ||
  value === "AVAILABLE" ||
  value === "ACTIVE" ||
  value === "COMPLETED" ||
  value === "REWARDED";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

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
    player: { scene: "OverworldScene", x: 830, y: 630 },
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
    const placeKey = getLandmarkGameDefinitionByQuestId(questId)?.locationKey;
    if (placeKey && !unlockedPostcards.includes(placeKey)) {
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
 * Reduces persisted quest input to one contiguous campaign frontier: every
 * leading reward survives, the next unfinished quest remains actionable, and
 * every later quest is locked. This makes V1-to-V2 migration safe while also
 * rejecting hand-edited jumps into new destinations.
 */
function normalizeCampaignQuests(
  rawQuests: unknown,
  allowedQuestIds: readonly QuestId[],
): Record<string, QuestStatus> {
  const source = isRecord(rawQuests) ? rawQuests : {};
  const allowed = new Set<string>(allowedQuestIds);
  const quests = cloneQuests(INITIAL_QUESTS_STATE);

  for (const questId of QUEST_ORDER) {
    const rawStatus = allowed.has(questId) ? source[questId] : undefined;
    if (rawStatus === "REWARDED") {
      quests[questId] = "REWARDED";
    } else if (
      rawStatus === "AVAILABLE" ||
      rawStatus === "ACTIVE" ||
      rawStatus === "COMPLETED"
    ) {
      quests[questId] = rawStatus;
    } else {
      quests[questId] = "AVAILABLE";
    }
  }

  return quests;
}

function normalizeGameStateCandidate(
  candidate: PersistedStateCandidate,
  fallbackLanguage: Language,
  allowedQuestIds: readonly QuestId[],
): GameState {
  const fallback = createInitialGameState(fallbackLanguage);
  const language: Language = candidate.language === "en" ? "en" : "vi";
  const quests = normalizeCampaignQuests(candidate.quests, allowedQuestIds);
  const unlockedPostcards = QUEST_ORDER.flatMap((questId) => {
    if (quests[questId] !== "REWARDED") return [];
    const definition = getLandmarkGameDefinitionByQuestId(questId);
    return definition ? [definition.locationKey] : [];
  });

  const rawPlayer = isRecord(candidate.player) ? candidate.player : undefined;
  const player = {
    scene:
      typeof rawPlayer?.scene === "string" && rawPlayer.scene.trim().length > 0
        ? rawPlayer.scene
        : fallback.player.scene,
    x:
      typeof rawPlayer?.x === "number" && Number.isFinite(rawPlayer.x)
        ? Math.round(rawPlayer.x)
        : fallback.player.x,
    y:
      typeof rawPlayer?.y === "number" && Number.isFinite(rawPlayer.y)
        ? Math.round(rawPlayer.y)
        : fallback.player.y,
  };

  const rawPreferences = isRecord(candidate.preferences)
    ? candidate.preferences
    : undefined;
  const preferences = {
    ...(typeof rawPreferences?.budgetVnd === "number" &&
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

/**
 * Migrates the persisted four-quest campaign to V2. Only V1's original quest
 * fields are read, so a hand-edited V1 save cannot grant future rewards.
 */
export function migrateGameStateV1(
  value: unknown,
  fallbackLanguage: Language = "vi",
): GameState {
  if (!isRecord(value) || value.version !== LEGACY_GAME_STATE_VERSION) {
    return createInitialGameState(fallbackLanguage);
  }

  return normalizeGameStateCandidate(
    value as PersistedStateCandidate,
    fallbackLanguage,
    LEGACY_QUEST_ORDER,
  );
}

/**
 * Accepts persisted JSON defensively. This is a migration boundary, not a game
 * authority: invalid values fall back to the first-run state instead of blocking play.
 */
export function hydrateGameState(
  value: unknown,
  fallbackLanguage: Language = "vi",
): GameState {
  if (!isRecord(value)) return createInitialGameState(fallbackLanguage);

  if (value.version === LEGACY_GAME_STATE_VERSION) {
    return migrateGameStateV1(value, fallbackLanguage);
  }
  if (value.version !== GAME_STATE_VERSION) {
    return createInitialGameState(fallbackLanguage);
  }

  return normalizeGameStateCandidate(
    value as PersistedStateCandidate,
    fallbackLanguage,
    QUEST_ORDER,
  );
}
