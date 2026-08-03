import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  signInAnonymously,
  type Auth,
  type Persistence,
  type User,
  type UserCredential,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

export type FirebaseEnvironment = Readonly<
  Record<string, string | boolean | undefined>
>;

export type FirebaseRuntimeConfig = {
  options: FirebaseOptions;
  useEmulators: boolean;
  authEmulatorUrl: string;
  firestoreEmulatorHost: string;
  firestoreEmulatorPort: number;
};

export type BrowserFirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  config: FirebaseRuntimeConfig;
};

export type FirebaseIdentity = {
  uid: string;
};

export type ApiAuthorizationResult =
  | { header: string; provider: "firebase" | "local"; uid: string }
  | { header: null; provider: "unavailable" };

export type ApiAuthorizationOptions = {
  /** Supplying null is useful for deterministic local-only tests and callers. */
  client?: BrowserFirebaseClient | null;
  environment?: FirebaseEnvironment;
  sdk?: Pick<
    FirebaseClientSdk,
    "setPersistence" | "browserLocalPersistence" | "signInAnonymously"
  >;
};

/**
 * This narrow SDK boundary keeps the browser integration testable without a
 * Firebase project or emulator. Production code uses `browserFirebaseSdk`.
 */
export type FirebaseClientSdk = {
  getApps(): FirebaseApp[];
  getApp(): FirebaseApp;
  initializeApp(options: FirebaseOptions): FirebaseApp;
  getAuth(app: FirebaseApp): Auth;
  getFirestore(app: FirebaseApp): Firestore;
  connectAuthEmulator(
    auth: Auth,
    url: string,
    options?: { disableWarnings?: boolean },
  ): void;
  connectFirestoreEmulator(
    firestore: Firestore,
    host: string,
    port: number,
  ): void;
  setPersistence(auth: Auth, persistence: Persistence): Promise<void>;
  browserLocalPersistence: Persistence;
  signInAnonymously(auth: Auth): Promise<UserCredential>;
};

export const browserFirebaseSdk: FirebaseClientSdk = {
  getApps,
  getApp,
  initializeApp,
  getAuth,
  getFirestore,
  connectAuthEmulator,
  connectFirestoreEmulator,
  setPersistence,
  browserLocalPersistence,
  signInAnonymously,
};

const configuredAuthEmulators = new WeakSet<object>();
const configuredFirestoreEmulators = new WeakSet<object>();
const configuredAuthPersistence = new WeakSet<object>();
const activeAnonymousSignIns = new WeakMap<object, Promise<User>>();

let cachedBrowserClient: BrowserFirebaseClient | null | undefined;

const isConfiguredValue = (
  value: string | boolean | undefined,
): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  !value.trim().startsWith("replace-");

const parsePort = (
  value: string | boolean | undefined,
  fallback: number,
): number => {
  if (typeof value !== "string") return fallback;
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : fallback;
};

const readViteEnvironment = (): FirebaseEnvironment => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env as FirebaseEnvironment;
  }

  return {};
};

/**
 * Returns null when browser Firebase has not been configured. This is an
 * expected Starter/local-development state and intentionally does not block
 * local-only game play.
 */
export function readFirebaseRuntimeConfig(
  environment: FirebaseEnvironment,
): FirebaseRuntimeConfig | null {
  const apiKey = environment.VITE_FIREBASE_API_KEY;
  const authDomain = environment.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = environment.VITE_FIREBASE_PROJECT_ID;
  const appId = environment.VITE_FIREBASE_APP_ID;

  if (![apiKey, authDomain, projectId, appId].every(isConfiguredValue)) {
    return null;
  }

  return {
    options: { apiKey, authDomain, projectId, appId },
    useEmulators: environment.VITE_USE_FIREBASE_EMULATORS === "true",
    authEmulatorUrl:
      typeof environment.VITE_FIREBASE_AUTH_EMULATOR_URL === "string" &&
      environment.VITE_FIREBASE_AUTH_EMULATOR_URL.trim().length > 0
        ? environment.VITE_FIREBASE_AUTH_EMULATOR_URL.trim()
        : "http://127.0.0.1:9099",
    firestoreEmulatorHost:
      typeof environment.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST === "string" &&
      environment.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST.trim().length > 0
        ? environment.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST.trim()
        : "127.0.0.1",
    firestoreEmulatorPort: parsePort(
      environment.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT,
      8080,
    ),
  };
}

/** Creates a client only; sign-in remains deferred until persistence is wired. */
export function createFirebaseClient(
  config: FirebaseRuntimeConfig,
  sdk: FirebaseClientSdk = browserFirebaseSdk,
): BrowserFirebaseClient {
  const app =
    sdk.getApps().length > 0 ? sdk.getApp() : sdk.initializeApp(config.options);
  const auth = sdk.getAuth(app);
  const firestore = sdk.getFirestore(app);

  if (config.useEmulators) {
    if (!configuredAuthEmulators.has(auth)) {
      sdk.connectAuthEmulator(auth, config.authEmulatorUrl, {
        disableWarnings: true,
      });
      configuredAuthEmulators.add(auth);
    }

    if (!configuredFirestoreEmulators.has(firestore)) {
      sdk.connectFirestoreEmulator(
        firestore,
        config.firestoreEmulatorHost,
        config.firestoreEmulatorPort,
      );
      configuredFirestoreEmulators.add(firestore);
    }
  }

  return { app, auth, firestore, config };
}

