import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DRAGON_BRIDGE_POSTCARD_KEY,
  DRAGON_BRIDGE_QUEST_ID,
  GAME_STATE_STORAGE_KEY,
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
    expect(normalizeGameState({ version: 99 })).toMatchObject(
      createInitialGameState(),
    );
    expect(
      normalizeGameState({
        version: 1,
        language: "vi",
        player: { scene: "OverworldScene", x: Number.NaN, y: 12 },
        quests: { [DRAGON_BRIDGE_QUEST_ID]: "not-a-state" },
        unlockedPostcards: ["dragon_bridge", "dragon_bridge", 42],
      }),
    ).toMatchObject({
      player: { x: 248, y: 12 },
      quests: { [DRAGON_BRIDGE_QUEST_ID]: "AVAILABLE" },
      unlockedPostcards: [],
      memoryFragments: 0,
    });
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

    session.updatePlayer("OverworldScene", 248, 772);
    session.updatePlayer("OverworldScene", 249.4, 772);
    session.setLanguage("en");
    unsubscribe();

    expect(changes).toEqual([
      { persistence: "debounced", x: 249, language: "vi" },
      { persistence: "immediate", x: 249, language: "en" },
    ]);
  });
});
