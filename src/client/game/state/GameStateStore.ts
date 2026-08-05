import {
  createInitialGameState as createDomainInitialGameState,
  hydrateGameState,
  setLanguage as applyLanguage,
  transitionQuest as applyQuestTransition,
  updatePlayerPosition,
  updatePreferences as applyPreferences,
} from "../../../shared/game-state.js";
import type {
  GameState,
  Language,
  QuestStatus,
} from "../../../shared/types.js";

/** V2 carries the ten-landmark campaign. V1 is read once and normalized by
 * the shared migration boundary before being persisted under this key. */
export const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v2";
export const LEGACY_GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v1";
export const DRAGON_BRIDGE_QUEST_ID = "dragon_bridge_lights";
export const DRAGON_BRIDGE_POSTCARD_KEY = "dragon_bridge";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type QuestMutation = {
  previous: QuestStatus;
  current: QuestStatus;
  state: GameState;
};

export type GameStateChange = {
  state: GameState;
  persistence: "debounced" | "immediate";
};

export type GameStateListener = (change: GameStateChange) => void;

const timestamp = (): string => new Date().toISOString();

const cloneState = (state: GameState): GameState => ({
  ...state,
  player: { ...state.player },
  quests: { ...state.quests },
  unlockedPostcards: [...state.unlockedPostcards],
  preferences: {
    ...state.preferences,
    interests: [...state.preferences.interests],
  },
});

const getBrowserStorage = (): StorageLike | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Re-exported client boundary for legacy scene callers; implementation lives in the shared domain. */
export const createInitialGameState = (): GameState =>
  createDomainInitialGameState();

/** Invalid/stale local JSON is normalized by the same reducer used by every scene. */
export const normalizeGameState = (candidate: unknown): GameState =>
  hydrateGameState(candidate);

/**
 * Local persistence is the always-available first store. A Firebase-backed
 * store can mirror it later without allowing scenes to bypass the domain reducer.
 */
export class LocalGameStateStore {
  private pendingSave: ReturnType<typeof setTimeout> | null = null;
  private state: GameState;

  public constructor(
    private readonly storage: StorageLike | null = getBrowserStorage(),
    private readonly playerDebounceMs = 3_500,
  ) {
    this.state = this.read();
  }

  public getState(): GameState {
    return cloneState(this.state);
  }

  public save(nextState: GameState): GameState {
    this.state = { ...normalizeGameState(nextState), updatedAt: timestamp() };
    this.persist();
    return this.getState();
  }

  public scheduleSave(nextState: GameState): GameState {
    this.state = { ...normalizeGameState(nextState), updatedAt: timestamp() };
    if (this.pendingSave) clearTimeout(this.pendingSave);

    this.pendingSave = setTimeout(() => {
      this.pendingSave = null;
      this.persist();
    }, this.playerDebounceMs);

    return this.getState();
  }

  public flush(): GameState {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
    }
    this.persist();
    return this.getState();
  }

  public clear(): void {
    if (this.pendingSave) clearTimeout(this.pendingSave);
    this.pendingSave = null;
    this.state = createInitialGameState();
    try {
      this.storage?.removeItem(GAME_STATE_STORAGE_KEY);
      this.storage?.removeItem(LEGACY_GAME_STATE_STORAGE_KEY);
    } catch {
      // Clearing local state is best effort only.
    }
  }

  public hasPersistedState(): boolean {
    try {
      return (
        this.storage?.getItem(GAME_STATE_STORAGE_KEY) !== null ||
        this.storage?.getItem(LEGACY_GAME_STATE_STORAGE_KEY) !== null
      );
    } catch {
      return false;
    }
  }

  private read(): GameState {
    try {
      const serialized =
        this.storage?.getItem(GAME_STATE_STORAGE_KEY) ??
        this.storage?.getItem(LEGACY_GAME_STATE_STORAGE_KEY);
      return serialized
        ? normalizeGameState(JSON.parse(serialized))
        : createInitialGameState();
    } catch {
      return createInitialGameState();
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(this.state));
      this.storage?.removeItem(LEGACY_GAME_STATE_STORAGE_KEY);
    } catch {
      // Local play continues when browser storage is unavailable or full.
    }
  }
}

export class GameSession {
  private readonly listeners = new Set<GameStateListener>();

  public constructor(private readonly store: LocalGameStateStore) {}

  public getState(): GameState {
    return this.store.getState();
  }

  public hasPersistedState(): boolean {
    return this.store.hasPersistedState();
  }

  public reset(): GameState {
    this.store.clear();
    const state = this.store.getState();
    this.publish(state, "immediate");
    return state;
  }

  public updatePlayer(scene: string, x: number, y: number): GameState {
    const current = this.store.getState();
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    if (
      current.player.scene === scene &&
      current.player.x === roundedX &&
      current.player.y === roundedY
    ) {
      return current;
    }

    const next = updatePlayerPosition(current, { scene, x, y });
    const saved = this.store.scheduleSave(next);
    this.publish(saved, "debounced");
    return saved;
  }

  public flush(): GameState {
    const saved = this.store.flush();
    this.publish(saved, "immediate");
    return saved;
  }

  public setLanguage(language: Language): GameState {
    const saved = this.store.save(
      applyLanguage(this.store.getState(), language),
    );
    this.publish(saved, "immediate");
    return saved;
  }

  public updatePreferences(
    preferences: Partial<GameState["preferences"]>,
  ): GameState {
    const saved = this.store.save(
      applyPreferences(this.store.getState(), preferences),
    );
    this.publish(saved, "immediate");
    return saved;
  }

  /** Applies a reconciled remote state through the same normalized local
   * boundary used for in-game mutations. */
  public replaceState(state: GameState): GameState {
    const saved = this.store.save(state);
    this.publish(saved, "immediate");
    return saved;
  }

  public subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public startQuest(questId: string): QuestMutation | null {
    return this.transitionQuest(questId, "ACTIVE");
  }

  public retryQuest(questId: string): QuestMutation | null {
    return this.transitionQuest(questId, "AVAILABLE");
  }

  public completeQuest(questId: string): QuestMutation | null {
    return this.transitionQuest(questId, "COMPLETED");
  }

  public rewardQuest(questId: string): QuestMutation | null {
    return this.transitionQuest(questId, "REWARDED");
  }

  /** Kept as a readable M3 helper; all side effects still run through rewardQuest. */
  public rewardDragonBridge(): QuestMutation | null {
    return this.rewardQuest(DRAGON_BRIDGE_QUEST_ID);
  }

  private transitionQuest(
    questId: string,
    nextStatus: QuestStatus,
  ): QuestMutation | null {
    const current = this.store.getState();
    const previous = current.quests[questId] ?? "LOCKED";
    const result = applyQuestTransition(current, questId, nextStatus);
    if (!result.ok || !result.changed) return null;

    const state = this.store.save(result.state);
    this.publish(state, "immediate");

    return {
      previous,
      current: state.quests[questId] ?? nextStatus,
      state,
    };
  }

  private publish(
    state: GameState,
    persistence: GameStateChange["persistence"],
  ): void {
    const change: GameStateChange = { state, persistence };
    this.listeners.forEach((listener) => listener(change));
  }
}

export const localGameStateStore = new LocalGameStateStore();
export const gameSession = new GameSession(localGameStateStore);
