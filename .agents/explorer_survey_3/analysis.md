# Test & Build Pipeline Analysis — Rồng Con Du Ký

**Author**: Explorer 3 (Test & Build Pipeline Explorer)  
**Date**: 2026-08-05  
**Working Directory**: `d:\Hackthon-GG2026\.agents\explorer_survey_3`  
**Repository**: `d:\Hackthon-GG2026`  

---

## 1. Executive Summary

This report presents a complete survey and evaluation of the **Test & Build Pipeline** for the game **Rồng Con Du Ký** (Phaser 4 + React + Fastify + Firebase + Gemini Interactions API). 

The test and build system is fully operational on native Windows (Node 24.x, PowerShell). Executing `npm run verify` succeeds with **100% pass rate** across all static checks, asset/content validators, client security scans, and **153 unit tests in 28 test files**. The Docker multi-stage build (`Dockerfile`) and orchestration (`compose.yaml`) paired with Playwright E2E tests (`14 spec files`) provide automated black-box container verification.

---

## 2. Package & Verification Pipeline (`npm run verify`)

### 2.1 Pipeline Architecture
The primary verification entry point is `npm run verify`, defined in `package.json` line 27:
```json
"verify": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run validate:content && npm run validate:assets && npm run build && npm run validate:client-build"
```

It executes a strict 8-stage synchronous sequence:

| Order | Sub-command | Tool / Script | Objective |
|---|---|---|---|
| 1 | `npm run typecheck` | `tsc --noEmit` | Validates TypeScript type safety across app and server without emitting JS. |
| 2 | `npm run lint` | `oxlint .` | Executes Oxlint (high-performance linter) across workspace (0 errors allowed). |
| 3 | `npm run format:check` | `prettier --check .` | Verifies code formatting compliance with Prettier. |
| 4 | `npm run test` | `vitest run` | Runs local unit test suite (excludes E2E and Firebase emulator tests). |
| 5 | `npm run validate:content` | `node --import tsx scripts/validate-content.ts` | Validates content schema, VI/EN parity, 10 location keys, 12+ food cards, source IDs. |
| 6 | `npm run validate:assets` | `node --import tsx scripts/validate-assets.ts` | Validates 35 manifest assets, SVG crispEdges/palette/dimensions, file existence. |
| 7 | `npm run build` | `vite build && tsc -p tsconfig.server.json` | Bundles React/Phaser frontend (`dist/`) and compiles Fastify backend (`build/`). |
| 8 | `npm run validate:client-build` | `node --import tsx scripts/validate-client-build.ts` | Scans client build artifacts for forbidden markers (`__GAME_TEST__`, API keys). |

### 2.2 Empirical Verification Results
An empirical run of `npm run verify` produced the following verified outputs:
- **Typecheck**: PASS (0 errors)
- **Lint**: PASS (0 errors, 7 warnings for unused variables in test files)
- **Format**: PASS (All files match Prettier style)
- **Vitest Unit Suite**: PASS — **28 test files, 153 tests passed** in **1.84s**
- **Content Validation**: PASS — 10 locations, 10 dialogue nodes, 26 source records validated
- **Asset Validation**: PASS — 35/35 required assets verified (32px tile size, crispEdges, dimensions)
- **Client & Server Build**: PASS — Vite client bundle (739ms) + TypeScript server build (`build/server/index.js`)
- **Client Build Security Scan**: PASS — 7 files scanned, 0 forbidden markers found

---

## 3. Unit & Integration Testing Infrastructure

### 3.1 Unit Test Inventory (`tests/unit/`)
The unit test suite consists of **28 test files** organized into 7 distinct domains:

1. **Client Domain (`tests/unit/client/`)**:
   - `analytics.test.ts` (2 tests): Telemetry and event tracking.
   - `api-client.test.ts` (3 tests): Client-side fetch wrapper and Fastify endpoint integration.
   - `gallery.test.ts` (3 tests): `LandmarkGalleryPanel` and `LandmarkDetailPanel` React state, grid layout, modal focus trap.
   - `travel-tools-dialogue.test.ts` (2 tests): Dialogue formatting in travel tools.

