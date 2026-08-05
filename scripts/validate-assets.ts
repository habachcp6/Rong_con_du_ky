import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSourceRegistry,
  type ValidationIssue,
  type ValidationResult,
} from "./validate-content.ts";
import {
  LANDMARK_GAME_DEFINITIONS,
  validateLandmarkGameDefinitions,
} from "../src/shared/landmark-game-definitions.ts";

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
  "map_background_overworld_night",
  "landmark_dragon_bridge",
  "landmark_my_khe_beach",
  "landmark_marble_mountains",
  "landmark_son_tra_peninsula",
  "landmark_han_river_bridge",
  "landmark_linh_ung_son_tra",
  "landmark_cham_museum",
  "landmark_non_nuoc_stone_village",
  "landmark_han_market",
  "landmark_ba_na_hills",
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

const ASSET_CATEGORIES = new Set([
  "character",
  "npc",
  "tileset",
  "fragment",
  "ui",
  "landmark",
  "landmark_icon",
  "map_background",
]);

const PNG_SUPPORTED_CATEGORIES = new Set([
  "landmark",
  "landmark_icon",
  "map_background",
]);

const PNG_MAGIC_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const GRID_REQUIRED_CATEGORIES = new Set([
  "character",
  "npc",
  "tileset",
  "fragment",
  "ui",
  "landmark_icon",
]);

const MAX_LANDMARK_POSTCARD_COLORS = 8;
const MIN_LANDMARK_ICON_COLORS = 5;
const MAX_LANDMARK_ICON_COLORS = 8;

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
  return readTagAttribute(root, attribute);
}

function readTagAttribute(tag: string, attribute: string) {
  const attributePattern = new RegExp(
    `\\b${attribute}\\s*=\\s*["']([^"']+)["']`,
    "iu",
  );
  return tag.match(attributePattern)?.[1];
}

function svgDimension(value: string | undefined) {
  if (!value || !/^\d+(?:px)?$/u.test(value)) {
    return undefined;
  }
  return Number.parseInt(value, 10);
}

