## 2026-08-04T06:25:58Z
You are worker_m7 (teamwork_preview_worker) assigned to Milestone 7 (R7: Playwright E2E Tests Expansion).

Working directory: D:\Hackthon-GG2026\.agents\worker_m7
Read the following authoritative files first:
- D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md
- D:\Hackthon-GG2026\AGENTS.md
- D:\Hackthon-GG2026\.agents\orchestrator\plan.md
- D:\Hackthon-GG2026\.agents\orchestrator\handoff.md

Your Task:
1. Write/expand Playwright E2E test suite specs in `tests/e2e/`:
   - `discoverable-pois.spec.ts`: Test overworld POI markers, proximity activation, localized hint banner ("Bấm E / Chạm để xem..."), and modal trigger.
   - `landmark-gallery.spec.ts`: Test header "Khám phá" button navigation, gallery panel displaying 10 landmarks (2 cols desktop, 1 col mobile <640px), clicking landmark card to open `LandmarkDetailPanel`, food cards display, source attributions, Google Maps link, and modal accessibility (X button, backdrop click, Escape key).
   - `locked-quest-ux.spec.ts`: Test approaching locked quest NPCs displays localized prerequisite landmark name dynamically in hint banner and dialogue body.

2. Run Playwright E2E suite (`npx playwright test --workers=1`) and full verification (`npm run verify`).
3. Write handoff report to `D:\Hackthon-GG2026\.agents\worker_m7\handoff.md`.
