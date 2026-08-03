import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateAssetManifest } from "../../../scripts/validate-assets.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../../..");

function canonicalInput() {
  return {
    manifest: JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, "public/assets/manifest.json"),
        "utf8",
      ),
    ) as unknown,
    publicDir: path.join(projectRoot, "public"),
    sourcesMarkdown: fs.readFileSync(
      path.join(projectRoot, "content/sources.md"),
      "utf8",
    ),
  };
}

describe("M1 asset manifest validation", () => {
  it("accepts every checked-in placeholder asset and its 32 px grid contract", () => {
    const result = validateAssetManifest(canonicalInput());

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("fails when a manifest dimension no longer matches the SVG and its grid", () => {
    const input = canonicalInput();
    const manifest = structuredClone(input.manifest) as {
      assets: Array<Record<string, unknown>>;
    };
    const dragonBoy = manifest.assets.find(
      (asset) => asset.id === "dragon_boy",
    );
    if (!dragonBoy) {
      throw new Error("Test fixture missing dragon_boy asset.");
    }
    dragonBoy.width = 96;

    const result = validateAssetManifest({ ...input, manifest });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === "SVG_DIMENSION_MISMATCH"),
    ).toBe(true);
    expect(
      result.issues.some(
        (issue) => issue.code === "ASSET_GRID_DIMENSION_MISMATCH",
      ),
    ).toBe(true);
  });

  it("fails when a declared asset file is absent", () => {
    const input = canonicalInput();
    const manifest = structuredClone(input.manifest) as {
      assets: Array<Record<string, unknown>>;
    };
    const landmark = manifest.assets.find(
      (asset) => asset.id === "landmark_dragon_bridge",
    );
    if (!landmark) {
      throw new Error("Test fixture missing landmark_dragon_bridge asset.");
    }
    landmark.path = "/assets/landmarks/not-present.svg";

    const result = validateAssetManifest({ ...input, manifest });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === "ASSET_FILE_MISSING"),
    ).toBe(true);
  });
});
