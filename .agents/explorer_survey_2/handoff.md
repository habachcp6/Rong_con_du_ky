# Handoff Report — Explorer 2 (Asset Pipeline Explorer)

## 1. Observation

Direct code inspection of the asset pipeline configuration and source files revealed the following exact specifications and line bindings:

- **`scripts/validate-assets.ts`**:
  - Line 18–54 (`REQUIRED_ASSET_IDS`): Contains 35 required asset IDs. Missing `"map_background_overworld_night"`.
  - Line 56–64 (`ASSET_CATEGORIES`): `Set(["character", "npc", "tileset", "fragment", "ui", "landmark", "landmark_icon"])`. Missing `"map_background"`.
  - Line 65–72 (`GRID_REQUIRED_CATEGORIES`) & Lines 370–419 (`validateGrid`): Requires grid cell dimensions `tileWidth === tileSize` (32px). New map icons are 48×48px.
  - Line 609–616 (`validateAssetManifest`): Hard-rejects any format other than `"svg"` (`if (asset.format !== "svg" || !asset.path.endsWith(".svg"))`).
  - Lines 676–694: Calls `validateSvg()` on all assets with format `"svg"`.

- **`public/assets/manifest.json`**:
  - Lines 205–323: 10 landmark postcard entries are currently declared with `"format": "svg"`, `"path": "/assets/landmarks/<name>.svg"`, `"width": 320`, `"height": 180`.
  - Lines 325–453: 10 map icon entries are currently declared with `"format": "svg"`, `"path": "/assets/landmark-icons/<name>.svg"`, `"width": 32`, `"height": 32`.
  - Missing entry for category `"map_background"` at `/assets/map/overworld-night.png`.

- **`src/client/game/scenes/PreloadScene.ts`**:
  - Lines 72–77: Iterates over `LANDMARK_GAME_DEFINITIONS` and executes `this.load.svg(definition.mapIconAssetId, definition.mapIconPath, { width: 32, height: 32 })`.
  - Does not load `map_background_overworld_night` image or `.png` postcard/icon assets.

- **`src/shared/landmark-game-definitions.ts`**:
  - Lines 43–144 (`LANDMARK_GAME_DEFINITIONS`): All 10 definitions declare `mapIconPath` ending in `.svg` (e.g., `/assets/landmark-icons/dragon-bridge.svg`).
  - Line 194 (`validateLandmarkGameDefinitions`): Asserts `definition.mapIconPath.endsWith(".svg")`.

- **`content/locations.vi.json` and `content/locations.en.json`**:
  - All 10 location definitions declare `"authoredImage": "/assets/landmarks/<filename>.svg"`.
  - `scripts/validate-content.ts` (lines 578–585) asserts `locationVi.authoredImage === asset.path`.

- **Test Files**:
  - `tests/unit/client/gallery.test.ts` (Line 27) asserts `location.authoredImage` matches `/^\/assets\/landmarks\/.*\.svg$/`.
  - `tests/unit/content/asset-validation.test.ts` asserts `icon.path` matches `/^\/assets\/landmark-icons\/.+\.svg$/u`.
  - `tests/e2e/landmark-gallery.spec.ts` and `discoverable-pois.spec.ts` assert DOM image `src` paths ending in `.svg`.

---

## 2. Logic Chain

1. **Observation 1** demonstrates that `scripts/validate-assets.ts` currently enforces SVG-only format validation and rejects `.png` files. Therefore, replacing SVGs with PNGs without modifying `validate-assets.ts` will immediately fail `npm run validate:assets`.
2. **Observation 2** shows that `manifest.json` defines categories, paths, formats, dimensions, and grid layouts. Updating assets to PNG requires changing `format` to `"png"`, updating `path` from `.svg` to `.png`, expanding icon dimensions to 48×48px, and adding an entry for `map_background_overworld_night` (1600×960).
3. **Observation 3** shows that `PreloadScene.ts` currently calls `this.load.svg` with fixed 32×32 dimensions. Moving to PNG requires switching to `this.load.image` and loading the map background asset `overworld-night.png`.
4. **Observation 4** establishes that `LANDMARK_GAME_DEFINITIONS` hardcodes `.svg` extensions for `mapIconPath` and enforces this rule in `validateLandmarkGameDefinitions()`. Updating asset paths in `manifest.json` without updating `landmark-game-definitions.ts` causes binding mismatch errors in both asset and content validators.
5. **Observation 5** demonstrates that `content/locations.vi.json` and `locations.en.json` `authoredImage` paths are checked against `manifest.json` asset paths. Updating `manifest.json` paths to `.png` requires synchronized updates in both content files.
6. **Observation 6** shows that unit and E2E test suites contain explicit regex and string matchers for `.svg` extensions. Updating the pipeline to `.png` without updating these test assertions will cause `npm run verify` and Playwright E2E tests to fail.

---

## 3. Caveats

- **Binary PNG Asset Generation**: This investigation focused strictly on asset pipeline code, validators, manifest schemas, and runtime loader logic. Explorer 2 did NOT generate actual `.png` binary files; asset creation is handled by asset generation workflows.
- **Backwards Compatibility vs Full PNG Cutover**: The proposed changes allow both `.png` and `.svg` for categories `landmark` and `landmark_icon` in validator logic while completing the transition to `.png` in manifest and game code.

---

## 4. Conclusion

To successfully transition Rồng Con Du Ký to PNG assets:
1. Update `scripts/validate-assets.ts` to support category `map_background`, allow PNG format for `landmark`, `landmark_icon`, and `map_background`, adjust icon grid tile size validation to 48×48px, and add binary PNG header verification.
2. Update `public/assets/manifest.json` to register 10 PNG postcards (320×180), 10 PNG icons (48×48), and 1 PNG map background (1600×960).
3. Update `src/client/game/scenes/PreloadScene.ts` to load PNG icons and postcards via `this.load.image` and preload `map_background_overworld_night`.
4. Update `src/shared/landmark-game-definitions.ts` `mapIconPath` values to `.png` and update its validator function.
5. Update `content/locations.vi.json` and `locations.en.json` `authoredImage` fields to `.png`.
6. Update unit and E2E test file assertion patterns from `.svg` to `.png`.

---

## 5. Verification Method

To independently verify these conclusions and pipeline readiness once implemented:

1. **Asset & Content Validation Commands**:
   ```powershell
   Set-Location "d:\Hackthon-GG2026"
   npm run validate:content
   npm run validate:assets
   ```
   *Expected Output*: `✅ Content validation passed` and `✅ Asset validation passed`.

2. **Full Verification Pipeline**:
   ```powershell
   npm run verify
   ```
   *Expected Output*: Typecheck, lint, format, vitest unit tests (including `gallery.test.ts` and `asset-validation.test.ts`), content validation, asset validation, and client build pass cleanly.

3. **Docker & Playwright E2E Verification**:
   ```powershell
   docker compose up --build -d
   Start-Sleep -Seconds 15
   Invoke-RestMethod http://127.0.0.1:8080/api/health
   $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:8080"
   npx playwright test --workers=1
   docker compose down
   ```
