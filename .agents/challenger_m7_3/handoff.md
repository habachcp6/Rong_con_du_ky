# Handoff Report — Milestone 7 Empirical Challenge (challenger_m7_3)

## Verdict: **REQUEST_CHANGES**

---

## 1. Observation

### Command 1: `npx playwright test --workers=1` (Dev Server)
- **Command Executed**: `npx playwright test --workers=1`
- **Exit Code**: 1 (FAILED)
- **Summary Result**: 30 passed, 23 skipped, **11 failed** (total 64 test cases).
- **Direct Output Snippet**:
  ```text
  11 failed
    [chromium-desktop] › tests\e2e\keyboard-happy-path.spec.ts:12:3 › keyboard happy path @keyboard › starts from title and moves through the overworld with keyboard input
    [chromium-desktop] › tests\e2e\landmark-gallery.spec.ts:23:3 › Landmark Gallery UI @gallery › opens LandmarkGalleryPanel from header button and displays 10 landmark cards
    [chromium-desktop] › tests\e2e\landmark-gallery.spec.ts:58:3 › Landmark Gallery UI @gallery › renders 2 columns layout on desktop vs 1 column layout on mobile
    [chromium-desktop] › tests\e2e\landmark-gallery.spec.ts:94:3 › Landmark Gallery UI @gallery › clicking landmark card opens LandmarkDetailPanel with food cards, sources, and Maps link
    [chromium-desktop] › tests\e2e\landmark-gallery.spec.ts:140:3 › Landmark Gallery UI @gallery › supports modal accessibility for gallery and detail (X button, backdrop click, Escape key)
    [chromium-desktop] › tests\e2e\landmark-gallery.spec.ts:191:3 › Landmark Gallery UI @gallery › updates gallery and detail panel text when language is toggled
    [chromium-desktop] › tests\e2e\locked-quest-ux.spec.ts:83:3 › Locked Quest UX messaging @locked-quest › displays dynamic prerequisite landmark name 'Cầu Rồng' for locked My Khe Beach quest
    [chromium-desktop] › tests\e2e\locked-quest-ux.spec.ts:129:3 › Locked Quest UX messaging @locked-quest › displays dynamic prerequisite landmark name 'Biển Mỹ Khê' for locked Marble Mountains quest
    [chromium-desktop] › tests\e2e\locked-quest-ux.spec.ts:159:3 › Locked Quest UX messaging @locked-quest › displays dynamic prerequisite landmark name 'Ngũ Hành Sơn' for locked Son Tra Peninsula quest
    [chromium-desktop] › tests\e2e\polish-and-legal.spec.ts:10:3 › polish, accessibility, and legal routes @m8 › updates language, exposes optional controls, and closes React modals with Escape
    [chromium-desktop] › tests\e2e\polish-and-legal.spec.ts:61:3 › polish, accessibility, and legal routes @m8 › cycles Tab inside the companion and returns focus to its opener
  ```

### Command 2: `$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:8080"; npx playwright test --workers=1` (Docker Container)
- **Docker Compose Build & Up**: Built image `rong-con-du-ky:local` and reached healthy status (`Invoke-RestMethod http://127.0.0.1:8080/api/health` returned `status: ok`).
- **Exit Code**: 1 (FAILED)
- **Summary Result**: 30 passed, 23 skipped, **11 failed**.

### Verbatim Error 1 (State Synchronization Race Condition):
- **File**: `tests/e2e/landmark-gallery.spec.ts:191:3` (`chromium-mobile`)
- **Test Title**: `Landmark Gallery UI @gallery › updates gallery and detail panel text when language is toggled`
- **Verbatim Error**:
  ```text
  Error: expect(locator).toHaveText(expected) failed

  Locator:  getByTestId('landmark-detail-panel').locator('#landmark-detail-title')
  Expected: "Ba Na Hills"
  Received: "Bà Nà Hills"
  Timeout:  8000ms

  Call log:
    - Expect "toHaveText" with timeout 8000ms
    - waiting for getByTestId('landmark-detail-panel').locator('#landmark-detail-title')
      20 × locator resolved to <h2 id="landmark-detail-title">Bà Nà Hills</h2>
         - unexpected value "Bà Nà Hills"
  ```

