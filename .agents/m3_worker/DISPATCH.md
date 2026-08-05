## 2026-08-05T04:08:34Z
<USER_REQUEST>
You are the Worker for Milestone M3 (Baked Overworld Night Map Asset Creation) for Rồng Con Du Ký.
Your working directory is `d:\Hackthon-GG2026\.agents\m3_worker`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INSTRUCTIONS:
1. Read `d:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md`, `d:\Hackthon-GG2026\AGENTS.md`, and `d:\Hackthon-GG2026\PROJECT.md`.
2. Generate a 1600x960 16-bit retro pixel-art night map (PNG format) using `image_gen` and save to `public/assets/map/overworld-night.png`.
   Style requirements:
   - Retro 16-bit pixel-art, top-down bird's eye view, night atmosphere (dark blue night sky, moonlit water, glowing lanterns).
   - Da Nang geography:
     * Han River flowing north-south through middle (x=650 to 1000)
     * Eastern coastline / My Khe beach (x > 1300) with golden sand and blue sea
     * Son Tra peninsula in northeast (x=1182, y=118)
     * Mainland on both sides of river with pixel-art streets and lush greenery
     * Departure Village / Làng Khởi Hành at (x=248, y=772) with small pixel-art houses
   - 10 Landmark pixel-art graphics depicted at exact coordinates:
     1. Dragon Bridge (825, 474): golden dragon bridge over river, dragon head, fire light
     2. My Khe Beach (1382, 688): golden sand, blue waves, coconut trees
     3. Marble Mountains (488, 118): cluster of 5 grey/green limestone karst peaks
     4. Son Tra Peninsula (1182, 118): deep green rainforest peninsula
     5. Han River Bridge (760, 300): swing bridge across river with night lights
     6. Linh Ung Pagoda (1370, 310): white Lady Buddha statue on hill
     7. Cham Museum (310, 350): French colonial red-tiled roof building
     8. Non Nuoc Stone Village (178, 640): stone carving workshops with white marble statues
     9. Han Market (310, 730): illuminated 2-story market building
     10. Ba Na Hills (108, 118): Golden Bridge held by giant stone hands on high mountain
3. Resize/crop output image to exactly 1600x960 PNG.
4. Run `npm run validate:assets` to verify `overworld-night.png` passes validation.
5. Write your handoff report to `d:\Hackthon-GG2026\.agents\m3_worker\handoff.md` with validation output, then send a message to parent when done.
</USER_REQUEST>
