# BRIEFING — 2026-08-05T11:05:45Z

## Mission
Implement Milestone M1 (Asset Pipeline & Validator Support) for Rồng Con Du Ký.

## 🔒 My Identity
- Archetype: implementer/qa/specialist worker
- Roles: implementer, qa, specialist
- Working directory: d:\Hackthon-GG2026\.agents\m1_worker
- Original parent: ff323766-e145-4706-8d75-eef50f6eb16a
- Milestone: M1

## 🔒 Key Constraints
- Update asset pipeline and validators to support PNG assets (`png` for `landmark`, `landmark_icon`, `map_background`).
- Update `public/assets/manifest.json`, `scripts/validate-assets.ts`, `src/client/game/scenes/PreloadScene.ts`, `src/shared/landmark-game-definitions.ts`, `content/locations.vi.json`, `content/locations.en.json`.
- Update tests: `gallery.test.ts`, `asset-validation.test.ts`, `landmark-content.test.ts`, `landmark-gallery.spec.ts`, `discoverable-pois.spec.ts`.
- Run validation commands (`npm run validate:content`, `npm run validate:assets`, `npx vitest run`, `npm run verify`).
- DO NOT CHEAT. All implementations must be genuine.

## Current Parent
- Conversation ID: ff323766-e145-4706-8d75-eef50f6eb16a
- Updated: 2026-08-05T11:05:45Z

## Task Summary
- **What to build**: Milestone M1 asset pipeline & validator updates for PNG assets and overworld-night map background.
- **Success criteria**: All validation commands, vitest unit tests, and full project verification (`npm run verify`) pass cleanly.
- **Interface contracts**: PROJECT.md & AGENTS.md

## Change Tracker
- **Files modified**:
  - `scripts/validate-assets.ts`: Added PNG format validation, PNG magic header check, `validatePng` function, `map_background` category, 48x48 icon grid validation, and `map_background_overworld_night` asset ID.
  - `public/assets/manifest.json`: Added `map_background_overworld_night` asset entry (1600x960), updated 10 landmark postcards to `.png` (320x180), and updated 10 landmark icons to `.png` (48x48).
  - `src/client/game/scenes/PreloadScene.ts`: Added `this.load.image` calls for `map_background_overworld_night`, 10 PNG map icons, and 10 PNG landmark postcards.
  - `src/shared/landmark-game-definitions.ts`: Updated all 10 `mapIconPath` fields from `.svg` to `.png` and updated `validateLandmarkGameDefinitions` to accept `.png`.
  - `content/locations.vi.json` & `content/locations.en.json`: Updated all 10 `authoredImage` paths from `.svg` to `.png`.
  - `tests/unit/client/gallery.test.ts`: Updated `authoredImage` regex assertion to `.png`.
  - `tests/unit/content/asset-validation.test.ts`: Updated icon dimension assertions to 48x48, fixture paths to `.png`, and added binary PNG header assertions.
  - `tests/unit/content/landmark-content.test.ts`: Updated test title and failure error message to reference postcard/image.
  - `tests/e2e/landmark-gallery.spec.ts`: Updated DOM `src` assertion for Ba Na Hills postcard from `.svg` to `.png`.
  - `tests/e2e/discoverable-pois.spec.ts`: Updated DOM `src` assertion for Han River Bridge icon from `.svg` to `.png`.
- **Build status**: PASS (`npm run verify` passed cleanly).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: PASS (28 test files passed, 153 unit tests passed, typecheck, lint, format:check, validate:content, validate:assets, build, validate:client-build all passed).
- **Lint status**: Clean (0 errors).
- **Tests added/modified**: Updated unit & E2E assertions for PNG asset pipeline.

## Loaded Skills
- None
