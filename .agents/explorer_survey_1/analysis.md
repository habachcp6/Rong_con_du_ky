# Overworld Scene Map Upgrade Analysis Report

## Executive Summary
This survey delivers an architectural and technical investigation for upgrading the overworld map in **Rồng Con Du Ký** from procedural primitive rendering (`drawWorld()`) to a 1600×960 16-bit pixel-art night map (PNG background), integrated with dynamic Phaser animation overlays, hidden static physics colliders, and accurate landmark icon positioning.

---

## 1. Procedural `drawWorld()` Breakdown (Lines 235-281 of `OverworldScene.ts`)

### 1.1 Current Implementation Mechanics
`drawWorld()` currently renders the map using Phaser 4 `Graphics` vector primitives directly onto the canvas:

```typescript
// OverworldScene.ts (lines 235-281)
private drawWorld(): void {
  const graphics = this.add.graphics();
  // Base background fill (Dark Teal #244a4d)
  graphics.fillStyle(0x244a4d, 1);
  graphics.fillRect(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);

  // Land masses (Greenish Teal #2d6d5e)
  graphics.fillStyle(0x2d6d5e, 1);
  graphics.fillRect(0, 0, 650, WORLD_BOUNDS.height); // West mainland
  graphics.fillRect(1000, 0, WORLD_BOUNDS.width - 1000, WORLD_BOUNDS.height); // East coast

  // Han River (Blue #14648d)
  graphics.fillStyle(0x14648d, 1);
  graphics.fillRect(650, 0, 350, WORLD_BOUNDS.height); // x=650 to 1000

  // Procedural river wave ripples (Cyan #6ce5ff)
  graphics.lineStyle(2, 0x6ce5ff, 0.32);
  for (let y = 24; y < WORLD_BOUNDS.height; y += 38) {
    graphics.lineBetween(664, y, 978, y);
  }

  // Dirt Roads (Brown #b79061)
  graphics.fillStyle(0xb79061, 1);
  graphics.fillRect(188, 430, 1110, 88); // Main east-west road
  graphics.fillRect(202, 500, 92, 350);  // Village south road

  // Dragon Bridge structure (Grey #4f5567 with Gold stroke #ffd166)
  graphics.fillStyle(0x4f5567, 1);
  graphics.fillRoundedRect(570, 408, 510, 132, 10);
  graphics.lineStyle(3, 0xffd166, 0.88);
  graphics.strokeRoundedRect(570, 408, 510, 132, 10);

  // Bridge lights (Yellow #ffc857)
  for (let x = 615; x <= 1030; x += 58) {
    graphics.fillStyle(0xffc857, 0.66);
    graphics.fillRect(x, 423, 22, 9);
    graphics.fillRect(x, 516, 22, 9);
  }

  // Text labels
  this.add.text(825, 380, gameText("CẦU RỒNG", "DRAGON BRIDGE"), { ... }).setOrigin(0.5).setDepth(5);
  this.add.text(214, 890, gameText("LÀNG KHỞI HÀNH", "STARTING VILLAGE"), { ... }).setDepth(5);
}
```

### 1.2 Limitations & Replacement Rationale
- **Visual Aesthetic**: Monochromatic block rectangles fail to represent the rich atmospheric detail of Da Nang's landmarks at night.
- **Maintainability**: Hardcoded geometric primitives cannot scale cleanly to 10 unique landmarks.
- **Replacement Strategy**: Replacing `drawWorld()` with a pre-rendered 1600×960 16-bit pixel-art night map (`map_overworld_night`) allows rich hand-crafted or AI-generated pixel art while maintaining exact alignment with game coordinates.

---

## 2. Collision Physics & Collider Hiding Mechanics

### 2.1 Current `WORLD_COLLIDERS` in `src/client/game/world.ts`
There are 5 static rectangular obstacle definitions in `WORLD_COLLIDERS`:
1. `market-hall`: (310, 190, 210, 120) - Color `0x7a5134`
2. `lantern-garden`: (516, 700, 184, 96) - Color `0x35654d`
3. `river-pier`: (742, 644, 134, 74) - Color `0x5a4638`
4. `east-pavilion`: (1335, 180, 166, 112) - Color `0x6c4b72`
5. `east-garden`: (1415, 762, 158, 128) - Color `0x35654d`

### 2.2 `addColliders()` in `OverworldScene.ts`
Currently:
```typescript
private addColliders(): void {
  WORLD_COLLIDERS.forEach((definition) => {
    const obstacle = this.add.rectangle(
      definition.x, definition.y, definition.width, definition.height, definition.color
    ).setDepth(8);
    obstacle.setStrokeStyle(2, 0xe8f7ff, 0.22);
    this.physics.add.existing(obstacle, true); // true = static body
    this.physics.add.collider(this.player, obstacle);
  });
}
```

