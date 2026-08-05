# Project: Rồng Con Du Ký — Overworld Map & Landmark Assets Upgrade

## Architecture

- **Framework & Engine**: Phaser 4 + React 19 + TypeScript + Vite.
- **Backend & Cloud**: Fastify Node backend in single repository & Cloud Run service.
- **Data & Auth**: Firebase Anonymous Auth + Firestore.
- **AI & Integrations**: Gemini Interactions API on server.
- **Map & Asset Pipeline**:
  - Baked 1600x960 16-bit pixel-art night map (`public/assets/map/overworld-night.png`).
  - 10 PNG Landmark Postcard images (320x180) in `public/assets/landmarks/<name>.png`.
  - 10 PNG Map Icons (48x48, transparent) in `public/assets/landmark-icons/<name>.png`.
  - Dynamic Phaser overlays in `OverworldScene.ts`: Han River waves, lantern flickering, Dragon Bridge fire particles, My Khe sea waves.
  - Invisible physics colliders (`WORLD_COLLIDER` rectangles hidden via `setVisible(false)`).

## Feature Inventory

| #   | Requirement                     | Description                                                                                                  | Milestone | Status |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| 1   | Asset Pipeline & Validators     | Support `.png` magic header, IHDR dimensions, icon grid in `validate-assets.ts` & `manifest.json`            | M1        | DONE   |
| 2   | Code & Content Definitions      | Update `PreloadScene.ts`, `landmark-game-definitions.ts`, `locations.vi.json`, `locations.en.json` to `.png` | M1        | DONE   |
| 3   | Unit & E2E Test Assertions      | Update vitest and Playwright regex/file extension assertions from `.svg` to `.png`                           | M1        | DONE   |
| 4   | Landmark Postcards Generation   | Generate 10 320x180 PNG postcards in `public/assets/landmarks/`                                              | M2        | DONE   |
| 5   | Map Icons Refresh               | Generate 10 48x48 transparent PNG map icons in `public/assets/landmark-icons/`                               | M2        | DONE   |
| 6   | Overworld Night Map             | Baked 1600x960 16-bit retro pixel-art night map with Da Nang geography & 10 landmarks                        | M3        | DONE   |
| 7   | OverworldScene Integration      | Replace procedural `drawWorld()` with baked image background, hide colliders                                 | M4        | DONE   |
| 8   | Dynamic Animation Overlays      | River waves, lantern flicker, Dragon Bridge fire particles, My Khe sea waves                                 | M4        | DONE   |
| 9   | Full Project Verification       | Run `npm run verify` (153 tests pass, exit code 0)                                                           | M5        | DONE   |
| 10  | Docker Container Build & Health | Build Docker container `rong-con-du-ky:local` & verify `GET /api/health` returns `status: ok`                | M5        | DONE   |
| 11  | Docker Playwright E2E           | Run Playwright E2E suite against Docker container (85 passed, 0 failed, 31 skipped)                          | M5        | DONE   |
| 12  | Status Documentation            | Update `docs/STATUS.md` with evidence rows for all deliverables                                              | M5        | DONE   |

## Milestones

| #   | Name                                                            | Scope                                                                                                         | Dependencies | Status   |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ | -------- |
| M1  | Asset Pipeline & Validator Support                              | `validate-assets.ts`, `manifest.json`, `PreloadScene.ts`, `landmark-game-definitions.ts`, JSON content, tests | None         | **DONE** |
| M2  | Landmark Postcards & Map Icons Generation                       | 10 PNG postcards (320x180) & 10 PNG map icons (48x48)                                                         | M1           | **DONE** |
| M3  | Baked Overworld Night Map Creation                              | 1600x960 16-bit pixel-art night map PNG                                                                       | M1           | **DONE** |
| M4  | OverworldScene Integration & Animations                         | Replace procedural `drawWorld()`, hide colliders, add 4 animation overlays                                    | M2, M3       | **DONE** |
| M5  | Full Verification, Docker Build, Playwright E2E & Documentation | `npm run verify`, Docker container build & health check, Playwright E2E tests, `docs/STATUS.md`               | M4           | **DONE** |

## Verification Summary

- **`npm run verify`**: PASSED 100% (153 unit tests in 28 test files, typecheck, oxlint, Prettier formatting, asset validator, content validator, Vite client build, Fastify server build, security scan).
- **Docker Container Health**: PASSED (`http://127.0.0.1:8080/api/health` returned `status: ok`).
- **Playwright E2E Suite**: PASSED (85 passed, 0 failed, 31 skipped against Docker container).
- **Forensic Audit**: CLEAN.
