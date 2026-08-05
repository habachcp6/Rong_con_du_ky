# Asset Pipeline Survey & Migration Analysis — Explorer 2

## Executive Summary

This report documents the Asset Pipeline investigation for **Rồng Con Du Ký**. The project is migrating from procedural canvas graphics and SVG placeholder vectors to high-quality 16-bit retro pixel-art raster PNG assets. This migration affects:
1. **10 Landmark Postcards** (`320×180` PNG format)
2. **10 Map Icons** (`48×48` PNG format with transparent background)
3. **1 Overworld Map Background** (`1600×960` PNG format, night theme)

To support this migration, modifications are required across the asset validation script (`scripts/validate-assets.ts`), asset manifest (`public/assets/manifest.json`), Phaser preloader (`src/client/game/scenes/PreloadScene.ts`), canonical landmark definitions (`src/shared/landmark-game-definitions.ts`), content localization files (`content/locations.vi.json`, `content/locations.en.json`), and unit/E2E test files.

---

## 1. Asset Requirements Comparison: Current SVG vs New PNG

| Asset Category | Asset Items & Paths | Dimensions | Current Format & Constraints | New PNG Requirements & Constraints |
|---|---|---|---|---|
| **Landmark Postcards** | 10 items:<br>`public/assets/landmarks/<name>.png`<br>(`dragon-bridge`, `my-khe`, `marble-mountains`, `son-tra`, `han-river-bridge`, `linh-ung`, `cham-museum`, `non-nuoc`, `han-market`, `ba-na-hills`) | 320×180 px (16:9 ratio) | Format: `svg`<br>Validator checks `viewBox`, `shape-rendering="crispEdges"`, `data-pixel-art="true"`, `data-alpha="false"`, max colors. | Format: `png`<br>Raster PNG (320×180).<br>Manifest `format: "png"`, `alpha: false`, `placeholder: false`.<br>Content `authoredImage` points to `.png`. |
| **Map Icons** | 10 items:<br>`public/assets/landmark-icons/<name>.png`<br>(`dragon-bridge`, `my-khe-beach`, `marble-mountains`, `son-tra-peninsula`, `han-river-bridge`, `linh-ung-son-tra`, `cham-museum`, `non-nuoc-stone-village`, `han-market`, `ba-na-hills`) | 48×48 px (previously 32×32) | Format: `svg`<br>Grid size 32×32.<br>Transparent canvas required (`data-alpha="true"`). | Format: `png`<br>Raster PNG with transparent background (`alpha: true`).<br>Dimensions 48×48 px.<br>Grid tile size 48×48 px.<br>Manifest `format: "png"`. |
| **Overworld Map Background** | 1 item:<br>`public/assets/map/overworld-night.png` | 1600×960 px | N/A (procedurally drawn via `drawWorld()` in `OverworldScene.ts` using `Phaser.GameObjects.Graphics`). | Format: `png`<br>Baked raster PNG (1600×960).<br>Night atmosphere (dark tones, Da Nang geography: Han river, coast, starting village, 10 landmark zones).<br>Category: `map_background`.<br>Manifest `format: "png"`, `alpha: false`, `placeholder: false`. |

---

## 2. Detailed File Modification Proposals

### File 1: `scripts/validate-assets.ts`

**Line References & Purpose**:
- **Line 18–54 (`REQUIRED_ASSET_IDS`)**: Add `"map_background_overworld_night"` (or `"map_background_overworld"`) to the required asset list.
- **Line 56–64 (`ASSET_CATEGORIES`)**: Add `"map_background"` to the valid asset category set:
  ```ts
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
  ```
- **Line 65–72 (`GRID_REQUIRED_CATEGORIES`) & `validateGrid` (Line 370–419)**:
  - Currently `GRID_REQUIRED_CATEGORIES` contains `"landmark_icon"`, and `validateGrid` requires `tileWidth === tileSize` (where `tileSize` is 32).
  - Update `validateGrid` so that for `"landmark_icon"`, `tileWidth` and `tileHeight` must equal `asset.width` (48) and `asset.height` (48):
    ```ts
    const expectedTileSize = asset.category === "landmark_icon" ? asset.width : tileSize;
    if (tileWidth !== expectedTileSize || tileHeight !== expectedTileSize) { ... }
    ```
