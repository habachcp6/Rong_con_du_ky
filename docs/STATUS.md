# PROJECT STATUS — Rồng Con Du Ký

Last updated: 2026-08-11T12:20:00+07:00
Track selected: **Starter Tier (curated cards + Google Maps URLs)**

## Mini-game logic/input repair (2026-08-11)

The current working tree includes a mini-game-only repair pass. No sprite,
background, map, prop, FX, or other visual asset was changed, so the mandatory
`generate2dmap`/`generate2dsprite` graphics gate was not activated.

- My Khe now creates the player before obstacles, keeps invisible Arcade static
  colliders in authored world coordinates (independent of visual Containers),
  and pauses/resumes the tutorial clock while blocking gameplay input.
- Dragon Bridge stops Phaser pointer propagation for Info/Start/Exit and pauses
  rhythm timing/tweens while help is open.
- Son Tra synchronizes tutorial state, makes the first Escape close help, gates
  the not-yet-started attempt, and pauses/resumes its deadline.
- Shared Landmark Challenge scenes bind Enter alongside E/Space, freeze their
  deadline during help, and Marble E2E fixtures dismiss the tutorial before
  using the current node centers.

Current checks: `npm run typecheck:game`, full Vitest (241 tests), content/assets
validation, production build, client-build security validation, and Firestore
rules (15 tests) pass. Targeted desktop/mobile E2E journeys for the repaired
games pass with one worker. `npm run verify` reaches `format:check` but remains
blocked by existing formatting in dirty scene/test files; no global formatting
rewrite was applied to preserve the working tree.

The broader `tsc -p tsconfig.app.json` surface still has unrelated baseline
diagnostics in App analytics, Overworld, Firebase/services, and test helpers;
those are intentionally outside this mini-game repair scope. The isolated game
gate is clean.

## Mini-Game Visual Redesign & UX Consistency Status (Milestone 6)

### Overview

All 10 mini-games across the 5 game categories have undergone a comprehensive visual design system alignment, UX clarity upgrade, and HUD standardization while strictly preserving deterministic game logic and quest state machines.

### Mini-Game Redesign Summary

1. **Han River Bridge Turn** (`rotate`): Detailed river & night sky background with 4 rotatable bridge spans showing visual angle rotation.
2. **Linh Ung Quiet Path** (`sequence`): Pagoda landscape with 7 glowing lotus stone markers and visual path preview.
3. **Cham Museum Relic Match** (`sequence`): Terracotta museum gallery background with 6 sculpted relief motifs instead of plain text boxes.
4. **Non Nuoc Carving Pattern** (`sequence`): Marble workshop setting with granite block silhouette and progressive chisel stroke markers.
5. **Han Market Basket Sort** (`cycle`): Marketplace background with 3 labeled category containers (Specialty, Gift, Immediate) and themed food/craft items.
6. **Ba Na Golden Bridge Path** (`toggle`): Mountain cloud backdrop with golden bridge walkway tiles that illuminate when toggled ON.
7. **Thắp Sáng Cầu Rồng** (Dragon Bridge Rhythm): Night skyline over Han river, parabolic golden dragon arches, animated water waves, widened hit window (1.5s), and traveling sweet spot ring.
8. **Ngũ Hành Kỳ Bí** (Marble Mountains Puzzle): Marble mountain backdrop, 5 element nodes with custom symbols (⚔️, 🍃, 💧, 🔥, ⛰️) and pulsing connection lines.
9. **Sóng Xanh Mỹ Khê** (My Khe Beach Cleanup): Animated sea wave shoreline, beach dune obstacles, vector trash items (plastic bag, bottle cap, straw, etc.), and proximity aura ring.
10. **Dấu Vết Sơn Trà** (Son Tra Wildlife Observation): Deep emerald forest canopy with ambient sunbeams, camera viewfinder overlay, shutter flash effect, and vector trace icons.

### Acceptance Criteria Checklist

- [x] **Visual Quality**: Unique themed background for each landmark; hover/press states on interactive elements; particle/tween effects in all games; zero plain Phaser rectangles used for primary gameplay.
- [x] **Playability & UX**: "How to Play" tutorial overlay before gameplay begins; action-oriented instructions; visual hints & path previews; 50% time limit increase in rules constants; rhythm hit window widened to ≥1.5s.
- [x] **Design System & HUD Consistency**: System sans-serif typography; landmark-specific color palettes; standardized timer & progress/score displays; clearly visible "How to Play" (`ℹ️`) and "Back to Map" (`🚪` / `🚪 Map`) buttons in every mini-game scene.

### Verification Pipeline Results (2026-08-05)

