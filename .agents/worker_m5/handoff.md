# Handoff Report — Milestone 5 (Locked Quest UX & Schema/Regression Safety)

## 1. Observation
- **`src/client/game/scenes/OverworldScene.ts` (lines 430–445)** previously displayed static fallback strings for locked NPCs (`"hoàn thành điểm trước để mở khóa"` / `"finish the previous landmark to unlock"`).
- **`src/client/app/GameUiOverlay.tsx` (lines 108–115)** previously displayed a generic message for `quest_locked` dialogue body (`"Hãy hoàn thành địa danh trước đó để mở khóa thử thách này nhé."` / `"Complete the previous landmark to unlock this challenge."`).
- **`src/shared/schemas.ts`**: `DragonChatRequestSchema.unlockedPostcards` was `max(10)`, while `ItineraryRequestSchema.unlockedPostcards`, `ItineraryResponseSchema.stops`, and `ItineraryResponseSchema.notes` were constrained to 4 items.
- Added `getPrerequisiteLandmarkName(questId: string, language: Language): string | undefined` to `src/client/content.ts` which uses `QUEST_ORDER` and `QUESTS` to resolve the prerequisite landmark key and retrieve the localized landmark name via `getLocationContent(language, prereqLandmarkKey)`.
- Updated `OverworldScene.ts` interaction hint banner to format:
  - VI: `${localized.npcLabel} — Hoàn thành ${prereqName} để mở khóa`
  - EN: `${localized.npcLabel} — Complete ${prereqName} to unlock`
- Updated `GameUiOverlay.tsx` dialogue body for `quest_locked` nodeId to format:
  - VI: `Hoàn thành ${prereqLandmarkName} để mở khóa.`
  - EN: `Complete ${prereqLandmarkName} to unlock.`
- Updated `src/shared/schemas.ts` location/postcard array limits in `ItineraryRequestSchema` and `ItineraryResponseSchema` to `.max(10)`.
- Added unit tests in `tests/unit/game/locked-quest-ux.test.ts`.
- Verified execution:
  - `npm run verify`: PASS (0 typecheck errors, 0 lint errors, prettier check pass, 83 vitest unit tests pass, content validation pass, asset validation pass, build pass, client build validation pass).
  - `npx playwright test --workers=1`: PASS (26/26 passed, including `locked-quest-ux.spec.ts`).

## 2. Logic Chain
1. **Requirement R5 & R6 (Locked Quest UX)**:
   - Observation: When a player encounters a locked quest NPC (e.g. My Khe Beach, Marble Mountains, Son Tra Peninsula), the hint banner and dialogue body must explicitly state the specific prerequisite landmark name (e.g. "Cầu Rồng" for My Khe Beach; "Biển Mỹ Khê" for Marble Mountains; "Ngũ Hành Sơn" for Son Tra Peninsula).
   - Step 1: `QUEST_ORDER` defines the deterministic sequence (`dragon_bridge_lights` -> `my_khe_clean_wave` -> `marble_five_elements` -> `son_tra_traces`).
   - Step 2: `getPrerequisiteLandmarkName` maps `questId` -> index in `QUEST_ORDER` -> `prereqQuestId` -> `prereqLandmarkKey` -> `getLocationContent(language, prereqLandmarkKey).name`.
   - Step 3: Integrating this helper in `OverworldScene.ts` (`updateInteractionState()`) and `GameUiOverlay.tsx` (`dialogueBody`) guarantees both overworld hint banner and dialogue modal display the exact localized prerequisite landmark name dynamically according to current active language (`vi` / `en`).
2. **Requirement R6 (Schema & Regression Safety)**:
   - Observation: Location arrays must support up to 10 locations without validation errors while maintaining full backwards compatibility for existing 4 quest locations.
   - Step 1: Updated `ItineraryRequestSchema.unlockedPostcards`, `ItineraryResponseSchema.stops`, and `ItineraryResponseSchema.notes` to `.max(10)`.
   - Step 2: Verified that existing 4 quest handlers, passport state, score calculation, and state machine transitions remain unchanged and 100% deterministic.
3. **Verification**:
   - Running `npm run verify` validates type safety, code formatting, static checks, unit tests, and build artifacts.
   - Running Playwright E2E tests confirms browser UI rendering for locked quest hints and dialogue body across both desktop and mobile viewports.

## 3. Caveats
- No caveats. All changes are minimal, deterministic, fully localized, and covered by both unit and E2E tests.

## 4. Conclusion
- Milestone 5 (Locked Quest UX & Schema/Regression Safety) is fully completed and verified. The interaction hint banner and dialogue body now dynamically display localized prerequisite landmark names for locked quests in both Vietnamese and English. Schemas support up to 10 locations, and all existing 4 quest workflows pass verification cleanly without regression.

## 5. Verification Method
To independently verify this implementation:
1. Run static checks and unit tests:
   `npm run verify`
   Expected result: All 83 unit tests, linting, formatting, content/asset validation, and client build checks pass with 0 errors.
2. Run Playwright E2E test suite:
   `npx playwright test --workers=1`
   Expected result: 26 passed tests (including `locked-quest-ux.spec.ts` on chromium-desktop and mobile-touch).
3. Inspect modified files:
   - `src/shared/schemas.ts`
   - `src/client/content.ts`
   - `src/client/game/scenes/OverworldScene.ts`
   - `src/client/app/GameUiOverlay.tsx`
   - `tests/unit/game/locked-quest-ux.test.ts`
