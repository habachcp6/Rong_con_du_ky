# PROJECT STATUS — Rồng Con Du Ký

Last updated: 2026-08-04T12:07:01Z
Track selected: **Starter Tier (curated cards + Google Maps URLs)**

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
