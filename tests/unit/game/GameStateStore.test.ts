import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DRAGON_BRIDGE_POSTCARD_KEY,
  DRAGON_BRIDGE_QUEST_ID,
  GAME_STATE_STORAGE_KEY,
  LEGACY_GAME_STATE_STORAGE_KEY,
  GameSession,
  LocalGameStateStore,
  createInitialGameState,
  normalizeGameState,
  type StorageLike,
} from "../../../src/client/game/state/GameStateStore.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("LocalGameStateStore", () => {
  it("keeps deterministic Dragon Bridge transitions and rewards one fragment only once", () => {
    const storage = new MemoryStorage();
    const session = new GameSession(new LocalGameStateStore(storage, 1));

    expect(session.startQuest(DRAGON_BRIDGE_QUEST_ID)?.current).toBe("ACTIVE");
    expect(session.completeQuest(DRAGON_BRIDGE_QUEST_ID)?.current).toBe(
      "COMPLETED",
    );
    expect(session.rewardDragonBridge()?.current).toBe("REWARDED");
    expect(session.rewardDragonBridge()).toBeNull();

    const state = session.getState();
    expect(state.memoryFragments).toBe(1);
    expect(state.unlockedPostcards).toEqual([DRAGON_BRIDGE_POSTCARD_KEY]);
    expect(state.quests[DRAGON_BRIDGE_QUEST_ID]).toBe("REWARDED");

    const rehydrated = new GameSession(
      new LocalGameStateStore(storage, 1),
    ).getState();
    expect(rehydrated.quests[DRAGON_BRIDGE_QUEST_ID]).toBe("REWARDED");
    expect(rehydrated.unlockedPostcards).toEqual([DRAGON_BRIDGE_POSTCARD_KEY]);
    expect(rehydrated.memoryFragments).toBe(1);
  });

  it("allows the documented ACTIVE to AVAILABLE retry before a new attempt", () => {
    const session = new GameSession(
      new LocalGameStateStore(new MemoryStorage(), 1),
    );

    session.startQuest(DRAGON_BRIDGE_QUEST_ID);
    expect(session.retryQuest(DRAGON_BRIDGE_QUEST_ID)?.current).toBe(
      "AVAILABLE",
    );
    expect(session.startQuest(DRAGON_BRIDGE_QUEST_ID)?.current).toBe("ACTIVE");
  });

  it("debounces position persistence and preserves the latest coordinates", () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const session = new GameSession(new LocalGameStateStore(storage, 300));

    session.updatePlayer("OverworldScene", 320, 480);
    session.updatePlayer("OverworldScene", 360, 520);

    expect(storage.getItem(GAME_STATE_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(300);

    const persisted = JSON.parse(
      storage.getItem(GAME_STATE_STORAGE_KEY) ?? "{}",
    ) as ReturnType<typeof createInitialGameState>;
    expect(persisted.player).toEqual({
      scene: "OverworldScene",
      x: 360,
      y: 520,
    });
  });

  it("falls back safely when stored JSON is malformed or incompatible", () => {
    const expected = createInitialGameState();
    const actual = normalizeGameState({ version: 99 });
    expect({ ...actual, updatedAt: expected.updatedAt }).toEqual(expected);
    expect(
      normalizeGameState({
        version: 1,
        language: "vi",
        player: { scene: "OverworldScene", x: Number.NaN, y: 12 },
        quests: { [DRAGON_BRIDGE_QUEST_ID]: "not-a-state" },
        unlockedPostcards: ["dragon_bridge", "dragon_bridge", 42],
      }),
    ).toMatchObject({
      player: { x: 830, y: 12 },
      quests: { [DRAGON_BRIDGE_QUEST_ID]: "AVAILABLE" },
      unlockedPostcards: [],
      memoryFragments: 0,
    });
  });

  it("reads a V1 local save once, normalizes it to V2, and removes the legacy key on persist", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_GAME_STATE_STORAGE_KEY,
      JSON.stringify({
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
        updatedAt: "2026-08-04T00:00:00.000Z",
      }),
    );

    const store = new LocalGameStateStore(storage, 1);
    const migrated = store.getState();
    expect(migrated.version).toBe(2);
    expect(migrated.memoryFragments).toBe(4);
    expect(migrated.quests.han_river_bridge_turn).toBe("AVAILABLE");

    store.flush();
    expect(storage.getItem(GAME_STATE_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(LEGACY_GAME_STATE_STORAGE_KEY)).toBeNull();
  });

  it("unlocks the next quest only through the shared deterministic reward reducer", () => {
    const session = new GameSession(
      new LocalGameStateStore(new MemoryStorage(), 1),
    );

    session.startQuest(DRAGON_BRIDGE_QUEST_ID);
    session.completeQuest(DRAGON_BRIDGE_QUEST_ID);
    session.rewardQuest(DRAGON_BRIDGE_QUEST_ID);

    expect(session.getState().quests.my_khe_clean_wave).toBe("AVAILABLE");
  });

  it("keeps a completed quest recoverable to its one-time reward after interruption", () => {
    const storage = new MemoryStorage();
    const session = new GameSession(new LocalGameStateStore(storage, 1));

    session.startQuest(DRAGON_BRIDGE_QUEST_ID);
    session.completeQuest(DRAGON_BRIDGE_QUEST_ID);
    const restored = new GameSession(new LocalGameStateStore(storage, 1));

    expect(restored.getState().quests[DRAGON_BRIDGE_QUEST_ID]).toBe(
      "COMPLETED",
    );
    expect(restored.rewardQuest(DRAGON_BRIDGE_QUEST_ID)?.current).toBe(
      "REWARDED",
    );
    expect(restored.rewardQuest(DRAGON_BRIDGE_QUEST_ID)).toBeNull();
    expect(restored.getState().memoryFragments).toBe(1);
  });

  it("persists language and preferences through the same local state boundary", () => {
    const session = new GameSession(
      new LocalGameStateStore(new MemoryStorage(), 1),
    );

    session.setLanguage("en");
    session.updatePreferences({
      budgetVnd: 150_000,
      dietary: "vegetarian",
      interests: ["beach", "food"],
    });

    expect(session.getState()).toMatchObject({
      language: "en",
      preferences: {
        budgetVnd: 150_000,
        dietary: "vegetarian",
        interests: ["beach", "food"],
      },
    });
  });

  it("exposes save availability and resets a new game through the session boundary", () => {
    const storage = new MemoryStorage();
    const session = new GameSession(new LocalGameStateStore(storage, 1));

    expect(session.hasPersistedState()).toBe(false);
    session.setLanguage("en");
    expect(session.hasPersistedState()).toBe(true);

    const reset = session.reset();
    expect(reset.language).toBe("vi");
    expect(reset.player.scene).toBe("OverworldScene");
    expect(session.hasPersistedState()).toBe(false);
  });

  it("publishes critical mutations immediately but skips duplicate stationary position writes", () => {
    const session = new GameSession(
      new LocalGameStateStore(new MemoryStorage(), 1),
    );
    const changes: Array<{ persistence: string; x: number; language: string }> =
      [];
    const unsubscribe = session.subscribe((change) => {
      changes.push({
        persistence: change.persistence,
        x: change.state.player.x,
        language: change.state.language,
      });
    });

    session.updatePlayer("OverworldScene", 830, 630);
    session.updatePlayer("OverworldScene", 831.4, 630);
    session.setLanguage("en");
    unsubscribe();

    expect(changes).toEqual([
      { persistence: "debounced", x: 831, language: "vi" },
      { persistence: "immediate", x: 831, language: "en" },
    ]);
  });
});
