import { describe, expect, it } from "vitest";
import {
  sanitizeAnalyticsProperties,
  trackAnalytics,
} from "../../../src/client/services/analytics.js";

describe("privacy-safe analytics adapter", () => {
  it("keeps only bounded primitive properties", () => {
    const properties = sanitizeAnalyticsProperties({
      quest_id: "dragon_bridge_lights",
      count: 4,
      enabled: true,
      "bad key": "drop",
      oversized: "x".repeat(200),
    });

    expect(properties).toEqual({
      quest_id: "dragon_bridge_lights",
      count: 4,
      enabled: true,
      oversized: "x".repeat(80),
    });
  });

  it("does not require a browser analytics SDK to construct an event", () => {
    expect(trackAnalytics("game_start", { language: "vi" })).toMatchObject({
      name: "game_start",
      properties: { language: "vi" },
    });
  });
});
