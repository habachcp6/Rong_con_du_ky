# BRIEFING — 2026-08-04T13:02:00Z

## Mission
Milestone 3 (R3: Discoverable POIs in Overworld): Add DISCOVERABLE_INTERACTABLES to world.ts and render amber/gold animated pulsing markers in OverworldScene.ts with player proximity detection, interaction hints, and event emission.

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: D:\Hackthon-GG2026\.agents\worker_m3
- Original parent: a5617e1e-a250-4447-ba03-72fd95e0bd78
- Milestone: M3 (R3)

## 🔒 Key Constraints
- Coordinates (x, y) non-overlapping in 1600x960 bounds (distinct from 4 quest NPCs and 5 colliders).
- Render amber/gold animated pulsing markers (`0xFFD166`).
- Proximity ~45px.
- Hint: "Bấm E / Chạm để xem..." / "Press E / Tap to view...".
- Emit event on interaction to trigger landmark detail view modal without modifying quest state or fragments.
- Minimal change principle.
- Run tests / verify.

## Current Parent
- Conversation ID: a5617e1e-a250-4447-ba03-72fd95e0bd78
- Updated: 2026-08-04T13:02:00Z

## Task Summary
- **What to build**: 6 discoverable POIs on Overworld map
- **Success criteria**: All 6 POIs positioned, rendered with pulsing animations, proximity detection working, event emitted on interaction, tests passing.
- **Interface contracts**: `src/client/game/world.ts`, `src/client/game/scenes/OverworldScene.ts`, `src/shared/types.ts`
- **Code layout**: Phaser OverworldScene + React UI event listener

## Change Tracker
- **Files modified**:
  - `src/shared/types.ts`: Added `OPEN_LANDMARK_DETAIL` to `GameToUiEvent` union.
  - `src/client/game/world.ts`: Exported `DiscoverableInteractable` type, `DISCOVERABLE_INTERACTABLES` array (6 POIs), and `getDiscoverableInteractableCopy` helper.
  - `src/client/game/scenes/OverworldScene.ts`: Added discoverable marker creation, amber pulsing animation (`0xFFD166`), proximity detection, bilingual hint, and event emission.
  - `tests/unit/game/world.test.ts`: Added 2 unit tests for POI count, keys, bounds, distance spacing, and bilingual copy formatting.
- **Build status**: PASS (`npm run verify` passed all checks including typecheck, lint, format:check, vitest, validate:content, validate:assets, build, validate:client-build).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: PASS (78/78 tests passed)
- **Lint status**: 0 errors, 2 pre-existing warnings in audit script scratch files.
- **Tests added/modified**: 2 new test cases in `world.test.ts`.

## Loaded Skills
- None.

## Key Decisions Made
- Positioned 6 discoverable POIs (`ba_na_hills` at (140, 160), `han_market` at (520, 220), `han_river_bridge` at (800, 220), `linh_ung_son_tra` at (1180, 180), `cham_museum` at (220, 440), `non_nuoc_stone_village` at (450, 840)) to maintain >50px spacing from all quest NPCs, colliders, player start position, and each other.
- Emitted `OPEN_LANDMARK_DETAIL` event to `bridge.emitGameToUi` without modifying `quests`, `memoryFragments`, or `unlockedPostcards` state.

## Artifact Index
- D:\Hackthon-GG2026\.agents\worker_m3\DISPATCH.md — Dispatch instructions
- D:\Hackthon-GG2026\.agents\worker_m3\progress.md — Progress log
- D:\Hackthon-GG2026\.agents\worker_m3\handoff.md — Handoff report
