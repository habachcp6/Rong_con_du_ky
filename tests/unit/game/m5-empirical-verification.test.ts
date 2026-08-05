import { describe, expect, it } from "vitest";
import { getPrerequisiteLandmarkName } from "../../../src/client/content.js";
import {
  DragonChatRequestSchema,
  ItineraryRequestSchema,
  ItineraryResponseSchema,
} from "../../../src/shared/schemas.js";

describe("M5 Empirical Verification", () => {
  describe("getPrerequisiteLandmarkName follows the full ten-quest campaign", () => {
    it("dragon_bridge_lights (Quest 1) -> undefined in VI and EN", () => {
      expect(
        getPrerequisiteLandmarkName("dragon_bridge_lights", "vi"),
      ).toBeUndefined();
      expect(
        getPrerequisiteLandmarkName("dragon_bridge_lights", "en"),
      ).toBeUndefined();
    });

    it("my_khe_clean_wave (Quest 2) -> Cầu Rồng (VI) / Dragon Bridge (EN)", () => {
      expect(getPrerequisiteLandmarkName("my_khe_clean_wave", "vi")).toBe(
        "Cầu Rồng",
      );
      expect(getPrerequisiteLandmarkName("my_khe_clean_wave", "en")).toBe(
        "Dragon Bridge",
      );
    });

    it("marble_five_elements (Quest 3) -> Biển Mỹ Khê (VI) / My Khe Beach (EN)", () => {
      expect(getPrerequisiteLandmarkName("marble_five_elements", "vi")).toBe(
        "Biển Mỹ Khê",
      );
      expect(getPrerequisiteLandmarkName("marble_five_elements", "en")).toBe(
        "My Khe Beach",
      );
    });

    it("son_tra_traces (Quest 4) -> Ngũ Hành Sơn (VI) / Marble Mountains (EN)", () => {
      expect(getPrerequisiteLandmarkName("son_tra_traces", "vi")).toBe(
        "Ngũ Hành Sơn",
      );
      expect(getPrerequisiteLandmarkName("son_tra_traces", "en")).toBe(
        "Marble Mountains",
      );
    });

    it("keeps all six new destinations sequentially locked behind the prior landmark", () => {
      expect(getPrerequisiteLandmarkName("han_river_bridge_turn", "vi")).toBe(
        "Bán Đảo Sơn Trà",
      );
      expect(getPrerequisiteLandmarkName("linh_ung_quiet_path", "en")).toBe(
        "Han River Bridge",
      );
      expect(getPrerequisiteLandmarkName("cham_museum_relic_match", "en")).toBe(
        "Linh Ung Pagoda Son Tra",
      );
      expect(
        getPrerequisiteLandmarkName("non_nuoc_carving_pattern", "en"),
      ).toBe("Cham Museum");
      expect(getPrerequisiteLandmarkName("han_market_basket_sort", "en")).toBe(
        "Non Nuoc Stone Craft Village",
      );
      expect(getPrerequisiteLandmarkName("ba_na_golden_bridge", "en")).toBe(
        "Han Market",
      );
    });
  });

  describe("Schema validations with 1, 4, 10, and 11 items (11 should fail)", () => {
    const makeStrings = (n: number) =>
      Array.from({ length: n }, (_, i) => `item_${i + 1}`);

    describe("DragonChatRequestSchema.unlockedPostcards", () => {
      [1, 4, 10].forEach((count) => {
        it(`validates with ${count} items`, () => {
          const res = DragonChatRequestSchema.safeParse({
            message: "test",
            unlockedPostcards: makeStrings(count),
          });
          expect(res.success).toBe(true);
        });
      });

      it("fails validation with 11 items", () => {
        const res = DragonChatRequestSchema.safeParse({
          message: "test",
          unlockedPostcards: makeStrings(11),
        });
        expect(res.success).toBe(false);
      });
    });

    describe("ItineraryRequestSchema.unlockedPostcards", () => {
      [1, 4, 10].forEach((count) => {
        it(`validates with ${count} items`, () => {
          const res = ItineraryRequestSchema.safeParse({
            unlockedPostcards: makeStrings(count),
            preferences: {},
          });
          expect(res.success).toBe(true);
        });
      });

      it("fails validation with 11 items", () => {
        const res = ItineraryRequestSchema.safeParse({
          unlockedPostcards: makeStrings(11),
          preferences: {},
        });
        expect(res.success).toBe(false);
      });
    });

    describe("ItineraryResponseSchema.stops", () => {
      const makeStops = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
          placeKey: `key_${i}`,
          name: `Stop ${i}`,
          description: `Desc ${i}`,
        }));

      [1, 4, 10].forEach((count) => {
        it(`validates with ${count} stops`, () => {
          const res = ItineraryResponseSchema.safeParse({
            title: "Title",
            summary: "Summary",
            stops: makeStops(count),
            notes: ["Note"],
          });
          expect(res.success).toBe(true);
        });
      });

      it("fails validation with 11 stops", () => {
        const res = ItineraryResponseSchema.safeParse({
          title: "Title",
          summary: "Summary",
          stops: makeStops(11),
          notes: ["Note"],
        });
        expect(res.success).toBe(false);
      });
    });

    describe("ItineraryResponseSchema.notes", () => {
      [1, 4, 10].forEach((count) => {
        it(`validates with ${count} notes`, () => {
          const res = ItineraryResponseSchema.safeParse({
            title: "Title",
            summary: "Summary",
            stops: [{ placeKey: "k", name: "N", description: "D" }],
            notes: makeStrings(count),
          });
          expect(res.success).toBe(true);
        });
      });

      it("fails validation with 11 notes", () => {
        const res = ItineraryResponseSchema.safeParse({
          title: "Title",
          summary: "Summary",
          stops: [{ placeKey: "k", name: "N", description: "D" }],
          notes: makeStrings(11),
        });
        expect(res.success).toBe(false);
      });
    });
  });
});