2. **Content Domain (`tests/unit/content/`)**:
   - `content-validation.test.ts` (7 tests): Unit tests for `validate-content.ts` script functions.
   - `asset-validation.test.ts` (8 tests): Unit tests for `validate-assets.ts` SVG/PNG rules and color palettes.
   - `food-cards.test.ts` (6 tests): Validates 12+ curated food cards across 10 landmarks, price ranges, dietary options, prohibited Places fields.
   - `landmark-content.test.ts` (5 tests): VI/EN key parity, text length limits, and source attribution links for all 10 landmarks.

3. **Game Mechanics Domain (`tests/unit/game/`)**:
   - `GameStateStore.test.ts` (10 tests): State machine transitions (`LOCKED → AVAILABLE → ACTIVE → COMPLETED → REWARDED`), fragment accounting, duplicate reward blocking.
   - `landmark-challenge-rules.test.ts` (10 tests): Rule evaluators for all 10 landmark mini-games.
   - `locked-quest-ux.test.ts` (2 tests): Verifies hint labels and dialogue text dynamically embed the specific prerequisite landmark name.
   - `m5-empirical-verification.test.ts` (21 tests): Empirical state transition verification.
   - `marble-puzzle.test.ts` (4 tests): Marble Five Elements puzzle logic.
   - `my_khe.test.ts` (3 tests): My Khe trash cleanup collision and counter logic.
   - `rhythm.test.ts` (2 tests): Dragon Bridge rhythm hit window logic.
   - `son-tra.test.ts` (2 tests): Son Tra camera frame alignment logic.
   - `world.test.ts` (6 tests): Overworld dimensions (1600×960), `QUEST_INTERACTABLES` count, `DISCOVERABLE_INTERACTABLES` count (6 items), non-overlapping coordinate assertions.

4. **Firebase & Data Domain (`tests/unit/firebase/`)**:
   - `firebase-client.test.ts` (5 tests): Anonymous Auth and client initialization.
   - `firebase-game-state.test.ts` (8 tests): Firestore state synchronization, version 2 schema migration.
   - `firestore-rules.test.ts` (2 tests): Unit testing Firestore security rule logic.

5. **Server Domain (`tests/unit/server/`)**:
   - `api.test.ts` (8 tests): Fastify health endpoints, CORS, static file serving.
   - `auth.test.ts` (3 tests): Fastify authorization guards.
   - `dragon.test.ts` (9 tests): Fastify `/api/dragon/chat` endpoint, Gemini Interactions API calls, authored fallback responses when offline/unconfigured.

6. **Scripts & Shared Domain (`tests/unit/scripts/` & `tests/unit/shared/`)**:
   - `native-docker-e2e-contract.test.ts` (3 tests): Validates native Windows PowerShell runner script contract.
   - `wsl-docker-e2e-contract.test.ts` (3 tests): Validates WSL Docker runner contract.
   - `validate-client-build.test.ts` (3 tests): Verifies security scanner detects forbidden markers.
   - `game-state.test.ts` (10 tests): Zod schema validation for `GameState`, `DragonChatRequestSchema` (unlockedPostcards max 10).
   - `baseline.test.ts` (3 tests): Baseline environment checks.

### 3.2 Integration Testing (`tests/integration/` & `npm run test:rules`)
- **Firestore Security Rules**: Executed via `npm run test:rules` (`vitest run --config vitest.rules.config.ts` against Firebase Auth/Firestore Emulators). Validates 15 security rule assertions (first-write frontier initialization, state graph enforcement, reward validation).

---

## 4. Playwright E2E Testing Infrastructure

### 4.1 Configuration (`playwright.config.ts`)
- **Test Directory**: `./tests/e2e`
- **Output Directories**: `test-results/playwright` (and HTML report to `playwright-report`)
- **Projects**:
  1. `chromium-desktop`: Viewport 1366×768, `hasTouch: false`, `isMobile: false`.
  2. `chromium-mobile`: Viewport 390×844, `hasTouch: true`, `isMobile: true`, `locale: "vi-VN"`.
- **Server Modes**:
  - **Local Dev Mode**: Launches `npm run dev:web -- --host 127.0.0.1 --port 4173` if no `PLAYWRIGHT_BASE_URL` is set.
  - **Container Mode**: When `PLAYWRIGHT_BASE_URL` is provided (e.g. `http://127.0.0.1:8080` or `http://127.0.0.1:18080`), tests run against the live HTTP container.
