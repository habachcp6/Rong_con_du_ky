import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { AppConfig } from "./config.js";

export type AuthIdentity = {
  uid: string;
  provider: "firebase" | "local";
};

export class AuthenticationError extends Error {
  public constructor(message = "Authentication is required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export type AuthVerifier = {
  verifyAuthorizationHeader(header: string | undefined): Promise<AuthIdentity>;
};

export type FirebaseTokenVerifier = {
  verifyIdToken(token: string): Promise<{ uid: string }>;
};

export type AuthVerifierOptions = {
  /** Injectable only to exercise Firebase token acceptance/rejection without
   * reaching a live Firebase project in unit tests. */
  getFirebaseTokenVerifier?: () => FirebaseTokenVerifier;
};

const LOCAL_UID_PATTERN = /^[A-Za-z0-9_-]{3,128}$/;

function getBearerToken(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    throw new AuthenticationError();
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthenticationError();
  }
  return token;
}

function firebaseAuth(): FirebaseTokenVerifier {
  const app =
    getApps()[0] ?? initializeApp({ credential: applicationDefault() });
  return getAuth(app);
}

const isSafeFirebaseUid = (uid: unknown): uid is string =>
  typeof uid === "string" &&
  uid.trim().length > 0 &&
  uid.length <= 128 &&
  !uid.includes("/");

export function createAuthVerifier(
  config: Pick<AppConfig, "allowLocalAuth">,
  options: AuthVerifierOptions = {},
): AuthVerifier {
  const getFirebaseTokenVerifier =
    options.getFirebaseTokenVerifier ?? firebaseAuth;

  return {
    async verifyAuthorizationHeader(header) {
      const token = getBearerToken(header);

      if (config.allowLocalAuth && token.startsWith("dev:")) {
        const uid = token.slice("dev:".length);
        if (!LOCAL_UID_PATTERN.test(uid)) {
          throw new AuthenticationError("Invalid local development token");
        }
        return { uid, provider: "local" };
      }

      try {
        const decoded = await getFirebaseTokenVerifier().verifyIdToken(token);
        if (!isSafeFirebaseUid(decoded.uid)) {
          throw new AuthenticationError("Invalid Firebase user id");
        }
        return { uid: decoded.uid, provider: "firebase" };
      } catch {
        throw new AuthenticationError("Invalid Firebase ID token");
      }
    },
  };
}
