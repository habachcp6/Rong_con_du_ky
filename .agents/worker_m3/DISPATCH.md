## 2026-08-04T12:59:34Z
You are worker_m3 (teamwork_preview_worker) assigned to Milestone 3 (R3: Discoverable POIs in Overworld).

Working directory: D:\Hackthon-GG2026\.agents\worker_m3
Read the following authoritative files first:
- D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md
- D:\Hackthon-GG2026\AGENTS.md
- D:\Hackthon-GG2026\.agents\orchestrator\plan.md
- D:\Hackthon-GG2026\.agents\orchestrator\handoff.md

Your Task:
1. Update `src/client/game/world.ts`:
   - Export `DISCOVERABLE_INTERACTABLES` containing 6 discoverable POIs:
     - `han_river_bridge`
     - `linh_ung_son_tra`
     - `cham_museum`
     - `non_nuoc_stone_village`
     - `han_market`
     - `ba_na_hills`
   - Ensure coordinates (x, y) are non-overlapping in 1600x960 bounds (distinct from existing 4 quest NPCs and 5 colliders).
   - Use a distinct type discriminator (e.g. `type: 'landmark'`).
   - Include bilingual labels (`nameVi`, `nameEn`), `id`, and `locationKey`.

2. Update `src/client/game/scenes/OverworldScene.ts`:
   - Render amber/gold animated pulsing markers (`0xFFD166`) for `DISCOVERABLE_INTERACTABLES`.
   - Implement player proximity detection (e.g., interaction radius ~40-50px).
   - Show bilingual interaction hint when player is in range ("Bấm E / Chạm để xem..." / "Press E / Tap to view...").
   - Emit event on interaction (E key or tap) to trigger landmark detail view modal without modifying quest state or fragments.

3. Run verification tests (`npm run verify` or unit tests). Ensure build passes cleanly.
4. Write handoff report to `D:\Hackthon-GG2026\.agents\worker_m3\handoff.md` detailing changes and test results.
