import { describe, expect, it } from "vitest";
import { GeminiMapsExplorerService } from "../../../src/server/services/maps-explorer.js";

describe("GeminiMapsExplorerService", () => {
  it("filters fallback places by category and query when offline or without API key", async () => {
    const service = new GeminiMapsExplorerService({
      apiKey: "",
      model: "gemini-2.5-flash",
    });

    const result = await service.explore({
      language: "vi",
      query: "Cầu Tình Yêu",
      category: "sightseeing",
    });

    expect(result.source).toBe("authored_maps");
    expect(result.places.length).toBeGreaterThan(0);
    const loveBridge = result.places.find((p) =>
      p.name.includes("Cầu Tình Yêu"),
    );
    expect(loveBridge).toBeDefined();
    expect(loveBridge?.googleMapsUri).toContain("maps");
    expect(result.groundingSources.length).toBeGreaterThan(0);
  });

  it("handles English language requests cleanly", async () => {
    const service = new GeminiMapsExplorerService({
      apiKey: "",
      model: "gemini-2.5-flash",
    });

    const result = await service.explore({
      language: "en",
      query: "beach",
      category: "nature",
    });

    expect(result.source).toBe("authored_maps");
    expect(result.places.length).toBeGreaterThan(0);
    expect(result.places[0].summary).toBeDefined();
  });
});
