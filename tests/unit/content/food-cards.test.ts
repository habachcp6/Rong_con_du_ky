import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSourceRegistry } from "../../../scripts/validate-content.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../../..");
const contentDir = path.join(projectRoot, "content");

const ALL_LANDMARK_KEYS = [
  "dragon_bridge",
  "my_khe_beach",
  "marble_mountains",
  "son_tra_peninsula",
  "han_river_bridge",
  "linh_ung_son_tra",
  "cham_museum",
  "non_nuoc_stone_village",
  "han_market",
  "ba_na_hills",
] as const;

const RESTRICTED_FIELDS = [
  "rating",
  "userRatingCount",
  "reviews",
  "openingHours",
  "openNow",
  "photos",
  "photoUrl",
];

type FoodCard = {
  id: string;
  placeId: string | null;
  placeIdStatus: "verified" | "unverified";
  landmarkKey: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  address: string;
  priceRange: "budget" | "moderate" | "premium";
  dietary: "any" | "vegetarian";
  googleMapsUri: string;
  sourceIds: string[];
};

type CuratedPlacesFile = {
  version: number;
  cards: FoodCard[];
};

describe("Curated Food Cards Suite", () => {
  const curatedPlaces = JSON.parse(
    fs.readFileSync(path.join(contentDir, "curated-places.json"), "utf8"),
  ) as CuratedPlacesFile;
  const sourcesMarkdown = fs.readFileSync(
    path.join(contentDir, "sources.md"),
    "utf8",
  );
  const { sources } = parseSourceRegistry(sourcesMarkdown);

  it("contains at least 12 food cards", () => {
    expect(curatedPlaces.cards.length).toBeGreaterThanOrEqual(12);
  });

  it("covers all 10 landmarks with at least 1 food card per landmark", () => {
    const coveredLandmarks = new Set(
      curatedPlaces.cards.map((card) => card.landmarkKey),
    );
    for (const key of ALL_LANDMARK_KEYS) {
      expect(
        coveredLandmarks.has(key),
        `Landmark '${key}' is missing a food card mapping`,
      ).toBe(true);
    }
  });

  it("contains a mix of budget, moderate, and premium price ranges", () => {
    const priceRanges = new Set(
      curatedPlaces.cards.map((card) => card.priceRange),
    );
    expect(priceRanges.has("budget")).toBe(true);
    expect(priceRanges.has("moderate")).toBe(true);
    expect(priceRanges.has("premium")).toBe(true);
  });

  it("contains both any and vegetarian dietary options", () => {
    const dietaryOptions = new Set(
      curatedPlaces.cards.map((card) => card.dietary),
    );
    expect(dietaryOptions.has("any")).toBe(true);
    expect(dietaryOptions.has("vegetarian")).toBe(true);
  });

  it("ensures no card contains restricted live Places fields", () => {
    for (const card of curatedPlaces.cards as unknown as Array<
      Record<string, unknown>
    >) {
      for (const field of RESTRICTED_FIELDS) {
        expect(
          field in card,
          `Card '${card.id}' contains restricted Places field '${field}'`,
        ).toBe(false);
      }
    }
  });

  it("validates Google Maps URIs and source ID citations for every food card", () => {
    for (const card of curatedPlaces.cards) {
      expect(card.googleMapsUri).toMatch(
        /^https:\/\/(www\.)?google\.com\/maps\/|https:\/\/maps\.app\.goo\.gl\//,
      );
      expect(card.sourceIds.length).toBeGreaterThanOrEqual(2);
      for (const sourceId of card.sourceIds) {
        expect(
          sources.has(sourceId),
          `Source '${sourceId}' for card '${card.id}' not found in sources.md`,
        ).toBe(true);
      }
    }
  });
});
