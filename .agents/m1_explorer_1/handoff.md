# Handoff Report — Explorer 1 (Milestone M1: Asset Pipeline & Validator Support)

## 1. Observation

Direct inspection of the repository's asset pipeline validator (`scripts/validate-assets.ts`), asset manifest (`public/assets/manifest.json`), game definitions (`src/shared/landmark-game-definitions.ts`), content location files (`content/locations.vi.json`, `content/locations.en.json`), preloader (`src/client/game/scenes/PreloadScene.ts`), and unit/E2E test files revealed the exact code locations and requirements for Milestone M1.

### A. `scripts/validate-assets.ts` Analysis
1. **`REQUIRED_ASSET_IDS` (lines 18–54)**: Contains 35 required asset IDs. Missing `"map_background_overworld_night"`.
2. **`ASSET_CATEGORIES` (lines 56–64)**: Defined as `Set(["character", "npc", "tileset", "fragment", "ui", "landmark", "landmark_icon"])`. Missing category `"map_background"`.
3. **Asset Format Checks (lines 609–616)**: Rejects any asset where `asset.format !== "svg"` or `!asset.path.endsWith(".svg")`. Lacks support for `"png"` format.
4. **Validation Logic (lines 676–694)**: Only executes `validateSvg()`. Lacks a `validatePng()` function to verify the PNG binary magic header (`89 50 4E 47 0D 0A 1A 0A`) and IHDR chunk dimensions (width/height at byte offset 16 and 20).
5. **Dimension & Aspect Ratio Checks**:
   - `landmark`: Enforces 16:9 ratio and `width: 320, height: 180`.
   - `landmark_icon`: Currently hardcoded to 32×32. Must be updated to 48×48.
   - `map_background`: Missing rules for 1600×960 dimensions, `alpha: false`, and `placeholder: false`.
6. **Grid Validation (`GRID_REQUIRED_CATEGORIES` & `validateGrid`, lines 65–72, 370–419)**: Currently enforces `tileWidth === tileSize` (32px). For 48×48 map icons, grid tile dimensions must equal 48×48px (`tileWidth: 48, tileHeight: 48`).

### B. `public/assets/manifest.json` Analysis
1. **Missing Overworld Map Asset**: No entry exists for `"id": "map_background_overworld_night"`.
2. **10 Landmark Postcards (lines 205–323)**: Declared with `"format": "svg"`, `"path": "/assets/landmarks/<name>.svg"`, `"width": 320`, `"height": 180`. Must be updated to `"format": "png"` and `"path": "/assets/landmarks/<name>.png"`.
3. **10 Map Icons (lines 325–453)**: Declared with `"format": "svg"`, `"path": "/assets/landmark-icons/<name>.svg"`, `"width": 32`, `"height": 32`, `"grid": { "tileWidth": 32, "tileHeight": 32, "columns": 1, "rows": 1 }`. Must be updated to `"format": "png"`, `"path": "/assets/landmark-icons/<name>.png"`, `"width": 48`, `"height": 48`, `"grid": { "tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1 }`.

### C. Downstream File Dependencies
1. **`src/shared/landmark-game-definitions.ts`**:
   - Lines 43–144 (`LANDMARK_GAME_DEFINITIONS`): 10 landmark entries specify `mapIconPath` ending in `.svg`.
   - Line 194 (`validateLandmarkGameDefinitions`): Asserts `!definition.mapIconPath.endsWith(".svg")`. Must update to `.png`.
2. **`content/locations.vi.json` & `content/locations.en.json`**:
   - All 10 landmark entries declare `"authoredImage": "/assets/landmarks/<filename>.svg"`. Must update to `.png`.
3. **`src/client/game/scenes/PreloadScene.ts`**:
   - Lines 72–77: Iterates over definitions and calls `this.load.svg(...)` with 32×32 dimensions. Must call `this.load.image(...)` for PNG icons and load `map_background_overworld_night` at `/assets/map/overworld-night.png`.
4. **Unit and E2E Tests**:
   - `tests/unit/content/asset-validation.test.ts`: Asserts `.svg` regexes, 32×32 dimensions, and SVG attribute tags. Must update for PNG format, 48×48 dimensions, and PNG binary header checks.
   - `tests/unit/client/gallery.test.ts` (line 27): Asserts `location.authoredImage` matches `/^\/assets\/landmarks\/.*\.svg$/`. Must update to `.png$`.
   - `tests/e2e/discoverable-pois.spec.ts` & `tests/e2e/landmark-gallery.spec.ts`: Assert DOM `src` ending in `.svg`. Must update to `.png`.

