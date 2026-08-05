# Project: Rồng Con Du Ký Overworld Map & Asset Upgrade

## Architecture
- **Frontend Engine**: Phaser 4 + React 19 + TypeScript + Vite
- **Overworld Map**: 1600x960 16-bit pixel-art night map (PNG background) loaded in Phaser `OverworldScene.ts`. Replaces procedural `drawWorld()`.
- **Physics Colliders**: Keep `WORLD_COLLIDER` physics bodies active for collision detection, but hide graphics rendering (`obstacle.setAlpha(0)` or `setVisible(false)`).
- **Landmark Graphics**: 10 Landmark Postcards (320x180 PNG), 10 Map Icons (48x48 PNG), and 1 Baked Overworld Map (1600x960 PNG).
- **Animations Overlay**: Phaser overlays (river water wave particle/tweens, lantern flickering alpha tweens, Dragon Bridge fire particle emitter, My Khe sea wave tweens).
- **Asset Pipeline**: `manifest.json`, `scripts/validate-assets.ts`, `PreloadScene.ts`, `landmark-game-definitions.ts`, location content JSONs updated to allow and expect `.png` format.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Asset Pipeline & Validator Updates | Update `validate-assets.ts`, `manifest.json`, `PreloadScene.ts`, `landmark-game-definitions.ts`, content files, and unit/E2E test regexes to support PNG for `landmark`, `landmark_icon`, `map_background` | M1 | Follow-up R4 |
| 2 | Landmark Postcards & Map Icons Generation | Generate 10 320x180 PNG postcards and 10 48x48 PNG transparent map icons using `generate2dsprite` / `image_gen` into `public/assets/` | M2 | Follow-up R2, R3 |
| 3 | Baked Overworld Night Map Generation | Generate baked 1600x960 16-bit pixel-art night map PNG (`overworld-night.png`) covering Da Nang geography (Han River, My Khe, Son Tra, Departure Village) and 10 landmarks at exact coordinates | M3 | Follow-up R1 |
| 4 | OverworldScene Integration & Animations | Replace `drawWorld()` with map PNG, hide collider graphics (`setAlpha(0)`), add Phaser animation overlays (river waves, lantern flickering, Dragon Bridge fire particles, My Khe sea waves) | M4 | Follow-up R1, R4 |
| 5 | Quality, Verification & Documentation | Ensure `npm run verify` passes 100% (153+ tests), Docker build + health check on port 8080 passes, Playwright E2E tests pass, update `docs/STATUS.md` | M5 | Follow-up R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Asset Pipeline & Validator Support | Update `validate-assets.ts`, `manifest.json`, `PreloadScene.ts`, `landmark-game-definitions.ts`, content files, unit tests | None | DONE |
| M2 | Postcard & Icon Assets Creation | Generate 10 320x180 PNG postcards and 10 48x48 PNG icons into `public/assets/` | M1 | PLANNED |
| M3 | Baked Overworld Map Asset Creation | Generate 1600x960 pixel-art night map PNG (`public/assets/map/overworld-night.png`) | M1 | PLANNED |
| M4 | OverworldScene Rendering & Overlay Animations | Replace `drawWorld()` in `OverworldScene.ts` with night map PNG, hide colliders, add Phaser animation overlays | M2, M3 | PLANNED |
| M5 | Full Verification & E2E Testing | Run `npm run verify`, Docker build + health check, Playwright E2E against container, update `docs/STATUS.md` | M4 | PLANNED |

## Interface Contracts
### Asset Keys & File Paths
- Map Background: `map_background_overworld_night` -> `public/assets/map/overworld-night.png` (1600x960 PNG)
- Landmark Postcards: `landmark_<key>` -> `public/assets/landmarks/<key>.png` (320x180 PNG)
- Map Icons: `landmark_icon_<key>` -> `public/assets/landmark-icons/<key>.png` (48x48 PNG, transparent background)

### Overworld Scene Rendering
- `drawWorld()` replaced by single Phaser image at (0, 0) with `setOrigin(0, 0)` and depth below player/NPCs.
- `obstacles` group created with `WORLD_COLLIDER` bounds, graphics invisible (`setAlpha(0)`).
- Dynamic overlays:
  - Han River waves: Phaser particle manager / tile position tween across x=650->1000.
  - Lantern flickering: Alpha tweens on decorative light sprites / circles.
  - Dragon Bridge fire: Particle emitter at (825, 474).
  - My Khe sea waves: Sine wave tweens on wave sprites at x>1300.
