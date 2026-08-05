## 2026-08-04T06:06:07Z
You are worker_m4 (teamwork_preview_worker) assigned to Milestone 4 (R4: Landmark Gallery UI & Detail Panel).

Working directory: D:\Hackthon-GG2026\.agents\worker_m4
Read the following authoritative files first:
- D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md
- D:\Hackthon-GG2026\AGENTS.md
- D:\Hackthon-GG2026\.agents\orchestrator\plan.md
- D:\Hackthon-GG2026\.agents\orchestrator\handoff.md

Your Task:
1. Create `LandmarkGalleryPanel.tsx` (or update existing UI components in `src/client/app/components/`):
   - Grid layout displaying all 10 landmarks: 2 columns on desktop, 1 column on mobile (<640px).
   - Show SVG postcard thumbnail, localized landmark title, short description, and source attribution badge.
   - Clicking a card opens `LandmarkDetailPanel.tsx` for that landmark key.

2. Create `LandmarkDetailPanel.tsx`:
   - Slide-up bottom sheet / modal (~70% viewport height).
   - Display full SVG postcard image, full bilingual title, category tag, full description/history, curated food cards for that location (from `curated-places.json`), and source attribution link.
   - Support modal closing via `X` button, backdrop click, or Escape key.
   - Include proper ARIA attributes (`aria-modal="true"`, `role="dialog"`, focus trap).

3. Integrate in `src/client/app/App.tsx` and `Header`:
   - Add "Khám phá" / "Explore" navigation button in the top header (positioned between Passport and Companion buttons).
   - Wire event listener for `OPEN_LANDMARK_DETAIL` from Phaser bridge so interacting with map POIs directly opens `LandmarkDetailPanel` for that POI.

4. Run tests and static checks (`npm run verify`).
5. Write handoff report to `D:\Hackthon-GG2026\.agents\worker_m4\handoff.md`.