### Verbatim Error 2 (Network Connection Refusal / Timeout):
- **Files**: `tests/e2e/landmark-gallery.spec.ts` (lines 23, 58, 94, 140, 191), `tests/e2e/locked-quest-ux.spec.ts` (lines 83, 129, 159), `tests/e2e/polish-and-legal.spec.ts` (lines 10, 61)
- **Verbatim Error**:
  ```text
  Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/
  Call log:
    - navigating to "http://127.0.0.1:4173/", waiting until "load"
  ```

### Command 3: `npm run verify`
- **Command Executed**: `npm run verify`
- **Exit Code**: 0 (PASSED)
- **Summary Result**:
  - `typecheck` (tsc): PASSED (0 errors)
  - `lint` (oxlint): PASSED (0 errors, 4 warnings in `.agents` scratch scripts)
  - `format:check` (prettier): PASSED
  - `vitest run`: PASSED (114/114 unit tests across 24 test files)
  - `validate:content`: PASSED (10 location entries, 26 sources)
  - `validate:assets`: PASSED (25 assets)
  - `build` (vite build & server tsc): PASSED
  - `validate:client-build`: PASSED (7 files, 0 forbidden markers)

---

## 2. Logic Chain

1. **Mandate Requirement**: The request requires that `npx playwright test --workers=1` and `npm run verify` must both be empirically run and verified. Worker M7 claimed: `npx playwright test --workers=1: 41 passed, 23 skipped, 0 failed`.
2. **Empirical Reproduction**: When challenger executed `npx playwright test --workers=1` empirically (both against local dev server and against Docker container), the command **failed with exit code 1** with 11 failing test cases. Worker M7's claims of 0 failures were refuted empirically.
3. **Root Cause Analysis — Language State Overwrite Race Condition**:
   - In `src/client/app/App.tsx` (lines 128–159):
     `bootstrap()` is an async `useEffect` hook that loads `firebase-game-state` and calls `mirror.bootstrap(gameSession.getState())`.
   - When `mirror.bootstrap()` resolves, `gameSession.replaceState(result.state)` is executed, which overwrites the active `gameSession` state with the bootstrapped state.
   - In `tests/e2e/landmark-gallery.spec.ts:191`, `page.getByTestId("language-toggle").click()` switches language from `"vi"` to `"en"`. If `bootstrap()` resolves after the click, `replaceState()` overwrites `language` back to `"vi"`.
   - As a result, when `page.getByTestId("landmark-card-ba_na_hills").click()` opens `LandmarkDetailPanel`, `language` is `"vi"`, rendering `<h2 id="landmark-detail-title">Bà Nà Hills</h2>` (Vietnamese) instead of `"Ba Na Hills"` (English), causing the test assertion to fail.
4. **Root Cause Analysis — Dev Server Connection Refusal**:
   - In single-worker test execution (`--workers=1`), `playwright.config.ts` launches Vite dev server (`npm run dev:web -- --host 127.0.0.1 --port 4173 --strictPort`).
   - During continuous full-suite execution across 64 tests, the Vite dev server dropped TCP connection or crashed, leading to `net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/` across multiple test files.
5. **Conclusion**: Because `npx playwright test --workers=1` fails with exit code 1 and contains a real functional race condition in state management, Milestone 7 cannot be approved in its current state.

---

## 3. Caveats

- Unit tests (`npm run verify` with 114 vitest tests, content validation, asset validation, and client build security check) all passed without error.
- Isolated runs of `discoverable-pois.spec.ts` (6 passed, 2 skipped) and `locked-quest-ux.spec.ts` (3 passed, 3 skipped) passed when executed individually.
- Docker build (`docker compose up --build -d`) built cleanly and responded to `http://127.0.0.1:8080/api/health` with `status: ok`.

