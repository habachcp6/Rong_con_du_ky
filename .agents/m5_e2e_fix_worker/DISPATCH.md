## 2026-08-05T04:36:40Z
You are the E2E Fix Worker for Milestone M5 for Rồng Con Du Ký.
Your working directory is `d:\Hackthon-GG2026\.agents\m5_e2e_fix_worker`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INSTRUCTIONS:
1. Read `d:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md`, `d:\Hackthon-GG2026\AGENTS.md`, `d:\Hackthon-GG2026\PROJECT.md`, and `d:\Hackthon-GG2026\.agents\m5_reviewer_1\handoff.md`.
2. Inspect the Docker setup (`Dockerfile`, `compose.yaml`, server static asset handling) and Playwright E2E tests (`tests/e2e/`).
3. Build and launch Docker container in native Windows PowerShell:
   ```powershell
   docker compose up --build -d
   Start-Sleep -Seconds 15
   Invoke-RestMethod http://127.0.0.1:8080/api/health
   ```
4. Run Playwright E2E tests against Docker container:
   ```powershell
   $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:8080"
   $env:PLAYWRIGHT_CAPTURE_VIDEO = "true"
   npx playwright test --workers=1
   ```
5. If any E2E tests fail (e.g. canvas load, asset serving, interaction hint, or server response), diagnose the root cause:
   - Check if Fastify server in Docker is correctly serving static PNG files from `public/assets/` or `dist/client/assets/`.
   - Check if Phaser game canvas or scene initialization has preloader/PNG loading delays or errors.
   - Check if Playwright selectors or wait timeouts need adjustment for containerized execution.
   - Fix the underlying code/config issue cleanly.
6. Verify that ALL 85 non-skipped Playwright E2E tests pass cleanly (0 failed) against the Docker container.
7. Run `npm run verify` to confirm 100% pass rate.
8. Stop Docker container (`docker compose down`), update `docs/STATUS.md` with verified evidence, write your report to `d:\Hackthon-GG2026\.agents\m5_e2e_fix_worker\handoff.md`, and send a message when complete.