- **Line 609–616 (Format & Extension Check)**:
  - Current code strictly rejects non-SVG files (`asset.format !== "svg"`).
  - Modify format check to allow `"png"` for categories `landmark`, `landmark_icon`, and `map_background`:
    ```ts
    const ALLOWED_PNG_CATEGORIES = new Set(["landmark", "landmark_icon", "map_background"]);
    if (asset.format === "png") {
      if (!ALLOWED_PNG_CATEGORIES.has(asset.category)) {
        addIssue(issues, "ASSET_FORMAT_INVALID", `${assetPath}.format`, `Category '${asset.category}' does not support PNG format.`);
      }
      if (!asset.path.endsWith(".png")) {
        addIssue(issues, "ASSET_FORMAT_INVALID", `${assetPath}.path`, "PNG assets must use .png extension.");
      }
    } else if (asset.format === "svg") {
      if (!asset.path.endsWith(".svg")) {
        addIssue(issues, "ASSET_FORMAT_INVALID", `${assetPath}.path`, "SVG assets must use .svg extension.");
      }
    } else {
      addIssue(issues, "ASSET_FORMAT_INVALID", `${assetPath}.format`, `Unsupported asset format '${asset.format}'.`);
    }
    ```
- **Line 676–694 (SVG vs PNG content inspection)**:
  - Wrap SVG-specific checks (`validateSvg`, palette checks, viewBox checks) inside `if (asset.format === "svg")`.
  - For `asset.format === "png"`:
    - Verify file exists and is non-empty (`fs.statSync(assetFile).size > 0`).
    - Validate binary PNG header (`0x89 50 4E 47 0D 0A 1A 0A`).
    - For `landmark`: enforce `asset.width === 320`, `asset.height === 180`, `asset.placeholder === false`.
    - For `landmark_icon`: enforce `asset.width === 48`, `asset.height === 48`, `asset.alpha === true`, `asset.placeholder === false`.
    - For `map_background`: enforce `asset.width === 1600`, `asset.height === 960`, `asset.alpha === false`, `asset.placeholder === false`.

---

### File 2: `public/assets/manifest.json`

**Changes Required**:
1. **Update 10 Landmark Postcards**:
   - Change `"format": "svg"` to `"format": "png"`.
   - Update `"path"` from `/assets/landmarks/<name>.svg` to `/assets/landmarks/<name>.png`.
   - Keep `width: 320`, `height: 180`, `alpha: false`, `placeholder: false`.
2. **Update 10 Map Icons**:
   - Change `"format": "svg"` to `"format": "png"`.
   - Update `"path"` from `/assets/landmark-icons/<name>.svg` to `/assets/landmark-icons/<name>.png`.
   - Update `width: 48`, `height: 48`.
   - Update `grid`: `{ "tileWidth": 48, "tileHeight": 48, "columns": 1, "rows": 1 }`.
   - Keep `alpha: true`, `placeholder: false`.
3. **Add 1 Overworld Map Background Entry**:
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

---

### File 3: `src/client/game/scenes/PreloadScene.ts`

**Line References & Changes**:
- **Lines 72–77 (`queueManifestGameplayAssets`)**:
  - Replace `this.load.svg(...)` for landmark icons with `this.load.image(...)`:
    ```ts
    LANDMARK_GAME_DEFINITIONS.forEach((definition) => {
      if (definition.mapIconPath.endsWith(".png")) {
        this.load.image(definition.mapIconAssetId, definition.mapIconPath);
      } else {
        this.load.svg(definition.mapIconAssetId, definition.mapIconPath, {
          width: 48,
          height: 48,
        });
      }
    });
    ```
- **Add Map Background Preloading**:
  - Add `this.load.image("map_background_overworld_night", "/assets/map/overworld-night.png");` to `queueManifestGameplayAssets()`.

---

### File 4: `src/shared/landmark-game-definitions.ts`

