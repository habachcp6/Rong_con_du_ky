## 2026-08-04T05:44:35Z
You are a teamwork_preview_worker subagent assigned to Milestone 1: Content Expansion (R1).
Your working directory is D:\Hackthon-GG2026\.agents\worker_m1. Create this directory first for metadata.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

User Requirements & Rules:
- Read D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md and D:\Hackthon-GG2026\AGENTS.md before starting.

Task Instructions:
1. Expand `content/locations.vi.json` and `content/locations.en.json` from 4 to 10 entries.
   - Preserved existing 4 keys (`dragon_bridge`, `my_khe_beach`, `marble_mountains`, `son_tra_peninsula`).
   - Add 6 new landmark keys in exact identical order in VI and EN files:
     `han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`.
   - Ensure each location entry follows the schema:
     - `key`: string
     - `name`: string
     - `shortDescription`: 80-700 chars, 50-80 words
     - `funFact`: 20-300 chars
     - `visitTip`: 20-350 chars
     - `authoredImage`: `/assets/landmarks/<filename>.svg` (filenames: `dragon-bridge.svg`, `my-khe.svg`, `marble-mountains.svg`, `son-tra.svg`, `han-river-bridge.svg`, `linh-ung.svg`, `cham-museum.svg`, `non-nuoc.svg`, `han-market.svg`, `ba-na-hills.svg`)
     - `assetId`: `landmark_<key>`
     - `imageAttributionId`: `asset_landmark_art_01` (or relevant attribution ID)
     - `sourceIds`: array of source IDs
   - Tourism facts must be paraphrased formally from official sources (danangfantasticity.com, Wikipedia VI).

2. Expand `content/curated-places.json` from 4 to at least 12 food cards.
   - Ensure EVERY landmark (all 10) has at least 1 food card (some can have 2 to reach >=12 total).
   - Each card must include: `id`, `landmarkKey`, `nameVi`, `nameEn`, `descriptionVi`, `descriptionEn`, `address`, `priceRange` ("budget"|"moderate"|"premium"), `dietary` ("any"|"vegetarian"), `googleMapsUri` (valid Google Maps URL), and `sourceIds`.
   - Include a balanced mix of budget, moderate, and premium price ranges, as well as vegetarian and any options.
   - ABSOLUTELY DO NOT include restricted Places fields (`rating`, `reviews`, `openingHours`, `openNow`, `photos`, `photoUrl`).

3. Expand `content/sources.md`:
   - Add formatted source citation entries for every new `sourceId` referenced in `locations.*.json` and `curated-places.json`. Follow the existing format in `sources.md`.

4. Verification:
   - Run existing content validation or narrow tests if available (`npm run validate:content` or `npx vitest`).
   - Report commands executed and test outputs in your handoff report.

Write your handoff report to `D:\Hackthon-GG2026\.agents\worker_m1\handoff.md` and send a summary message to parent.
