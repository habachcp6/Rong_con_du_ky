import {
  DragonChatResponseSchema,
  ExploreSearchResponseSchema,
  ItineraryApiResponseSchema,
  RecommendationResponseSchema,
  type DragonChatRequest,
  type DragonChatResponse,
  type ExploreSearchRequest,
  type ExploreSearchResponse,
  type ItineraryApiResponse,
  type ItineraryRequest,
  type RecommendationRequest,
  type RecommendationResponse,
} from "../../shared/schemas";
import type { z } from "zod";

export type AuthorizationProvider = () => Promise<string | null>;

export type ApiClientOptions = {
  baseUrl?: string;
  getAuthorization?: AuthorizationProvider;
  fetchImpl?: typeof fetch;
};

export class ApiClientError extends Error {
  public constructor(
    public readonly code:
      "AUTH_UNAVAILABLE" | "NETWORK_ERROR" | "HTTP_ERROR" | "INVALID_RESPONSE",
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const defaultBaseUrl = (): string =>
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL)
    : "/api";

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string"
      ? body.message
      : response.statusText;
  } catch {
    return response.statusText || "The request could not be completed.";
  }
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getAuthorization: AuthorizationProvider;

  public constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? defaultBaseUrl()).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.getAuthorization = options.getAuthorization ?? (async () => null);
  }

  public chat(input: DragonChatRequest): Promise<DragonChatResponse> {
    return this.post("/dragon/chat", input, DragonChatResponseSchema);
  }

  public recommendations(
    input: RecommendationRequest,
  ): Promise<RecommendationResponse> {
    return this.post("/recommendations", input, RecommendationResponseSchema);
  }

  public explore(input: ExploreSearchRequest): Promise<ExploreSearchResponse> {
    return this.post("/explore/search", input, ExploreSearchResponseSchema);
  }

  public itinerary(input: ItineraryRequest): Promise<ItineraryApiResponse> {
    return this.post("/itinerary", input, ItineraryApiResponseSchema);
  }

  private async post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const authorization = await this.getAuthorization();
    if (!authorization) {
      throw new ApiClientError(
        "AUTH_UNAVAILABLE",
        "A signed-in game session is not available.",
      );
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiClientError(
        "NETWORK_ERROR",
        "The service could not be reached.",
      );
    }

    if (!response.ok) {
      throw new ApiClientError("HTTP_ERROR", await parseErrorMessage(response));
    }

    try {
      return schema.parse(await response.json());
    } catch {
      throw new ApiClientError(
        "INVALID_RESPONSE",
        "The service returned an unexpected response.",
      );
    }
  }
}

/** Firebase is loaded only after a user actually opens an AI/travel tool. */
export async function createBrowserApiClient(): Promise<ApiClient> {
  const { getApiAuthorizationHeader } = await import("./firebase-client");
  return new ApiClient({ getAuthorization: getApiAuthorizationHeader });
}