**Line References & Changes**:
- **Lines 43–144 (`LANDMARK_GAME_DEFINITIONS`)**:
  - Update `mapIconPath` for all 10 landmark definitions from `.svg` to `.png`:
    - `dragon_bridge`: `"/assets/landmark-icons/dragon-bridge.png"`
    - `my_khe_beach`: `"/assets/landmark-icons/my-khe-beach.png"`
    - `marble_mountains`: `"/assets/landmark-icons/marble-mountains.png"`
    - `son_tra_peninsula`: `"/assets/landmark-icons/son-tra-peninsula.png"`
    - `han_river_bridge`: `"/assets/landmark-icons/han-river-bridge.png"`
    - `linh_ung_son_tra`: `"/assets/landmark-icons/linh-ung-son-tra.png"`
    - `cham_museum`: `"/assets/landmark-icons/cham-museum.png"`
    - `non_nuoc_stone_village`: `"/assets/landmark-icons/non-nuoc-stone-village.png"`
    - `han_market`: `"/assets/landmark-icons/han-market.png"`
    - `ba-na-hills`: `"/assets/landmark-icons/ba-na-hills.png"`
- **Lines 191–197 (`validateLandmarkGameDefinitions`)**:
  - Update path extension check to accept `.png`:
    ```ts
    if (
      typeof definition.mapIconPath !== "string" ||
      !definition.mapIconPath.startsWith("/assets/landmark-icons/") ||
      !(definition.mapIconPath.endsWith(".png") || definition.mapIconPath.endsWith(".svg"))
    ) {
      errors.push(`Definition ${index} has an invalid mapIconPath.`);
    }
    ```

---

### File 5: Location Content Files (`content/locations.vi.json` and `content/locations.en.json`)

**Changes Required**:
- In both `locations.vi.json` and `locations.en.json`, update `authoredImage` for all 10 location entries to point to `.png`:
  - `"authoredImage": "/assets/landmarks/<name>.png"`
- This is mandatory because `scripts/validate-content.ts` (lines 578–585) validates that `authoredImage` matches `manifest.json` `path`.

---

### File 6: Unit & E2E Test Suite Alignment

When switching from SVG to PNG, the following test files contain path assertions or regexes that must be updated:
1. `tests/unit/client/gallery.test.ts` (Line 27): Change regex from `/\.svg$/` to `/\.png$/` (or `/\.(png|svg)$/`).
2. `tests/unit/content/asset-validation.test.ts`: Update mock paths and regexes checking `landmark-icons/*.svg` to `.png`.
3. `tests/e2e/landmark-gallery.spec.ts`: Update image `src` assertions from `.svg` to `.png`.
4. `tests/e2e/discoverable-pois.spec.ts`: Update map icon asset references if verified in DOM/network requests.

---

## 3. Verification & Compliance Plan

To ensure 100% verification pass rate (`npm run verify`):
1. **Static Validation**:
   - `npm run validate:content` checks that `authoredImage` paths in `content/locations.*.json` match `manifest.json`.
   - `npm run validate:assets` checks that PNG files exist on disk in `public/assets/landmarks/`, `public/assets/landmark-icons/`, and `public/assets/map/`, with proper format, non-empty size, correct dimensions, and manifest alignment.
2. **Unit Tests**:
   - `npx vitest run` executes all test files and verifies game definitions, content schemas, and client rendering assertions.
3. **E2E Integration & Docker Verification**:
   - Playwright tests verify that map background renders without visual artifacts or broken image links, map icons render at proper positions, and landmark gallery modals load 320×180 PNG postcards smoothly.

---

## Summary Matrix of Affected Code Locations

| File Path | Purpose of Change | Priority / Criticality |
|---|---|---|
| `scripts/validate-assets.ts` | Allow PNG format, add `map_background` category, update grid check for 48x48 icons, add header validation. | Critical (blocks `npm run verify`) |
| `public/assets/manifest.json` | Register 10 PNG postcards, 10 48x48 PNG icons, 1 1600x960 PNG map background. | Critical (blocks content & asset validation) |
| `src/client/game/scenes/PreloadScene.ts` | Preload `overworld-night.png` and PNG icons/postcards via `this.load.image`. | Critical (blocks game runtime loading) |
| `src/shared/landmark-game-definitions.ts` | Update `mapIconPath` to `.png` and update validation function. | Critical (blocks game definition validation) |
| `content/locations.vi.json` & `en.json` | Update `authoredImage` to `.png` paths. | Critical (blocks content validation) |
| `tests/unit/client/gallery.test.ts` & `tests/unit/content/asset-validation.test.ts` | Update assertion regexes and mock paths to `.png`. | High (blocks `npm run verify`) |
| `tests/e2e/*.spec.ts` | Update DOM `src` assertions from `.svg` to `.png`. | High (blocks E2E pipeline) |
