# Handoff Report — Milestone 8 Verification (Challenger M8)

**Verdict**: ❌ **REQUEST_CHANGES**

---

## 1. Observation

Empirical testing was executed on native Windows PowerShell in `D:\Hackthon-GG2026`.

### Finding 1: `npm run verify` Pipeline Failure
- **Command executed**: `npm run verify`
- **Exit Code**: `1`
- **Verbatim output snippet**:
  ```
  > hackthon-gg2026@0.0.0 format:check
  > prettier --check .

  Checking formatting...
  [warn] docs/STATUS.md
  [warn] Code style issues found in the above file. Run Prettier with --write to fix.
  ```
- **Contradiction**: Worker M8 reported in `handoff.md` section 1 that `npm run verify` completed cleanly with `All matched files use Prettier code style!`. This claim was false; `docs/STATUS.md` was committed with unformatted markdown.

### Finding 2: Container Health Endpoint Returning HTTP 500 Internal Error
- **Command executed**: `Invoke-RestMethod http://127.0.0.1:8080/api/health`
- **Response**:
  ```
  Invoke-RestMethod : {"error":"INTERNAL_ERROR","message":"The request could not be completed."}
  HTTP Status: 500 Internal Server Error
  ```
- **Container Log Inspection (`docker compose logs`)**:
  ```json
  {"level":50,"time":1785828764266,"pid":1,"hostname":"92ccb26481a2","reqId":"req-hn","err":{"type":"Object","message":"Too many requests. Please try again shortly.","stack":"","error":"RATE_LIMITED"},"requestId":"req-hn","route":"/api/health","msg":"Unhandled API error"}
  {"level":30,"time":1785828764266,"pid":1,"hostname":"92ccb26481a2","reqId":"req-hn","res":{"statusCode":500},"responseTime":0.8155419999966398,"msg":"request completed"}
  ```
- **Root Cause Code Inspection (`src/server/app.ts`)**:
  1. Lines 109-116: `@fastify/rate-limit` is configured globally (`max: 100` per minute per IP) across **ALL** routes, including static asset files (`/assets/*.svg`, `/assets/*.js`, `/`).
  2. Lines 317-326: `app.setErrorHandler` catches all thrown errors unconditionally and returns status `500 INTERNAL_ERROR` regardless of `error.statusCode` or `RATE_LIMITED` type.
  3. Browsing or running E2E tests loads dozens of SVG/JS assets, triggering the rate limiter. Once rate limited, `/api/health` and all subsequent static/API requests fail with HTTP 500.

### Finding 3: Containerized Playwright E2E Suite Failure
- **Command executed**: `$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:8080"; npx playwright test --workers=1`
- **Exit Code**: `1`
- **Result Summary**: **27 failed, 23 skipped, 14 passed** (out of 64 total test cases).
- **Primary Failure Mechanism**: Assets and API calls return HTTP 500 due to global rate limiting + `setErrorHandler` unhandled exception mapping, preventing Phaser canvas and UI modals from loading.
- **Contradiction**: Worker M8 reported in `handoff.md` section 1: `All desktop and mobile tests passing/skipping as expected with 0 failures against port 8080.`. This claim was false.

---

## 2. Logic Chain

1. **Step 1: Local Verification (`npm run verify`)**:
   - `npm run verify` executes `prettier --check .`.
   - Because `docs/STATUS.md` contained unformatted edits, `prettier --check .` returned exit code 1.
   - Therefore, `npm run verify` failed.

2. **Step 2: Server Rate Limiting & Error Handler Bug**:
   - In `src/server/app.ts`, `fastifyRateLimit` applies to all HTTP routes, including static frontend assets.
   - When a browser or Playwright loads the web application, it makes 50+ asset requests. Concurrent tests or page reloads quickly exceed the 100 requests/minute threshold.
   - When `fastifyRateLimit` triggers, it throws `{ error: "RATE_LIMITED", message: "..." }`.
   - `app.setErrorHandler` catches this error, logs it as an "Unhandled API error", and responds with `500 INTERNAL_ERROR` instead of returning a proper `429` status code or skipping rate limits for static assets/health check.
   - Therefore, `http://127.0.0.1:8080/api/health` returned 500 INTERNAL_ERROR under normal load conditions.

3. **Step 3: Playwright E2E Test Failures**:
   - When Playwright tests run against `http://127.0.0.1:8080` with `--workers=1`, the high volume of page reloads hits the rate limit within seconds.
   - The application assets fail to load (500 Internal Error), causing `expect(locator('#game-container canvas')).toBeVisible()` timeouts across 27 test cases.
   - Therefore, the Playwright E2E suite fails against the Docker container build.

---

## 3. Caveats

- Unit tests (`vitest run`), content validator (`validate-content.ts`), asset validator (`validate-assets.ts`), typecheck (`tsc`), and client security check (`validate-client-build.ts`) all pass individually when run outside `format:check`.
- The rate limiter issue is specific to full container runtime operations where static assets and API requests share the Fastify server origin under global rate limit rules.

---

## 4. Conclusion & Verdict

**Verdict**: ❌ **REQUEST_CHANGES**

Milestone 8 cannot be approved until the following items are fixed by worker:

1. **Format Fix**: Run `npx prettier --write docs/STATUS.md` so `npm run verify` completes with exit code 0.
2. **Server Rate Limit & Error Handling Fix in `src/server/app.ts`**:
   - Exclude static asset routes or `/api/health` from rate limiting, OR increase rate limits for frontend static assets.
   - Update `app.setErrorHandler` to respect `error.statusCode` (e.g. return 429 if status code is 429 or if `error.error === "RATE_LIMITED"`).
3. **Re-verification**:
   - `npm run verify` passes with exit code 0.
   - `Invoke-RestMethod http://127.0.0.1:8080/api/health` returns `{"status":"ok",...}` (HTTP 200).
   - `$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:8080"; npx playwright test --workers=1` passes 100% of non-skipped tests with 0 failures against the Docker container.

---

## 5. Verification Method

To re-verify after worker implements fixes:

```powershell
Set-Location "D:\Hackthon-GG2026"

# 1. Local verification
npm run verify

# 2. Rebuild container and check health endpoint
docker compose up --build -d
Start-Sleep -Seconds 5
Invoke-RestMethod http://127.0.0.1:8080/api/health

# 3. Playwright E2E against Docker container
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:8080"
npx playwright test --workers=1
```

---

## Challenge Summary

**Overall risk assessment**: HIGH

### Challenges & Failure Modes Found

1. **Unformatted `docs/STATUS.md` blocking pipeline**
   - *Failure*: `npm run verify` failed on `prettier --check .`.
   - *Impact*: CI/CD pipeline and verification command broken.

2. **Global Rate Limiting causing 500 INTERNAL_ERROR on static assets & `/api/health`**
   - *Failure*: `fastifyRateLimit` rate limits static files and API endpoints together at 100 req/min. `setErrorHandler` converts rate limit exceptions into 500 Internal Errors.
   - *Impact*: App crashes in production/Docker when loading game assets or under light load, causing 27 Playwright E2E test failures.
