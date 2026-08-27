# Project: Rồng Con Du Ký — Mini-Game Redesign (Visuals, UX, Gameplay Balance)

## Architecture

- **Frontend Engine**: Phaser 4 + React 19 + TypeScript + Vite.
- **Deterministic Game Logic**: All 10 mini-games use deterministic rules modules (`landmark-challenge-rules.ts`, `rhythm.ts`, `marble-puzzle.ts`, `my-khe.ts`, `son-tra.ts`) and state machine (`GameStateStore.ts`).
- **Scene Architecture**:
  - Category 1: `LandmarkChallengeScene` base class + 6 scenes (`HanRiverBridgeQuestScene`, `LinhUngQuestScene`, `ChamMuseumQuestScene`, `NonNuocQuestScene`, `HanMarketQuestScene`, `BaNaGoldenBridgeQuestScene`) in `src/client/game/scenes/LandmarkChallengeScenes.ts`.
  - Category 2: `DragonBridgeQuestScene.ts` in `src/client/game/scenes/`.
  - Category 3: `MarbleMountainsPuzzleScene.ts` in `src/client/game/scenes/`.
  - Category 4: `MyKheCleanupScene.ts` in `src/client/game/scenes/`.
  - Category 5: `SonTraWildlifeScene.ts` in `src/client/game/scenes/`.
- **Zero AI in Scenes**: Mini-game scenes contain no Gemini or fetch calls; AI is strictly isolated to backend server.

## Feature Inventory

| #   | Feature                                                    | Description                                                                                                                                                                                                     | Milestone | Source                   |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------ |
| 1   | Duration & Hit Window Updates + Rules Integrity Test Suite | Update durations (+50%) & rhythm hit window (>=1500ms). Update existing test bounds and create `minigame-redesign-integrity.test.ts` (TC-5.1 to TC-5.12).                                                       | M1        | R3, TC-1..TC-5           |
| 2   | Category 1 Landmark Challenge Redesign (6 games)           | Update `LandmarkChallengeScenes.ts` with postcard backgrounds, visual stage visualizers, tutorial overlays, progress indicators, category icons, glow/particle feedback. Preserve touch targets.                | M2        | R1, R2, R4, TC-7.1..7.6  |
| 3   | Category 2 Dragon Bridge Rhythm Redesign                   | Golden dragon bridge graphics, conductor sweet spot track, particle spark emitters, flame/water celebration tweens, visual tutorial overlay.                                                                    | M3        | R1, R2, R3, TC-7.7       |
| 4   | Category 3 Marble Mountains Five Elements Redesign         | Misty mountain backdrop, 5 runic elemental discs, resonant energy line, pulse target hint highlight, particle bursts, visual tutorial diagram.                                                                  | M4        | R1, R2, R3, TC-7.8       |
| 5   | Categories 4 & 5 Beach Cleanup & Son Tra Redesign          | My Khe coastal graphics, 8 trash vector icons, 3 scenery obstacles, proximity ring, clean sparkle burst. Son Tra canopy backdrop with sunbeams, 3 trace icons, camera lens viewport, shutter flash, ranger HUD. | M5        | R1, R2, R4, TC-7.9..7.10 |
| 6   | Design System Alignment & Full E2E Verification            | Standardized HUD buttons ("How to Play", "Back to Map"), timer/score styling, color palette per theme. Pass `npm run verify` and all Playwright specs (TC-0..TC-10).                                            | M6        | R4, R5, TC-0..TC-10      |

## Milestones

| #   | Name                                     | Scope                                                                                                     | Dependencies   | Status |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- | ------ |
| 1   | Rule Constants & Integrity Tests         | Update time limits, rhythm hit window, unit test assertions, create `minigame-redesign-integrity.test.ts` | None           | DONE   |
| 2   | Category 1 Landmark Games Redesign       | Redesign 6 landmark challenge scenes in `LandmarkChallengeScenes.ts`                                      | M1             | DONE   |
| 3   | Category 2 Dragon Bridge Rhythm Redesign | Redesign `DragonBridgeQuestScene.ts` visual & UX elements                                                 | M1             | DONE   |
| 4   | Category 3 Marble Mountains Redesign     | Redesign `MarbleMountainsPuzzleScene.ts` visual & UX elements                                             | M1             | DONE   |
| 5   | Categories 4 & 5 Mini-Games Redesign     | Redesign `MyKheCleanupScene.ts` and `SonTraWildlifeScene.ts`                                              | M1             | DONE   |
| 6   | Design System & Full Verification        | Standardize UI across all 10 games, run `npm run verify` & full Playwright E2E suite                      | M2, M3, M4, M5 | DONE   |

## Code Layout

- Rule modules: `src/client/game/landmark-challenge-rules.ts`, `src/client/game/rhythm.ts`, `src/client/game/my-khe.ts`, `src/client/game/son-tra.ts`, `src/client/game/marble-puzzle.ts`
- Scene modules: `src/client/game/scenes/LandmarkChallengeScenes.ts`, `src/client/game/scenes/DragonBridgeQuestScene.ts`, `src/client/game/scenes/MarbleMountainsPuzzleScene.ts`, `src/client/game/scenes/MyKheCleanupScene.ts`, `src/client/game/scenes/SonTraWildlifeScene.ts`
- Unit tests: `tests/unit/game/landmark-challenge-rules.test.ts`, `tests/unit/game/rhythm.test.ts`, `tests/unit/game/my-khe.test.ts`, `tests/unit/game/son-tra.test.ts`, `tests/unit/game/minigame-redesign-integrity.test.ts`
- E2E tests: `tests/e2e/landmark-games.spec.ts`, `tests/e2e/dragon-bridge-journey.spec.ts`, `tests/e2e/remaining-quests.spec.ts`
