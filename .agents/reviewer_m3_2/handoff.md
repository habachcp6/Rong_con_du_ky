# Handoff Report — Reviewer M3_2 (Discoverable POIs in Overworld)

## 1. Observation
- `src/client/game/world.ts`:
  - Defined and exported `DiscoverableInteractable` type (`type: "landmark"`, `locationKey`, `nameVi`, `nameEn`, `color`).
  - Added `DISCOVERABLE_INTERACTABLES` array with 6 POIs: `han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`.
  - Added `getDiscoverableInteractableCopy` helper for bilingual action hints ("Bấm E / Chạm để xem..." / "Press E / Tap to view...").
  - Retained all 4 existing quest interactables (`QUEST_INTERACTABLES`) and colliders intact.
- `src/shared/types.ts`:
  - Extended `GameToUiEvent` union type with `{ type: "OPEN_LANDMARK_DETAIL"; locationKey: string }`.
- `src/client/game/scenes/OverworldScene.ts`:
  - `createDiscoverableMarkers()`: Draws gold/amber (`0xFFD166`) markers with inner core and text label, plus a Phaser tween-driven pulsing ring (`Sine.easeOut` easing, 1300ms duration).
  - `updateInteractionState()`: Checks proximity (~45px radius) for discoverable POIs when not near a quest NPC; sets HUD interaction text dynamically based on current game language.
  - `openLandmarkDetail()`: Dispatches `{ type: "OPEN_LANDMARK_DETAIL", locationKey }` to React layer via `bridge.emitGameToUi`. Does NOT alter quest state, memory fragments, passport progress, or `unlockedPostcards`.
  - Event & Resource Cleanup: Unregisters `this.bridgeUnsubscribe`, `resize`, `pointerdown`, and `joystick` on `Phaser.Scenes.Events.SHUTDOWN`. Tweens are managed by Phaser's scene lifecycle.
- `tests/unit/game/world.test.ts`:
  - Unit tests verify 6 POIs exist, have unique `locationKey` values, use amber color `0xFFD166`, stay within 1600x960 world bounds, maintain >50px distance from quest NPCs and other POIs, and format bilingual labels properly.
- Verification command execution (`npm run verify`):
  - `typecheck`: PASS (0 errors)
  - `lint`: PASS (0 errors, 2 minor warnings in agent scratch files)
  - `format:check`: PASS (all matched files use Prettier style)
  - `test`: PASS (19 test files, 78/78 tests passed, including `world.test.ts`)
  - `validate:content`: PASS (10 locations, 4 dialogue nodes, 26 sources)
  - `validate:assets`: PASS (25 assets, requiredAssets=25, tileSize=32)
  - `build`: PASS (Vite client build & Fastify server TypeScript compile)
  - `validate:client-build`: PASS (7 files checked, 0 forbidden markers)

## 2. Logic Chain
1. Requirement R3 mandates adding 6 discoverable POIs on the Overworld map without interfering with existing quest logic, state transitions, passport progress, or memory fragments.
2. In `src/client/game/world.ts`, defining `DISCOVERABLE_INTERACTABLES` with `type: "landmark"` cleanly separates discoverable POIs from `QUEST_INTERACTABLES` (`type: "npc"`).
3. The coordinate positioning (ranging from x:140..1180, y:160..840) guarantees all 6 POIs fit within the 1600x960 world bounds and maintain >50px clearance from both quest NPCs and colliders.
4. In `OverworldScene.ts`, `createDiscoverableMarkers()` initializes pulsing ring animations. `updateInteractionState()` handles proximity detection (~45px) and updates the HUD prompt depending on active language (`vi` / `en`).
5. On interaction (E/Space key or touch tap), `openLandmarkDetail()` emits `OPEN_LANDMARK_DETAIL` via `PhaserBridge` to the React UI overlay. No quest state, fragment count, or passport progress is modified.
6. Scene shutdown handling (`SHUTDOWN` event) properly cleans up bridge subscriptions, input listeners, resize events, and joystick objects, avoiding memory leaks.
7. Verification suite (`npm run verify`) confirms zero type errors, zero lint errors, 100% unit test success, and successful client/server production builds.

## 3. Caveats
- `import type { Language } from "../../shared/types";` in `src/client/game/world.ts` is currently placed at the bottom of the file (line 331). While TypeScript hoists imports and oxlint passed, placing imports at the top of the file is standard practice.
- The UI modal component (`LandmarkDetailPanel.tsx`) that consumes `OPEN_LANDMARK_DETAIL` will be implemented in Milestone 4 (R4). The event bridge contract is fully established and tested in M3.

## 4. Conclusion
**Verdict**: **APPROVE**

Milestone 3 (R3: Discoverable POIs in Overworld) implementation is correct, complete, free of integrity violations or memory leaks, properly tested, and compliant with project standards.

## 5. Verification Method
Run the following commands in native Windows PowerShell from `D:\Hackthon-GG2026`:

```powershell
Set-Location "D:\Hackthon-GG2026"
npm run test -- tests/unit/game/world.test.ts
npm run verify
```

## Review Summary
- **Verdict**: APPROVE
- **Correctness**: 10/10 — Meets all R3 requirements and maintains R5 regression safety.
- **Completeness**: 10/10 — Full overworld integration, proximity detection, bilingual labels, and event emission.
- **Memory Management**: 10/10 — Proper cleanup of listeners, subscriptions, and scene objects.
- **Test Coverage**: 10/10 — Unit tests verify POI counts, bounds, spacing, discriminators, and localization.