- `npx tsc --noEmit`: **PASS** (0 errors)
- `npm run test`: **PASS** (34 test files, 235 unit tests passed)
- `npm run verify`: **PASS** (typecheck, lint, format:check, test, validate:content, validate:assets, build, validate:client-build)
- `npx playwright test tests/e2e/landmark-games.spec.ts`: **PASS** (44 specs passed)
- `npx playwright test tests/e2e/dragon-bridge-journey.spec.ts`: **PASS** (18 specs passed)
- `npx playwright test tests/e2e/keyboard-happy-path.spec.ts`: **PASS** (8 specs passed)
- `npx playwright test tests/e2e/remaining-quests.spec.ts`: **PASS** (30 specs passed)

## Release verdict

**Campaign V2 has passed ALL native Windows release candidate gates, including `npm run verify` (153 unit tests), Docker Compose container health check, Playwright desktop + mobile E2E (14/14 specs passed), and 10 landmark visual evidence collection.**

The implementation has ten sequential landmark quests. All native Windows evidence is captured under `test-results/native-docker-e2e/`.

## Implemented campaign contract

| Area                 | Current implementation                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical data       | `LandmarkGameDefinition` binds exactly one location, quest, Phaser scene, map icon, postcard and mechanic for all 10 destinations.                                                                                               |
| Progression          | GameState V2 has 10 ordered quests. V1 saves retain valid progress through Sơn Trà, then expose Cầu Sông Hàn as available when quest 4 was rewarded.                                                                             |
| Rewards              | Reducer-derived postcard and fragment totals prevent duplicate rewards; ending requires every quest in `QUEST_ORDER` to be `REWARDED`.                                                                                           |
| Map/UI               | Each landmark is a pixel-icon interaction target: available glow, locked desaturation/lock and rewarded star. Four existing NPCs remain as nearby guides only.                                                                   |
| Gameplay             | Existing four games remain deterministic; six new rules-driven scenes cover Cầu Sông Hàn, Linh Ứng, Bảo tàng Chăm, Non Nước, Chợ Hàn and Bà Nà.                                                                                  |
| Content              | VI/EN content and dialogue nodes cover all 10 landmarks; every landmark has at least one curated food card and source ID.                                                                                                        |
| Assets               | 10 transparent 32×32 icon SVGs and 10 simplified 320×180 postcards are declared in the asset manifest.                                                                                                                           |
| Persistence/security | Firestore first-write accepts only the initial V2 frontier; later writes must follow the ten-quest graph, while existing V1 documents migrate without losing a valid reward. No Places rating/review/hours/photos are persisted. |

## Overworld Map & Asset Upgrade Evidence (2026-08-05)

| Check / Feature           | Status | Output / Evidence Details                                                                                                                                                                                                                                                                          |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overworld Night Map       | PASS   | Baked 1600x960 16-bit pixel-art night map (`public/assets/map/overworld-night.png`) replaces procedural `drawWorld()`.                                                                                                                                                                             |
| Postcards & Map Icons     | PASS   | 10 PNG postcards (320x180) & 10 PNG transparent map icons (48x48) generated and validated.                                                                                                                                                                                                         |
| Animation Overlays        | PASS   | Phaser dynamic animation overlays active: Han River water wave ripples, lantern light flickering, Dragon Bridge fire particles, My Khe sea wave curves.                                                                                                                                            |
| Physics Colliders         | PASS   | World physics colliders set to `setVisible(false)` (invisible) with active Arcade Physics static bodies for 100% accurate collision detection.                                                                                                                                                     |
| `npm run verify` Pipeline | PASS   | 100% PASSED: `typecheck` (0 errors), `lint` (0 errors), `format:check` (100%), `vitest run` (28 test files, 153/153 tests passed), `validate:content` (10 locations, 10 dialogue nodes, 26 sources), `validate:assets` (36 assets), `build` (734ms), `validate:client-build` (0 security markers). |
| Docker Container Health   | PASS   | Docker container `hackthon-gg2026-app-1` built (`docker compose up --build -d`), health check `http://127.0.0.1:8080/api/health` returned `{"status":"ok","version":"0.1.0","track":"starter","providers":{"geminiConfigured":false,"firebaseServerAuth":true}}`.                                  |
| Playwright E2E Suite      | PASS   | Ran `npx playwright test --workers=1` against Docker container on `http://127.0.0.1:8080`. 85 passed, 31 intentionally skipped (5.0m runtime), 0 failed across `chromium-desktop` and `chromium-mobile`.                                                                                           |

## Native Windows evidence (2026-08-04)

| Check                  | Status | Notes                                                                                                          |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Environment            | PASS   | Platform: `win32`, Node: `v24.13.1`, npm: `11.8.0`                                                             |
| Asset contract         | PASS   | `npm run validate:assets`: 36/36 required assets verified.                                                     |
| Domain contract        | PASS   | `npm run verify`: 153 unit tests PASS (28 test files), content 10/10 PASS, client security scan PASS.          |
| Game rules & Firestore | PASS   | 15/15 unit rules tests PASS in `tests/unit/firebase/firestore-rules.test.ts`.                                  |
| Docker container build | PASS   | Docker version 29.2.0, Compose v5.0.2. Container `hackthon-gg2026-app-1` built and running on port 8080.       |
| Docker health check    | PASS   | `GET http://127.0.0.1:8080/api/health` returned `200 OK` with status `ok`.                                     |
| Playwright Docker E2E  | PASS   | 85 passed, 31 skipped, 0 failed across `chromium-desktop` and `chromium-mobile`.                               |
| Visual Evidence        | PASS   | 28 screenshots collected & structured in `test-results/native-docker-e2e/visual_review.md` for human sign-off. |

