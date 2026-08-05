# Handoff Report — Worker M3 (Discoverable POIs in Overworld)

## 1. Observation
- `src/client/game/world.ts`: Exported `DiscoverableInteractable` type, `DISCOVERABLE_INTERACTABLES` array with 6 POIs (`han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`), and `getDiscoverableInteractableCopy` helper.
- `src/shared/types.ts`: Extended `GameToUiEvent` union with `{ type: "OPEN_LANDMARK_DETAIL"; locationKey: string }`.
- `src/client/game/scenes/OverworldScene.ts`: Added `createDiscoverableMarkers()` to draw amber/gold (`0xFFD166`) pulsing markers with `Sine.easeOut` tween animations, updated `updateInteractionState()` to detect proximity (~45px radius) and display bilingual hints ("Bấm E / Chạm để xem..." / "Press E / Tap to view..."), and implemented `openLandmarkDetail()` to emit `OPEN_LANDMARK_DETAIL` via `PhaserBridge` without altering quest status, memory fragments, or passport progress.
- `tests/unit/game/world.test.ts`: Added 2 unit tests verifying that all 6 POIs exist, have correct discriminators and keys, are within world bounds (1600x960), maintain >50px spacing from quest NPCs and each other, and format bilingual copy correctly.
- Verification command output (`npm run verify`):
  - `typecheck`: PASS (0 errors)
  - `lint`: PASS (0 errors)
  - `format:check`: PASS (0 issues)
  - `test`: PASS (19 test files, 78/78 tests passed)
  - `validate:content`: PASS
  - `validate:assets`: PASS
  - `build`: PASS
  - `validate:client-build`: PASS

## 2. Logic Chain
1. Requirement R3 specifies adding 6 discoverable POIs on the Overworld map without affecting quest state or fragment counts.
2. We defined `DISCOVERABLE_INTERACTABLES` with `type: "landmark"` and amber/gold color `0xFFD166`, assigning coordinates that fit within 1600x960 bounds while maintaining >50px distance from colliders and quest NPCs.
3. In `OverworldScene.ts`, Phaser tweens create a continuous pulsing aura ring around each marker. Proximity detection (~45px) activates the interaction HUD with localized text.
4. On user interaction (E key, Space key, or mobile tap), `OverworldScene` emits `OPEN_LANDMARK_DETAIL` to the React overlay layer via `bridge.emitGameToUi`, cleanly separating game canvas events from React UI modal presentation.
5. All pre-existing 4 quest NPCs and collision rules remain intact and unchanged.

## 3. Caveats
- UI modal handling for `OPEN_LANDMARK_DETAIL` in React (`LandmarkDetailPanel.tsx` / `App.tsx`) is scheduled for Milestone 4 (R4). The event contract `{ type: "OPEN_LANDMARK_DETAIL", locationKey: string }` is now fully in place and ready for M4 consumption.

## 4. Conclusion
Milestone 3 (R3: Discoverable POIs in Overworld) is complete and fully verified. `DISCOVERABLE_INTERACTABLES` are rendered with pulsing animations, proximity detection works in VI and EN, events are emitted cleanly, and 100% of unit and static verification checks pass.

## 5. Verification Method
Run the following commands in native Windows PowerShell from `D:\Hackthon-GG2026`:

```powershell
Set-Location "D:\Hackthon-GG2026"
npm run test -- tests/unit/game/world.test.ts
npm run verify
```
