## 2026-08-05T04:14:49Z
You are the Worker for Milestone M4 (OverworldScene Integration & Animations Overlay) for Rồng Con Du Ký.
Your working directory is `d:\Hackthon-GG2026\.agents\m4_worker`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INSTRUCTIONS:
1. Read `d:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md`, `d:\Hackthon-GG2026\AGENTS.md`, `d:\Hackthon-GG2026\PROJECT.md`, and `d:\Hackthon-GG2026\.agents\explorer_survey_1\handoff.md`.
2. Inspect `src/client/game/scenes/OverworldScene.ts` and `src/client/game/world.ts`.
3. Implement the M4 changes:
   - Replace procedural `drawWorld()` rendering (lines 235-281 of `OverworldScene.ts`) with a single baked image call: `this.add.image(0, 0, 'map_background_overworld_night').setOrigin(0, 0)` rendered at background depth below player/NPCs.
   - Hide `WORLD_COLLIDER` rectangles: keep the physics bodies active in the `obstacles` group, but set their graphics representation to invisible (`obstacle.setAlpha(0)` or `obstacle.setVisible(false)`).
   - Add Phaser dynamic animation overlays on top of the night map background:
     1. River water waves on Han River (x=650 to 1000): Phaser tweens/particle emitter/wave tile movement.
     2. Lantern flickering: Alpha flickering tweens on decorative lantern light points.
     3. Dragon Bridge fire particles: Particle emitter at dragon head (825, 474) emitting orange/red fire spark particles.
     4. My Khe sea waves: Sine wave position/alpha tweens on ocean wave graphics (x > 1300).
4. Run `npx vitest run` and `npm run verify` to verify all unit tests, typecheck, linting, asset validation, and client build pass cleanly.
5. Write your handoff report to `d:\Hackthon-GG2026\.agents\m4_worker\handoff.md` with build & test output evidence, then send a message to parent when complete.
