import fastifyRateLimit from "@fastify/rate-limit";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import type { z } from "zod";
import {
  DragonChatRequestSchema,
  ExploreSearchRequestSchema,
  ItineraryRequestSchema,
  PlaceSearchSchema,
  RecommendationRequestSchema,
} from "../shared/schemas.js";
import {
  AuthenticationError,
  createAuthVerifier,
  type AuthIdentity,
  type AuthVerifier,
} from "./auth.js";
import { CONFIG, type AppConfig } from "./config.js";
import { ContentRepository } from "./services/content.js";
import { GeminiDragonService, type DragonService } from "./services/dragon.js";
import {
  GeminiMapsExplorerService,
  type MapsExplorerService,
} from "./services/maps-explorer.js";
import { findCuratedRecommendations } from "./services/recommendations.js";

declare module "fastify" {
  interface FastifyRequest {
    authIdentity: AuthIdentity | null;
  }
}

export type ApiServices = {
  auth: AuthVerifier;
  content: ContentRepository;
  dragon: DragonService;
  mapsExplorer: MapsExplorerService;
};

export type CreateAppOptions = {
  config?: AppConfig;
  services?: Partial<ApiServices>;
  /**
   * The production entry point installs an SPA fallback after registering
   * static files. Unit/API callers retain the API-only 404 handler by default.
   */
  deferNotFoundHandler?: boolean;
};

class UidIpRateLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  public check(identity: AuthIdentity, ip: string, now = Date.now()): boolean {
    const key = `${identity.uid}:${ip}`;
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    current.count += 1;
    return current.count <= 30;
  }
}

const parseRequest = <T>(
  schema: z.ZodType<T>,
  body: unknown,
  reply: FastifyReply,
): T | undefined => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    void reply
      .status(400)
      .send({ error: "INVALID_REQUEST", message: "Request data is invalid" });
    return undefined;
  }
  return parsed.data;
};

const noStore = (reply: FastifyReply) =>
  reply.header("cache-control", "no-store");

