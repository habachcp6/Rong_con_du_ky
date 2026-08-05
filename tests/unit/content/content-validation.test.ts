import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateContentData } from "../../../scripts/validate-content.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../../..");
const contentDir = path.join(projectRoot, "content");

function readJson(relativePath: string) {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
  ) as unknown;
}

function canonicalInput() {
  return {
    locationsVi: readJson("content/locations.vi.json"),
    locationsEn: readJson("content/locations.en.json"),
    dialogueVi: readJson("content/dialogue.vi.json"),
    dialogueEn: readJson("content/dialogue.en.json"),
    curatedPlaces: readJson("content/curated-places.json"),
    sourcesMarkdown: fs.readFileSync(
      path.join(contentDir, "sources.md"),
      "utf8",
    ),
    assetManifest: readJson("public/assets/manifest.json"),
    publicDir: path.join(projectRoot, "public"),
  };
}

describe("M1 canonical content validation", () => {
  it("accepts the checked-in bilingual content, source registry, cards, and asset references", () => {
    const result = validateContentData(canonicalInput());

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("fails when a translated landmark key is missing", () => {
    const input = canonicalInput();
    const locationsEn = structuredClone(input.locationsEn) as Record<
      string,
      unknown
    >;
    delete locationsEn.dragon_bridge;

    const result = validateContentData({ ...input, locationsEn });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === "LOCATION_KEYS_INVALID"),
    ).toBe(true);
  });

  it("fails when a tourism fact loses its declared source", () => {
    const input = canonicalInput();
    const locationsVi = structuredClone(input.locationsVi) as Record<
      string,
      Record<string, unknown>
    >;
    const locationsEn = structuredClone(input.locationsEn) as Record<
      string,
      Record<string, unknown>
    >;
    locationsVi.dragon_bridge.sourceIds = ["source_missing_01"];
    locationsEn.dragon_bridge.sourceIds = ["source_missing_01"];

    const result = validateContentData({ ...input, locationsVi, locationsEn });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === "SOURCE_NOT_FOUND"),
    ).toBe(true);
  });

  it("fails when an authored landmark description falls outside the 50–80 word contract", () => {
    const input = canonicalInput();
    const locationsVi = structuredClone(input.locationsVi) as Record<
      string,
      Record<string, unknown>
    >;
    const locationsEn = structuredClone(input.locationsEn) as Record<
      string,
      Record<string, unknown>
    >;
    locationsVi.dragon_bridge.shortDescription = "Quá ngắn.";
    locationsEn.dragon_bridge.shortDescription = "Too short.";

    const result = validateContentData({ ...input, locationsVi, locationsEn });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === "LOCATION_DESCRIPTION_WORD_COUNT_INVALID",
      ),
    ).toBe(true);
  });

  it("fails when a location no longer points to its canonical postcard asset", () => {
    const input = canonicalInput();
    const locationsVi = structuredClone(input.locationsVi) as Record<
      string,
      Record<string, unknown>
    >;
    const locationsEn = structuredClone(input.locationsEn) as Record<
      string,
      Record<string, unknown>
    >;
    locationsVi.dragon_bridge.assetId = "landmark_my_khe_beach";
    locationsEn.dragon_bridge.assetId = "landmark_my_khe_beach";

    const result = validateContentData({ ...input, locationsVi, locationsEn });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === "LOCATION_POSTCARD_BINDING_MISMATCH",
      ),
    ).toBe(true);
  });

  it("fails if a Starter card fabricates an unverified Place ID", () => {
    const input = canonicalInput();
    const curatedPlaces = structuredClone(input.curatedPlaces) as {
      cards: Array<Record<string, unknown>>;
    };
    curatedPlaces.cards[0].placeId = "ChIJfabricated_123";

    const result = validateContentData({ ...input, curatedPlaces });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === "PLACE_ID_UNVERIFIED_NOT_NULL",
      ),
    ).toBe(true);
  });

  it("fails when restricted live Places data is persisted in a Starter card", () => {
    const input = canonicalInput();
    const curatedPlaces = structuredClone(input.curatedPlaces) as {
      cards: Array<Record<string, unknown>>;
    };
    curatedPlaces.cards[0].rating = 4.9;

    const result = validateContentData({ ...input, curatedPlaces });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === "RESTRICTED_PLACE_DATA"),
    ).toBe(true);
  });
});
