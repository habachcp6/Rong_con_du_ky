import { describe, expect, it } from "vitest";
import {
  getAllLocationContent,
  getCuratedPlaceCards,
  getLocationContent,
} from "../../../src/client/content";

describe("Landmark Gallery & Detail content helpers", () => {
  it("getAllLocationContent returns all 10 landmarks in Vietnamese and English", () => {
    const viLocations = getAllLocationContent("vi");
    const enLocations = getAllLocationContent("en");

    expect(viLocations).toHaveLength(10);
    expect(enLocations).toHaveLength(10);

    const viKeys = viLocations.map((l) => l.key);
    const enKeys = enLocations.map((l) => l.key);
    expect(viKeys).toEqual(enKeys);
  });

  it("every location content contains complete details for detail panel rendering", () => {
    const locations = getAllLocationContent("vi");
    for (const location of locations) {
      expect(location.key).toBeTruthy();
      expect(location.name).toBeTruthy();
      expect(location.shortDescription).toBeTruthy();
      expect(location.authoredImage).toMatch(/^\/assets\/landmarks\/.*\.png$/);
      expect(location.sourceIds.length).toBeGreaterThan(0);

      // Verify single location lookup
      const fetched = getLocationContent("vi", location.key);
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe(location.name);
    }
  });

  it("every location has at least one associated food card for the detail panel", () => {
    const locations = getAllLocationContent("vi");
    const foodCards = getCuratedPlaceCards("vi");

    for (const location of locations) {
      const cardsForLandmark = foodCards.filter(
        (card) => card.landmarkKey === location.key,
      );
      expect(cardsForLandmark.length).toBeGreaterThanOrEqual(1);
    }
  });
});
