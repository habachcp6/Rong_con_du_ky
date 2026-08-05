# Review & Handoff Report — Milestone 5 (R5 & R6: Locked Quest UX & Schema/Regression Safety)

## Review Summary

**Verdict**: **APPROVE**

## 1. Observation
- `src/client/content.ts` (lines 91-102): Added `getPrerequisiteLandmarkName(questId: string, language: Language): string | undefined`. It dynamically resolves `questId` -> index in `QUEST_ORDER` -> `prereqQuestId` -> `prereqLandmarkKey` -> localized name via `getLocationContent(language, prereqLandmarkKey).name`.
- `src/client/game/scenes/OverworldScene.ts` (lines 430-445): Replaced generic hint banner labels with dynamic prerequisite landmark names for locked quest NPCs (`${localized.npcLabel} — Hoàn thành ${prereqName} để mở khóa` in VI; `${localized.npcLabel} — Complete ${prereqName} to unlock` in EN).
- `src/client/app/GameUiOverlay.tsx` (lines 97-122): Updated dialogue body for `quest_locked` node ID to dynamically state `Hoàn thành ${prereqLandmarkName} để mở khóa.` in VI and `Complete ${prereqLandmarkName} to unlock.` in EN.
- `src/shared/schemas.ts`: Updated location array constraints in `DragonChatRequestSchema.unlockedPostcards`, `ItineraryRequestSchema.unlockedPostcards`, `ItineraryResponseSchema.stops`, and `ItineraryResponseSchema.notes` to `.max(10)`.
- `tests/unit/game/locked-quest-ux.test.ts`: Unit tests verify correct localized prerequisite landmark name resolution for all quests in VI and EN, as well as edge cases (quest 1, unknown quest ID).
- Command Execution: `npm run verify` executed directly on native Windows PowerShell:
  - `typecheck` (tsc): PASSED (0 errors)
  - `lint` (oxlint): PASSED (0 errors)
  - `format:check` (prettier): PASSED
  - `test` (vitest): PASSED (21 test files, 83 unit tests passed)
  - `validate:content`: PASSED (10 locations, 4 dialogue nodes, 26 sources)
  - `validate:assets`: PASSED (25 assets, 25 required assets)
  - `build` (vite + tsc): PASSED
  - `validate:client-build`: PASSED (7 files checked, 0 forbidden markers)

## 2. Logic Chain
1. **Dynamic Prerequisite UX (R6)**:
   - Observation: Locked quest NPCs previously showed generic hint text ("hoàn thành điểm trước để mở khóa").
   - Deduction: Mapping `questId` through `QUEST_ORDER` (`dragon_bridge_lights` -> `my_khe_clean_wave` -> `marble_five_elements` -> `son_tra_traces`) guarantees deterministic resolution of the exact preceding landmark.
   - Verification: In `OverworldScene.ts` and `GameUiOverlay.tsx`, calling `getPrerequisiteLandmarkName(questId, language)` fetches the exact localized landmark name (e.g., "Cầu Rồng" / "Dragon Bridge", "Biển Mỹ Khê" / "My Khe Beach", "Ngũ Hành Sơn" / "Marble Mountains").
2. **Schema & Regression Safety (R5 & R6)**:
   - Observation: Expanding content to 10 landmarks requires schema validation array limits to accommodate up to 10 items.
   - Deduction: Changing `.max(4)` to `.max(10)` across Zod request and response schemas enables 10-landmark itinerary/chat payloads while preserving backward compatibility for 4-landmark quest payloads.
3. **Adversarial & Integrity Review**:
   - Check 1: No hardcoded test outputs or dummy facade logic found in `content.ts`, `OverworldScene.ts`, `GameUiOverlay.tsx`, or `schemas.ts`.
   - Check 2: Quest order, reward logic, memory fragment accumulation, and state transitions remain strictly deterministic and unbypassed.
   - Check 3: Verified directly via `npm run verify` without relying on self-certifying claims.

## 3. Caveats
- No caveats. The implementation is clean, fully localized, type-safe, and passes all unit, content, asset, lint, formatting, and build verifications.

## 4. Conclusion
- The changes submitted by `worker_m5` for Milestone 5 fulfill all requirements for R5 and R6 without introducing regressions, integrity violations, or breaking changes. The verdict is **APPROVE**.

## 5. Verification Method
1. Execute static checks, unit tests, and build validation:
   `npm run verify`
   Expected result: All 83 unit tests pass, typecheck passes, content/asset validators pass, and client build security check passes.
2. Code inspection:
   - `src/client/content.ts`
   - `src/client/game/scenes/OverworldScene.ts`
   - `src/client/app/GameUiOverlay.tsx`
   - `src/shared/schemas.ts`
   - `tests/unit/game/locked-quest-ux.test.ts`