### 2.3 Required Hiding Mechanism for Night Map
When integrating the baked PNG night map, solid colored rectangles must be hidden so they do not obscure the map artwork, while retaining their Arcade Physics static collision bodies:
- Call `obstacle.setVisible(false)` OR `obstacle.setAlpha(0)`.
- Remove `obstacle.setStrokeStyle(...)`.
- The physics engine continues using `obstacle.body` for player collision checks without drawing any visible overlay.

---

## 3. Map Coordinates & Landmark Placement Matrix

### 3.1 World Size & Starting Location
- **Map Dimensions**: 1600 × 960 pixels (`WORLD_BOUNDS`).
- **Starting Village (Làng Khởi Hành)**: Located at `(248, 772)`. Includes pixel-art houses and small lanterns.

### 3.2 10 Landmark Target Position Matrix
The target night map positions specified in `ORIGINAL_REQUEST.md` (R1) are mapped to `LANDMARK_GAME_DEFINITIONS` in `src/shared/landmark-game-definitions.ts`:

| # | Landmark Key | Name (VI) | Target Position (x, y) | Graphic Elements on Baked Night Map |
|---|--------------|-----------|------------------------|-------------------------------------|
| 1 | `dragon_bridge` | Cầu Rồng | **(825, 474)** | Golden bridge spanning Han River, dragon head, fire light |
| 2 | `my_khe_beach` | Biển Mỹ Khê | **(1382, 688)** | East coast sandy beach, blue ocean waves, coconut trees |
| 3 | `marble_mountains` | Ngũ Hành Sơn | **(488, 118)** | Cluster of 5 rocky grey/green mountain peaks |
| 4 | `son_tra_peninsula` | Sơn Trà | **(1182, 118)** | Dense tropical green rainforest peninsula in northeast |
| 5 | `han_river_bridge` | Cầu Sông Hàn | **(760, 300)** | Swing bridge spanning river with night lights |
| 6 | `linh_ung_son_tra` | Linh Ứng | **(1370, 310)** | White Lady Buddha statue on lush hillside |
| 7 | `cham_museum` | Bảo Tàng Chăm | **(310, 350)** | Red-tiled roof French colonial style building |
| 8 | `non_nuoc_stone_village` | Làng Đá Non Nước | **(178, 640)** | Sculpture village with white stone statues |
| 9 | `han_market` | Chợ Hàn | **(310, 730)** | Two-story illuminated market hall |
| 10 | `ba_na_hills` | Bà Nà Hills | **(108, 118)** | Golden Bridge, giant stone hands, mountain peak |

*Note*: Downstream implementation must ensure `LANDMARK_GAME_DEFINITIONS` in `src/shared/landmark-game-definitions.ts` reflects these exact target coordinates.

---

## 4. Baked PNG Night Map Integration Strategy

