# Handoff Report — Overworld Scene Map Upgrade Survey

## 1. Observation

### 1.1 Source Code Inspection
- **`src/client/game/scenes/OverworldScene.ts` (Lines 235–281)**:
  `drawWorld()` currently renders procedural vector graphics directly onto Phaser 4 canvas using `this.add.graphics()`:
  - Base canvas fill: `graphics.fillStyle(0x244a4d, 1)` filling 1600×960.
  - Land masses: `graphics.fillRect(0, 0, 650, 960)` and `graphics.fillRect(1000, 0, 600, 960)`.
  - Han River: `graphics.fillRect(650, 0, 350, 960)` (blue `0x14648d`) with cyan line ripples `graphics.lineBetween(664, y, 978, y)`.
  - Roads: brown rectangles `graphics.fillRect(188, 430, 1110, 88)` and `graphics.fillRect(202, 500, 92, 350)`.
  - Dragon Bridge: rounded rect `graphics.fillRoundedRect(570, 408, 510, 132, 10)` with stroke `graphics.strokeRoundedRect(570, 408, 510, 132, 10)`.
  - Text labels: "CẦU RỒNG" at (825, 380) and "LÀNG KHỞI HÀNH" at (214, 890).
- **`src/client/game/scenes/OverworldScene.ts` (Lines 283–298)**:
  `addColliders()` instantiates Phaser visual rectangles from `WORLD_COLLIDERS`:
  ```typescript
  const obstacle = this.add.rectangle(definition.x, definition.y, definition.width, definition.height, definition.color).setDepth(8);
  obstacle.setStrokeStyle(2, 0xe8f7ff, 0.22);
  this.physics.add.existing(obstacle, true);
  this.physics.add.collider(this.player, obstacle);
  ```
- **`src/client/game/world.ts` (Lines 60–114)**:
  - `WORLD_BOUNDS`: `{ width: 1600, height: 960, playerStart: { x: 248, y: 772 } }`.
  - `WORLD_COLLIDERS`: 5 rectangular definitions (`market-hall`, `lantern-garden`, `river-pier`, `east-pavilion`, `east-garden`).
- **`src/shared/landmark-game-definitions.ts` (Lines 43–144)**:
  Contains canonical registry of 10 landmark definitions with keys, quest IDs, scene keys, map icon paths, and `mapPosition` coordinates.
- **`public/assets/manifest.json` & `scripts/validate-assets.ts`**:
  - `manifest.json` currently specifies `format: "svg"` for landmarks and landmark icons.
  - `validate-assets.ts` validates SVG attributes and requires format matching.

---

## 2. Logic Chain

1. **Procedural canvas replacement**:
   - *Observation*: `drawWorld()` in `OverworldScene.ts` (lines 235-281) creates procedural rectangles and lines.
   - *Reasoning*: Replacing all canvas drawing inside `drawWorld()` with `this.add.image(0, 0, "map_overworld_night").setOrigin(0, 0).setDepth(0)` cleanly renders the baked 1600×960 pixel-art PNG while removing all procedural primitives.
2. **Hiding physics colliders**:
   - *Observation*: `addColliders()` (lines 283-298) creates visual rectangle GameObjects and attaches Arcade Physics static bodies (`this.physics.add.existing(obstacle, true)`).
   - *Reasoning*: Calling `obstacle.setVisible(false)` (or `obstacle.setAlpha(0)`) hides the solid colored boxes from rendering over the night map artwork while preserving exact player collision physics.
3. **Aligning landmark coordinates**:
   - *Observation*: `LANDMARK_GAME_DEFINITIONS` in `src/shared/landmark-game-definitions.ts` maps landmark positions.
   - *Reasoning*: Updating `mapPosition` values in `LANDMARK_GAME_DEFINITIONS` to match the target coordinates specified in `ORIGINAL_REQUEST.md` (e.g. Cầu Rồng at 825, 474; Biển Mỹ Khê at 1382, 688; Ngũ Hành Sơn at 488, 118; etc.) ensures map icons render directly over their artwork representations on the night map background.
4. **Dynamic animation overlays**:
   - *Observation*: Night map requires animated atmosphere (river ripples, flickering lanterns, dragon fire, ocean waves).
   - *Reasoning*: Creating lightweight Phaser dynamic overlays (tweens and particle emitters) at depth levels 1 and 2 places animation FX above the background PNG (depth 0) but below map icons (depth 18) and player (depth 20).
5. **Asset & Validation integration**:
   - *Observation*: `public/assets/manifest.json` and `scripts/validate-assets.ts` check asset files.
   - *Reasoning*: Adding category `"map_background"` and supporting PNG format in `validate-assets.ts` ensures `npm run verify` passes when PNG postcards, map icons, and night map background are integrated.

---

## 3. Caveats

- **Pixel art image generation**: The actual generation of `overworld-night.png` (1600×960), 10 postcard PNGs (320×180), and 10 map icon PNGs (48×48) is the task of Asset Generator / Implementer subagents using `image_gen`.
- **Collider shape alignment**: If the baked night map features new building boundaries, `WORLD_COLLIDERS` in `world.ts` may need minor coordinate tuning to align perfectly with visual walls on the PNG.

---

## 4. Conclusion

Replacing procedural `drawWorld()` with a baked 1600×960 16-bit pixel-art night map (PNG) is completely feasible and architecturally clean:
1. `drawWorld()` in `OverworldScene.ts` will load and display `map_overworld_night` at `(0,0)` with depth 0.
2. `addColliders()` will set `obstacle.setVisible(false)` to hide solid blocks while maintaining collision physics.
3. `LANDMARK_GAME_DEFINITIONS` coordinates will align the 10 landmark icons and player start position `(248, 772)` with the night map artwork.
4. 4 Phaser animation overlays (river waves, lantern flickering, dragon fire particles, sea waves) will add dynamic life above the background image.
5. Manifest and asset validation scripts will accept PNG format across `map_background`, `landmark`, and `landmark_icon` categories.

---

## 5. Verification Method

To verify the overworld scene map upgrade survey and subsequent implementation:

1. **Inspect Survey Reports**:
   - Confirm analysis details in `d:\Hackthon-GG2026\.agents\explorer_survey_1\analysis.md`.
   - Confirm handoff report in `d:\Hackthon-GG2026\.agents\explorer_survey_1\handoff.md`.
2. **Run Verification Commands**:
   ```powershell
   Set-Location "d:\Hackthon-GG2026"
   npm run verify
   ```
3. **Invalidation Conditions**:
   - `drawWorld()` still renders procedural vector rectangles.
   - Static physics colliders remain visible solid color boxes on screen.
   - Landmark map icons do not align with their corresponding night map positions.
   - `npm run verify` fails due to asset format or manifest mismatch.
