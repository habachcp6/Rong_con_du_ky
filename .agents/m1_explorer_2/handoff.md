# Handoff Report — M1 Explorer 2 (Asset Pipeline & Validator Support)

## 1. Observation

Direct file inspection of `PreloadScene.ts`, `landmark-game-definitions.ts`, `locations.vi.json`, and `locations.en.json` yields the following exact observations:

### 1.1 `src/client/game/scenes/PreloadScene.ts`
- **Lines 72–77**: Currently queues landmark icons using `this.load.svg` with rasterization dimensions `{ width: 32, height: 32 }`:
  ```typescript
  LANDMARK_GAME_DEFINITIONS.forEach((definition) => {
    this.load.svg(definition.mapIconAssetId, definition.mapIconPath, {
      width: 32,
      height: 32,
    });
  });
  ```
- **Missing Asset Preloading**:
  - Does NOT preload the new 1600×960 pixel-art night map background (`map_background_overworld_night` at `/assets/map/overworld-night.png`).
  - Does NOT preload PNG postcards (`landmark_<key>` at `/assets/landmarks/<filename>.png`) into the Phaser texture cache.

### 1.2 `src/shared/landmark-game-definitions.ts`
- **Lines 43–144 (`LANDMARK_GAME_DEFINITIONS`)**: All 10 landmark definitions specify `mapIconPath` ending in `.svg`:
  - Line 49 (`dragon_bridge`): `mapIconPath: "/assets/landmark-icons/dragon-bridge.svg"`
  - Line 59 (`my_khe_beach`): `mapIconPath: "/assets/landmark-icons/my-khe-beach.svg"`
  - Line 69 (`marble_mountains`): `mapIconPath: "/assets/landmark-icons/marble-mountains.svg"`
  - Line 79 (`son_tra_peninsula`): `mapIconPath: "/assets/landmark-icons/son-tra-peninsula.svg"`
  - Line 89 (`han_river_bridge`): `mapIconPath: "/assets/landmark-icons/han-river-bridge.svg"`
  - Line 99 (`linh_ung_son_tra`): `mapIconPath: "/assets/landmark-icons/linh-ung-son-tra.svg"`
  - Line 109 (`cham_museum`): `mapIconPath: "/assets/landmark-icons/cham-museum.svg"`
  - Line 119 (`non_nuoc_stone_village`): `mapIconPath: "/assets/landmark-icons/non-nuoc-stone-village.svg"`
  - Line 129 (`han_market`): `mapIconPath: "/assets/landmark-icons/han-market.svg"`
  - Line 139 (`ba_na_hills`): `mapIconPath: "/assets/landmark-icons/ba-na-hills.svg"`
- **Lines 191–197 (`validateLandmarkGameDefinitions`)**:
  ```typescript
  if (
    typeof definition.mapIconPath !== "string" ||
    !definition.mapIconPath.startsWith("/assets/landmark-icons/") ||
    !definition.mapIconPath.endsWith(".svg")
  ) {
    errors.push(`Definition ${index} has an invalid mapIconPath.`);
  }
  ```
  Explicitly requires `mapIconPath` to end with `.svg`.

### 1.3 `content/locations.vi.json` and `content/locations.en.json`
- Both files contain 10 landmark definitions.
- All 10 definitions in both files specify `"authoredImage"` referencing `.svg` files in `/assets/landmarks/`:
  - `dragon_bridge`: `"/assets/landmarks/dragon-bridge.svg"` (Line 8)
  - `my_khe_beach`: `"/assets/landmarks/my-khe.svg"` (Line 19)
  - `marble_mountains`: `"/assets/landmarks/marble-mountains.svg"` (Line 30)
  - `son_tra_peninsula`: `"/assets/landmarks/son-tra.svg"` (Line 41)
  - `han_river_bridge`: `"/assets/landmarks/han-river-bridge.svg"` (Line 52)
  - `linh_ung_son_tra`: `"/assets/landmarks/linh-ung.svg"` (Line 63)
  - `cham_museum`: `"/assets/landmarks/cham-museum.svg"` (Line 74)
  - `non_nuoc_stone_village`: `"/assets/landmarks/non-nuoc.svg"` (Line 85)
  - `han_market`: `"/assets/landmarks/han-market.svg"` (Line 96)
  - `ba_na_hills`: `"/assets/landmarks/ba-na-hills.svg"` (Line 107)

