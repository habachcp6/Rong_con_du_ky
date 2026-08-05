# Soft Handoff Report — Spec Miner Survey 1

**Agent Archetype:** Specification Miner  
**Working Directory:** `D:\Hackthon-GG2026\.agents\spec_miner_survey_1`  
**Target Specifications:** `ORIGINAL_REQUEST.md` (R1 - R8) and `AGENTS.md`  
**Report Output:** `D:\Hackthon-GG2026\.agents\spec_miner_survey_1\analysis.md`  

---

## 1. Observation

Direct observations from examining `ORIGINAL_REQUEST.md`, `AGENTS.md`, and current project files in `D:\Hackthon-GG2026\`:

1. **Content Files (`content/locations.vi.json` and `content/locations.en.json`)**:
   - Currently contain 4 landmark keys (`dragon_bridge`, `my_khe_beach`, `marble_mountains`, `son_tra_peninsula`).
   - Line 14 of `ORIGINAL_REQUEST.md` states: "Expand `content/locations.vi.json` and `content/locations.en.json` from 4 to 10 entries... Add 6 new landmark keys: `han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`."

2. **Food Cards (`content/curated-places.json`)**:
   - Currently contains 4 cards (`banh_xeo_ba_duong`, `hoangs_kitchen`, `mi_quang_ba_mua_ngu_hanh_son`, `maha_vegetariano`).
   - Line 33 of `ORIGINAL_REQUEST.md` states: "Expand `content/curated-places.json` from 4 to at least 12 food cards. Every landmark (all 10) must have at least 1 food card."

3. **Landmark SVGs (`public/assets/landmarks/`)**:
   - 4 existing SVGs (`dragon-bridge.svg`, `my-khe.svg`, `marble-mountains.svg`, `son-tra.svg`) are ~1KB placeholders with `placeholder: true` in `public/assets/manifest.json`.
   - Line 37 of `ORIGINAL_REQUEST.md` states: "Replace all 4 existing SVGs in `public/assets/landmarks/` and create 6 new ones (total 10)... 320x180 pixels... shape-rendering='crispEdges'... data-pixel-art='true' and data-alpha='false'... 4px border frame using color #182433."

4. **Overworld Interactables (`src/client/game/world.ts`)**:
   - `world.ts` exports `QUEST_INTERACTABLES` containing 4 quest NPCs.
   - Line 53 of `ORIGINAL_REQUEST.md` states: "Add a new `DISCOVERABLE_INTERACTABLES` array in `src/client/game/world.ts` alongside the existing `QUEST_INTERACTABLES`... 6 new landmarks... non-overlapping position within the existing 1600x960 world bounds."

5. **App Header & UI Panels (`src/client/app/App.tsx`)**:
   - `App.tsx` header actions include Passport and Companion buttons.
   - Line 70 of `ORIGINAL_REQUEST.md` states: "Add a 'Khám phá' / 'Explore' button to the app header, positioned between the existing 'Hộ chiếu' (Passport) button and 'Trợ lý' (Companion) button... opens a `LandmarkGalleryPanel`... Each card button/link to open the full `LandmarkDetailPanel`."

6. **Zod Schemas (`src/shared/schemas.ts`)**:
   - Line 20 of `schemas.ts` currently reads: `unlockedPostcards: z.array(z.string().max(80)).max(4).default([]),`.
   - Line 102 of `ORIGINAL_REQUEST.md` states: "Update `DragonChatRequestSchema.unlockedPostcards` from `max(4)` to `max(10)` in `src/shared/schemas.ts`."

7. **Locked Quest UX (`src/client/game/scenes/OverworldScene.ts` and `src/client/app/GameUiOverlay.tsx`)**:
   - `OverworldScene.ts` line 376 reads: `${localized.npcLabel} — hoàn thành điểm trước để mở khóa`.
   - `GameUiOverlay.tsx` line 109 reads: `Hãy hoàn thành địa danh trước đó để mở khóa thử thách này nhé.`.
   - Line 106 of `ORIGINAL_REQUEST.md` states: "Improve this to show the specific name of the prerequisite landmark. For example... 'Hoàn thành thử thách ở Ngũ Hành Sơn để mở khóa'".

8. **Validator Scripts (`scripts/validate-content.ts` and `scripts/validate-assets.ts`)**:
   - `validate-content.ts` line 8 defines `EXPECTED_LOCATION_KEYS` with 4 elements.
   - `validate-assets.ts` line 13 defines `REQUIRED_ASSET_IDS` with 4 landmark IDs.
   - Line 116 of `ORIGINAL_REQUEST.md` states: "Update `scripts/validate-content.ts` to require exactly 10 location keys... ≥12 food cards... Update `scripts/validate-assets.ts` to validate all 10 landmark SVGs... `placeholder: false` for all 10."

---

## 2. Logic Chain

1. **Observation 1 & 2** show that the current data files (`locations.vi.json`, `locations.en.json`, `curated-places.json`) only support the 4-landmark MVP state. Expanding to 10 landmarks and 12+ food cards requires updating these JSON files, adding corresponding source entries to `content/sources.md`, and ensuring VI/EN parity and forbidden Places field guards.
2. **Observation 3** shows that existing SVGs are placeholders and lack the 6 new landmarks. The spec requires 10 detailed 320x180 SVGs (2-4KB each) matching strict pixel-art XML contracts (`crispEdges`, `data-pixel-art="true"`, `#182433` border) and updating `manifest.json` entries to `placeholder: false`.
3. **Observation 4** shows that overworld discoverable POIs are completely absent from `world.ts` and `OverworldScene.ts`. Adding `DISCOVERABLE_INTERACTABLES` with valid non-colliding coordinates inside 1600x960 and rendering gold animated markers will satisfy R3 without affecting quest state machine or fragment progression.
4. **Observation 5** shows that header layout and gallery/detail modals do not exist in `src/client/app/`. Adding "Khám phá" button and creating `LandmarkGalleryPanel` and `LandmarkDetailPanel` with `useModalAccessibility` fulfills R4.
5. **Observation 6** shows that `schemas.ts` caps `unlockedPostcards` at 4, which will reject requests with up to 10 postcards. Updating `max(4)` to `max(10)` fulfills R5.
6. **Observation 7** shows that generic strings are used for locked quest NPC interactions. Looking up `QUEST_ORDER` and `getLocationContent` dynamically to insert the prerequisite landmark name fulfills R6.
7. **Observation 8** shows validator scripts hardcode 4 landmarks. Updating `EXPECTED_LOCATION_KEYS` and `REQUIRED_ASSET_IDS` to 10 keys and expanding unit/E2E test suites fulfills R7 and prepares for R8 verification.

