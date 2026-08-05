# Project Plan: Rồng Con Du Ký Expansion (R1 - R8)

## Architecture
- Game Engine: Phaser 4 + React + TypeScript + Vite.
- Backend: Fastify Node server in Cloud Run.
- Data & Auth: Firebase Anonymous Auth + Firestore.
- Content: JSON content files (`content/locations.*.json`, `content/curated-places.json`, `public/assets/manifest.json`, `content/sources.md`).
- Overworld: Phaser OverworldScene + React UI overlay stack.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Landmark Content Expansion | 10 bilingual landmarks (6 new: han_river_bridge, linh_ung_son_tra, cham_museum, non_nuoc_stone_village, han_market, ba_na_hills) | M1 | R1 |
| 2 | Food Cards Expansion | 12+ curated food cards covering all 10 landmarks | M1 | R1 |
| 3 | Sources & Attribution | Paraphrased official facts & citations in content/sources.md | M1 | R1 |
| 4 | Pixel Art SVGs | 10 high-quality 320x180 pixel art SVGs + manifest attribution | M2 | R2 |
| 5 | Discoverable POIs | 6 discoverable interactable POIs on Overworld map (amber/gold markers, no quest state impact) | M3 | R3 |
| 6 | Landmark Gallery & Detail Modal | Header "Khám phá" button + LandmarkGalleryPanel & LandmarkDetailPanel React UI | M4 | R4 |
| 7 | Locked Quest UX & Schema | Prerequisite landmark name in locked quest hints/dialogue + schema max(10) | M5 | R5, R6 |
| 8 | Content & Asset Validators | Updated validate-content.ts, validate-assets.ts, and unit tests | M6 | R7 |
| 9 | Playwright E2E Expansion | End-to-end tests for POIs, Gallery, Language toggle, locked quest UX | M7 | R7 |
| 10 | Docker & Full Pipeline Verification | npm run verify, Docker compose up, health check, Playwright against Docker, STATUS.md update | M8 | R8 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Survey & Codebase Mapping | Enumerate codebase layout, existing tests, content schemas | none | DONE |
| 1 | Content & Sources Expansion | R1: locations.vi/en.json (10 keys), curated-places.json (12+ cards), sources.md | M0 | DONE |
| 2 | Pixel Art SVG Postcards & Manifest | R2: 10 SVG cards (320x180, crispEdges, <=24 colors), manifest.json update | M0, M1 | DONE |
| 3 | Discoverable Overworld POIs | R3: world.ts DISCOVERABLE_INTERACTABLES (6 POIs), OverworldScene proximity & events | M1, M2 | DONE |
| 4 | Landmark Gallery & Detail UI | R4: LandmarkGalleryPanel, LandmarkDetailPanel, Header button, modal accessibility | M1, M2, M3 | DONE |
| 5 | Locked Quest UX & Regression Safety | R5, R6: Dynamic prerequisite landmark names in locked quest hint/dialogue, schemas.ts | M1 | DONE |
| 6 | Validators & Unit Tests | R7: validate-content.ts, validate-assets.ts, unit tests for POIs & locked quest text | M1-M5 | DONE |
| 7 | Playwright E2E Tests | R7: E2E tests for POIs, gallery, locked UX, responsive viewports | M4, M5, M6 | DONE |
| 8 | Docker & Verification Pipeline | R8: npm run verify, Docker container build, Playwright against Docker, STATUS.md & README.md | M1-M7 | IN_PROGRESS |

## Code Layout
- `content/locations.vi.json`, `content/locations.en.json` — Landmark definitions
- `content/curated-places.json` — Food card definitions
- `content/sources.md` — Citations and attributions
- `public/assets/landmarks/` — SVG postcard files
- `public/assets/manifest.json` — Asset manifest
- `src/client/game/world.ts` — Map interactable coordinates and metadata
- `src/client/game/scenes/OverworldScene.ts` — Overworld scene logic & interactables
- `src/client/app/` — React UI components (Gallery, Detail Panel, Header, GameUiOverlay)
- `src/shared/schemas.ts` — Shared validation schemas
- `scripts/validate-content.ts`, `scripts/validate-assets.ts` — Validation scripts
- `tests/` — Unit and E2E test files