---

## 2. Logic Chain

1. **Observation A & B (Validator PNG rejection)**: `scripts/validate-assets.ts` currently fails any non-SVG asset. To allow PNG asset pipeline integration in M2 and M3, `validate-assets.ts` must first be updated to accept PNG format for `landmark`, `landmark_icon`, and `map_background`.
2. **Observation A.4 (PNG Header Verification)**: PNG is a binary format (unlike text-based SVG). To ensure corrupted or non-PNG files are not checked in, the validator must inspect the 8-byte PNG binary signature (`89 50 4E 47 0D 0A 1A 0A`) and parse IHDR chunk width/height (bytes 16–23) to verify actual file dimensions match manifest metadata.
3. **Observation B (Manifest Schema Contract)**: Updating `public/assets/manifest.json` establishes the contract for 10 PNG postcards (320×180), 10 PNG icons (48×48), and 1 PNG night map background (1600×960).
4. **Observation C.1 & C.2 (Content & Definition Alignment)**: `scripts/validate-content.ts` compares `location.authoredImage` against `manifest.json` asset paths. Updating `manifest.json` to `.png` without updating `locations.vi.json`, `locations.en.json`, and `landmark-game-definitions.ts` would break content validation.
5. **Observation C.3 & C.4 (Runtime Loader & Test Suite Integrity)**: Phaser's `this.load.image` is required for loading PNG assets. Unit and E2E tests verify asset paths and sizes. Synchronizing loader calls and test assertions guarantees zero regressions when `npm run verify` and E2E suites run.

---

## 3. Caveats

- **Binary PNG Files Creation**: Explorer 1's role is read-only analysis and exact modification specification. Actual binary `.png` asset file generation occurs in M2 (Postcards & Icons) and M3 (Overworld Night Map).
- **Format Support Flexibility**: The validator logic is updated to allow both `.png` and `.svg` for `landmark` and `landmark_icon` categories to support transitional testing, while canonical manifest entries and definitions cut over to `.png`.

---

## 4. Conclusion & Exact Code Modifications Specification

### A. Code Modification Specification for `scripts/validate-assets.ts`

1. **Update `REQUIRED_ASSET_IDS`**:
   Add `"map_background_overworld_night"` to `REQUIRED_ASSET_IDS`:
   ```typescript
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
   ```

2. **Update `ASSET_CATEGORIES` & PNG/SVG Category Sets**:
   ```typescript
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
   ```

3. **Add PNG Header Check and `validatePng()` Function**:
   ```typescript
   const PNG_MAGIC_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
   ```

4. **Update Manifest Entry Format Validation in `validateAssetManifest()`**:
   ```typescript
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
   ```

5. **Update File Content Inspection Call**:
   ```typescript
   if (asset.format === "svg") {
     const svg = fs.readFileSync(assetFile, "utf8");
     validateSvg(svg, asset, `${assetPath}.path`, issues);
   } else if (asset.format === "png") {
     const buffer = fs.readFileSync(assetFile);
     validatePng(buffer, asset, `${assetPath}.path`, issues);
   }
   ```

6. **Update `validateGrid()` for 48×48 Landmark Icons**:
   ```typescript
   function validateGrid(
     asset: ManifestAsset,
     tileSize: number,
     issuePath: string,
     issues: ValidationIssue[],
   ) {
     if (!GRID_REQUIRED_CATEGORIES.has(asset.category)) {
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
     const expectedTileSize = asset.category === "landmark_icon" ? asset.width : tileSize;
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
   ```

---

### B. Specification for `public/assets/manifest.json` Entries

Add `map_background_overworld_night` entry and update 10 `landmark` and 10 `landmark_icon` entries to PNG:

```json
{
  "id": "map_background_overworld_night",
  "path": "/assets/map/overworld-night.png",
  "category": "map_background",
  "format": "png",
  "width": 1600,
  "height": 960,
  "alpha": false,
  "placeholder": false,
  "owner": "Rồng Con Du Ký Hackathon Team",
  "attributionId": "asset_landmark_art_01"
}
```

