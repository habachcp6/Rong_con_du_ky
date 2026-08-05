## 2026-08-05T04:08:33Z
You are the Worker for Milestone M2 (Landmark Postcards & Map Icons Asset Generation) for Rồng Con Du Ký.
Your working directory is `d:\Hackthon-GG2026\.agents\m2_worker`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INSTRUCTIONS:
1. Read `d:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md`, `d:\Hackthon-GG2026\AGENTS.md`, and `d:\Hackthon-GG2026\PROJECT.md`.
2. Generate 10 new 320x180 16-bit retro pixel-art landmark postcard images (PNG format) using `image_gen` for `public/assets/landmarks/<name>.png`:
   - `dragon-bridge.png` (Golden dragon bridge over Han River)
   - `my-khe.png` (Golden sand beach, blue sea waves, coconut trees)
   - `marble-mountains.png` (Five limestone karst peaks)
   - `son-tra.png` (Lush green tropical jungle peninsula)
   - `han-river-bridge.png` (Swing bridge over river at night)
   - `linh-ung.png` (White Lady Buddha statue on Son Tra hill)
   - `cham-museum.png` (Red tile roof French architecture museum)
   - `non-nuoc.png` (Stone carving village with white marble statues)
   - `han-market.png` (Two-story bustling indoor night market)
   - `ba-na-hills.png` (Golden Bridge held by giant stone hands)
   Resize/crop generated PNGs to exactly 320x180 if needed.
3. Generate 10 new 48x48 16-bit retro pixel-art map icons (PNG format, transparent background) using `image_gen` for `public/assets/landmark-icons/<name>.png` corresponding to the 10 landmarks above.
4. Run `npm run validate:assets` to verify all 20 PNG asset files pass asset validation.
5. Write your handoff report to `d:\Hackthon-GG2026\.agents\m2_worker\handoff.md` with file paths and validation output, then send a message to parent when done.