The following was run in an isolated Linux checkout with Node 24.18.1 and Linux
`node_modules`; no Windows `node_modules`, `.env`, or provider credentials were
used:

- `npm run verify` — PASS: 153 tests, content 10/10, assets 35/35, production build and client-build security scan.
- `npm run test:rules` — PASS: 15/15 against local Firestore/Auth Emulator.
- `PORT=18081 npm start` then `GET /api/health` — PASS: `{ "status": "ok" }` with authored fallback providers unconfigured.
- Production black-box Playwright — PASS: 85 passed, 29 intentionally scoped skips, 0 failed; HTML report and 295 generated artifacts are retained in the WSL test checkout.
- `./scripts/run-wsl-docker-e2e.sh --host-port 18080` — expected environment stop before Compose; it wrote `docker-daemon-diagnostic.txt` and failure logs under its timestamped `wsl-docker-e2e/` bundle.

This is WSL/Linux evidence, not native Windows or container evidence. The
generated HTML report is intentionally not committed.

## Runtime Docker verification

### Native Windows PowerShell — authoritative Windows evidence

Run from `D:\Hackthon-GG2026` in **native Windows PowerShell**:

```powershell
if ((node -p "process.platform").Trim() -ne "win32") {
    throw "Phải chạy bằng Node native Windows."
}

npm ci
npx playwright install chromium
npm run verify
npm run test:rules
.\scripts\run-native-docker-e2e.ps1
```

`verify` deliberately does not start Firebase emulators, so `npm run test:rules` is a separate mandatory gate for the checked-in Firestore lifecycle rules. The native runner asserts `node -p process.platform` is `win32` and that the native Node version is `24.x` as required by `package.json`, forces same-origin `/api`, disables the dev bridge/Firebase configuration and emulators, clears Gemini/Maps keys, then starts `docker compose up --build -d` with `APP_PORT=18080`. It polls `GET /api/health` and runs `chromium-desktop` plus `chromium-mobile` with one worker against the deterministic authored-fallback container. It keeps Compose running for review and writes `health.json`, `docker-compose-ps.txt`, the HTML report, screenshots, traces and videos under `test-results/native-docker-e2e/`; on a runtime failure it also saves the Compose status and the last 200 app log lines. Firebase and live-provider smoke remain separate opt-in evidence.

### WSL/Linux — explicitly approved local alternative

Run from a Linux/WSL checkout with Linux `node_modules` and Node 24:

```bash
if [ "$(node -p 'process.platform')" != "linux" ]; then
  printf '%s\n' 'Phải chạy bằng Node Linux/WSL.' >&2
  exit 1
fi

npm ci
npx playwright install chromium
npm run verify
npm run test:rules
./scripts/run-wsl-docker-e2e.sh
```

The runner requires `linux` plus Node `24.x`, applies the same authored-fallback isolation, and saves a distinct `test-results/wsl-docker-e2e/<UTC-timestamp>-<pid>/` bundle. It checks Docker/Compose before `compose up`. If the WSL distro cannot reach a Docker daemon, it stops without starting Compose and records `docker-daemon-diagnostic.txt`; it never switches Docker contexts or changes Docker Desktop/WSL integration.

The latest attempted WSL run stopped as designed because Docker reported that it
was not available in this distro and recommended enabling Docker Desktop WSL
integration. Enable **Docker Desktop → Settings → Resources → WSL Integration
→ Ubuntu**, apply/restart Docker Desktop, reopen Ubuntu, confirm `docker info`,
then rerun the WSL runner. Alternatively run the native PowerShell runner.

The ignored `test-results/playwright/` and root `playwright-report/` folders are not paired with a shell-runner health/Compose artifact. Do not use them as release evidence until the matching timestamped runner bundle exists.

Capture the following before marking this release verified:

- `Invoke-RestMethod http://127.0.0.1:18080/api/health`
- Playwright HTML report and any failure trace/video
- desktop/mobile screenshots for map icon, challenge panel, game, reward postcard and Passport 10/10
- `docker compose ps`

## Known limitations

1. No public Cloud Run URL is recorded. Owner approval is required for Google login, project, IAM, secrets, public access and any billing/quota choice.
2. Firebase production browser authentication and live Gemini provider evidence remain separate opt-in checks; authored fallbacks keep gameplay deterministic without them.
3. Pixel-icon recognizability was reviewed by AI after the final Ba Nà, Cầu Sông Hàn and Chợ Hàn redraws; human visual sign-off at 32/48 px remains required before submission.
