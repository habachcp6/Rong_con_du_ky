import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extractSvgColors,
  validateAssetManifest,
} from "../../../scripts/validate-assets.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../../..");
const LANDMARK_ICON_IDS = [
  "landmark_icon_dragon_bridge",
  "landmark_icon_my_khe_beach",
  "landmark_icon_marble_mountains",
  "landmark_icon_son_tra_peninsula",
  "landmark_icon_han_river_bridge",
  "landmark_icon_linh_ung_son_tra",
  "landmark_icon_cham_museum",
  "landmark_icon_non_nuoc_stone_village",
  "landmark_icon_han_market",
  "landmark_icon_ba_na_hills",
] as const;

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
  it("accepts every checked-in authored asset and its 32 px grid contract", () => {
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
    landmark.path = "/assets/landmarks/not-present.png";

    const result = validateAssetManifest({ ...input, manifest });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === "ASSET_FILE_MISSING"),
    ).toBe(true);
  });

  it("enforces the simplified eight-color landmark and icon palettes", () => {
    const input = canonicalInput();
    const result = validateAssetManifest(input);
    expect(result.ok).toBe(true);
    expect(
      result.issues.some((issue) => issue.code === "LANDMARK_PALETTE_EXCEEDED"),
    ).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === "LANDMARK_ICON_PALETTE_EXCEEDED",
      ),
    ).toBe(false);

    const colors = extractSvgColors(
      '<rect fill="#FF0000"/><rect fill="#ff0000"/><rect stroke="#00FF00"/>',
    );
    expect(colors.size).toBe(2);
    expect(colors.has("#ff0000")).toBe(true);
    expect(colors.has("#00ff00")).toBe(true);

    const manifest = input.manifest as {
      assets: Array<{ category: string; path: string; format?: string }>;
    };
    for (const asset of manifest.assets.filter(
      (entry) =>
        entry.category === "landmark" || entry.category === "landmark_icon",
    )) {
      const assetPath = path.join(projectRoot, "public", asset.path);
      if (asset.format === "svg" || asset.path.endsWith(".svg")) {
        const svg = fs.readFileSync(assetPath, "utf8");
        expect(extractSvgColors(svg).size).toBeLessThanOrEqual(8);
      } else {
        const buffer = fs.readFileSync(assetPath);
        expect(buffer.subarray(0, 4)).toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        );
      }
    }
  });

  it("registers one transparent, non-placeholder map icon for every landmark", () => {
    const input = canonicalInput();
    const manifest = input.manifest as {
      assets: Array<Record<string, unknown>>;
    };
    const icons = manifest.assets.filter(
      (asset) => asset.category === "landmark_icon",
    );

    expect(icons).toHaveLength(10);
    expect(icons.map((asset) => asset.id).sort()).toEqual(
      [...LANDMARK_ICON_IDS].sort(),
    );

    const fingerprints = new Set<string>();
    for (const icon of icons) {
      expect(icon.width).toBe(48);
      expect(icon.height).toBe(48);
      expect(icon.alpha).toBe(true);
      expect(icon.placeholder).toBe(false);
      expect(icon.path).toMatch(/^\/assets\/landmark-icons\/.+\.(png|svg)$/u);
      expect(icon.grid).toEqual({
        tileWidth: 48,
        tileHeight: 48,
        columns: 1,
        rows: 1,
      });

      const iconPath = path.join(projectRoot, "public", String(icon.path));
      if (String(icon.path).endsWith(".svg")) {
        const svg = fs.readFileSync(iconPath, "utf8");
        expect(svg).toContain('data-landmark-icon="true"');
        expect(extractSvgColors(svg).size).toBeGreaterThanOrEqual(5);
        expect(extractSvgColors(svg).size).toBeLessThanOrEqual(8);
        expect(svg).not.toMatch(
          /<rect\b(?=[^>]*\bwidth=["']32["'])(?=[^>]*\bheight=["']32["'])/u,
        );
        fingerprints.add(svg);
      } else {
        const buffer = fs.readFileSync(iconPath);
        expect(buffer.subarray(0, 4)).toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        );
        fingerprints.add(buffer.toString("base64"));
      }
    }
    expect(fingerprints.size).toBe(10);
  });

  it("rejects an invalid or corrupted landmark icon file", () => {
    const input = canonicalInput();
    const temporaryPublicDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "rong-con-du-ky-assets-"),
    );
    fs.cpSync(input.publicDir, temporaryPublicDir, { recursive: true });

    try {
      const iconPath = path.join(
        temporaryPublicDir,
        "assets/landmark-icons/dragon-bridge.png",
      );
      fs.writeFileSync(iconPath, Buffer.from([0x00, 0x00, 0x00, 0x00]));

      const result = validateAssetManifest({
        ...input,
        publicDir: temporaryPublicDir,
      });
      expect(result.ok).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.code === "PNG_HEADER_INVALID" ||
            issue.code === "LANDMARK_ICON_PALETTE_TOO_SMALL",
        ),
      ).toBe(true);
    } finally {
      fs.rmSync(temporaryPublicDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("rejects an opaque or placeholder landmark icon declaration", () => {
    const input = canonicalInput();
    const manifest = structuredClone(input.manifest) as {
      assets: Array<Record<string, unknown>>;
    };
    const icon = manifest.assets.find(
      (asset) => asset.id === "landmark_icon_dragon_bridge",
    );
    if (!icon) {
      throw new Error("Test fixture missing landmark_icon_dragon_bridge.");
    }
    icon.alpha = false;
    icon.placeholder = true;

    const result = validateAssetManifest({ ...input, manifest });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === "LANDMARK_ICON_ALPHA_REQUIRED",
      ),
    ).toBe(true);
    expect(
      result.issues.some(
        (issue) => issue.code === "LANDMARK_ICON_PLACEHOLDER_FORBIDDEN",
      ),
    ).toBe(true);
  });

  it("rejects an icon that no longer matches the canonical location binding", () => {
    const input = canonicalInput();
    const manifest = structuredClone(input.manifest) as {
      assets: Array<Record<string, unknown>>;
    };
    const icon = manifest.assets.find(
      (asset) => asset.id === "landmark_icon_dragon_bridge",
    );
    if (!icon) {
      throw new Error("Test fixture missing dragon bridge landmark icon.");
    }
    icon.path = "/assets/landmark-icons/han-market.png";

    const result = validateAssetManifest({ ...input, manifest });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === "LANDMARK_ICON_BINDING_MISMATCH",
      ),
    ).toBe(true);
  });
});