---

## 2. Logic Chain & Analysis of Code Modifications

### 2.1 Updating `src/client/game/scenes/PreloadScene.ts`
- **Reasoning**: In Phaser 3/4, SVG assets are loaded via `this.load.svg(key, url, { width, height })`, whereas PNG raster images are loaded via `this.load.image(key, url)`. Switching from 32×32 SVG icons to 48×48 PNG icons requires calling `this.load.image(definition.mapIconAssetId, definition.mapIconPath)`. Furthermore, `OverworldScene.ts` requires the baked night map texture `"map_background_overworld_night"` to be preloaded, and landmark postcard images (`landmark_<key>`) should be preloaded as PNGs.
- **Exact Code Change**:
  In `PreloadScene.ts`, replace lines 72–77 with:
  ```typescript
      // Load baked 1600x960 pixel-art night map background
      this.load.image(
        "map_background_overworld_night",
        "/assets/map/overworld-night.png",
      );

      // Load 10 PNG map icons and 10 PNG landmark postcards
      LANDMARK_GAME_DEFINITIONS.forEach((definition) => {
        this.load.image(definition.mapIconAssetId, definition.mapIconPath);
        const postcardFilename =
          definition.locationKey === "my_khe_beach"
            ? "my-khe"
            : definition.locationKey === "son_tra_peninsula"
              ? "son-tra"
              : definition.locationKey === "linh_ung_son_tra"
                ? "linh-ung"
                : definition.locationKey === "non_nuoc_stone_village"
                  ? "non-nuoc"
                  : definition.locationKey.replace(/_/g, "-");
        this.load.image(
          definition.postcardAssetId,
          `/assets/landmarks/${postcardFilename}.png`,
        );
      });
  ```

### 2.2 Updating `src/shared/landmark-game-definitions.ts`
- **Reasoning**: `LANDMARK_GAME_DEFINITIONS` acts as the single source of truth for landmark-to-asset bindings across Phaser scenes and content validators. Changing asset formats from `.svg` to `.png` requires updating the `mapIconPath` property of all 10 landmark objects from `.svg` to `.png`. Additionally, `validateLandmarkGameDefinitions` must be updated so that it validates that `mapIconPath` ends with `.png` instead of `.svg`.
- **Exact Code Changes**:
  1. In `LANDMARK_GAME_DEFINITIONS` (lines 49, 59, 69, 79, 89, 99, 109, 119, 129, 139), replace all `.svg` extensions with `.png`:
     ```typescript
     mapIconPath: "/assets/landmark-icons/dragon-bridge.png",
     mapIconPath: "/assets/landmark-icons/my-khe-beach.png",
     mapIconPath: "/assets/landmark-icons/marble-mountains.png",
     mapIconPath: "/assets/landmark-icons/son-tra-peninsula.png",
     mapIconPath: "/assets/landmark-icons/han-river-bridge.png",
     mapIconPath: "/assets/landmark-icons/linh-ung-son-tra.png",
     mapIconPath: "/assets/landmark-icons/cham-museum.png",
     mapIconPath: "/assets/landmark-icons/non-nuoc-stone-village.png",
     mapIconPath: "/assets/landmark-icons/han-market.png",
     mapIconPath: "/assets/landmark-icons/ba-na-hills.png",
     ```
  2. In `validateLandmarkGameDefinitions` (line 194), change:
     ```typescript
     // BEFORE:
     !definition.mapIconPath.endsWith(".svg")
     // AFTER:
     !definition.mapIconPath.endsWith(".png")
     ```

