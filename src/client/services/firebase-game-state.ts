import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import {
  GAME_STATE_VERSION,
  LEGACY_GAME_STATE_VERSION,
  QUEST_ORDER,
  hydrateGameState,
} from "../../shared/game-state.js";
import type { GameState, QuestStatus } from "../../shared/types.js";
import {
  ensureAnonymousFirebaseIdentity,
  getBrowserFirebaseClient,
  type BrowserFirebaseClient,
  type FirebaseClientSdk,
} from "./firebase-client.js";

export type AnonymousAuthPort = {
  getUid(): Promise<string>;
};

export type RemoteGameStateStore = {
  read(uid: string): Promise<unknown | null>;
  write(uid: string, state: GameState): Promise<void>;
};

export type FirestoreDocumentSnapshot = {
  exists(): boolean;
  data(): unknown;
};

/** A small Firestore seam for unit tests; production uses the modular SDK below. */
export type FirestoreOperations = {
  doc(firestore: Firestore, path: string, ...pathSegments: string[]): unknown;
  getDoc(reference: unknown): Promise<FirestoreDocumentSnapshot>;
  setDoc(reference: unknown, data: unknown): Promise<void>;
};

const browserFirestoreOperations: FirestoreOperations = {
  doc: (firestore, path, ...pathSegments) =>
    doc(firestore, path, ...pathSegments),
  getDoc: async (reference) => getDoc(reference as ReturnType<typeof doc>),
  setDoc: async (reference, data) =>
    setDoc(
      reference as ReturnType<typeof doc>,
      data as Record<string, unknown>,
    ),
};

export type FirestoreGameStateDocument = {
  version: 2;
  language: GameState["language"];
  player: GameState["player"];
  quests: GameState["quests"];
  unlockedPostcards: string[];
  memoryFragments: number;
  preferences: GameState["preferences"];
  updatedAt: string;
};

export type GameStateSyncStatus =
  | { mode: "disabled"; reason: "FIREBASE_NOT_CONFIGURED" }
  | { mode: "idle" }
  | { mode: "ready"; uid: string }
  | {
      mode: "offline";
      reason:
        | "AUTH_UNAVAILABLE"
        | "REMOTE_UNAVAILABLE"
        | "LOCAL_PROGRESS_REQUIRES_MIGRATION";
    };

export type GameStateBootstrapResult = {
  state: GameState;
  status: GameStateSyncStatus;
  source: "local" | "remote" | "merged";
};

export type GameStateSyncResult = {
  state: GameState;
  status: GameStateSyncStatus;
  saved: boolean;
};

export type GameStateMirror = {
  bootstrap(localState: GameState): Promise<GameStateBootstrapResult>;
  queueSave(state: GameState): void;
  flush(): Promise<GameStateSyncResult>;
  dispose(): void;
  getStatus(): GameStateSyncStatus;
};

export type FirebaseGameStateMirrorOptions = {
  debounceMs?: number;
};

const QUEST_STATUS_WEIGHT: Record<QuestStatus, number> = {
  LOCKED: 0,
  AVAILABLE: 1,
  ACTIVE: 2,
  COMPLETED: 3,
  REWARDED: 4,
};

const cloneGameState = (state: GameState): GameState => ({
  ...state,
  player: { ...state.player },
  quests: { ...state.quests },
  unlockedPostcards: [...state.unlockedPostcards],
  preferences: {
    ...state.preferences,
    interests: [...state.preferences.interests],
  },
});

const validUid = (uid: string): boolean =>
  uid.trim().length > 0 && !uid.includes("/");

const timestampValue = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const progressValue = (state: GameState): number =>
  state.memoryFragments * 100 +
  Object.values(state.quests).reduce(
    (total, status) => total + QUEST_STATUS_WEIGHT[status],
    0,
  );

/** Firestore only allows a canonical initial document at create time. Existing
 * local progress remains playable locally until it can be migrated through an
 * authorized path; a browser must never synthesize a first-write ending. */
const isInitialCampaignState = (state: GameState): boolean =>
  state.memoryFragments === 0 &&
  state.unlockedPostcards.length === 0 &&
  QUEST_ORDER.every((questId, index) =>
    index === 0
      ? state.quests[questId] === "AVAILABLE"
      : state.quests[questId] === "LOCKED",
  );

/** V1 remains readable so the mirror can upgrade it in a valid V2 write. */
const isPersistedGameState = (value: unknown): boolean =>
  Boolean(value) &&
  typeof value === "object" &&
  ((value as { version?: unknown }).version === LEGACY_GAME_STATE_VERSION ||
    (value as { version?: unknown }).version === GAME_STATE_VERSION);

const isCurrentPersistedGameState = (value: unknown): boolean =>
  Boolean(value) &&
  typeof value === "object" &&
  (value as { version?: unknown }).version === GAME_STATE_VERSION;

