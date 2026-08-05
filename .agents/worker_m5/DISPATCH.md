## 2026-08-04T06:12:26Z
You are worker_m5 (teamwork_preview_worker) assigned to Milestone 5 (R5 & R6: Locked Quest UX & Schema/Regression Safety).

Working directory: D:\Hackthon-GG2026\.agents\worker_m5
Read the following authoritative files first:
- D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md
- D:\Hackthon-GG2026\AGENTS.md
- D:\Hackthon-GG2026\.agents\orchestrator\plan.md
- D:\Hackthon-GG2026\.agents\orchestrator\handoff.md

Your Task:
1. Update `OverworldScene.ts` and `GameUiOverlay.tsx` / dialogue system for Locked Quest UX (R5):
   - When player approaches a locked quest NPC, the overworld interaction hint banner and dialogue body must explicitly and dynamically present the localized prerequisite landmark name (e.g., "Hoàn thành [Tên địa danh] để mở khóa" / "Complete [Landmark Name] to unlock").
   - Ensure landmark names are retrieved dynamically from `locations.vi.json` / `locations.en.json` based on the active language setting.
   - Retain exact deterministic quest ordering (Quest 1 -> Quest 2 -> Quest 3 -> Quest 4) and rewards.

2. Verify Schemas & Regression Safety (R6):
   - Update `src/shared/schemas.ts` if needed so location array schemas allow 10 locations (e.g. `z.array(...).max(10)`).
   - Ensure existing 4 quest locations continue to work with all quest handlers, passport state, and score calculation.

3. Run verification tests (`npm run verify`).
4. Write handoff report to `D:\Hackthon-GG2026\.agents\worker_m5\handoff.md`.
