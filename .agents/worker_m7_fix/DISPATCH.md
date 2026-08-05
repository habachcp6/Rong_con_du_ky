## 2026-08-04T06:59:54Z
You are worker_m7_fix (teamwork_preview_worker) assigned to remediate Milestone 7 E2E test failures.

Working directory: D:\Hackthon-GG2026\.agents\worker_m7_fix
Read the following authoritative files first:
- D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md
- D:\Hackthon-GG2026\AGENTS.md
- D:\Hackthon-GG2026\.agents\challenger_m7_2\handoff.md

Your Task:
1. Fix Failure 1 (`tests/e2e/landmark-gallery.spec.ts` / `LandmarkDetailPanel.tsx`):
   - When language is toggled to EN on mobile, opening `LandmarkDetailPanel` for `ba_na_hills` should display "Ba Na Hills" (from `locations.en.json`).
   - Ensure `LandmarkDetailPanel` receives the active `language` prop or dynamically computes `getLocationContent(language, locationKey).name` so localized title updates when language changes.

2. Fix Failure 2 (`tests/e2e/mobile-touch-quest-journey.spec.ts`):
   - Ensure mobile touch joystick interaction and player movement reliably places the player within interaction distance of the quest NPC so `[data-testid="interaction-hint"]` appears.

3. Run `npx playwright test --workers=1` and `npm run verify`. Ensure 0 failures across all 64 E2E tests and 114 unit tests.
4. Write handoff report to `D:\Hackthon-GG2026\.agents\worker_m7_fix\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
