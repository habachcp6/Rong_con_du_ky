import { describe, expect, it, vi } from "vitest";
import {
  ApiClient,
  ApiClientError,
} from "../../../src/client/services/api-client.js";

const recommendationBody = {
  source: "curated",
  places: [
    {
      placeId: null,
      placeIdStatus: "unverified",
      landmarkKey: "dragon_bridge",
      name: "Authored place",
      description: "A local authored card.",
      address: "Da Nang",
      priceRange: "budget",
      dietary: "any",
      googleMapsUri:
        "https://www.google.com/maps/search/?api=1&query=Da%20Nang",
      sourceIds: ["source_card_01"],
    },
  ],
  notice: null,
};

describe("browser API client", () => {
  it("sends the Firebase/local authorization contract and validates a curated response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(recommendationBody), { status: 200 }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({
      baseUrl: "/api",
      getAuthorization: async () => "Bearer dev:test-player",
      fetchImpl,
    });

    await expect(
      client.recommendations({ language: "vi", dietary: "any" }),
    ).resolves.toMatchObject({
      source: "curated",
      places: [{ name: "Authored place" }],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/recommendations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer dev:test-player",
        }),
      }),
    );
  });

  it("does not issue a request without an authenticated browser session", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const client = new ApiClient({
      getAuthorization: async () => null,
      fetchImpl,
    });

    await expect(
      client.recommendations({ language: "en", dietary: "any" }),
    ).rejects.toMatchObject({
      code: "AUTH_UNAVAILABLE",
    } satisfies Partial<ApiClientError>);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an unexpected provider payload instead of passing it into the UI", async () => {
    const client = new ApiClient({
      getAuthorization: async () => "Bearer dev:test-player",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ source: "curated", places: [{}] }), {
          status: 200,
        })) as typeof fetch,
    });

    await expect(
      client.recommendations({ language: "en", dietary: "any" }),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    } satisfies Partial<ApiClientError>);
  });
});
