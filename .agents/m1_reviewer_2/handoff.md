# Handoff Report — Reviewer 2 (Milestone M1: Asset Pipeline & Validator Support)

## Review Verdict: `APPROVE`

---

## 1. Observation

A thorough independent review and verification of all Milestone M1 code changes was conducted across the codebase (`scripts/validate-assets.ts`, `public/assets/manifest.json`, `src/client/game/scenes/PreloadScene.ts`, `src/shared/landmark-game-definitions.ts`, location content JSONs, and associated unit/E2E test files):

1. **`scripts/validate-assets.ts`**:
   - Added `"map_background_overworld_night"` to `REQUIRED_ASSET_IDS`.
   - Extended `ASSET_CATEGORIES` with `"map_background"`.
   - Defined `PNG_SUPPORTED_CATEGORIES` (`Set(["landmark", "landmark_icon", "map_background"])`) and `PNG_MAGIC_HEADER` (`Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])`).
   - Implemented `validatePng()` which verifies the 8-byte PNG magic header signature, verifies the IHDR chunk at offset 12 (`"IHDR"`), extracts `width` (uint32BE at offset 16) and `height` (uint32BE at offset 20), enforces exact dimensions (`1600x960` for `map_background`, `320x180` for `landmark`, `48x48` for `landmark_icon`), and validates `alpha` flags.
   - Updated `validateGrid()` to permit `48x48` tile sizes for `landmark_icon` grid assets.
   - Updated format validation in `validateAssetManifest()` to accept both `.png` and `.svg` files based on category support and filename extension matching.

2. **`public/assets/manifest.json`**:
   - Added `"id": "map_background_overworld_night"` referencing `/assets/map/overworld-night.png` with dimensions `1600x960`, category `map_background`, format `png`, alpha `false`, placeholder `false`.
   - Updated all 10 landmark postcard assets to format `png`, path `/assets/landmarks/<name>.png`, width 320, height 180, alpha `false`, placeholder `false`.
   - Updated all 10 landmark map icon assets to format `png`, path `/assets/landmark-icons/<name>.png`, width 48, height 48, grid cell 48x48, alpha `true`, placeholder `false`.

3. **`src/client/game/scenes/PreloadScene.ts`**:
   - Added `this.load.image("map_background_overworld_night", "/assets/map/overworld-night.png")`.
   - Updated landmark asset preloading to use `this.load.image` for PNG map icons and PNG landmark postcards.

4. **`src/shared/landmark-game-definitions.ts`**:
   - Updated canonical `LANDMARK_GAME_DEFINITIONS` `mapIconPath` values to `.png`.
   - Updated `validateLandmarkGameDefinitions()` regex check to accept `!/\.(png|svg)$/.test(definition.mapIconPath)`.

5. **Location Content JSONs (`content/locations.vi.json` and `content/locations.en.json`)**:
   - Updated all 10 `authoredImage` paths in both VI and EN files to `/assets/landmarks/<key>.png`.

6. **Unit & E2E Test Suites**:
   - Updated `tests/unit/client/gallery.test.ts`, `tests/unit/content/asset-validation.test.ts`, `tests/unit/content/landmark-content.test.ts`, `tests/e2e/landmark-gallery.spec.ts`, and `tests/e2e/discoverable-pois.spec.ts` to assert on PNG extensions and 48x48 icon specs.

---

## 2. Logic Chain

1. **PNG Binary Verification**: SVG parsing (`extractSvgColors`, `readSvgAttribute`) cannot be applied to binary PNG files. `validate-assets.ts` correctly branches format validation: for PNG assets, it verifies the magic bytes `0x89504E470D0A1A0A` and decodes IHDR header dimensions to ensure binary asset files strictly match manifest entries without relying on external libraries or dummy mocks.
2. **Canonical Manifest Contract**: `public/assets/manifest.json` defines the contract for asset loading. Updating all 10 landmark postcards to `320x180 PNG`, 10 map icons to `48x48 PNG` with alpha, and adding `1600x960 PNG` for the overworld night map provides the static asset foundation needed by Phaser scenes and React components.
3. **Phaser Asset Loading**: Phaser requires `this.load.image` for raster image files (PNG/JPG) rather than `this.load.svg`. Updating `PreloadScene.ts` ensures PNG textures are properly loaded into the Phaser texture manager.
4. **Content Parity & Canonical Definitions**: Syncing `LANDMARK_GAME_DEFINITIONS`, `locations.vi.json`, and `locations.en.json` with the new PNG postcard and icon file paths ensures `validate:content` and `validate:assets` pass without discrepancy.
5. **No Integrity Violations**: Code inspection confirmed no hardcoded test outputs, dummy implementations, or bypassed verification steps. Tests run against genuine asset files and manifest definitions.

---

## 3. Caveats

No caveats. All M1 asset pipeline and validator updates are clean, robust, backward-compatible, and fully verified.

---

## 4. Conclusion

Milestone M1 (Asset Pipeline & Validator Support) satisfies all requirements from `PROJECT.md` and `AGENTS.md`. The code changes preserve structural integrity, maintain full backward compatibility for SVG assets in other categories, and pass all verification checks. Final verdict is **`APPROVE`**.

---

## 5. Verification Method & Evidence

Independent verification was executed on Windows PowerShell in `d:\Hackthon-GG2026`:

```powershell
Set-Location "d:\Hackthon-GG2026"
npm run validate:content
npm run validate:assets
npx vitest run
npm run verify
```

### Direct Command Output Evidence:

1. **`npm run validate:content`**:
   ```
   ✅ Content validation passed (locations=10, dialogueNodes=10, sources=26).
   ```

2. **`npm run validate:assets`**:
   ```
   ✅ Asset validation passed (assets=36, requiredAssets=36, tileSize=32).
   ```

3. **`npx vitest run`**:
   ```
   Test Files  28 passed (28)
        Tests  153 passed (153)
     Start at  11:07:06
     Duration  2.52s
   ```

4. **`npm run verify`**:
   ```
   > hackthon-gg2026@0.0.0 verify
   > npm run typecheck && npm run lint && npm run format:check && npm run test && npm run validate:content && npm run validate:assets && npm run build && npm run validate:client-build

   ✅ Client build security validation passed (files=7, forbiddenMarkers=0).
   ```

---

## Review Summary & Verified Claims

- **Verdict**: `APPROVE`
- **Integrity Check**: Pass (0 integrity violations detected).
- **Verified Claims**:
  - `validate-assets.ts` validates binary PNG files (magic header + IHDR dimensions) → Pass
  - 10 landmark postcards (320x180 PNG), 10 map icons (48x48 PNG with alpha), 1 overworld night map (1600x960 PNG) present in manifest and verified → Pass
  - `PreloadScene.ts` queues PNG assets via `this.load.image` → Pass
  - `LANDMARK_GAME_DEFINITIONS` & content JSONs updated and in sync → Pass
  - All 153 Vitest unit tests pass → Pass
  - Full `npm run verify` pipeline passes with 0 errors → Pass

## Challenge Summary

- **Overall Risk Assessment**: LOW
- **Assumption Stress-Testing**:
  - *IHDR Chunk parsing*: Checked byte offset boundaries (`buffer.length >= 24`), preventing OOB exceptions on corrupted PNGs.
  - *Format restriction by category*: Restricted PNG support strictly to `landmark`, `landmark_icon`, and `map_background`, preserving SVG validation for standard character/npc/tileset/ui assets.
