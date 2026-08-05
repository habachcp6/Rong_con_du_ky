## 2026-08-05T04:03:10Z
You are the Worker for Milestone M1 (Asset Pipeline & Validator Support) for Rồng Con Du Ký.
Your working directory is `d:\Hackthon-GG2026\.agents\m1_worker`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INSTRUCTIONS:
1. Read `d:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md`, `d:\Hackthon-GG2026\AGENTS.md`, and `d:\Hackthon-GG2026\PROJECT.md`.
2. Read the detailed specifications in the M1 Explorer handoff reports:
   - `d:\Hackthon-GG2026\.agents\m1_explorer_1\handoff.md` (validator & manifest changes)
   - `d:\Hackthon-GG2026\.agents\m1_explorer_2\handoff.md` (PreloadScene, definitions, content JSONs)
   - `d:\Hackthon-GG2026\.agents\m1_explorer_3\handoff.md` (unit test & E2E assertion updates)
3. Implement the M1 changes:
   - `scripts/validate-assets.ts`: Allow `png` for `landmark`, `landmark_icon`, `map_background`. Validate PNG header (`89 50 4E 47 0D 0A 1A 0A`), PNG dimensions, icon alpha/grid checks, and add `map_background_overworld_night` asset ID.
   - `public/assets/manifest.json`: Update 10 landmark postcards to `.png` (320x180), 10 map icons to `.png` (48x48), and add `map_background_overworld_night` (`/assets/map/overworld-night.png`, 1600x960).
   - `src/client/game/scenes/PreloadScene.ts`: Load PNG postcards, map icons, and `map_background_overworld_night` via `this.load.image`.
   - `src/shared/landmark-game-definitions.ts`: Update all `mapIconPath` to `.png` and update validation logic to accept `.png`.
   - `content/locations.vi.json` and `content/locations.en.json`: Update all 10 `authoredImage` paths to `.png`.
   - Unit & E2E tests: Update `gallery.test.ts`, `asset-validation.test.ts`, `landmark-content.test.ts`, `landmark-gallery.spec.ts`, `discoverable-pois.spec.ts` assertions from `.svg` to `.png`.
4. Run narrow tests (`npm run validate:content`, `npm run validate:assets`, `npx vitest run`) to verify your work.
5. Write your handoff report to `d:\Hackthon-GG2026\.agents\m1_worker\handoff.md` with build & test output evidence, then send a message to parent when complete.
