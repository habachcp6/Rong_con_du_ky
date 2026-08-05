import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSourceRegistry } from "../../../scripts/validate-content.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../../..");
const contentDir = path.join(projectRoot, "content");

const EXPECTED_LANDMARK_KEYS = [
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

function readJson<T>(filename: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(contentDir, filename), "utf8"),
  ) as T;
}

type LocationItem = {
  key: string;
  name: string;
  shortDescription: string;
  funFact: string;
  visitTip: string;
  authoredImage: string;
  assetId: string;
  imageAttributionId: string;
  sourceIds: string[];
};

describe("10 Landmark Content Suite", () => {
  const locationsVi =
    readJson<Record<string, LocationItem>>("locations.vi.json");
  const locationsEn =
    readJson<Record<string, LocationItem>>("locations.en.json");
  const sourcesMarkdown = fs.readFileSync(
    path.join(contentDir, "sources.md"),
    "utf8",
  );
  const { sources } = parseSourceRegistry(sourcesMarkdown);

  it("contains exactly the 10 expected landmark keys in both VI and EN", () => {
    const keysVi = Object.keys(locationsVi);
    const keysEn = Object.keys(locationsEn);

    expect(keysVi).toHaveLength(10);
    expect(keysEn).toHaveLength(10);
    expect(keysVi).toEqual(EXPECTED_LANDMARK_KEYS);
    expect(keysEn).toEqual(EXPECTED_LANDMARK_KEYS);
  });

  it("maintains VI and EN parity across key, assetId, authoredImage, and sourceIds", () => {
    for (const key of EXPECTED_LANDMARK_KEYS) {
      const vi = locationsVi[key];
      const en = locationsEn[key];

      expect(vi).toBeDefined();
      expect(en).toBeDefined();
      expect(vi.key).toBe(key);
      expect(en.key).toBe(key);
      expect(vi.assetId).toBe(en.assetId);
      expect(vi.authoredImage).toBe(en.authoredImage);
      expect(vi.imageAttributionId).toBe(en.imageAttributionId);
      expect(vi.sourceIds).toEqual(en.sourceIds);
    }
  });

  it("ensures shortDescription word count is between 50 and 80 words for all 10 landmarks", () => {
    for (const key of EXPECTED_LANDMARK_KEYS) {
      for (const [lang, item] of [
        ["vi", locationsVi[key]],
        ["en", locationsEn[key]],
      ] as const) {
        const words = item.shortDescription
          .trim()
          .split(/\s+/u)
          .filter(Boolean).length;
        expect(
          words,
          `Landmark '${key}' in ${lang} has ${words} words, expected 50-80`,
        ).toBeGreaterThanOrEqual(50);
        expect(
          words,
          `Landmark '${key}' in ${lang} has ${words} words, expected 50-80`,
        ).toBeLessThanOrEqual(80);
      }
    }
  });

  it("verifies every sourceId in landmark content references a valid tourism-fact source", () => {
    for (const key of EXPECTED_LANDMARK_KEYS) {
      const item = locationsVi[key];
      expect(item.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of item.sourceIds) {
        const source = sources.get(sourceId);
        expect(
          source,
          `Source '${sourceId}' for landmark '${key}' not found in sources.md`,
        ).toBeDefined();
        expect(source?.metadata.kind).toBe("tourism-fact");
      }
    }
  });

  it("verifies landmark postcard asset files exist in public/assets/landmarks/", () => {
    for (const key of EXPECTED_LANDMARK_KEYS) {
      const item = locationsVi[key];
      const imagePath = path.join(projectRoot, "public", item.authoredImage);
      expect(
        fs.existsSync(imagePath),
        `Authored image '${item.authoredImage}' does not exist at '${imagePath}'`,
      ).toBe(true);
    }
  });
});
