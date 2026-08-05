## 2026-08-05T03:58:05Z
Task: Upgrade the entire overworld map graphics and landmark assets for Rồng Con Du Ký (Phaser 4 + React + TypeScript).
Key Requirements:
R1. Overworld Map Background: Replace procedural `drawWorld()` in `src/client/game/scenes/OverworldScene.ts` with a baked 1600x960 16-bit pixel-art night map (PNG). Show Da Nang geography (Han River, My Khe beach, Son Tra peninsula, streets/greenery, Departure Village) and unique pixel-art graphics for all 10 landmarks at their exact coordinates. Add Phaser animations overlay (river water waves, lantern flickering, Dragon Bridge fire particles, My Khe sea waves).
R2. Landmark Postcards: Generate 10 new 320x180 pixel-art postcard images (PNG format) using `image_gen` for `public/assets/landmarks/<name>.png`. Update manifest and validators to accept PNG.
R3. Map Icons Refresh: Generate 10 new 48x48 pixel-art map icons (PNG format, transparent background) using `image_gen`.
R4. Integration & Validator Update: Update `scripts/validate-assets.ts` to allow PNG for landmark, landmark_icon, map_background. Hide WORLD_COLLIDER rectangles (`obstacle.setAlpha(0)` or `setVisible(false)`). Update `manifest.json`, `PreloadScene.ts`, `landmark-game-definitions.ts`.
R5. Quality & Verification: `npm run verify` pass 100% (153+ tests), Docker build + health check on port 8080, Playwright E2E tests pass. Update `docs/STATUS.md`.