Postcards (10 entries):
- `landmark_dragon_bridge`: path `"/assets/landmarks/dragon-bridge.png"`, format `"png"`, width `320`, height `180`
- `landmark_my_khe_beach`: path `"/assets/landmarks/my-khe.png"`, format `"png"`, width `320`, height `180`
- `landmark_marble_mountains`: path `"/assets/landmarks/marble-mountains.png"`, format `"png"`, width `320`, height `180`
- `landmark_son_tra_peninsula`: path `"/assets/landmarks/son-tra.png"`, format `"png"`, width `320`, height `180`
- `landmark_han_river_bridge`: path `"/assets/landmarks/han-river-bridge.png"`, format `"png"`, width `320`, height `180`
- `landmark_linh_ung_son_tra`: path `"/assets/landmarks/linh-ung.png"`, format `"png"`, width `320`, height `180`
- `landmark_cham_museum`: path `"/assets/landmarks/cham-museum.png"`, format `"png"`, width `320`, height `180`
- `landmark_non_nuoc_stone_village`: path `"/assets/landmarks/non-nuoc.png"`, format `"png"`, width `320`, height `180`
- `landmark_han_market`: path `"/assets/landmarks/han-market.png"`, format `"png"`, width `320`, height `180`
- `landmark_ba_na_hills`: path `"/assets/landmarks/ba-na-hills.png"`, format `"png"`, width `320`, height `180`

Map Icons (10 entries):
- `landmark_icon_dragon_bridge`: path `"/assets/landmark-icons/dragon-bridge.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_my_khe_beach`: path `"/assets/landmark-icons/my-khe-beach.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_marble_mountains`: path `"/assets/landmark-icons/marble-mountains.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_son_tra_peninsula`: path `"/assets/landmark-icons/son-tra-peninsula.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_han_river_bridge`: path `"/assets/landmark-icons/han-river-bridge.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_linh_ung_son_tra`: path `"/assets/landmark-icons/linh-ung-son-tra.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_cham_museum`: path `"/assets/landmark-icons/cham-museum.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_non_nuoc_stone_village`: path `"/assets/landmark-icons/non-nuoc-stone-village.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_han_market`: path `"/assets/landmark-icons/han-market.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`
- `landmark_icon_ba_na_hills`: path `"/assets/landmark-icons/ba-na-hills.png"`, format `"png"`, width `48`, height `48`, grid `{"tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1}`, alpha `true`

---

### C. Specification for Related Downstream Files

1. **`src/shared/landmark-game-definitions.ts`**:
   - Update `mapIconPath` for all 10 definitions from `.svg` to `.png`.
   - Update line 194 in `validateLandmarkGameDefinitions()`:
     `!definition.mapIconPath.endsWith(".png")`.

2. **`content/locations.vi.json` & `content/locations.en.json`**:
   - Update `authoredImage` for all 10 landmark locations from `/assets/landmarks/<name>.svg` to `/assets/landmarks/<name>.png`.

3. **`src/client/game/scenes/PreloadScene.ts`**:
   - Queue loading of `map_background_overworld_night`:
     `this.load.image("map_background_overworld_night", "/assets/map/overworld-night.png");`
   - Update `queueManifestGameplayAssets()`:
     ```typescript
     LANDMARK_GAME_DEFINITIONS.forEach((definition) => {
       this.load.image(definition.mapIconAssetId, definition.mapIconPath);
     });
     ```

4. **`tests/unit/content/asset-validation.test.ts` & `tests/unit/client/gallery.test.ts`**:
   - Update `gallery.test.ts` line 27 regex matcher to `/^\/assets\/landmarks\/.*\.png$/`.
   - Update `asset-validation.test.ts` to assert 48×48 icon dimensions and `.png` file extension.

---

## 5. Verification Method

To independently verify the implementation of Milestone M1:

1. **Static Validation Commands**:
   ```powershell
   Set-Location "d:\Hackthon-GG2026"
   npm run validate:content
   npm run validate:assets
   ```
   *Expected Output*: `✅ Content validation passed` and `✅ Asset validation passed`.

2. **Narrow Unit Test Suite Execution**:
   ```powershell
   npx vitest run tests/unit/content/asset-validation.test.ts tests/unit/client/gallery.test.ts
   ```
   *Expected Output*: All test cases pass.

3. **Full Project Verification**:
   ```powershell
   npm run verify
   ```
   *Expected Output*: Typecheck, lint, format, vitest unit tests, content validator, asset validator, and Vite client build pass cleanly.

4. **Docker & Playwright E2E Container Pipeline**:
   ```powershell
   docker compose up --build -d
   Start-Sleep -Seconds 15
   Invoke-RestMethod http://127.0.0.1:8080/api/health
   $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:8080"
   npx playwright test --workers=1
   docker compose down
   ```
   *Expected Output*: Health check returns `{"status":"ok"}` and Playwright E2E tests pass.
