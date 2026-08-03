import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSourceRegistry,
  type ValidationIssue,
  type ValidationResult,
} from "./validate-content.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_ASSET_IDS = [
  "dragon_boy",
  "npc_dragon_bridge_guide",
  "npc_my_khe_lifeguard",
  "npc_marble_monk",
  "npc_son_tra_ranger",
  "tileset_da_nang_starter",
  "fragment_dragon_bridge",
  "fragment_my_khe_beach",
  "fragment_marble_mountains",
  "fragment_son_tra_peninsula",
  "ui_interact",
  "ui_map",
  "ui_passport",
  "ui_settings",
  "ui_sound",
  "landmark_dragon_bridge",
  "landmark_my_khe_beach",
  "landmark_marble_mountains",
  "landmark_son_tra_peninsula",
] as const;

const ASSET_CATEGORIES = new Set([
  "character",
  "npc",
  "tileset",
  "fragment",
  "ui",
  "landmark",
]);
const GRID_REQUIRED_CATEGORIES = new Set([
  "character",
  "npc",
  "tileset",
  "fragment",
  "ui",
]);

export type AssetValidationInput = {
  manifest: unknown;
  publicDir: string;
  sourcesMarkdown: string;
};

type ManifestAsset = {
  id: string;
  path: string;
  category: string;
  format: string;
  width: number;
  height: number;
  grid?: {
    tileWidth: number;
    tileHeight: number;
    columns: number;
    rows: number;
  };
  alpha: boolean;
  placeholder: boolean;
  owner: string;
  attributionId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: ValidationIssue[],
  code: string,
  issuePath: string,
  message: string,
) {
  issues.push({ code, path: issuePath, message });
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseGrid(value: unknown): ManifestAsset["grid"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { tileWidth, tileHeight, columns, rows } = value;
  if (![tileWidth, tileHeight, columns, rows].every(isPositiveInteger)) {
    return undefined;
  }
  return { tileWidth, tileHeight, columns, rows };
}

function parseManifestAsset(
  candidate: unknown,
  index: number,
  issues: ValidationIssue[],
): ManifestAsset | undefined {
  const assetPath = `manifest.assets[${index}]`;
  if (!isRecord(candidate)) {
    addIssue(
      issues,
      "ASSET_ENTRY_INVALID",
      assetPath,
      "Asset entry must be an object.",
    );
    return undefined;
  }
  const grid =
    candidate.grid === undefined ? undefined : parseGrid(candidate.grid);
  if (candidate.grid !== undefined && !grid) {
    addIssue(
      issues,
      "ASSET_GRID_INVALID",
      `${assetPath}.grid`,
      "grid must contain positive integer tileWidth, tileHeight, columns, and rows.",
    );
  }
  const fieldsAreValid =
    typeof candidate.id === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.format === "string" &&
    isPositiveInteger(candidate.width) &&
    isPositiveInteger(candidate.height) &&
    typeof candidate.alpha === "boolean" &&
    typeof candidate.placeholder === "boolean" &&
    typeof candidate.owner === "string" &&
    typeof candidate.attributionId === "string";
  if (!fieldsAreValid) {
    addIssue(
      issues,
      "ASSET_ENTRY_INVALID",
      assetPath,
      "Asset requires string id/path/category/format/owner/attributionId, positive width/height, and boolean alpha/placeholder.",
    );
    return undefined;
  }
  return {
    id: candidate.id,
    path: candidate.path,
    category: candidate.category,
    format: candidate.format,
    width: candidate.width,
    height: candidate.height,
    grid,
    alpha: candidate.alpha,
    placeholder: candidate.placeholder,
    owner: candidate.owner,
    attributionId: candidate.attributionId,
  };
}

function readSvgAttribute(svg: string, attribute: string) {
  const root = svg.match(/<svg\b([^>]*)>/iu)?.[1] ?? "";
  const attributePattern = new RegExp(
    `\\b${attribute}\\s*=\\s*["']([^"']+)["']`,
    "iu",
  );
  return root.match(attributePattern)?.[1];
}

function svgDimension(value: string | undefined) {
  if (!value || !/^\d+(?:px)?$/u.test(value)) {
    return undefined;
  }
  return Number.parseInt(value, 10);
}

function validateSvg(
  svg: string,
  asset: ManifestAsset,
  issuePath: string,
  issues: ValidationIssue[],
) {
  const width = svgDimension(readSvgAttribute(svg, "width"));
  const height = svgDimension(readSvgAttribute(svg, "height"));
  if (width !== asset.width || height !== asset.height) {
    addIssue(
      issues,
      "SVG_DIMENSION_MISMATCH",
      issuePath,
      `SVG dimensions ${width ?? "unknown"}×${height ?? "unknown"} do not match manifest ${asset.width}×${asset.height}.`,
    );
  }

  const viewBox = readSvgAttribute(svg, "viewBox");
  if (viewBox !== `0 0 ${asset.width} ${asset.height}`) {
    addIssue(
      issues,
      "SVG_VIEWBOX_MISMATCH",
      issuePath,
      `SVG viewBox must be '0 0 ${asset.width} ${asset.height}'.`,
    );
  }
  if (readSvgAttribute(svg, "shape-rendering") !== "crispEdges") {
    addIssue(
      issues,
      "SVG_PIXEL_RENDERING_MISSING",
      issuePath,
      "SVG placeholder must declare shape-rendering='crispEdges'.",
    );
  }
  if (readSvgAttribute(svg, "data-pixel-art") !== "true") {
    addIssue(
      issues,
      "SVG_PIXEL_MARKER_MISSING",
      issuePath,
      "SVG placeholder must declare data-pixel-art='true'.",
    );
  }
  if (readSvgAttribute(svg, "data-alpha") !== String(asset.alpha)) {
    addIssue(
      issues,
      "SVG_ALPHA_MISMATCH",
      issuePath,
      "SVG data-alpha marker must match the manifest alpha field.",
    );
  }
  if (/<(?:linearGradient|radialGradient|filter)\b/iu.test(svg)) {
    addIssue(
      issues,
      "SVG_SOFT_RENDERING_FORBIDDEN",
      issuePath,
      "Pixel-art assets must not contain gradients or filters.",
    );
  }
  if (/\b(?:href|xlink:href)\s*=\s*["']https?:\/\//iu.test(svg)) {
    addIssue(
      issues,
      "SVG_EXTERNAL_REFERENCE_FORBIDDEN",
      issuePath,
      "Local assets must not fetch external SVG resources.",
    );
  }
}

function validateGrid(
  asset: ManifestAsset,
  tileSize: number,
  issuePath: string,
  issues: ValidationIssue[],
) {
  if (!GRID_REQUIRED_CATEGORIES.has(asset.category)) {
    if (
      asset.category === "landmark" &&
      asset.width * 9 !== asset.height * 16
    ) {
      addIssue(
        issues,
        "LANDMARK_ASPECT_RATIO_INVALID",
        issuePath,
        "Landmark postcard placeholders must use a 16:9 ratio.",
      );
    }
    return;
  }
  if (!asset.grid) {
    addIssue(
      issues,
      "ASSET_GRID_MISSING",
      issuePath,
      `${asset.category} assets require a declared pixel grid.`,
    );
    return;
  }
  const { tileWidth, tileHeight, columns, rows } = asset.grid;
  if (tileWidth !== tileSize || tileHeight !== tileSize) {
    addIssue(
      issues,
      "ASSET_TILE_SIZE_MISMATCH",
      issuePath,
      `Grid cells must be ${tileSize}×${tileSize}.`,
    );
  }
  if (
    asset.width !== tileWidth * columns ||
    asset.height !== tileHeight * rows
  ) {
    addIssue(
      issues,
      "ASSET_GRID_DIMENSION_MISMATCH",
      issuePath,
      "Width and height must equal the declared grid cell size multiplied by columns and rows.",
    );
  }
}

function publicAssetFile(publicDir: string, assetPath: string) {
  if (!assetPath.startsWith("/assets/")) {
    return undefined;
  }
  const root = path.resolve(publicDir);
  const candidate = path.resolve(root, `.${assetPath}`);
  if (!candidate.startsWith(`${root}${path.sep}`)) {
    return undefined;
  }
  return candidate;
}

export function validateAssetManifest(
  input: AssetValidationInput,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const sourceRegistry = parseSourceRegistry(input.sourcesMarkdown);
  issues.push(...sourceRegistry.issues);
  if (!isRecord(input.manifest)) {
    addIssue(
      issues,
      "ASSET_MANIFEST_INVALID",
      "manifest",
      "Asset manifest must be an object.",
    );
    return { ok: false, issues, summary: [] };
  }

  if (input.manifest.version !== 1) {
    addIssue(
      issues,
      "ASSET_MANIFEST_VERSION_INVALID",
      "manifest.version",
      "Asset manifest version must be 1.",
    );
  }
  const tileSize = input.manifest.tileSize;
  if (tileSize !== 32) {
    addIssue(
      issues,
      "ASSET_TILE_SIZE_INVALID",
      "manifest.tileSize",
      "M1 asset contract requires tileSize 32.",
    );
  }
  if (
    !isRecord(input.manifest.palette) ||
    input.manifest.palette.style !== "top-down-pixel-art"
  ) {
    addIssue(
      issues,
      "ASSET_PALETTE_INVALID",
      "manifest.palette",
      "Palette must declare top-down-pixel-art style.",
    );
  } else if (
    !isPositiveInteger(input.manifest.palette.maxColors) ||
    input.manifest.palette.maxColors > 32
  ) {
    addIssue(
      issues,
      "ASSET_PALETTE_INVALID",
      "manifest.palette.maxColors",
      "Palette maxColors must be an integer no greater than 32.",
    );
  }
  if (!Array.isArray(input.manifest.assets)) {
    addIssue(
      issues,
      "ASSET_MANIFEST_INVALID",
      "manifest.assets",
      "Asset manifest must contain an assets array.",
    );
    return { ok: false, issues, summary: [] };
  }

  const parsedAssets = input.manifest.assets
    .map((entry, index) => parseManifestAsset(entry, index, issues))
    .filter((entry): entry is ManifestAsset => entry !== undefined);
  const ids = new Set<string>();
  const paths = new Set<string>();
  const assetIds = new Set(parsedAssets.map((asset) => asset.id));

  for (const requiredId of REQUIRED_ASSET_IDS) {
    if (!assetIds.has(requiredId)) {
      addIssue(
        issues,
        "REQUIRED_ASSET_MISSING",
        "manifest.assets",
        `Required M1 asset '${requiredId}' is missing.`,
      );
    }
  }

  for (const asset of parsedAssets) {
    const assetPath = `manifest.assets.${asset.id}`;
    if (!/^[a-z][a-z0-9_]+$/u.test(asset.id)) {
      addIssue(
        issues,
        "ASSET_ID_INVALID",
        `${assetPath}.id`,
        "Asset IDs must use lowercase snake_case.",
      );
    }
    if (ids.has(asset.id)) {
      addIssue(
        issues,
        "ASSET_ID_DUPLICATE",
        `${assetPath}.id`,
        `Asset ID '${asset.id}' is duplicated.`,
      );
    }
    ids.add(asset.id);
    if (paths.has(asset.path)) {
      addIssue(
        issues,
        "ASSET_PATH_DUPLICATE",
        `${assetPath}.path`,
        `Asset path '${asset.path}' is duplicated.`,
      );
    }
    paths.add(asset.path);
    if (!ASSET_CATEGORIES.has(asset.category)) {
      addIssue(
        issues,
        "ASSET_CATEGORY_INVALID",
        `${assetPath}.category`,
        `Unsupported category '${asset.category}'.`,
      );
    }
    if (asset.format !== "svg" || !asset.path.endsWith(".svg")) {
      addIssue(
        issues,
        "ASSET_FORMAT_INVALID",
        `${assetPath}.format`,
        "M1 placeholder assets must be SVG files declared as format svg.",
      );
    }
    if (!asset.owner.trim()) {
      addIssue(
        issues,
        "ASSET_OWNER_MISSING",
        `${assetPath}.owner`,
        "Every asset needs an owner.",
      );
    }
    if (!asset.attributionId.trim()) {
      addIssue(
        issues,
        "ASSET_ATTRIBUTION_MISSING",
        `${assetPath}.attributionId`,
        "Every asset needs an attribution ID.",
      );
    } else {
      const attribution = sourceRegistry.sources.get(asset.attributionId);
      if (!attribution) {
        addIssue(
          issues,
          "ASSET_ATTRIBUTION_NOT_FOUND",
          `${assetPath}.attributionId`,
          "Asset attribution ID is not present in content/sources.md.",
        );
      } else if (attribution.metadata.kind !== "asset-attribution") {
        addIssue(
          issues,
          "ASSET_ATTRIBUTION_KIND_INVALID",
          `${assetPath}.attributionId`,
          "Asset attribution ID must have kind asset-attribution.",
        );
      }
    }

    validateGrid(
      asset,
      typeof tileSize === "number" ? tileSize : 32,
      assetPath,
      issues,
    );
    const assetFile = publicAssetFile(input.publicDir, asset.path);
    if (!assetFile || !fs.existsSync(assetFile)) {
      addIssue(
        issues,
        "ASSET_FILE_MISSING",
        `${assetPath}.path`,
        `Asset file '${asset.path}' is missing from public/.`,
      );
      continue;
    }
    if (fs.statSync(assetFile).size === 0) {
      addIssue(
        issues,
        "ASSET_FILE_EMPTY",
        `${assetPath}.path`,
        "Asset file is empty.",
      );
      continue;
    }
    if (asset.format === "svg") {
      validateSvg(
        fs.readFileSync(assetFile, "utf8"),
        asset,
        `${assetPath}.path`,
        issues,
      );
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: [
      `assets=${parsedAssets.length}`,
      `requiredAssets=${REQUIRED_ASSET_IDS.length}`,
      `tileSize=${tileSize ?? "unknown"}`,
    ],
  };
}

function readJsonFile(filePath: string, issues: ValidationIssue[]): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown manifest read error.";
    addIssue(issues, "ASSET_MANIFEST_READ_FAILED", filePath, message);
    return undefined;
  }
}

export function validateAssetFiles(
  projectRoot = path.resolve(__dirname, ".."),
): ValidationResult {
  const bootstrapIssues: ValidationIssue[] = [];
  const manifest = readJsonFile(
    path.join(projectRoot, "public", "assets", "manifest.json"),
    bootstrapIssues,
  );
  let sourcesMarkdown = "";
  try {
    sourcesMarkdown = fs.readFileSync(
      path.join(projectRoot, "content", "sources.md"),
      "utf8",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sources read error.";
    addIssue(
      bootstrapIssues,
      "SOURCES_READ_FAILED",
      path.join(projectRoot, "content", "sources.md"),
      message,
    );
  }
  const result = validateAssetManifest({
    manifest,
    publicDir: path.join(projectRoot, "public"),
    sourcesMarkdown,
  });
  result.issues.unshift(...bootstrapIssues);
  result.ok = result.issues.length === 0;
  return result;
}

function isCliInvocation() {
  return (
    Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename
  );
}

if (isCliInvocation()) {
  const result = validateAssetFiles();
  if (result.ok) {
    console.log(`✅ Asset validation passed (${result.summary.join(", ")}).`);
  } else {
    console.error(
      `❌ Asset validation failed with ${result.issues.length} issue(s):`,
    );
    for (const issue of result.issues) {
      console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
  }
}
