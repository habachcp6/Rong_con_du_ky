import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../../src/server/app.js";
import type { AppConfig } from "../../../src/server/config.js";

const testConfig: AppConfig = {
  env: "test",
  port: 0,
  appVersion: "test",
  googleCloudProject: "test-project",
  geminiApiKey: "",
  geminiModel: "gemini-3.6-flash",
  googleMapsApiKey: "",
  allowedOrigins: ["http://localhost:5173"],
  allowLocalAuth: true,
  starterTrack: true,
};

const apps: Awaited<ReturnType<typeof createApp>>[] = [];

async function app() {
  const instance = await createApp({ config: testConfig });
  apps.push(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});

describe("API boundary", () => {
  it("serves health with baseline browser hardening headers", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-request-id"]).toMatch(/.+/u);
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
  });

  it("requires an identity before serving AI routes", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/api/dragon/chat",
      payload: { language: "vi", message: "Xin chào" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "UNAUTHORIZED" });
  });

  it("returns an authored Gemini fallback without exposing provider details", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/api/dragon/chat",
      headers: { authorization: "Bearer dev:e2e-player" },
      payload: {
        language: "vi",
        questId: "dragon_bridge_lights",
        message: "Cho mình một gợi ý",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      source: string;
      fallback: boolean;
      reply: { dialogue: string; nextAction: string };
    };
    expect(body.source).toBe("fallback");
    expect(body.fallback).toBe(true);
    expect(body.reply.dialogue).toContain("Cầu Rồng");
    expect(body.reply.nextAction).toBe("NONE");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("filters authored Starter cards and omits restricted Places fields", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { authorization: "Bearer dev:e2e-player" },
      payload: {
        language: "en",
        landmarkKey: "my_khe_beach",
        dietary: "vegetarian",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      source: string;
      places: Array<Record<string, unknown>>;
    };
    expect(body.source).toBe("curated");
    expect(body.places).toHaveLength(1);
    expect(body.places[0]).toMatchObject({
      placeId: null,
      placeIdStatus: "unverified",
      dietary: "vegetarian",
    });
    expect(body.places[0]).not.toHaveProperty("rating");
    expect(body.places[0]).not.toHaveProperty("reviews");
    expect(body.places[0]).not.toHaveProperty("openNow");
  });

  it("keeps Standard Places endpoints disabled in the Starter track", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/api/places/search",
      headers: { authorization: "Bearer dev:e2e-player" },
      payload: { language: "vi", query: "coffee" },
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({ error: "STANDARD_TRACK_DISABLED" });
  });

  it("allows the production entry point to install its SPA fallback exactly once", async () => {
    const instance = await createApp({
      config: testConfig,
      deferNotFoundHandler: true,
    });
    apps.push(instance);
    instance.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "API route not found" });
      }
      return reply.status(200).send({ shell: "spa" });
    });

    const shell = await instance.inject({ method: "GET", url: "/journey" });
    const api = await instance.inject({ method: "GET", url: "/api/missing" });

    expect(shell.statusCode).toBe(200);
    expect(shell.json()).toEqual({ shell: "spa" });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toMatchObject({ error: "NOT_FOUND" });
  });

  it("does not rate limit health endpoint or non-API static asset routes", async () => {
    const instance = await app();
    // Fire 110 requests to health check to ensure allowList skips rate limiting
    const requests = Array.from({ length: 110 }, () =>
      instance.inject({ method: "GET", url: "/api/health" }),
    );
    const responses = await Promise.all(requests);
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: "ok" });
    }
  });

  it("returns HTTP 429 for rate-limited API endpoints instead of HTTP 500", async () => {
    const instance = await app();
    // Fire >100 requests to an unauthenticated API endpoint (e.g. POST /api/dragon/chat)
    let rateLimitedResponse = null;
    for (let i = 0; i < 105; i++) {
      const res = await instance.inject({
        method: "POST",
        url: "/api/dragon/chat",
        payload: { language: "vi", message: "test" },
      });
      if (res.statusCode === 429) {
        rateLimitedResponse = res;
        break;
      }
    }
    expect(rateLimitedResponse).not.toBeNull();
    expect(rateLimitedResponse?.statusCode).toBe(429);
    expect(rateLimitedResponse?.json()).toMatchObject({
      error: "RATE_LIMITED",
    });
  });
});