export async function createApp(
  options: CreateAppOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? CONFIG;
  const content = options.services?.content ?? new ContentRepository();
  const services: ApiServices = {
    auth: options.services?.auth ?? createAuthVerifier(config),
    content,
    dragon:
      options.services?.dragon ??
      new GeminiDragonService({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        content,
      }),
    mapsExplorer:
      options.services?.mapsExplorer ??
      new GeminiMapsExplorerService({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
      }),
  };
  const uidIpRateLimiter = new UidIpRateLimiter();
  const app = Fastify({
    logger:
      config.env === "test"
        ? false
        : { level: config.env === "production" ? "info" : "warn" },
    bodyLimit: 32 * 1024,
  });

  app.decorateRequest("authIdentity", null);
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: (req) => {
      const url = req.raw.url || req.url || "";
      const pathname = url.split("?")[0];
      if (
        pathname === "/api/health" ||
        pathname.startsWith("/assets/") ||
        pathname === "/favicon.ico" ||
        !pathname.startsWith("/api/")
      ) {
        return true;
      }
      return false;
    },
    errorResponseBuilder: (_req, context) => {
      const err = new Error("Too many requests. Please try again shortly.");
      (err as unknown as Record<string, unknown>).statusCode =
        context.statusCode;
      (err as unknown as Record<string, unknown>).error = "RATE_LIMITED";
      return err;
    },
  });

  // The frontend, Firebase browser SDK and API all share one Cloud Run origin.
  // These headers make that boundary explicit without exposing provider keys.
  app.addHook("onSend", async (request, reply, payload) => {
    reply
      .header("x-request-id", request.id)
      .header("x-content-type-options", "nosniff")
      .header("referrer-policy", "strict-origin-when-cross-origin")
      .header("permissions-policy", "camera=(), geolocation=(), microphone=()");

    if (config.env === "test") {
      reply.header("x-frame-options", "DENY");
    }

    reply.header(
      "content-security-policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors *; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com",
    );
    return payload;
  });

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin || config.env === "production") return;

    if (!config.allowedOrigins.includes(origin)) {
      if (request.method === "OPTIONS") {
        await reply.status(403).send({ error: "ORIGIN_NOT_ALLOWED" });
      }
      return;
    }

    reply
      .header("access-control-allow-origin", origin)
      .header("vary", "origin")
      .header(
        "access-control-allow-headers",
        "authorization, content-type, x-request-id",
      )
      .header("access-control-allow-methods", "GET, POST, OPTIONS");
    if (request.method === "OPTIONS") {
      await reply.status(204).send();
    }
  });

  const authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const identity = await services.auth.verifyAuthorizationHeader(
        request.headers.authorization,
      );
      if (!uidIpRateLimiter.check(identity, request.ip)) {
        await noStore(reply).status(429).send({
          error: "RATE_LIMITED",
          message: "Too many authenticated requests.",
        });
        return;
      }
      request.authIdentity = identity;
    } catch (error) {
      const message =
        error instanceof AuthenticationError
          ? error.message
          : "Authentication failed";
      await noStore(reply).status(401).send({ error: "UNAUTHORIZED", message });
    }
  };

  app.get("/api/health", async (_request, reply) =>
    reply.send({
      status: "ok",
      version: config.appVersion,
      track: "starter",
      providers: {
        geminiConfigured: Boolean(config.geminiApiKey),
        firebaseServerAuth: !config.allowLocalAuth,
      },
      timestamp: new Date().toISOString(),
    }),
  );

  app.post(
    "/api/dragon/chat",
    { preHandler: authenticate },
    async (request, reply) => {
      const input = parseRequest(DragonChatRequestSchema, request.body, reply);
      if (!input || !request.authIdentity) return;

      const result = await services.dragon.chat(input);
      request.log.info(
        {
          requestId: request.id,
          authProvider: request.authIdentity.provider,
          route: "dragon/chat",
          source: result.source,
        },
        "AI response served",
      );
      return noStore(reply).send({
        ...result,
        fallback: result.source === "fallback",
      });
    },
  );

  app.post(
    "/api/recommendations",
    { preHandler: authenticate },
    async (request, reply) => {
      const input = parseRequest(
        RecommendationRequestSchema,
        request.body,
        reply,
      );
      if (!input || !request.authIdentity) return;

      const result = findCuratedRecommendations(services.content, input);
      request.log.info(
        {
          requestId: request.id,
          authProvider: request.authIdentity.provider,
          route: "recommendations",
          count: result.places.length,
        },
        "Curated recommendations served",
      );
      return noStore(reply).send(result);
    },
  );

  app.post(
    "/api/itinerary",
    { preHandler: authenticate },
    async (request, reply) => {
      const input = parseRequest(ItineraryRequestSchema, request.body, reply);
      if (!input || !request.authIdentity) return;

      const result = await services.dragon.itinerary(input);
      request.log.info(
        {
          requestId: request.id,
          authProvider: request.authIdentity.provider,
          route: "itinerary",
          source: result.source,
        },
        "Itinerary served",
      );
      return noStore(reply).send({
        ...result,
        fallback: result.source === "fallback",
      });
    },
  );

  app.post(
    "/api/explore/search",
    { preHandler: authenticate },
    async (request, reply) => {
      const input = parseRequest(
        ExploreSearchRequestSchema,
        request.body,
        reply,
      );
      if (!input || !request.authIdentity) return;

      const result = await services.mapsExplorer.explore(input);
      request.log.info(
        {
          requestId: request.id,
          authProvider: request.authIdentity.provider,
          route: "explore/search",
          source: result.source,
          count: result.places.length,
        },
        "Explore search served",
      );
      return noStore(reply).send(result);
    },
  );

  app.post(
    "/api/places/search",
    { preHandler: authenticate },
    async (request, reply) => {
      const input = parseRequest(PlaceSearchSchema, request.body, reply);
      if (!input || !request.authIdentity) return;
      return noStore(reply).status(501).send({
        error: "STANDARD_TRACK_DISABLED",
        message:
          "Places API is intentionally disabled in the Starter track. Use curated recommendations instead.",
      });
    },
  );

  app.get(
    "/api/places/:placeId",
    { preHandler: authenticate },
    async (_request, reply) =>
      noStore(reply).status(501).send({
        error: "STANDARD_TRACK_DISABLED",
        message:
          "Place Details is intentionally disabled in the Starter track.",
      }),
  );

  app.get(
    "/api/places/:placeId/photo",
    { preHandler: authenticate },
    async (_request, reply) =>
      noStore(reply).status(501).send({
        error: "STANDARD_TRACK_DISABLED",
        message:
          "Place Photos are intentionally disabled in the Starter track.",
      }),
  );

  if (!options.deferNotFoundHandler) {
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "API route not found" });
      }
      return reply.status(404).send({ error: "NOT_FOUND" });
    });
  }

  app.setErrorHandler((error, request, reply) => {
    const errObj = error as
      | (Error & { statusCode?: number; error?: string; code?: string })
      | undefined;
    const statusCode =
      typeof errObj?.statusCode === "number"
        ? errObj.statusCode
        : errObj?.error === "RATE_LIMITED"
          ? 429
          : 500;

    if (
      statusCode === 429 ||
      errObj?.error === "RATE_LIMITED" ||
      errObj?.code === "FST_ERR_RATE_LIMIT_EXCEEDED"
    ) {
      return noStore(reply)
        .status(429)
        .send({
          error: "RATE_LIMITED",
          message:
            typeof errObj?.message === "string"
              ? errObj.message
              : "Too many requests. Please try again shortly.",
        });
    }

    if (statusCode >= 400 && statusCode < 500) {
      return noStore(reply)
        .status(statusCode)
        .send({
          error:
            typeof errObj?.error === "string" ? errObj.error : "CLIENT_ERROR",
          message:
            typeof errObj?.message === "string"
              ? errObj.message
              : "Request failed.",
        });
    }

    request.log.error(
      { err: error, requestId: request.id, route: request.routeOptions?.url },
      "Unhandled API error",
    );
    return noStore(reply).status(500).send({
      error: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    });
  });

  return app;
}