- **Black-box Guard**: Setting `PLAYWRIGHT_PRODUCTION_E2E=true` automatically excludes dev-bridge tests (`e2e-bridge-enabled.spec.ts`).

### 4.2 E2E Test Suite Inventory (14 Spec Files)
1. `app-shell.spec.ts`: Page loading, canvas mounting, title screen, header buttons.
2. `discoverable-pois.spec.ts`: Proximity hints for discovery POIs, opening detail panels with key E/Space, bilingual hints, closing panels without state mutation.
3. `dragon-bridge-journey.spec.ts`: Complete Dragon Bridge quest flow (dialogue -> rhythm game -> reward -> fragment grant).
4. `e2e-bridge-enabled.spec.ts`: Developer bridge verification (skipped in production container mode).
5. `e2e-bridge-guard.spec.ts`: Asserts bridge is disabled in production builds.
6. `keyboard-happy-path.spec.ts`: Full keyboard-only navigation across campaign.
7. `landmark-gallery.spec.ts`: "Khám phá" header button, 10 landmark grid cards, 2-col vs 1-col responsive layout, `LandmarkDetailPanel` contents (food cards, sources, Maps link), modal accessibility (Escape key, backdrop click, X button), language toggle.
8. `landmark-games.spec.ts`: Mini-game panel loading for all 10 landmark destinations.
9. `locked-quest-ux.spec.ts`: Asserts hint text and dialogue text contain specific prerequisite landmark names (e.g. "Cầu Sông Hàn", "Ngũ Hành Sơn").
10. `mobile-touch-controls.spec.ts`: Touch D-Pad, action buttons, panel gestures on mobile.
11. `mobile-touch-quest-journey.spec.ts`: Complete quest journey using touch controls.
12. `polish-and-legal.spec.ts`: Terms, Privacy, credits, visual polish verification.
13. `remaining-quests.spec.ts`: Quests 5 through 10 gameplay flows.
14. `travel-tools.spec.ts`: Companion / AI travel assistant drawer and fallback dialogue.

---

## 5. Docker Build & Container Health Check Infrastructure

### 5.1 Dockerfile (`Dockerfile`)
Multi-stage build optimized for production & Google Cloud Run:
- **Stage 1 (`builder`)**: Uses `node:24-alpine`. Copies `package*.json`, runs `npm ci`, sets build args (`VITE_API_BASE_URL=/api`, etc.), runs `npm run build` producing `/app/dist` (frontend) and `/app/build` (backend). Server secrets are excluded.
- **Stage 2 (`runtime`)**: Uses `node:24-alpine`. Sets `NODE_ENV=production`, `PORT=8080`, runs `npm ci --omit=dev`, copies `/dist`, `/build`, `/content`. Exposes port 8080.
- **Built-in Healthcheck**:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"
  ```
- **Security**: Runs as non-root `USER node`.

### 5.2 Docker Compose (`compose.yaml`)
- Service name: `app`
- Image: `rong-con-du-ky:local`
- Container port mapping: `${APP_PORT:-8080}:8080`
- Runtime environment: `NODE_ENV=production`, `PORT=8080`, `ALLOW_LOCAL_AUTH=false`, authored fallbacks active when API keys are unsupplied.
- Healthcheck: standard Docker compose healthcheck calling `/api/health`.

### 5.3 Native PowerShell Container Verification Runner (`scripts/run-native-docker-e2e.ps1`)
Executable from native Windows PowerShell:
1. Validates Node version is `24.x` and platform is `win32`.
2. Sets container port (e.g. `APP_PORT=18080`).
3. Executes `docker compose up --build -d`.
4. Polls `http://127.0.0.1:18080/api/health` until HTTP 200 `{ "status": "ok" }` (120s timeout). Saves JSON payload to `health.json`.
5. Executes Playwright E2E: `npx playwright test --project=chromium-desktop --project=chromium-mobile --workers=1` against `PLAYWRIGHT_BASE_URL=http://127.0.0.1:18080` with `PLAYWRIGHT_PRODUCTION_E2E=true`.
6. Stores output bundle under `test-results/native-docker-e2e/<runId>/` containing `health.json`, `docker-compose-ps.txt`, logs, HTML report, screenshots, and videos.

---