export function extractSvgColors(svg: string): Set<string> {
  const matches = svg.match(/#[0-9a-fA-F]{3,8}\b/gu) ?? [];
  return new Set(matches.map((color) => color.toLowerCase()));
}

function svgCoordinate(value: string | undefined, fallback = 0) {
  if (value === undefined) {
    return fallback;
  }
  return /^\d+(?:px)?$/u.test(value) ? Number.parseInt(value, 10) : undefined;
}

function hasOpaqueFullCanvasRect(
  svg: string,
  width: number,
  height: number,
): boolean {
  const rectangles = svg.match(/<rect\b[^>]*>/gu) ?? [];
  return rectangles.some((rectangle) => {
    const x = svgCoordinate(readTagAttribute(rectangle, "x"));
    const y = svgCoordinate(readTagAttribute(rectangle, "y"));
    const rectWidth = svgCoordinate(readTagAttribute(rectangle, "width"));
    const rectHeight = svgCoordinate(readTagAttribute(rectangle, "height"));
    const fill = readTagAttribute(rectangle, "fill");
    const opacity = Number(readTagAttribute(rectangle, "opacity") ?? "1");
    return (
      x === 0 &&
      y === 0 &&
      rectWidth === width &&
      rectHeight === height &&
      fill !== "none" &&
      Number.isFinite(opacity) &&
      opacity > 0
    );
  });
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
  if (asset.category === "landmark" || asset.category === "landmark_icon") {
    const colors = extractSvgColors(svg);
    const colorLimit =
      asset.category === "landmark"
        ? MAX_LANDMARK_POSTCARD_COLORS
        : MAX_LANDMARK_ICON_COLORS;
    if (colors.size > colorLimit) {
      addIssue(
        issues,
        asset.category === "landmark"
          ? "LANDMARK_PALETTE_EXCEEDED"
          : "LANDMARK_ICON_PALETTE_EXCEEDED",
        issuePath,
        `Landmark SVG has ${colors.size} unique hex colors, which exceeds the limit of ${colorLimit}.`,
      );
    }
    if (
      asset.category === "landmark_icon" &&
      colors.size < MIN_LANDMARK_ICON_COLORS
    ) {
      addIssue(
        issues,
        "LANDMARK_ICON_PALETTE_TOO_SMALL",
        issuePath,
        `Landmark map icons need ${MIN_LANDMARK_ICON_COLORS}-${MAX_LANDMARK_ICON_COLORS} unique hex colors; found ${colors.size}.`,
      );
    }
  }
  if (asset.category === "landmark_icon") {
    if (!asset.alpha) {
      addIssue(
        issues,
        "LANDMARK_ICON_ALPHA_REQUIRED",
        issuePath,
        "Landmark map icons must declare alpha=true for a transparent background.",
      );
    }
    if (readSvgAttribute(svg, "data-landmark-icon") !== "true") {
      addIssue(
        issues,
        "LANDMARK_ICON_MARKER_MISSING",
        issuePath,
        "Landmark map icons must declare data-landmark-icon='true'.",
      );
    }
    if (hasOpaqueFullCanvasRect(svg, asset.width, asset.height)) {
      addIssue(
        issues,
        "LANDMARK_ICON_OPAQUE_CANVAS_FORBIDDEN",
        issuePath,
        "Landmark map icons must keep the canvas transparent.",
      );
    }
  }
}

function validatePng(
  buffer: Buffer,
  asset: ManifestAsset,
  issuePath: string,
  issues: ValidationIssue[],
) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC_HEADER)) {
    addIssue(
      issues,
      "PNG_HEADER_INVALID",
      issuePath,
      "PNG file magic header missing or invalid (expected 89 50 4E 47 0D 0A 1A 0A).",
    );
    return;
  }

  if (buffer.length >= 24 && buffer.toString("ascii", 12, 16) === "IHDR") {
    const actualWidth = buffer.readUInt32BE(16);
    const actualHeight = buffer.readUInt32BE(20);
    if (actualWidth !== asset.width || actualHeight !== asset.height) {
      addIssue(
        issues,
        "PNG_DIMENSION_MISMATCH",
        issuePath,
        `PNG binary dimensions ${actualWidth}×${actualHeight} do not match manifest ${asset.width}×${asset.height}.`,
      );
    }
  }

  if (asset.category === "map_background") {
    if (asset.width !== 1600 || asset.height !== 960) {
      addIssue(
        issues,
        "MAP_BACKGROUND_DIMENSION_MISMATCH",
        issuePath,
        "Map background asset must be 1600×960.",
      );
    }
    if (asset.alpha) {
      addIssue(
        issues,
        "MAP_BACKGROUND_ALPHA_FORBIDDEN",
        issuePath,
        "Map background must declare alpha=false.",
      );
    }
  } else if (asset.category === "landmark") {
    if (asset.width !== 320 || asset.height !== 180) {
      addIssue(
        issues,
        "LANDMARK_DIMENSION_MISMATCH",
        issuePath,
        "Landmark postcard asset must be 320×180.",
      );
    }
  } else if (asset.category === "landmark_icon") {
    if (asset.width !== 48 || asset.height !== 48) {
      addIssue(
        issues,
        "LANDMARK_ICON_DIMENSION_MISMATCH",
        issuePath,
        "Landmark icon asset must be 48×48.",
      );
    }
    if (!asset.alpha) {
      addIssue(
        issues,
        "LANDMARK_ICON_ALPHA_REQUIRED",
        issuePath,
        "Landmark icon must declare alpha=true for a transparent background.",
      );
    }
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
  const expectedTileSize =
    asset.category === "landmark_icon" ? asset.width : tileSize;
  if (tileWidth !== expectedTileSize || tileHeight !== expectedTileSize) {
    addIssue(
      issues,
      "ASSET_TILE_SIZE_MISMATCH",
      issuePath,
      `Grid cells must be ${expectedTileSize}×${expectedTileSize}.`,
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

function validateCanonicalLandmarkAssetBindings(
  assets: readonly ManifestAsset[],
  issues: ValidationIssue[],
) {
  const definitionResult = validateLandmarkGameDefinitions();
  for (const error of definitionResult.errors) {
    addIssue(
      issues,
      "LANDMARK_GAME_DEFINITION_INVALID",
      "landmark-game-definitions",
      error,
    );
  }

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const definition of LANDMARK_GAME_DEFINITIONS) {
    const icon = assetsById.get(definition.mapIconAssetId);
    if (
      !icon ||
      icon.category !== "landmark_icon" ||
      icon.path !== definition.mapIconPath
    ) {
      addIssue(
        issues,
        "LANDMARK_ICON_BINDING_MISMATCH",
        `manifest.assets.${definition.mapIconAssetId}`,
        `Landmark '${definition.locationKey}' must declare icon '${definition.mapIconAssetId}' at '${definition.mapIconPath}'.`,
      );
    }

    const postcard = assetsById.get(definition.postcardAssetId);
    if (!postcard || postcard.category !== "landmark") {
      addIssue(
        issues,
        "LANDMARK_POSTCARD_BINDING_MISMATCH",
        `manifest.assets.${definition.postcardAssetId}`,
        `Landmark '${definition.locationKey}' must declare postcard '${definition.postcardAssetId}'.`,
      );
    }
  }
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
  const landmarkIconFingerprints = new Map<string, string>();

  validateCanonicalLandmarkAssetBindings(parsedAssets, issues);

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
    if (
      (asset.category === "landmark" || asset.category === "landmark_icon") &&
      asset.placeholder
    ) {
      addIssue(
        issues,
        asset.category === "landmark"
          ? "LANDMARK_PLACEHOLDER_FORBIDDEN"
          : "LANDMARK_ICON_PLACEHOLDER_FORBIDDEN",
        `${assetPath}.placeholder`,
        "Landmark assets must not be marked as placeholder (placeholder must be false).",
      );
    }
    const isSvg = asset.format === "svg" && asset.path.endsWith(".svg");
    const isPng = asset.format === "png" && asset.path.endsWith(".png");

    if (!isSvg && !isPng) {
      addIssue(
        issues,
        "ASSET_FORMAT_INVALID",
        `${assetPath}.format`,
        "Asset format must be svg (.svg) or png (.png).",
      );
    } else if (isPng && !PNG_SUPPORTED_CATEGORIES.has(asset.category)) {
      addIssue(
        issues,
        "ASSET_FORMAT_INVALID",
        `${assetPath}.format`,
        `Category '${asset.category}' does not support PNG format.`,
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
      const svg = fs.readFileSync(assetFile, "utf8");
      validateSvg(svg, asset, `${assetPath}.path`, issues);
      if (asset.category === "landmark_icon") {
        const fingerprint = createHash("sha256").update(svg).digest("hex");
        const duplicateOf = landmarkIconFingerprints.get(fingerprint);
        if (duplicateOf) {
          addIssue(
            issues,
            "LANDMARK_ICON_DUPLICATE_ART",
            `${assetPath}.path`,
            `Landmark icon artwork duplicates '${duplicateOf}'.`,
          );
        } else {
          landmarkIconFingerprints.set(fingerprint, asset.id);
        }
      }
    } else if (asset.format === "png") {
      const buffer = fs.readFileSync(assetFile);
      validatePng(buffer, asset, `${assetPath}.path`, issues);
      if (asset.category === "landmark_icon") {
        const fingerprint = createHash("sha256").update(buffer).digest("hex");
        const duplicateOf = landmarkIconFingerprints.get(fingerprint);
        if (duplicateOf) {
          addIssue(
            issues,
            "LANDMARK_ICON_DUPLICATE_ART",
            `${assetPath}.path`,
            `Landmark icon artwork duplicates '${duplicateOf}'.`,
          );
        } else {
          landmarkIconFingerprints.set(fingerprint, asset.id);
        }
      }
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
