import { describe, expect, it, vi } from "vitest";
import { ContentRepository } from "../../../src/server/services/content.js";
import {
  GeminiDragonService,
  requireUnlockedItineraryStops,
} from "../../../src/server/services/dragon.js";

const validReply = JSON.stringify({
  dialogue: "Hãy quan sát nhịp đèn và thử lại bình tĩnh nhé.",
  choices: [{ id: "close", label: "Tiếp tục" }],
  hint: "Đếm theo nhịp hình ảnh.",
  nextAction: "NONE",
  citedPlaceIds: [],
});

const lockedItinerary = JSON.stringify({
  title: "A route",
  summary: "A route that should be rejected.",
  stops: [
    {
      placeKey: "son_tra_peninsula",
      name: "Son Tra",
      description: "This stop has not been unlocked.",
    },
  ],
  notes: [],
});

const createServiceWithResponses = (responses: Array<string | Error>) => {
  const service = new GeminiDragonService({
    apiKey: "test-only-key",
    model: "gemini-test-model",
    content: new ContentRepository(),
  });
  const create = vi.fn();
  responses.forEach((response) => {
    if (response instanceof Error) create.mockRejectedValueOnce(response);
    else create.mockResolvedValueOnce({ output_text: response });
  });
  (
    service as unknown as {
      client: { interactions: { create: typeof create } };
    }
  ).client = { interactions: { create } };
  return { service, create };
};

describe("Gemini itinerary semantic guard", () => {
  it("accepts structured stops only for caller-provided unlocked landmarks", () => {
    const itinerary = {
      title: "Route",
      summary: "One stop",
      stops: [
        {
          placeKey: "dragon_bridge",
          name: "Dragon Bridge",
          description: "A landmark",
        },
      ],
      notes: [],
    };

    expect(requireUnlockedItineraryStops(itinerary, ["dragon_bridge"])).toEqual(
      itinerary,
    );
  });

  it("rejects a valid-JSON model response that introduces a locked landmark", () => {
    expect(() =>
      requireUnlockedItineraryStops(
        {
          title: "Route",
          summary: "Unexpected stop",
          stops: [
            {
              placeKey: "son_tra_peninsula",
              name: "Son Tra",
              description: "Not yet unlocked",
            },
          ],
          notes: [],
        },
        ["dragon_bridge"],
      ),
    ).toThrow("not unlocked");
  });
});

describe("Gemini structured-provider boundary", () => {
  it("accepts a schema-valid provider reply without exposing a client secret", async () => {
    const { service, create } = createServiceWithResponses([validReply]);

    const result = await service.chat({
      language: "vi",
      message: "Cho mình một gợi ý",
      unlockedPostcards: [],
    });

    expect(result).toMatchObject({
      source: "gemini",
      retries: 0,
      reply: { nextAction: "NONE", dialogue: expect.any(String) },
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: "gemini-test-model",
      store: false,
      response_format: { mime_type: "application/json" },
    });
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      timeout: 7_500,
      maxRetries: 0,
    });
  });

  it("retries once after a transient provider failure and then uses valid JSON", async () => {
    const { service, create } = createServiceWithResponses([
      new Error("provider timeout"),
      validReply,
    ]);

    const result = await service.chat({
      language: "en",
      message: "Please help",
      unlockedPostcards: [],
    });

    expect(result).toMatchObject({ source: "gemini", retries: 1 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("falls back after two semantically unsafe itinerary responses", async () => {
    const { service, create } = createServiceWithResponses([
      lockedItinerary,
      lockedItinerary,
    ]);

    const result = await service.itinerary({
      language: "en",
      unlockedPostcards: ["dragon_bridge"],
      preferences: { interests: [] },
    });

    expect(result).toMatchObject({ source: "fallback", retries: 1 });
    expect(
      result.itinerary.stops.every((stop) => stop.placeKey === "dragon_bridge"),
    ).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