/**
 * Singleton browser entry point. A malformed or unavailable browser Firebase
 * setup yields null, allowing the caller to retain its local persistence path.
 */
export function getBrowserFirebaseClient(
  environment: FirebaseEnvironment = readViteEnvironment(),
): BrowserFirebaseClient | null {
  if (cachedBrowserClient !== undefined) return cachedBrowserClient;

  const config = readFirebaseRuntimeConfig(environment);
  if (!config) {
    cachedBrowserClient = null;
    return cachedBrowserClient;
  }

  try {
    cachedBrowserClient = createFirebaseClient(config);
  } catch {
    // Credentials/configuration are deliberately not surfaced to gameplay.
    cachedBrowserClient = null;
  }

  return cachedBrowserClient;
}

/**
 * Auth persistence is best effort: browser privacy settings can reject it, but
 * an anonymous sign-in can still succeed for the current tab.
 */
export async function ensureAnonymousFirebaseIdentity(
  client: Pick<BrowserFirebaseClient, "auth">,
  sdk: Pick<
    FirebaseClientSdk,
    "setPersistence" | "browserLocalPersistence" | "signInAnonymously"
  > = browserFirebaseSdk,
): Promise<FirebaseIdentity> {
  const user = await ensureAnonymousFirebaseUser(client, sdk);
  return { uid: user.uid };
}

const ensureAnonymousFirebaseUser = async (
  client: Pick<BrowserFirebaseClient, "auth">,
  sdk: Pick<
    FirebaseClientSdk,
    "setPersistence" | "browserLocalPersistence" | "signInAnonymously"
  >,
): Promise<User> => {
  if (!configuredAuthPersistence.has(client.auth)) {
    try {
      await sdk.setPersistence(client.auth, sdk.browserLocalPersistence);
    } catch {
      // Continue with the SDK's current persistence mode.
    }
    configuredAuthPersistence.add(client.auth);
  }

  const existingUser = client.auth.currentUser;
  if (existingUser) return existingUser;

  const activeSignIn = activeAnonymousSignIns.get(client.auth);
  if (activeSignIn) return activeSignIn;

  const signIn = sdk
    .signInAnonymously(client.auth)
    .then((credential) => credential.user);
  activeAnonymousSignIns.set(client.auth, signIn);

  try {
    return await signIn;
  } finally {
    activeAnonymousSignIns.delete(client.auth);
  }
};

const isDevelopmentClient = (environment: FirebaseEnvironment): boolean =>
  environment.DEV === true ||
  environment.MODE === "development" ||
  environment.MODE === "test";

const LOCAL_DEVELOPMENT_UID_PATTERN = /^[A-Za-z0-9_-]{3,128}$/;

const getLocalDevelopmentUid = (environment: FirebaseEnvironment): string => {
  const configuredUid = environment.VITE_LOCAL_DEV_UID;
  if (
    typeof configuredUid === "string" &&
    LOCAL_DEVELOPMENT_UID_PATTERN.test(configuredUid)
  ) {
    return configuredUid;
  }

  return "local-player";
};

/**
 * Returns the sole client-to-server Authorization contract. Firebase tokens
 * are preferred whenever the browser has a configured client. A dev token is
 * intentionally possible only in Vite development/test modes, matching the
 * server's non-production `ALLOW_LOCAL_AUTH` boundary.
 */
export async function getApiAuthorization(
  options: ApiAuthorizationOptions = {},
): Promise<ApiAuthorizationResult> {
  const environment = options.environment ?? readViteEnvironment();
  const client =
    options.client === undefined
      ? getBrowserFirebaseClient(environment)
      : options.client;

  if (client) {
    try {
      const user = await ensureAnonymousFirebaseUser(
        client,
        options.sdk ?? browserFirebaseSdk,
      );
      const idToken = await user.getIdToken();
      if (idToken) {
        return {
          header: `Bearer ${idToken}`,
          provider: "firebase",
          uid: user.uid,
        };
      }
    } catch {
      // The local fallback below is deliberately constrained to dev/test.
    }
  }

  if (isDevelopmentClient(environment)) {
    const uid = getLocalDevelopmentUid(environment);
    return { header: `Bearer dev:${uid}`, provider: "local", uid };
  }

  return { header: null, provider: "unavailable" };
}

/** Convenience form for request clients that only need the header value. */
export async function getApiAuthorizationHeader(
  options: ApiAuthorizationOptions = {},
): Promise<string | null> {
  return (await getApiAuthorization(options)).header;
}

/** Test-only cache reset; runtime code should retain one Firebase app per tab. */
export function resetBrowserFirebaseClientForTests(): void {
  cachedBrowserClient = undefined;
}