const sameFirestoreDocument = (left: GameState, right: GameState): boolean =>
  JSON.stringify(toFirestoreGameStateDocument(left)) ===
  JSON.stringify(toFirestoreGameStateDocument(right));

/**
 * Firestore receives only the normalized game-state projection. It contains no
 * Places metadata, reviews, ratings, or provider responses.
 */
export function toFirestoreGameStateDocument(
  state: GameState,
): FirestoreGameStateDocument {
  const normalized = hydrateGameState(state);
  const preferences: GameState["preferences"] = {
    ...(normalized.preferences.budgetVnd === undefined
      ? {}
      : { budgetVnd: normalized.preferences.budgetVnd }),
    ...(normalized.preferences.dietary === undefined
      ? {}
      : { dietary: normalized.preferences.dietary }),
    interests: [...normalized.preferences.interests],
  };

  return {
    version: normalized.version,
    language: normalized.language,
    player: { ...normalized.player },
    quests: { ...normalized.quests },
    unlockedPostcards: [...normalized.unlockedPostcards],
    memoryFragments: normalized.memoryFragments,
    preferences,
    updatedAt: normalized.updatedAt,
  };
}

/**
 * Prefer irreversible campaign progress over wall-clock time. For equal
 * progress, the newest normalized state wins so position/preferences converge
 * across devices without allowing a stale state to erase a reward.
 */
export function reconcileGameStates(
  localState: GameState,
  remoteValue: unknown,
): {
  state: GameState;
  source: "local" | "remote" | "merged";
} {
  const local = hydrateGameState(localState);
  if (!isPersistedGameState(remoteValue))
    return { state: local, source: "local" };

  const remote = hydrateGameState(remoteValue);
  const localProgress = progressValue(local);
  const remoteProgress = progressValue(remote);

  if (remoteProgress > localProgress)
    return { state: remote, source: "remote" };
  if (localProgress > remoteProgress) return { state: local, source: "local" };

  if (timestampValue(remote.updatedAt) > timestampValue(local.updatedAt)) {
    return { state: remote, source: "merged" };
  }

  return { state: local, source: "merged" };
}

export function createFirebaseAnonymousAuth(
  client: Pick<BrowserFirebaseClient, "auth">,
  sdk?: Pick<
    FirebaseClientSdk,
    "setPersistence" | "browserLocalPersistence" | "signInAnonymously"
  >,
): AnonymousAuthPort {
  return {
    async getUid(): Promise<string> {
      const identity = await ensureAnonymousFirebaseIdentity(client, sdk);
      if (!validUid(identity.uid))
        throw new Error("Firebase returned an invalid anonymous user id.");
      return identity.uid;
    },
  };
}

export function createFirestoreGameStateStore(
  client: Pick<BrowserFirebaseClient, "firestore">,
  operations: FirestoreOperations = browserFirestoreOperations,
): RemoteGameStateStore {
  return {
    async read(uid: string): Promise<unknown | null> {
      if (!validUid(uid))
        throw new Error("Cannot read game state for an invalid user id.");
      const reference = operations.doc(
        client.firestore,
        "users",
        uid,
        "game",
        "state",
      );
      const snapshot = await operations.getDoc(reference);
      return snapshot.exists() ? snapshot.data() : null;
    },
    async write(uid: string, state: GameState): Promise<void> {
      if (!validUid(uid))
        throw new Error("Cannot write game state for an invalid user id.");
      const reference = operations.doc(
        client.firestore,
        "users",
        uid,
        "game",
        "state",
      );
      await operations.setDoc(reference, toFirestoreGameStateDocument(state));
    },
  };
}

export class FirebaseGameStateMirror implements GameStateMirror {
  private pendingSave: ReturnType<typeof setTimeout> | null = null;
  private latestState: GameState | null = null;
  private uid: string | null = null;
  private status: GameStateSyncStatus = { mode: "idle" };
  private activeFlush: Promise<GameStateSyncResult> | null = null;
  private localProgressRequiresMigration = false;

  public constructor(
    private readonly auth: AnonymousAuthPort,
    private readonly remoteStore: RemoteGameStateStore,
    private readonly options: FirebaseGameStateMirrorOptions = {},
  ) {}

  public getStatus(): GameStateSyncStatus {
    return { ...this.status };
  }

