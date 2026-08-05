import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAssetManifest,
  validateAssetFiles,
} from "../../scripts/validate-assets.ts";
import {
  LANDMARK_GAME_DEFINITIONS,
  validateLandmarkGameDefinitions,
} from "../../src/shared/landmark-game-definitions.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function getCanonicalInput() {
  const manifestPath = path.join(projectRoot, "public/assets/manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const sourcesMarkdown = fs.readFileSync(
    path.join(projectRoot, "content/sources.md"),
    "utf8"
  );
  return {
    manifest,
    publicDir: path.join(projectRoot, "public"),
    sourcesMarkdown,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

console.log("=== EMPIRICAL TEST SUITE: M1 ASSET PIPELINE & VALIDATOR ===");

// Test 1: Canonical manifest passes validation
const canonicalInput = getCanonicalInput();
const baselineResult = validateAssetManifest(canonicalInput);
assert(
  baselineResult.ok === true && baselineResult.issues.length === 0,
  "Canonical manifest validation passes cleanly",
  JSON.stringify(baselineResult.issues)
);

// Test 2: validateAssetFiles() wrapper function passes on project root
const fileValidationResult = validateAssetFiles(projectRoot);
assert(
  fileValidationResult.ok === true && fileValidationResult.issues.length === 0,
  "validateAssetFiles() passes cleanly on project root",
  JSON.stringify(fileValidationResult.issues)
);

// Test 3: Required 36 asset IDs checked
const assetsArr = (canonicalInput.manifest as any).assets;
assert(
  assetsArr.length >= 36,
  `Manifest contains ${assetsArr.length} assets (>=36 required)`
);

const requiredIds = [
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
];

const manifestIds = new Set(assetsArr.map((a: any) => a.id));
let missingRequired = false;
for (const rid of requiredIds) {
  if (!manifestIds.has(rid)) {
    missingRequired = true;
    console.error(`Missing required asset ID: ${rid}`);
  }
}
assert(!missingRequired, "All 36 required M1 asset IDs are present in manifest");

// Test 4: Missing required asset ID fails validation
const modifiedManifest1 = structuredClone(canonicalInput.manifest) as any;
modifiedManifest1.assets = modifiedManifest1.assets.filter(
  (a: any) => a.id !== "map_background_overworld_night"
);
const resultMissing = validateAssetManifest({
  ...canonicalInput,
  manifest: modifiedManifest1,
});
assert(
  resultMissing.ok === false &&
    resultMissing.issues.some((i) => i.code === "REQUIRED_ASSET_MISSING"),
  "Rejects manifest when required asset ID is missing"
);

// Test 5: Night map background configuration and dimensions
const mapBgAsset = assetsArr.find(
  (a: any) => a.id === "map_background_overworld_night"
);
assert(
  mapBgAsset &&
    mapBgAsset.category === "map_background" &&
    mapBgAsset.format === "png" &&
    mapBgAsset.width === 1600 &&
    mapBgAsset.height === 960 &&
    mapBgAsset.alpha === false &&
    mapBgAsset.placeholder === false,
  "map_background_overworld_night contract matches specification (1600x960 PNG, alpha=false, placeholder=false)"
);

// Test 6: Rejects map background with alpha=true
const modifiedManifest2 = structuredClone(canonicalInput.manifest) as any;
const bgEntry = modifiedManifest2.assets.find(
  (a: any) => a.id === "map_background_overworld_night"
);
bgEntry.alpha = true;
const resultBgAlpha = validateAssetManifest({
  ...canonicalInput,
  manifest: modifiedManifest2,
});
assert(
  resultBgAlpha.ok === false &&
    resultBgAlpha.issues.some(
      (i) => i.code === "MAP_BACKGROUND_ALPHA_FORBIDDEN"
    ),
  "Rejects map background declaring alpha=true"
);

// Test 7: Postcards configuration check (10 PNG postcards, 320x180, alpha=false, placeholder=false)
const postcards = assetsArr.filter((a: any) => a.category === "landmark");
assert(
  postcards.length === 10,
  `Found 10 landmark postcards (got ${postcards.length})`
);

let postcardsValid = true;
for (const p of postcards) {
  if (
    p.format !== "png" ||
    p.width !== 320 ||
    p.height !== 180 ||
    p.alpha !== false ||
    p.placeholder !== false ||
    !p.path.endsWith(".png")
  ) {
    postcardsValid = false;
    console.error("Invalid postcard entry:", p);
  }
}
assert(
  postcardsValid,
  "All 10 landmark postcards use 320x180 PNG, alpha=false, placeholder=false"
);

// Test 8: Map icons configuration check (10 PNG icons, 48x48, grid 48x48, alpha=true, placeholder=false)
const icons = assetsArr.filter((a: any) => a.category === "landmark_icon");
assert(icons.length === 10, `Found 10 landmark map icons (got ${icons.length})`);

let iconsValid = true;
for (const ic of icons) {
  if (
    ic.format !== "png" ||
    ic.width !== 48 ||
    ic.height !== 48 ||
    ic.alpha !== true ||
    ic.placeholder !== false ||
    !ic.path.endsWith(".png") ||
    !ic.grid ||
    ic.grid.tileWidth !== 48 ||
    ic.grid.tileHeight !== 48
  ) {
    iconsValid = false;
    console.error("Invalid icon entry:", ic);
  }
}
assert(
  iconsValid,
  "All 10 landmark map icons use 48x48 PNG, grid 48x48, alpha=true, placeholder=false"
);

// Test 9: PNG Binary IHDR dimension mismatch detection
const modifiedManifest3 = structuredClone(canonicalInput.manifest) as any;
const landmarkEntry = modifiedManifest3.assets.find(
  (a: any) => a.id === "landmark_dragon_bridge"
);
landmarkEntry.width = 400; // Change manifest width to 400 while file on disk is 320
const resultDimensionMismatch = validateAssetManifest({
  ...canonicalInput,
  manifest: modifiedManifest3,
});
assert(
  resultDimensionMismatch.ok === false &&
    resultDimensionMismatch.issues.some(
      (i) => i.code === "PNG_DIMENSION_MISMATCH" || i.code === "LANDMARK_DIMENSION_MISMATCH"
    ),
  "Detects PNG binary IHDR dimension mismatch against manifest"
);

// Test 10: Canonical Landmark Game Definitions validation
const gameDefResult = validateLandmarkGameDefinitions();
assert(
  gameDefResult.valid === true && gameDefResult.errors.length === 0,
  "LANDMARK_GAME_DEFINITIONS validates cleanly with 10 entries",
  JSON.stringify(gameDefResult.errors)
);

// Summary
console.log("\n==================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