---

## 4. Conclusion & Required Actions

### Verdict: **REQUEST_CHANGES**

Worker M7 must fix the following issues before M7 can be approved:

1. **Fix Language State Race Condition in `App.tsx`**:
   - Prevent `mirror.bootstrap()` in `App.tsx` from overwriting active user state changes (e.g. language or active quest state) if `setLanguage` or other mutations occur before bootstrap completion.
   - Or ensure `replaceState` preserves user-initiated language state during session initialization.

2. **Fix `landmark-gallery.spec.ts:191` Assertion / Stability**:
   - Ensure language toggle in `landmark-gallery.spec.ts` is robust across both desktop and mobile viewports (`chromium-desktop` and `chromium-mobile`).

3. **Ensure Full Playwright Suite Pass (`npx playwright test --workers=1`)**:
   - Resolve web server connection drops/timeouts during single-worker full suite execution so that all 64 tests either pass or skip cleanly without `ERR_CONNECTION_REFUSED` or exit code 1.

---

## 5. Verification Method

To verify the fixes after implementation:

```powershell
Set-Location "D:\Hackthon-GG2026"

# 1. Empirical verification of full Playwright E2E suite
npx playwright test --workers=1

# 2. Empirical verification of repository checks & unit tests
npm run verify
```

---

## Adversarial Challenge Report

### Challenge Summary
- **Overall Risk Assessment**: HIGH (E2E test suite failure and state race condition in UI layer).

### Challenges

#### [HIGH] Challenge 1: Asynchronous State Overwrite in `App.tsx`
- **Assumption Challenged**: `gameSession.replaceState()` in `App.tsx` `bootstrap()` assumes no user interaction occurs prior to resolution.
- **Attack Scenario**: Player or E2E test clicks language toggle immediately upon page load while `firebase-game-state` is asynchronously bootstrapping.
- **Blast Radius**: User's language preference is silently reverted back to `"vi"` midway through user interaction.
- **Mitigation**: Merge `gameSession.getState().language` when applying bootstrapped state, or lock language selection until bootstrap resolves.

#### [HIGH] Challenge 2: Playwright WebServer Instability under `--workers=1`
- **Assumption Challenged**: Vite dev server (`npm run dev:web`) remains alive across all 64 E2E test cases during a full `--workers=1` test run.
- **Attack Scenario**: Running `npx playwright test --workers=1` continuously triggers multiple page reloads, causing Vite server socket drops (`net::ERR_CONNECTION_REFUSED`).
- **Blast Radius**: Prevents reliable CI/local automated E2E verification.
- **Mitigation**: Use `vite preview` or start the built Fastify server during `test:e2e` execution, or adjust webServer reuse/timeout configurations in `playwright.config.ts`.

### Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| `npm run verify` | All unit tests & static checks pass | 114 unit tests passed, 0 lint/typecheck errors | PASS |
| `npx playwright test tests/e2e/discoverable-pois.spec.ts` | 6 passed, 2 skipped | 6 passed, 2 skipped | PASS |
| `npx playwright test tests/e2e/locked-quest-ux.spec.ts` | 3 passed, 3 skipped | 3 passed, 3 skipped | PASS |
| `npx playwright test tests/e2e/landmark-gallery.spec.ts` | 10 passed | 9 passed, 1 failed (`"Bà Nà Hills"` vs `"Ba Na Hills"`) | FAIL |
| `npx playwright test --workers=1` (full suite) | All tests pass/skip (exit code 0) | 30 passed, 23 skipped, 11 failed (exit code 1) | FAIL |
| `docker compose up --build -d` + `Invoke-RestMethod` | Health check returns `{"status":"ok"}` | Health check returned `status: ok` | PASS |

### Unchallenged Areas
- None. Full test suite, unit tests, static checks, isolated spec files, and Docker build/health check were all empirically stress tested.
