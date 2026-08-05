## 2026-08-05T03:58:54Z
You are Explorer 1 (Overworld Scene Explorer) for Rồng Con Du Ký.
Your working directory is `d:\Hackthon-GG2026\.agents\explorer_survey_1`.

MANDATORY INSTRUCTIONS:
1. Read `d:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md` and `d:\Hackthon-GG2026\AGENTS.md`.
2. Inspect `src/client/game/scenes/OverworldScene.ts`, `src/client/game/world.ts`, and any associated scene/rendering files.
3. Detail how procedural `drawWorld()` works (lines 235-281 of OverworldScene.ts), how `WORLD_COLLIDER` rectangles are drawn and added to physics, how 10 landmark positions and departure village are located, and how replacing `drawWorld()` with a baked 1600x960 16-bit pixel-art night map (PNG) should be integrated.
4. Detail the required Phaser animations overlay (river water waves, lantern flickering, Dragon Bridge fire particles, My Khe sea waves) and how colliders should be hidden (`setAlpha(0)` or `setVisible(false)`).
5. Write your findings to `d:\Hackthon-GG2026\.agents\explorer_survey_1\analysis.md` and deliver a soft/hard handoff report in `d:\Hackthon-GG2026\.agents\explorer_survey_1\handoff.md`.
6. Send a message to parent when done with path to `handoff.md`.
