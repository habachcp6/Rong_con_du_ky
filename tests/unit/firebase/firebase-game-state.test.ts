import { describe, expect, it, vi } from "vitest";
import {
  createInitialGameState,
  transitionQuest,
} from "../../../src/shared/game-state.js";
import type { GameState } from "../../../src/shared/types.js";
import {
  createGameStateMirrorFromFirebaseClient,
  createFirestoreGameStateStore,
  FirebaseGameStateMirror,
  reconcileGameStates,
  toFirestoreGameStateDocument,
  type FirestoreOperations,
  type RemoteGameStateStore,
} from "../../../src/client/services/firebase-game-state.js";
import type { Firestore } from "firebase/firestore";

const rewardDragonBridge = (state: GameState): GameState => {
  const active = transitionQuest(
    state,
    "dragon_bridge_lights",
    "ACTIVE",
    "2026-08-03T00:00:01.000Z",
  );
  const complete = transitionQuest(
    active.state,
    "dragon_bridge_lights",
    "COMPLETED",
    "2026-08-03T00:00:02.000Z",
  );
  return transitionQuest(
    complete.state,
    "dragon_bridge_lights",
    "REWARDED",
    "2026-08-03T00:00:03.000Z",
  ).state;
};

describe("Firestore game-state projection", () => {
  it("persists only normalized game state and omits undefined optional values", () => {
    const document = toFirestoreGameStateDocument(
      createInitialGameState("vi", "2026-08-03T00:00:00.000Z"),
    );

    expect(document).toMatchObject({
      version: 1,
      language: "vi",
      preferences: { interests: [] },
    });
    expect(document.preferences).not.toHaveProperty("budgetVnd");
    expect(document.preferences).not.toHaveProperty("dietary");
    expect(document).not.toHaveProperty("places");
    expect(document).not.toHaveProperty("recommendations");
  });

  it("uses the owner-scoped point-document path for read and write", async () => {
    const reference = { path: "users/anon-123/game/state" };
    const operations: FirestoreOperations = {
      doc: vi.fn(() => reference),
      getDoc: vi.fn(async () => ({
        exists: () => true,
        data: () => ({ version: 1 }),
      })),
      setDoc: vi.fn(async () => undefined),
    };
    const store = createFirestoreGameStateStore(
      { firestore: {} as Firestore },
      operations,
    );
    const state = createInitialGameState("en", "2026-08-03T00:00:00.000Z");

    await expect(store.read("anon-123")).resolves.toEqual({ version: 1 });
    await store.write("anon-123", state);

    expect(operations.doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "anon-123",
      "game",
      "state",
    );
    expect(operations.setDoc).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({ version: 1, language: "en" }),
    );
  });
});

describe("FirebaseGameStateMirror", () => {
  it("takes remote irreversible progress without letting a stale remote erase it", async () => {
    const local = createInitialGameState("vi", "2026-08-03T00:05:00.000Z");
    const remote = rewardDragonBridge(
      createInitialGameState("vi", "2026-08-03T00:00:00.000Z"),
    );
    const store: RemoteGameStateStore = {
      read: vi.fn(async () => remote),
      write: vi.fn(async () => undefined),
    };
    const mirror = new FirebaseGameStateMirror(
      { getUid: vi.fn(async () => "anon-123") },
      store,
    );

    const bootstrapped = await mirror.bootstrap(local);
    expect(bootstrapped.source).toBe("remote");
    expect(bootstrapped.state.quests.dragon_bridge_lights).toBe("REWARDED");
    expect(bootstrapped.status).toEqual({ mode: "ready", uid: "anon-123" });

    const localWithReward = rewardDragonBridge(
      createInitialGameState("vi", "2026-08-03T00:10:00.000Z"),
    );
    const staleRemote = createInitialGameState(
      "vi",
      "2026-08-03T00:20:00.000Z",
    );
    expect(
      reconcileGameStates(localWithReward, staleRemote).state.quests
        .dragon_bridge_lights,
    ).toBe("REWARDED");
  });

  it("returns local state instead of throwing when anonymous Auth is unavailable", async () => {
    const local = createInitialGameState("en", "2026-08-03T00:00:00.000Z");
    const store: RemoteGameStateStore = {
      read: vi.fn(async () => null),
      write: vi.fn(async () => undefined),
    };
    const mirror = new FirebaseGameStateMirror(
      { getUid: vi.fn(async () => Promise.reject(new Error("offline"))) },
      store,
    );

    await expect(mirror.bootstrap(local)).resolves.toMatchObject({
      state: local,
      status: { mode: "offline", reason: "AUTH_UNAVAILABLE" },
      source: "local",
    });
    expect(store.read).not.toHaveBeenCalled();
  });

  it("coalesces a save through the remote store and keeps local state on write failure", async () => {
    const state = rewardDragonBridge(
      createInitialGameState("vi", "2026-08-03T00:00:00.000Z"),
    );
    const write = vi.fn(async () => Promise.reject(new Error("offline")));
    const mirror = new FirebaseGameStateMirror(
      { getUid: vi.fn(async () => "anon-123") },
      { read: vi.fn(async () => null), write },
      { debounceMs: 1 },
    );

    mirror.queueSave(state);
    const result = await mirror.flush();

    expect(write).toHaveBeenCalledWith("anon-123", state);
    expect(result).toMatchObject({
      state,
      status: { mode: "offline", reason: "REMOTE_UNAVAILABLE" },
      saved: false,
    });
  });

  it("retains the latest local state when Firebase is not configured", async () => {
    const state = rewardDragonBridge(
      createInitialGameState("vi", "2026-08-03T00:00:00.000Z"),
    );
    const mirror = createGameStateMirrorFromFirebaseClient(null);

    await mirror.bootstrap(createInitialGameState("vi"));
    mirror.queueSave(state);

    await expect(mirror.flush()).resolves.toMatchObject({
      state,
      status: { mode: "disabled", reason: "FIREBASE_NOT_CONFIGURED" },
      saved: false,
    });
  });
});