  public async bootstrap(
    localState: GameState,
  ): Promise<GameStateBootstrapResult> {
    const local = hydrateGameState(localState);
    this.latestState = local;

    const uid = await this.ensureUid();
    if (!uid)
      return { state: local, status: this.getStatus(), source: "local" };

    try {
      const remoteValue = await this.remoteStore.read(uid);
      if (remoteValue === null && !isInitialCampaignState(local)) {
        this.localProgressRequiresMigration = true;
        this.status = {
          mode: "offline",
          reason: "LOCAL_PROGRESS_REQUIRES_MIGRATION",
        };
        return {
          state: cloneGameState(local),
          status: this.getStatus(),
          source: "local",
        };
      }

      this.localProgressRequiresMigration = false;
      const result = reconcileGameStates(local, remoteValue);
      this.latestState = result.state;

      if (
        !isCurrentPersistedGameState(remoteValue) ||
        !sameFirestoreDocument(result.state, hydrateGameState(remoteValue))
      ) {
        await this.remoteStore.write(uid, result.state);
      }

      this.status = { mode: "ready", uid };
      return {
        state: cloneGameState(result.state),
        status: this.getStatus(),
        source: result.source,
      };
    } catch {
      this.status = { mode: "offline", reason: "REMOTE_UNAVAILABLE" };
      return {
        state: cloneGameState(local),
        status: this.getStatus(),
        source: "local",
      };
    }
  }

  public queueSave(state: GameState): void {
    this.latestState = hydrateGameState(state);
    if (this.localProgressRequiresMigration) {
      if (!isInitialCampaignState(this.latestState)) return;
      this.localProgressRequiresMigration = false;
      this.status = { mode: "idle" };
    }
    if (this.pendingSave) clearTimeout(this.pendingSave);

    const debounceMs = this.options.debounceMs ?? 2_000;
    this.pendingSave = setTimeout(() => {
      this.pendingSave = null;
      void this.flush();
    }, debounceMs);
  }

  public async flush(): Promise<GameStateSyncResult> {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
    }

    if (this.activeFlush) return this.activeFlush;

    const stateAtStart = this.latestState
      ? cloneGameState(this.latestState)
      : null;
    if (!stateAtStart) {
      return {
        state: hydrateGameState(null),
        status: this.getStatus(),
        saved: false,
      };
    }

    if (this.localProgressRequiresMigration) {
      return {
        state: stateAtStart,
        status: this.getStatus(),
        saved: false,
      };
    }

    this.activeFlush = this.persist(stateAtStart);
    try {
      const result = await this.activeFlush;
      return result;
    } finally {
      this.activeFlush = null;
    }
  }

  public dispose(): void {
    if (this.pendingSave) clearTimeout(this.pendingSave);
    this.pendingSave = null;
  }

  private async ensureUid(): Promise<string | null> {
    if (this.uid) return this.uid;

    try {
      this.uid = await this.auth.getUid();
      this.status = { mode: "ready", uid: this.uid };
      return this.uid;
    } catch {
      this.status = { mode: "offline", reason: "AUTH_UNAVAILABLE" };
      return null;
    }
  }

  private async persist(state: GameState): Promise<GameStateSyncResult> {
    const uid = await this.ensureUid();
    if (!uid) return { state, status: this.getStatus(), saved: false };

    try {
      await this.remoteStore.write(uid, state);
      this.status = { mode: "ready", uid };
      return {
        state: cloneGameState(state),
        status: this.getStatus(),
        saved: true,
      };
    } catch {
      this.status = { mode: "offline", reason: "REMOTE_UNAVAILABLE" };
      return {
        state: cloneGameState(state),
        status: this.getStatus(),
        saved: false,
      };
    }
  }
}

class LocalOnlyGameStateMirror implements GameStateMirror {
  private latestState: GameState | null = null;

  public getStatus(): GameStateSyncStatus {
    return { mode: "disabled", reason: "FIREBASE_NOT_CONFIGURED" };
  }

  public async bootstrap(
    localState: GameState,
  ): Promise<GameStateBootstrapResult> {
    this.latestState = hydrateGameState(localState);
    return {
      state: cloneGameState(this.latestState),
      status: this.getStatus(),
      source: "local",
    };
  }

  public queueSave(state: GameState): void {
    // The existing LocalGameStateStore remains the durable fallback.
    this.latestState = hydrateGameState(state);
  }

  public async flush(): Promise<GameStateSyncResult> {
    return {
      state: cloneGameState(this.latestState ?? hydrateGameState(null)),
      status: this.getStatus(),
      saved: false,
    };
  }

  public dispose(): void {
    // No timers or network resources in local-only mode.
  }
}

export function createGameStateMirrorFromFirebaseClient(
  client: BrowserFirebaseClient | null,
): GameStateMirror {
  if (!client) return new LocalOnlyGameStateMirror();

  return new FirebaseGameStateMirror(
    createFirebaseAnonymousAuth(client),
    createFirestoreGameStateStore(client),
  );
}

/**
 * Browser convenience factory. It never throws for absent Firebase config;
 * callers can use the same mirror API in local-only and Firebase modes.
 */
export function createBrowserGameStateMirror(): GameStateMirror {
  return createGameStateMirrorFromFirebaseClient(getBrowserFirebaseClient());
}
