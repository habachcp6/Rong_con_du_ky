import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  createAuthVerifier,
} from "../../../src/server/auth.js";

describe("server authorization boundary", () => {
  it("accepts a constrained local dev token only when the config permits it", async () => {
    const verifier = createAuthVerifier({ allowLocalAuth: true });

    await expect(
      verifier.verifyAuthorizationHeader("Bearer dev:local-player"),
    ).resolves.toEqual({ uid: "local-player", provider: "local" });
    await expect(
      verifier.verifyAuthorizationHeader("Bearer dev:no"),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("verifies a real Firebase-style ID token through the injectable admin boundary", async () => {
    const verifyIdToken = vi.fn(async (token: string) => {
      expect(token).toBe("signed-id-token");
      return { uid: "firebase-user_123" };
    });
    const verifier = createAuthVerifier(
      { allowLocalAuth: false },
      { getFirebaseTokenVerifier: () => ({ verifyIdToken }) },
    );

    await expect(
      verifier.verifyAuthorizationHeader("Bearer signed-id-token"),
    ).resolves.toEqual({ uid: "firebase-user_123", provider: "firebase" });
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed headers, rejected tokens, unsafe UIDs, and dev tokens in production", async () => {
    const rejected = createAuthVerifier(
      { allowLocalAuth: false },
      {
        getFirebaseTokenVerifier: () => ({
          verifyIdToken: async () => {
            throw new Error("invalid signature");
          },
        }),
      },
    );
    const unsafeUid = createAuthVerifier(
      { allowLocalAuth: false },
      {
        getFirebaseTokenVerifier: () => ({
          verifyIdToken: async () => ({ uid: "unsafe/path" }),
        }),
      },
    );

    await expect(
      rejected.verifyAuthorizationHeader(undefined),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await expect(
      rejected.verifyAuthorizationHeader("Bearer dev:local-player"),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await expect(
      rejected.verifyAuthorizationHeader("Bearer invalid"),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await expect(
      unsafeUid.verifyAuthorizationHeader("Bearer signed-id-token"),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