---

## 3. Caveats

- **No live Cloud Run / Gemini credentials present**: Tests must rely on authored offline fallbacks and mock servers as mandated by project rules in `AGENTS.md`.
- **Native PowerShell Execution for R8**: Verification scripts (`npm run verify`, `docker compose up`, `npx playwright test`) must be executed from native Windows PowerShell as specified in R8.

---

## 4. Conclusion

The specification mining and gap analysis for requirements R1 through R8 is complete and documented in full detail in `analysis.md`. The gap matrix clearly identifies every file requiring modifications, new components to build, schema changes, validator updates, and test additions.

---

## 5. Verification Method

To verify the analysis findings against the codebase:
1. Inspect `analysis.md` in `D:\Hackthon-GG2026\.agents\spec_miner_survey_1\analysis.md`.
2. Inspect `content/locations.vi.json` and `locations.en.json` (currently 4 keys vs. 10 required).
3. Inspect `content/curated-places.json` (currently 4 cards vs. 12+ required).
4. Inspect `scripts/validate-content.ts` (currently 4 keys expected).
5. Inspect `scripts/validate-assets.ts` (currently 4 landmark asset IDs expected).
6. Inspect `src/shared/schemas.ts` line 20 (`max(4)` vs `max(10)`).
7. Inspect `src/client/game/scenes/OverworldScene.ts` line 376 (generic locked hint).

---

## 6. Remaining Work (Next Steps for Implementer Agents)

1. **Content & Asset Implementation (R1, R2)**:
   - Create 6 new location entries in `locations.vi.json` & `locations.en.json`.
   - Create 8+ new food card entries in `curated-places.json`.
   - Add new source references to `sources.md`.
   - Generate/author 10 pixel-art SVGs in `public/assets/landmarks/` matching R2 XML rules.
   - Update `public/assets/manifest.json`.

2. **Game & UI Implementation (R3, R4, R5, R6)**:
   - Add `DISCOVERABLE_INTERACTABLES` to `world.ts` and marker rendering to `OverworldScene.ts`.
   - Add "Khám phá" button to `App.tsx` header.
   - Create `LandmarkGalleryPanel.tsx` and `LandmarkDetailPanel.tsx`.
   - Update `src/shared/schemas.ts` `unlockedPostcards` limit to `max(10)`.
   - Update `OverworldScene.ts` and `GameUiOverlay.tsx` with dynamic prerequisite landmark names.

3. **Validators, Testing & Verification (R7, R8)**:
   - Update `scripts/validate-content.ts` and `scripts/validate-assets.ts`.
   - Add unit tests and Playwright E2E tests for new features.
   - Run `npm run verify` and Docker E2E pipeline in native PowerShell.
   - Update `docs/STATUS.md` and `README.md`.