### 2.3 Updating `content/locations.vi.json` and `content/locations.en.json`
- **Reasoning**: `scripts/validate-content.ts` asserts that `locationVi.authoredImage === locationEn.authoredImage` and `locationVi.authoredImage === asset.path` (matching `manifest.json` `assetId`). Updating `manifest.json` to register `.png` postcards requires changing `"authoredImage"` in both Vietnamese and English location content files to `.png`.
- **Exact Code Changes**:
  In both `content/locations.vi.json` and `content/locations.en.json`, update the 10 `"authoredImage"` values as follows:
  ```json
  "dragon_bridge": { ..., "authoredImage": "/assets/landmarks/dragon-bridge.png", ... }
  "my_khe_beach": { ..., "authoredImage": "/assets/landmarks/my-khe.png", ... }
  "marble_mountains": { ..., "authoredImage": "/assets/landmarks/marble-mountains.png", ... }
  "son_tra_peninsula": { ..., "authoredImage": "/assets/landmarks/son-tra.png", ... }
  "han_river_bridge": { ..., "authoredImage": "/assets/landmarks/han-river-bridge.png", ... }
  "linh_ung_son_tra": { ..., "authoredImage": "/assets/landmarks/linh-ung.png", ... }
  "cham_museum": { ..., "authoredImage": "/assets/landmarks/cham-museum.png", ... }
  "non_nuoc_stone_village": { ..., "authoredImage": "/assets/landmarks/non-nuoc.png", ... }
  "han_market": { ..., "authoredImage": "/assets/landmarks/han-market.png", ... }
  "ba_na_hills": { ..., "authoredImage": "/assets/landmarks/ba-na-hills.png", ... }
  ```

---

## 3. Caveats

1. **Synchronized Execution**: Edits to `landmark-game-definitions.ts`, `locations.vi.json`, `locations.en.json`, `manifest.json`, and `validate-assets.ts` must happen in lockstep. If content files are updated to `.png` before `manifest.json` or `validate-assets.ts` is updated, `npm run validate:content` or `npm run validate:assets` will fail.
2. **Test File Assertions**: Existing test files (`tests/unit/client/gallery.test.ts`, `tests/unit/content/asset-validation.test.ts`, `tests/e2e/landmark-gallery.spec.ts`, `tests/e2e/discoverable-pois.spec.ts`) contain regexes matching `\.svg$`. They must also be updated to match `\.png$` as part of M1.

---

## 4. Conclusion

The exact code modification plan for M1 asset loading & definitions is fully mapped:
- **`PreloadScene.ts`**: Switched from `this.load.svg` to `this.load.image` for 10 landmark icons and 10 landmark postcards; added `this.load.image("map_background_overworld_night", "/assets/map/overworld-night.png")`.
- **`landmark-game-definitions.ts`**: All 10 `mapIconPath` entries updated from `.svg` to `.png`; `validateLandmarkGameDefinitions` check updated to require `.png`.
- **`locations.vi.json` & `locations.en.json`**: All 10 `"authoredImage"` fields updated from `.svg` to `.png`.

---

## 5. Verification Method

Once implemented, verify the modifications via:

1. **Validator Commands**:
   ```powershell
   Set-Location "d:\Hackthon-GG2026"
   npm run validate:content
   npm run validate:assets
   ```
   *Expected Output*: `✅ Content validation passed` and `✅ Asset validation passed`.

2. **Unit Tests**:
   ```powershell
   npx vitest run tests/unit/client/gallery.test.ts tests/unit/content/asset-validation.test.ts
   ```
   *Expected Output*: All test cases pass with `.png` asset path assertions.

3. **Full Suite Verification**:
   ```powershell
   npm run verify
   ```
   *Expected Output*: Clean pass across typecheck, lint, format, vitest unit tests, content/asset validation, and Vite client build.
