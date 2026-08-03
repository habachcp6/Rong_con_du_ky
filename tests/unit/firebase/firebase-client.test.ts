import { describe, expect, it, vi } from "vitest";
import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import type { Auth, Persistence, UserCredential } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  createFirebaseClient,
  ensureAnonymousFirebaseIdentity,
  getApiAuthorization,
  getApiAuthorizationHeader,
  readFirebaseRuntimeConfig,
  type BrowserFirebaseClient,
  type FirebaseClientSdk,
  type FirebaseEnvironment,
} from "../../../src/client/services/firebase-client.js";

const configuredEnvironment: FirebaseEnvironment = {
  VITE_FIREBASE_API_KEY: "public-web-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "rong-con-du-ky.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "rong-con-du-ky",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
  VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9199",
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: "localhost",
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: "8181",
};

const createSdk = (): {
  sdk: FirebaseClientSdk;
  auth: Auth;
  firestore: Firestore;
  initializeApp: ReturnType<typeof vi.fn>;
  connectAuthEmulator: ReturnType<typeof vi.fn>;
  connectFirestoreEmulator: ReturnType<typeof vi.fn>;
} => {
  const app = {} as FirebaseApp;
  const auth = { currentUser: null } as unknown as Auth;
  const firestore = {} as Firestore;
  let initialized = false;
  const initializeApp = vi.fn((_options: FirebaseOptions) => {
    initialized = true;
    return app;
  });
  const connectAuthEmulator = vi.fn();
  const connectFirestoreEmulator = vi.fn();

  return {
    sdk: {
      getApps: vi.fn(() => (initialized ? [app] : [])),
      getApp: vi.fn(() => app),
      initializeApp,
      getAuth: vi.fn(() => auth),
      getFirestore: vi.fn(() => firestore),
      connectAuthEmulator,
      connectFirestoreEmulator,
      setPersistence: vi.fn(async () => undefined),
      browserLocalPersistence: {} as Persistence,
      signInAnonymously: vi.fn(
        async () => ({ user: { uid: "anonymous-user" } }) as UserCredential,
      ),
    },
    auth,
    firestore,
    initializeApp,
    connectAuthEmulator,
    connectFirestoreEmulator,
  };
};

describe("Firebase browser configuration", () => {
  it("stays disabled until every public Firebase browser setting is real", () => {
    expect(readFirebaseRuntimeConfig({})).toBeNull();
    expect(
      readFirebaseRuntimeConfig({
        ...configuredEnvironment,
        VITE_FIREBASE_APP_ID: "replace-with-web-app-id",
      }),
    ).toBeNull();

    expect(readFirebaseRuntimeConfig(configuredEnvironment)).toMatchObject({
      options: {
        projectId: "rong-con-du-ky",
      },
      useEmulators: true,
      authEmulatorUrl: "http://127.0.0.1:9199",
      firestoreEmulatorHost: "localhost",
      firestoreEmulatorPort: 8181,
    });
  });

  it("initializes one app and connects each emulator only once", () => {
    const config = readFirebaseRuntimeConfig(configuredEnvironment);
    if (!config) throw new Error("Expected test Firebase config.");
    const fake = createSdk();

    createFirebaseClient(config, fake.sdk);
    createFirebaseClient(config, fake.sdk);

    expect(fake.initializeApp).toHaveBeenCalledOnce();
    expect(fake.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(fake.connectAuthEmulator).toHaveBeenCalledWith(
      fake.auth,
      "http://127.0.0.1:9199",
      {
        disableWarnings: true,
      },
    );
    expect(fake.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(fake.connectFirestoreEmulator).toHaveBeenCalledWith(
      fake.firestore,
      "localhost",
      8181,
    );
  });

  it("continues anonymous sign-in when durable Auth persistence is unavailable", async () => {
    const auth = { currentUser: null } as unknown as Auth;
    const setPersistence = vi.fn(async () =>
      Promise.reject(new Error("Storage denied")),
    );
    const signInAnonymously = vi.fn(
      async () => ({ user: { uid: "anonymous-user" } }) as UserCredential,
    );

    await expect(
      ensureAnonymousFirebaseIdentity(
        { auth },
        {
          setPersistence,
          browserLocalPersistence: {} as Persistence,
          signInAnonymously,
        },
      ),
    ).resolves.toEqual({ uid: "anonymous-user" });

    expect(setPersistence).toHaveBeenCalledOnce();
    expect(signInAnonymously).toHaveBeenCalledWith(auth);
  });

  it("uses a Firebase ID token for server requests when Firebase is configured", async () => {
    const getIdToken = vi.fn(async () => "firebase-id-token");
    const auth = {
      currentUser: { uid: "firebase-user", getIdToken },
    } as unknown as Auth;
    const sdk = {
      setPersistence: vi.fn(async () => undefined),
      browserLocalPersistence: {} as Persistence,
      signInAnonymously: vi.fn(),
    };

    await expect(
      getApiAuthorization({
        client: { auth } as BrowserFirebaseClient,
        environment: { DEV: true },
        sdk,
      }),
    ).resolves.toEqual({
      header: "Bearer firebase-id-token",
      provider: "firebase",
      uid: "firebase-user",
    });
    await expect(
      getApiAuthorizationHeader({
        client: { auth } as BrowserFirebaseClient,
        environment: { DEV: true },
        sdk,
      }),
    ).resolves.toBe("Bearer firebase-id-token");
    expect(getIdToken).toHaveBeenCalledTimes(2);
  });

  it("allows the local development token only outside production builds", async () => {
    await expect(
      getApiAuthorization({
        client: null,
        environment: { DEV: true, VITE_LOCAL_DEV_UID: "e2e-player" },
      }),
    ).resolves.toEqual({
      header: "Bearer dev:e2e-player",
      provider: "local",
      uid: "e2e-player",
    });

    await expect(
      getApiAuthorizationHeader({
        client: null,
        environment: { DEV: false, MODE: "production" },
      }),
    ).resolves.toBeNull();
  });
});