### 4.1 Asset Pipeline & Validation Setup
- **File Location**: `public/assets/maps/overworld-night.png` (1600×960 pixels).
- **Manifest Entry in `public/assets/manifest.json`**:
  ```json
  {
    "id": "map_overworld_night",
    "path": "/assets/maps/overworld-night.png",
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
- **Validator Updates in `scripts/validate-assets.ts`**:
  - Update `ASSET_CATEGORIES` to include `"map_background"`.
  - Update asset validation logic to accept `format: "png"` for `landmark`, `landmark_icon`, and `map_background`.

### 4.2 Scene Loading & Rendering
- In `PreloadScene.ts`:
  ```typescript
  this.load.image("map_overworld_night", "/assets/maps/overworld-night.png");
  ```
- In `OverworldScene.ts`:
  ```typescript
  private drawWorld(): void {
    this.add.image(0, 0, "map_overworld_night")
      .setOrigin(0, 0)
      .setDepth(0);
  }
  ```

---

## 5. Dynamic Phaser Animation Overlays

To create a vivid, living night environment without baking heavy animations into the base PNG, 4 dynamic Phaser particle/tween overlays are specified:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OVERWORLD NIGHT MAP (1600x960)                 │
│                                                                        │
│  [Bà Nà Hills]        [Ngũ Hành Sơn]      [Cầu Sông Hàn] [Sơn Trà]     │
│   (108,118)            (488,118)            (760,300)   (1182,118)   │
│                                                                        │
│  [Bảo Tàng Chăm]      🌊 RIVER WAVES     🔥 FIRE PARTICLES [Linh Ứng]  │
│   (310,350)           (x: 650→1000)        (825, 474)     (1370,310)  │
│                            │                                           │
│  [Làng Đá Non Nước]        │              [Biển Mỹ Khê]               │
│   (178,640)           🏮 LANTERN          (1382,688) 🌊 SEA WAVES    │
│                        FLICKER            (x>1300)                    │
│  [Chợ Hàn]            (310,730 & 248,772)                              │
│   (310,730)                                                            │
│  [Làng Khởi Hành]                                                      │
│   (248,772)                                                            │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 River Water Waves (Han River x: 650 → 1000)
- **Concept**: Soft horizontal light ripples flowing downstream along the river.
- **Phaser Implementation**:
  - Create multiple semi-transparent ripple graphics/sprites along the river channel.
  - Animate using Phaser tweens: `x` displacement (+15px to -15px) and `alpha` oscillation (0.2 → 0.6) with `Sine.easeInOut`, duration ~2500ms, looping indefinitely (`repeat: -1`, `yoyo: true`).

### 5.2 Lantern Flickering (Starting Village x: 248, y: 772 & Han Market x: 310, y: 730)
- **Concept**: Warm, soft orange-yellow glowing light accents near village houses and market stalls.
- **Phaser Implementation**:
  - Add radial glow graphics or light sprites (`0xffa500` / `0xffd166`) at key lantern coordinates.
  - Apply Phaser tweens to randomize alpha (0.3 → 0.85) and subtle scale pulse (1.0 → 1.15), creating a cozy night atmosphere.

### 5.3 Dragon Bridge Fire Particles (Cầu Rồng head at x: 825, y: 474)
- **Concept**: Fire ember sparks drifting rightward and upward from the Dragon's mouth.
- **Phaser Implementation**:
  - Create a Phaser 4 Particle Emitter (`this.add.particles(...)`).
  - Configuration:
    - Spawn point: `(835, 465)` (head of dragon).
    - Lifespan: 600 - 900ms.
    - Speed: 25 - 50 px/s, angle: 330° - 360° (upwards & rightwards).
    - Scale: start 1.2, end 0.2.
    - Alpha: start 1.0, end 0.
    - Tint: gradient from yellow `0xffd166` to orange `0xff6b6b`.
    - Blend mode: `ADD`.

### 5.4 My Khe Sea Waves (East Coast x: 1300 → 1580, y: 688)
- **Concept**: Gentle white sea foam waves lapping onto the golden sandy shore.
- **Phaser Implementation**:
  - Curved wave line graphics or wave sprites placed along shoreline curve (x: 1300 to 1580).
  - Animate using Phaser tweens: horizontal push toward shore (westward motion), expanding scale, and fading out alpha, looping infinitely.

---

## 6. Depth Layering & Rendering Order Matrix

To ensure visual elements render correctly without clipping or depth conflicts:

| Depth Level | Layer Content | Purpose & Description |
|-------------|---------------|-----------------------|
| **0** | `map_overworld_night` | Baked 1600×960 16-bit pixel-art night background image |
| **1** | River Waves & Sea Waves | Animated water ripple graphics and foam overlays |
| **2** | Fire Particles & Lantern Glows | Additive blend fire embers and warm lantern light glows |
| **8** | Physics Colliders | Invisible static colliders (`setAlpha(0)` / `setVisible(false)`) |
| **16** | Landmark Pulse Glow | Pulsing circular glow under available/interactive landmark icons |
| **18** | Landmark Map Icons | 48×48 pixel-art landmark map icon sprites |
| **19** | Landmark Labels & Guide NPCs | Text labels ("Cầu Rồng", "Chợ Hàn", etc.) and guide NPC sprites |
| **20** | Player & Status Badges | Dragon boy player sprite (`dragon_player`), Lock 🔒 and Star ★ badges |
| **50+** | HUD & Touch UI | Interaction prompt box, touch joystick, interact button |

---

## 7. Conclusions & Recommendations for Implementation

1. **Clean Decoupling**: Procedural canvas drawing in `drawWorld()` can be completely replaced by `this.add.image(0, 0, "map_overworld_night")`.
2. **Physics Collision Integrity**: `addColliders()` must set `obstacle.setVisible(false)` to hide solid blocks while preserving exact Arcade Physics bodies.
3. **Coordinate Alignment**: `LANDMARK_GAME_DEFINITIONS` map positions must match the 10 target landmark positions on the 1600×960 canvas.
4. **Animation Depth Order**: Overlays (river, lanterns, fire particles, sea waves) must be rendered between Depth 1 and 2 to sit naturally above the background image but below the player and interactive icons.
5. **Asset Validation Parity**: `validate-assets.ts` must be updated to support PNG format for `map_background`, `landmark`, and `landmark_icon`.