## 6. Verification Checks Matrix for Requirements R1–R5

Below is the exhaustive matrix of verification checks required to validate R1–R5 (including the overworld graphic upgrade):

```
+-------------------------------------------------------------------------------------------------------------------------------+
| Requirement | Specific Verification Check                     | Method / Command                 | Target File / Component    |
+-------------------------------------------------------------------------------------------------------------------------------+
| R1 (Content) | 10 Location keys VI/EN parity & 50-80 word count | npm run validate:content         | content/locations.*.json   |
| R1 (Food)    | >=12 food cards covering 10 keys; zero Places    | npm run validate:content         | content/curated-places.json|
|              | restricted fields (rating, reviews, photos)      | vitest run food-cards.test.ts    |                            |
| R1 (Map Art) | Overworld 1600x960 night map raster loaded via   | Playwright E2E (app-shell)       | OverworldScene.ts          |
|              | add.image(); Phaser wave/lantern/fire particle   | Visual screenshot inspection     | public/assets/map/         |
|              | overlay animations active                       |                                  |                            |
+-------------------------------------------------------------------------------------------------------------------------------+
| R2 (Assets)  | 10 Postcards (320x180), placeholder: false in    | npm run validate:assets          | public/assets/landmarks/   |
|              | manifest; SVG crispEdges, no gradients/filters   | vitest run asset-validation      | public/assets/manifest.json|
+-------------------------------------------------------------------------------------------------------------------------------+
| R3 (POIs)    | 6 Discoverable POIs in world.ts (type: discovery)| vitest run world.test.ts         | src/client/game/world.ts   |
|              | Non-overlapping coords; opens detail panel on E;  | npx playwright test discoverable | LandmarkDetailPanel.tsx    |
|              | zero quest state / fragment mutation             |                                  |                            |
| R3 (Icons)   | 10 Map icons (48x48 / 32x32) transparent bg       | npm run validate:assets          | public/assets/map-icons/   |
+-------------------------------------------------------------------------------------------------------------------------------+
| R4 (Gallery) | "Khám phá" header button opens gallery modal;     | vitest run gallery.test.ts       | LandmarkGalleryPanel.tsx   |
|              | 10 cards in grid (2-col desktop, 1-col mobile);   | npx playwright test gallery      | LandmarkDetailPanel.tsx    |
|              | Escape key closes; focus trap; VI/EN toggle      |                                  |                            |
+-------------------------------------------------------------------------------------------------------------------------------+
| R5 (Safety)  | 4 Main quests retain state machine & 0-4 fragments| vitest run GameStateStore        | GameStateStore.ts          |
|              | Schema unlockedPostcards max(10); locked quest UX| vitest run locked-quest-ux       | OverworldScene.ts          |
|              | shows prerequisite landmark name; colliders hidden| npx playwright test locked-quest | GameUiOverlay.tsx          |
+-------------------------------------------------------------------------------------------------------------------------------+
```

---

## 7. `docs/STATUS.md` Evidence Protocol

When completing a milestone or release candidate update, `docs/STATUS.md` must be updated following this exact protocol:

1. **Header Metadata**:
   - Update `Last updated:` timestamp (ISO UTC format).
   - Confirm active deployment track (**Starter Tier**).

2. **Release Verdict Section**:
   - Update summary statement confirming native Windows execution result of `npm run verify` (153 unit tests), Docker Compose health check status, and Playwright E2E suite completion.

3. **Native Windows Evidence Table**:
   - Update row statuses (PASS/FAIL) and exact metrics for:
     - **Environment**: Node version (24.x), OS (`win32`).
     - **Asset contract**: `npm run validate:assets` (35 assets verified).
     - **Domain contract**: `npm run verify` (153 unit tests, 10 locations, client build scan).
     - **Firestore security**: `npm run test:rules` (15 emulator tests).
     - **Docker build & health**: Container name, port (18080 or 8080), HTTP 200 `/api/health`.
     - **Playwright E2E**: Spec pass count (14 spec files), desktop and mobile.
     - **Visual evidence**: Number of screenshots collected in `test-results/native-docker-e2e/<runId>/`.

4. **Artifact Paths**:
   - Record exact filesystem paths for generated evidence: `health.json`, `docker-compose-ps.txt`, `playwright-report/index.html`, visual screenshots.

---
