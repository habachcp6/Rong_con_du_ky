# Specification Mining & Repo Gap Analysis Report

**Date:** 2026-08-04  
**Working Directory:** `D:\Hackthon-GG2026\.agents\spec_miner_survey_1`  
**Target Specification:** `ORIGINAL_REQUEST.md` (R1 - R8) and `AGENTS.md`  

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Content | Landmark Expansion (10 Landmarks) | Expand location content from 4 to 10 landmarks with VI/EN parity and paraphrased tourism facts from official portal. | `locations.vi.json`, `locations.en.json` | Parsed location records with 10 keys | `LOCATION_KEYS_INVALID`, `LANGUAGE_KEY_PARITY_MISMATCH` validator errors | ORIGINAL_REQUEST.md R1, `validate-content.ts` |
| 2 | Content | Food Cards Expansion (12+ Cards) | Expand curated place cards to ≥12 cards covering all 10 landmarks with price/dietary mix and no forbidden Places fields. | `curated-places.json` | 12+ curated place cards | `CURATED_PLACES_INCOMPLETE`, `RESTRICTED_PLACE_DATA` validator errors | ORIGINAL_REQUEST.md R1, `validate-content.ts` |
| 3 | Content | Canonical Sources Registry | Canonical markdown registry for all facts, food cards, and asset attributions referenced by content files. | `content/sources.md` | Source ID records registry | `SOURCE_NOT_FOUND`, `SOURCE_METADATA_MISSING` validator errors | ORIGINAL_REQUEST.md R1, `sources.md` |
| 4 | Asset | 10 Pixel-Art Landmark Postcards | 10 pixel-art SVG postcard assets (320x180, 8/16-bit, crispEdges, 4px #182433 border, max 24 colors, 2-4KB detail). | SVG files in `public/assets/landmarks/` | Rendered pixel-art postcard images | `SVG_DIMENSION_MISMATCH`, `SVG_SOFT_RENDERING_FORBIDDEN` validator errors | ORIGINAL_REQUEST.md R2, `validate-assets.ts` |
| 5 | Asset | Asset Manifest Contract | Asset manifest mapping asset IDs to paths, dimensions, placeholder status (`false`), and attribution IDs. | `public/assets/manifest.json` | Asset index | `REQUIRED_ASSET_MISSING`, `ASSET_ATTRIBUTION_NOT_FOUND` validator errors | ORIGINAL_REQUEST.md R2, `manifest.json` |
| 6 | Overworld | 6 Discoverable POIs | 6 non-quest interactable markers placed in the 1600x960 overworld map in gold/amber color with pulsing animation. | E/Space key, touch tap proximity | Emits event, opens `LandmarkDetailPanel` | Ignored if input disabled or dialogue/modal active | ORIGINAL_REQUEST.md R3, `world.ts`, `OverworldScene.ts` |
| 7 | UI | Landmark Gallery UI Panel | Responsive grid modal (2 cols desktop, 1 col mobile) accessible via "Khám phá" / "Explore" header button. | Header button click | Landmark cards grid modal | Keyboard trap handles tab cycle inside modal | ORIGINAL_REQUEST.md R4, `App.tsx`, `App.css` |
| 8 | UI | Landmark Detail Modal | Slide-up modal (~70% viewport height) showing full landmark SVG, facts, tips, sources, and Google Maps link. | POI interaction or Gallery card click | Landmark detail modal view | Returns focus to trigger/canvas on close | ORIGINAL_REQUEST.md R3/R4, `GameUiOverlay.tsx` |
| 9 | UX | Dynamic Prerequisite Quest Hint & Dialogue | Proximity hints and dialogue body for locked quests show the specific prerequisite landmark name instead of generic text. | Player near locked quest NPC | Dynamic localized text with prerequisite landmark name | Falls back gracefully if landmark missing | ORIGINAL_REQUEST.md R6, `OverworldScene.ts`, `GameUiOverlay.tsx` |
| 10 | Schema | Zod Unlocked Postcards Limit Extension | `DragonChatRequestSchema.unlockedPostcards` array max capacity increased from 4 to 10. | `unlockedPostcards` array in chat request | Validated request schema | ZodValidationError if array length > 10 | ORIGINAL_REQUEST.md R5, `schemas.ts` |
| 11 | Testing | Validator Scripts & Automated Tests | Validation scripts, Vitest unit tests, and Playwright E2E tests checking 10 landmarks, 12+ food cards, SVGs, gallery, locked UX. | `npm run verify`, `npx playwright test` | Test suite execution reports | Non-zero exit code on failure | ORIGINAL_REQUEST.md R7, `validate-content.ts`, `validate-assets.ts` |
| 12 | Pipeline | Docker Build & Verification Pipeline | Native PowerShell pipeline verifying static checks, Docker container health (`/api/health`), and E2E test execution against port 8080. | PowerShell commands, Docker Compose | Healthy container & green test suite | Failing container healthcheck or test failure | ORIGINAL_REQUEST.md R8, `Dockerfile`, `compose.yaml`, `STATUS.md` |

---

## Edge Cases

| # | Feature | Input | Observed / Expected Behavior |
|---|---------|-------|------------------------------|
| 1 | Landmark Gallery / Detail | Language toggle (VI ↔ EN) while gallery or detail panel is open | Modal must immediately re-render content in the new language without closing or losing focus trap. |
| 2 | Overworld POI Interaction | Player presses E/Space or taps near POI while another modal (Dialogue/Passport) is active | Overworld interaction must be suppressed so multiple full-screen/modal dialogs do not stack or clash. |
| 3 | Overworld POI Focus | Closing LandmarkDetailPanel opened from Overworld POI | Input focus must be returned cleanly to the Phaser game canvas, allowing seamless movement resumption. |
| 4 | Landmark Detail Focus | Closing LandmarkDetailPanel opened from Landmark Gallery card | Focus must return to the specific gallery card button that triggered the detail modal. |
| 5 | Locked Quest UX | Player approaches `my_khe_npc` while locked | Prerequisite is `dragon_bridge` ("Cầu Rồng" / "Dragon Bridge"). Text: "Hoàn thành thử thách ở Cầu Rồng để mở khóa". |
| 6 | Locked Quest UX | Player approaches `marble_npc` while locked | Prerequisite is `my_khe_beach` ("Biển Mỹ Khê" / "My Khe Beach"). Text: "Hoàn thành thử thách ở Biển Mỹ Khê để mở khóa". |
| 7 | Locked Quest UX | Player approaches `son_tra_npc` while locked | Prerequisite is `marble_mountains` ("Ngũ Hành Sơn" / "Marble Mountains"). Text: "Hoàn thành thử thách ở Ngũ Hành Sơn để mở khóa". |
| 8 | Starter Curated Places | Food cards schema validation | Must reject cards containing `rating`, `reviews`, `openingHours`, `openNow`, `photos`, or `photoUrl`. Must enforce `placeIdStatus: "unverified"` and `placeId: null`. |
| 9 | Landmark SVG Art | SVG content validation | Root element must have `width="320" height="180" viewBox="0 0 320 180" shape-rendering="crispEdges" data-pixel-art="true" data-alpha="false"`. Must reject `<linearGradient>`, `<radialGradient>`, `<filter>`, `<image>`, `xlink:href`. Must include 4px `#182433` border. File size 2-4KB. Max 24 colors. |
| 10 | Schema Validation | `DragonChatRequestSchema` with 10 postcards | Passing an array of 5 to 10 unlocked postcard strings must succeed validation (previously capped at 4). |
| 11 | Overworld Coordinates | 6 Discoverable POIs placement | POI coordinates must be strictly within bounds (1600x960), non-overlapping with the 4 quest NPCs (`dragon_bridge_npc` 1160,474; `my_khe_npc` 1382,688; `marble_npc` 394,370; `son_tra_npc` 1362,354) and 5 colliders (`market-hall`, `lantern-garden`, `river-pier`, `east-pavilion`, `east-garden`). |
| 12 | Mobile Responsive Viewport | Viewport width < 768px (e.g., 390x844) | Landmark gallery renders in 1 column; Landmark detail modal occupies ~70% height with touch scroll support; buttons maintain minimum touch targets (≥44px). |

---

## Detailed Specifications & Requirements Survey (R1 – R8)

### R1. Content Expansion — 10 Bilingual Landmarks + 12 Food Cards

1. **Landmark Keys Contract**:
   - Existing 4 keys (must preserve exact keys and basic structure): `dragon_bridge`, `my_khe_beach`, `marble_mountains`, `son_tra_peninsula`.
   - New 6 keys (must add): `han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`.
   - Total keys = 10.
   - Exact file locations: `content/locations.vi.json` and `content/locations.en.json`. Key order must be identical in both files.

2. **Landmark Entry Schema**:
   ```json
   {
     "key": "<landmark_key>",
     "name": "<localized_name>",
     "shortDescription": "<80-700 chars, 50-80 words>",
     "funFact": "<20-300 chars>",
     "visitTip": "<20-350 chars>",
     "authoredImage": "/assets/landmarks/<filename>.svg",
     "assetId": "landmark_<key>",
     "imageAttributionId": "<attribution_id>",
     "sourceIds": ["<source_id>", ...]
   }
   ```

3. **Content & Sourcing Rules**:
   - Tourism facts must be paraphrased from `danangfantasticity.com` (primary) and Wikipedia Vietnamese (secondary for history).
   - Tone: Educational and formal matching official tourism portal style.
   - All `sourceIds` must reference valid records in `content/sources.md`.
   - `content/sources.md` record structure:
     - `## source_id` header
     - `- **Kind:**` `tourism-fact` | `curated-place` | `curation-policy` | `asset-attribution`
     - `- **Publisher:**` publisher name
     - `- **Title:**` source title
     - `- **URL:**` `https://` or `local://`
     - `- **Accessed:**` YYYY-MM-DD
     - `- **License / use:**` usage description
     - `- **Supports:**` bullet list of supported facts/claims

4. **Curated Places (Food Cards) Contract**:
   - File location: `content/curated-places.json`.
   - Must expand from 4 to at least 12 food cards.
   - Every single landmark key (all 10) must be associated with at least 1 food card (`landmarkKey` field).
   - Card schema:
     - `id`: string (snake_case)
     - `placeId`: null
     - `placeIdStatus`: "unverified"
     - `landmarkKey`: valid landmark key
     - `nameVi`, `nameEn`: string (3-160 chars)
     - `descriptionVi`, `descriptionEn`: string (35-500 chars)
     - `address`: string (3-300 chars)
     - `priceRange`: `"budget"` | `"moderate"` | `"premium"` (editorial grouping mix across set)
     - `dietary`: `"any"` | `"vegetarian"` (mix across set)
     - `googleMapsUri`: valid https Google Maps search/place URL
     - `sourceIds`: array containing venue source ID + `source_starter_curation_01`
   - Forbidden fields (validator enforced): `rating`, `userRatingCount`, `reviews`, `openingHours`, `openNow`, `photos`, `photoUrl`.

---

### R2. Landmark SVG Art — 10 Pixel-Art Postcards

1. **File Inventory**:
   - `public/assets/landmarks/dragon-bridge.svg` (Replace)
   - `public/assets/landmarks/my-khe.svg` (Replace)
   - `public/assets/landmarks/marble-mountains.svg` (Replace)
   - `public/assets/landmarks/son-tra.svg` (Replace)
   - `public/assets/landmarks/han-river-bridge.svg` (New)
   - `public/assets/landmarks/linh-ung.svg` (New)
   - `public/assets/landmarks/cham-museum.svg` (New)
   - `public/assets/landmarks/non-nuoc.svg` (New)
   - `public/assets/landmarks/han-market.svg` (New)
   - `public/assets/landmarks/ba-na-hills.svg` (New)

2. **SVG Format Constraints**:
   - Viewport & Dimensions: `width="320"` `height="180"` `viewBox="0 0 320 180"`.
   - Root attributes: `shape-rendering="crispEdges"`, `data-pixel-art="true"`, `data-alpha="false"`.
   - Forbidden SVG tags & attributes: `<linearGradient>`, `<radialGradient>`, `<filter>`, `<image>`, `xlink:href`, external HTTP links.
   - Allowed elements: `<rect>`, `<path>`, `<circle>`, `<polygon>`, `<g>`.
   - File size & detail: Target 2-4KB per file, detailed pixel art depicting landmark recognizable features.
   - Color palette: Maximum 24 colors per SVG image.
   - Border frame: 4px border in color `#182433` (e.g. `<path fill="#182433" d="M0 0h320v4H0zM0 176h320v4H0zM0 0h4v180H0zM316 0h4v180h-4z"/>`).

3. **Manifest Integration (`public/assets/manifest.json`)**:
   - All 10 landmark entries must have:
     - `category`: `"landmark"`
     - `format`: `"svg"`
     - `width`: 320, `height`: 180
     - `alpha`: false
     - `placeholder`: `false` (updated from `true`)
     - `attributionId`: e.g. `asset_landmark_art_01` (referencing `content/sources.md` crediting hackathon team pixel art).

---

### R3. Discoverable POIs in Overworld — 6 New Interactables

1. **Data Structure (`src/client/game/world.ts`)**:
   - Add export array `DISCOVERABLE_INTERACTABLES` containing 6 entries for:
     `han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`.
   - Type discriminator: `type: "discovery"`.
   - Position constraints:
     - World bounds: 1600 x 960 (x in [40, 1560], y in [40, 920]).
     - Non-overlapping with 4 NPC positions:
       - `dragon_bridge_npc`: (1160, 474)
       - `my_khe_npc`: (1382, 688)
       - `marble_npc`: (394, 370)
       - `son_tra_npc`: (1362, 354)
     - Non-overlapping with 5 colliders:
       - `market-hall`: x 310..520, y 190..310
       - `lantern-garden`: x 516..700, y 700..796
       - `river-pier`: x 742..876, y 644..718
       - `east-pavilion`: x 1335..1501, y 180..292
       - `east-garden`: x 1415..1573, y 762..890
     - Non-overlapping with player start (248, 772).
   - Interaction radius: ~60-70px.
   - Marker color: Amber / Gold `0xFFD166`.

2. **Game Mechanics & Scene Integration (`OverworldScene.ts`)**:
   - Render POI markers on overworld map with subtle pulsing/blinking animation.
   - Proximity detection showing localized hint text (e.g., "Cầu Sông Hàn — nhấn E / Space để khám phá").
   - E/Space key and mobile touch tap interaction.
   - **Crucial progression rule**: Discovery POIs MUST NOT alter `quests` state machine, MUST NOT grant memory fragments, MUST NOT increment `memoryFragments` count, MUST NOT affect passport ending gate (`isJourneyComplete`), MUST NOT push to `unlockedPostcards`.
   - Emits bridge event to open `LandmarkDetailPanel`.
   - Disable player movement / input while detail modal is open; restore input focus to canvas upon close.

---

### R4. Landmark Gallery UI & Detail Panel

1. **Header Action**:
   - Add button `"Khám phá"` (VI) / `"Explore"` (EN) to `app-header__actions` in `src/client/app/App.tsx`.
   - Position: Between existing Passport (`data-testid="passport-open"`) and Companion (`data-testid="travel-tools-open"`) buttons.
   - Test attribute: `data-testid="gallery-open"`.

2. **Landmark Gallery Panel (`LandmarkGalleryPanel.tsx`)**:
   - React component displayed as a modal dialog when "Khám phá" / "Explore" is clicked.
   - Grid layout:
     - Desktop (≥768px): 2 columns grid.
     - Mobile (<768px): 1 column grid.
   - Card contents for each of the 10 landmarks:
     - Landmark SVG thumbnail (320x180 preview).
     - Localized name.
     - Short description preview (first ~100 chars).
     - Button/link to open `LandmarkDetailPanel` for that landmark.

3. **Landmark Detail Panel (`LandmarkDetailPanel.tsx`)**:
   - Shared component triggered by either (a) clicking an Overworld Discoverable POI, or (b) clicking a Gallery card.
   - Bottom slide-up sheet/modal occupying ~70% viewport height with semi-transparent dark overlay.
   - Scrollable contents:
     - Full landmark SVG image.
     - Localized name (`<h2>`).
     - Full short description.
     - Fun fact (highlighted callout box).
     - Visit tip (highlighted callout box).
     - Source IDs with labels.
     - Google Maps link (`target="_blank" rel="noopener noreferrer"`).
     - Close button + Escape key support.

4. **Accessibility Standards**:
   - Both panels must use `useModalAccessibility` hook.
   - `role="dialog"`, `aria-modal="true"`, focus trap within modal elements.
   - Clean focus return to trigger button or canvas upon closing.

---

### R5. Regression Safety — Preserve Existing Systems

1. **Quests & Progression**:
   - All 4 existing quests (`dragon_bridge_lights`, `my_khe_clean_wave`, `marble_five_elements`, `son_tra_traces`) and state transitions (`LOCKED → AVAILABLE → ACTIVE → COMPLETED → REWARDED`) must remain intact.
   - `QUEST_INTERACTABLES` coordinates and NPC textures untouched.
   - `memoryFragments` counter only increments on quest `REWARDED` status (0-4/4 fragments).
   - `isJourneyComplete` logic continues checking all 4 quest completions.
   - `dialogue.vi.json` and `dialogue.en.json` untouched.

2. **Schema Update**:
   - In `src/shared/schemas.ts`: update `DragonChatRequestSchema.unlockedPostcards` from `z.array(...).max(4)` to `z.array(...).max(10)`.

---

### R6. Improved Locked Quest UX

1. **Dynamic Prerequisite Landmark Names**:
   - When player approaches a locked quest NPC, replace generic generic hint ("hoàn thành điểm trước để mở khóa" / "finish the previous landmark to unlock") with dynamic text including the prerequisite landmark name.
   - Quest order mapping:
     - `my_khe_clean_wave` (locked) -> Prerequisite: `dragon_bridge` ("Cầu Rồng" / "Dragon Bridge")
     - `marble_five_elements` (locked) -> Prerequisite: `my_khe_beach` ("Biển Mỹ Khê" / "My Khe Beach")
     - `son_tra_traces` (locked) -> Prerequisite: `marble_mountains` ("Ngũ Hành Sơn" / "Marble Mountains")
   - Text formats:
     - VI hint / dialogue: `"Hoàn thành thử thách ở [Prerequisite Name] để mở khóa"`
     - EN hint / dialogue: `"Complete the challenge at [Prerequisite Name] to unlock"`

2. **Affected Code Files**:
   - `src/client/game/scenes/OverworldScene.ts`: `updateInteractionState()` method.
   - `src/client/app/GameUiOverlay.tsx`: `quest_locked` nodeId body rendering.

---

### R7. Validator Scripts & Automated Test Suite Updates

1. **Content Validator (`scripts/validate-content.ts`)**:
   - `EXPECTED_LOCATION_KEYS`: updated to 10 keys.
   - Validate VI/EN parity for all 10 entries.
   - Validate asset manifest references for all 10 entries.
   - Validate `curated-places.json`: ≥12 cards total, all 10 landmark keys present with ≥1 card each.

2. **Asset Validator (`scripts/validate-assets.ts`)**:
   - `REQUIRED_ASSET_IDS`: updated to include 10 landmark asset IDs (`landmark_dragon_bridge` .. `landmark_ba_na_hills`).
   - Validate disk existence, 320x180 dimensions, `placeholder: false`, and `shape-rendering="crispEdges"` in SVG for all 10 landmarks.

3. **Unit Tests (`tests/unit/`)**:
   - `DISCOVERABLE_INTERACTABLES` validation (count = 6, non-overlapping coordinates, valid placeKeys).
   - Content loading unit test for 10 landmarks in VI and EN.
   - Locked quest UX text unit test verifying dynamic landmark name insertion.

4. **Playwright E2E Tests (`e2e/`)**:
   - Overworld discoverable POI interaction test (keyboard E/Space & click opens detail modal).
   - Landmark gallery test (header button opens gallery, grid renders 10 cards, card opens detail modal).
   - Language toggle test for gallery & detail modal.
   - Dynamic locked quest UX test.
   - Zero console errors assertion.
   - Responsive viewports: Desktop (1366x768) and Mobile (390x844).

---

### R8. Verification Pipeline, Docker, STATUS.md

1. **PowerShell Verification Steps**:
   ```powershell
   Set-Location "D:\Hackthon-GG2026"
   npm run verify
   docker compose up --build -d
   Start-Sleep -Seconds 15
   Invoke-RestMethod http://127.0.0.1:8080/api/health
   $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:8080"
   $env:PLAYWRIGHT_CAPTURE_VIDEO = "true"
   npx playwright test --workers=1
   docker compose down
   ```

2. **Documentation Updates**:
   - `docs/STATUS.md`: update evidence table for 10 landmarks, 12+ food cards, discoverable POIs, Landmark Gallery, dynamic locked quest UX, and Docker/Playwright test run evidence.
   - `README.md`: update landmark count and feature descriptions where applicable.

---

## Codebase Gap Analysis Matrix

| Requirement | Spec Requirement | Current Codebase State | Identified Gap |
|-------------|------------------|------------------------|----------------|
| **R1** | 10 Location keys in `locations.vi.json` and `locations.en.json` | Contains 4 keys (`dragon_bridge`, `my_khe_beach`, `marble_mountains`, `son_tra_peninsula`) | Missing 6 landmark entries (`han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`) in both language files. |
| **R1** | ≥12 Food cards in `curated-places.json` covering all 10 landmarks | Contains 4 food cards covering only the 4 original landmarks | Missing at least 8 additional food cards; 6 landmarks currently have 0 food cards. |
| **R1** | Source IDs for new facts and food cards in `content/sources.md` | Contains 11 source entries for original 4 landmarks/cards | Missing source entries for 6 new landmarks and new food cards. |
| **R2** | 10 Pixel-art landmark SVGs (320x180, crispEdges, border #182433, 2-4KB detail) | 4 existing SVGs are ~1KB placeholders; 6 new SVGs do not exist | All 10 SVG files need creation/replacement with detailed pixel art conforming to spec. |
| **R2** | Manifest entries for 10 landmarks with `placeholder: false` and art attribution ID | Manifest has 4 landmarks with `placeholder: true` and `asset_placeholder_original_01` | Manifest needs 10 landmark entries with `placeholder: false` and updated `attributionId`. |
| **R3** | `DISCOVERABLE_INTERACTABLES` array in `world.ts` (6 POIs, non-overlapping coordinates) | `world.ts` only exports `QUEST_INTERACTABLES` (4 NPCs) | Missing `DISCOVERABLE_INTERACTABLES` array and type definition. |
| **R3** | Overworld map rendering & interaction for 6 discoverable POIs | `OverworldScene.ts` only renders `QUEST_INTERACTABLES` | Missing POI sprite/marker rendering, pulsing animation, proximity check, and bridge event emission. |
| **R4** | "Khám phá" / "Explore" header button between Passport and Companion | `App.tsx` header has Passport ("Hộ chiếu 0/4") and Companion ("Trợ lý"), but no Explore button | Missing Explore button in header layout and state trigger for gallery modal. |
| **R4** | `LandmarkGalleryPanel` component (responsive grid 2 col desktop / 1 col mobile) | Component does not exist | Need to create `LandmarkGalleryPanel.tsx` and accompanying CSS. |
| **R4** | `LandmarkDetailPanel` component (slide-up ~70% height, facts, tips, maps link) | Component does not exist | Need to create `LandmarkDetailPanel.tsx` shared between Overworld POIs and Gallery cards. |
| **R5** | `DragonChatRequestSchema.unlockedPostcards` max limit extended to 10 | `src/shared/schemas.ts` line 20 has `max(4)` | Needs `.max(10)` in `schemas.ts`. |
| **R6** | Dynamic prerequisite landmark name in locked quest hints and dialogue | `OverworldScene.ts` and `GameUiOverlay.tsx` use hardcoded generic string "hoàn thành điểm trước để mở khóa" | Needs dynamic lookup of previous quest landmark name via `QUEST_ORDER` and `getLocationContent`. |
| **R7** | Content validator supports 10 locations and ≥12 food cards | `scripts/validate-content.ts` hardcodes 4 location keys | `EXPECTED_LOCATION_KEYS` must be updated to 10 keys and food card count threshold updated. |
| **R7** | Asset validator checks 10 landmark SVGs with `placeholder: false` | `scripts/validate-assets.ts` hardcodes 4 landmark asset IDs | `REQUIRED_ASSET_IDS` must be updated to include all 10 landmark asset IDs. |
| **R7** | Unit and E2E test coverage for new features | Tests only cover 4 landmarks, 4 quests, and pre-expansion UI | Need unit tests for POI array, 10-landmark loading, locked quest text; E2E tests for POI interaction, gallery modal, responsive viewports, locked text. |
| **R8** | Verification pipeline, Docker smoke evidence, STATUS.md update | STATUS.md documents pre-expansion evidence (4 landmarks, 4 food cards) | STATUS.md must be updated with post-expansion evidence and Docker/Playwright PowerShell verification. |

---

## Conclusion & Action Plan for Implementation

The specification for requirements R1 through R8 is fully defined and precise across all technical layers (data schemas, SVG graphics standards, overworld physics/coordinates, React UI component hierarchy, Zod schemas, validator scripts, and test suites). 

To bring the codebase to 100% specification compliance:
1. **R1 Content**: Enrich `locations.vi.json` and `locations.en.json` to 10 keys; expand `curated-places.json` to 12+ cards; update `content/sources.md`.
2. **R2 Asset Art**: Replace 4 existing SVGs and create 6 new SVGs conforming to 320x180 crispEdges pixel-art specs; update `manifest.json`.
3. **R3 Overworld POIs**: Add `DISCOVERABLE_INTERACTABLES` to `world.ts`; render gold animated markers in `OverworldScene.ts`; emit POI events.
4. **R4 Gallery & Detail UI**: Add "Khám phá" button to `App.tsx` header; build `LandmarkGalleryPanel.tsx` and `LandmarkDetailPanel.tsx` with accessibility traps.
5. **R5 Schema**: Update `DragonChatRequestSchema.unlockedPostcards` to `max(10)` in `src/shared/schemas.ts`.
6. **R6 Locked Quest UX**: Update `OverworldScene.ts` and `GameUiOverlay.tsx` to dynamically show prerequisite landmark names.
7. **R7 Validators & Tests**: Update `validate-content.ts` and `validate-assets.ts`; add unit and Playwright E2E tests.
8. **R8 Pipeline**: Execute verification script in native PowerShell and update `docs/STATUS.md`.
