# PROJECT STATUS — Rồng Con Du Ký

Last updated: 2026-08-03  
Track selected: **Starter Tier (Đường A — curated cards + Google Maps URLs)**

## Release verdict

**Local release candidate xanh; chưa release-ready/public.**

Tất cả feature/gameplay trong scope MVP đã được triển khai và test local, gồm smoke Fastify từ production artifact. Public Cloud Run URL, Firebase production/browser-auth evidence, Gemini live evidence và Cloud Run production smoke vẫn bị chặn bởi tooling/credentials/approval của người dùng. Không được trình bày trạng thái này như một deploy hoàn tất.

## Evidence mới nhất

| Kiểm tra                  | Kết quả                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell/runtime             | WSL fallback, Node `v24.18.1`; user đã cho phép fallback này. Google Cloud SDK `578.0.0` đã cài local nhưng `gcloud auth list` đang rỗng; chưa có pass native PowerShell thật.                                                                                                  |
| `npm run verify`          | PASS: TypeScript, Oxlint, Prettier, Vitest, content/assets validators, Vite build, server TypeScript và client-bundle security guard.                                                                                                                                           |
| Unit suite                | **19 files / 75 tests PASS** (fresh `npm run verify` local evidence).                                                                                                                                                                                                           |
| Firestore Rules Emulator  | **PASS: 1 suite / 7 tests** via local Firebase CLI `15.25.1`, Auth + Firestore Emulator with demo project `demo-rong-con-du-ky`. Covers unauthenticated/list/cross-UID denial, canonical owner create, valid lifecycle/retry/reward, malformed field and skipped reward denial. |
| Browser Firebase smoke    | **PASS local emulator**: Vite with dummy emulator-only config reached `Đã đồng bộ`; browser observed 9 successful Auth/Firestore emulator responses and 0 console/page errors. This is not production Auth evidence.                                                            |
| Content validation        | PASS: 4 locations, 4 dialogue nodes, 11 source entries.                                                                                                                                                                                                                         |
| Asset validation          | PASS: 19/19 assets, grid/tile 32 px.                                                                                                                                                                                                                                            |
| Full Playwright           | **22 passed / 18 skipped / 0 failed** across 40 desktop/mobile cases. Skips are intentional desktop/mobile ownership splits plus the dev-only bridge disabled in the black-box suite; none are failures.                                                                        |
| Dev-only E2E bridge       | **PASS: 1/1** with `VITE_ENABLE_E2E_BRIDGE=true`; bridge walks the four-quest reducer graph and rejects a locked out-of-order reward. Production bundle guard confirms it is absent from `dist/`.                                                                               |
| M8 targeted E2E           | Desktop focus/Escape/focus-return and Tab/Shift+Tab cycle PASS; mobile Companion bounds PASS at 390×844; public legal routes PASS.                                                                                                                                              |
| Technical video evidence  | PASS local: `npm run test:e2e:record` recorded the latest black-box Dragon Bridge journey (`video.webm`, 1,536,270 bytes, ignored/reproducible). This is not the narrated three-minute submission video.                                                                        |
| Production-artifact smoke | PASS local (latest rebuild): staged `build/`, `dist/` and `content/` outside the Windows mount; Fastify returned 200 for `/api/health`, `/`, `/privacy` and compiled JS asset with CSP, `nosniff`, `DENY` frame and `x-request-id` headers. This is not Cloud Run smoke.        |
| Secret scan               | PASS: no actual Google API-key, private-key or service-account JSON pattern in source scope (ignored build/dependency/test artifact directories).                                                                                                                               |
| Client build              | Shell `index` 310.39 kB / gzip 96.47 kB; Phaser `GameContainer` lazy chunk 1,438.72 kB / gzip 375.32 kB; Firebase remains lazy. Vite warns the Phaser chunk exceeds 500 kB.                                                                                                     |
| Dependency audit          | No high/critical gate failure with `npm audit --omit=dev --audit-level=high`; npm reports 6 moderate transitive findings (`uuid@9.0.1` through Firebase Admin Storage). `npm audit fix --force` proposes a breaking Firebase Admin change and was intentionally not run.        |

Visual artifacts are generated locally under `test-results/playwright/**/screenshots/` and ignored from Git. Representative checkpoints: title desktop/mobile, keyboard/touch overworld, Dragon Bridge retry/reward/postcard, three remaining quest tutorials/rewards, ending, travel fallback, privacy, desktop English shell and mobile Companion.

## Milestones

| Milestone | Name | Status | Evidence / remaining condition |
| --- | --- | --- |
| M0 | Guardrails & baseline | PASS (WSL fallback) | Git initialized, Node 24, scripts and checks reproducible in WSL. Native PowerShell confirmation remains D-001 follow-up. |
| M1 | Art bible & content schema | PASS | Canonical bilingual JSON, source IDs, 19 asset placeholders, validators. |
| M2 | Core movement & scene | PASS | Keyboard, collision/camera, touch joystick, local debounce persistence; named procedural-layer metadata and explicit NPC interaction radius contract. |
| M3 | Dragon Bridge vertical slice | PASS | Tutorial, retry, 7/10 threshold, reward/postcard/refresh E2E. |
| M4 | Mỹ Khê, Ngũ Hành Sơn, Sơn Trà | PASS | All three deterministic mini-games plus four-stamp passport/ending. |
| M5 | Firebase persistence | PASS (local/emulator) | Anonymous client/mirror, local fallback, browser emulator smoke, UID rules, reconciliation ADR and unit contracts pass. Configured real-project/browser Auth smoke remains a release checkpoint. |
| M6 | Starter recommendations | PASS (local) | Authenticated Fastify curated endpoint, source IDs/Maps links, browser fallback and E2E. Standard Places remains intentionally 501-disabled. |
| M7 | Gemini | IMPLEMENTED — live-provider verification pending | Server-only Interactions boundary, Zod, 7.5 s timeout, one retry, semantic unlocked-stop guard, authored fallback. Mocked valid/retry/semantic-rejection paths pass; no production key/model request was run. |
| M8 | Polish, accessibility, analytics, legal | PASS (local) | VI/EN selection, keyboard/touch, focus trap/Escape/focus return, mute/fullscreen controls, mobile safe-area CSS + 390×844 bounds check, sanitized event seam, `/privacy` and `/terms`. |
| M9 | Test, hardening & performance | PASS (local pre-release) | Full verify/E2E/Rules, production-artifact smoke, security headers test, bundle secret/bridge guard, no secret scan hit, lazy Phaser/Firebase boundary. Phaser chunk and moderate audit finding are documented release risks. |
| M10 | Docker / Cloud Run deploy | BLOCKED — human/tooling | `gcloud` local đã sẵn sàng nhưng chưa có Google login/project/IAM/secrets/public-access approval; Docker Desktop chưa bật WSL integration. |
| M11 | Submission & pitch | PREPARED local; public submission BLOCKED by M10 | README, architecture, legal, demo, deployment runbook, 7-slide pitch source, technical video capture plan/result and submission checklist exist. Public URL, Cloud smoke and narrated submission video remain missing. |

## What was completed after the initial vertical slice

- Added all four quest routes to the Overworld and preserved deterministic reward/retry behavior through `GameSession`.
- Added Passport, postcard, ending gate and local-first/reactive persistence subscription.
- Added dynamic Firebase Auth/Firestore mirror; only normalized GameState is stored and remote progress cannot erase a stronger local reward.
- Added typed `/api` client, Fastify Starter recommendation endpoint, Gemini server adapter, Zod schemas and authored fallbacks.
- Added a semantic itinerary guard: valid model JSON still fails if it contains a locked landmark.
- Added public Privacy/Terms React pages, docs, deployment runbook, ADR-007, GDD and demo script.
- Added focus management, Escape behavior, mobile layout audit, language propagation into Phaser scenes, screen-reader labels and no-emoji fallback control labels.
- Added modal focus return, verified Tab/Shift+Tab wrapping and guarded the persistent postcard lifecycle so it cannot intercept Escape inside a mini-game; postcard rendering now also recovers from the durable session state on slow/mobile mounts.
- Added explicit TitleScene `Continue`/`New Game` actions, save-availability detection and a deterministic reset boundary with unit coverage.
- Added dev-only `window.__GAME_TEST__`, compiled-client rejection for that marker/credential markers, and a full reducer-graph browser proof without using localStorage as the primary progression proof.
- Added mocked Gemini structured-provider tests for valid JSON, transient retry and semantically locked itinerary fallback.
- Added pitch deck source, video-backup workflow, submission checklist and release handoff; technical capture is reproducible from the final local code.
- Added privacy-safe analytics event seam: `game_start`, `language_selected`, `quest_start`, `quest_complete`, `postcard_open`, `place_card_open`, `google_maps_open`, `food_preferences_submitted`, `itinerary_created`, `game_complete`.
- Added defensive response headers, stronger Firestore transition/postcard rules and a local Emulator suite for owner/list/schema/transition contracts.

## Known limitations and blockers

1. **No public URL:** deployment needs user login/2FA, project choice, public-access approval and secrets. Do not create billing or publish automatically.
2. **No configured Firebase production smoke:** Auth + Firestore Rules Emulator passes locally, but no real Firebase web config/project or browser Anonymous Auth session has been exercised.
3. **No live Gemini evidence:** `GEMINI_API_KEY` was not supplied; local fallback is intentionally what the E2E exercises.
4. **Cloud tooling/auth:** Google Cloud SDK `578.0.0` đã cài local nhưng chưa có account/project (`gcloud auth list` trả `[]`); Docker CLI hiện báo WSL integration chưa bật. Production artifact đã được staged trên Linux `/tmp` cho local smoke; Docker image và Cloud Run smoke cần bật daemon hoặc dùng AI Studio/PowerShell sau khi owner đăng nhập.
5. **No Git remote:** repository is initialized but has no configured remote; do not push until the owner confirms the source-of-truth remote.
6. **Assets are placeholders:** release needs D-004 rights/asset approval.
7. **Performance:** Phaser is lazy-loaded but its game chunk remains large; measure real mobile 4G/production first playable before claiming a performance target.
8. **Audit:** six moderate transitive Firebase Admin Storage findings remain; no safe non-breaking automated fix was offered by npm.

## Next human-assisted actions

1. Run `scripts/bootstrap-windows.ps1`, then `npm run test:rules` and `npm run test:e2e` in **native PowerShell** if Windows confirmation is required.
2. Configure a non-production Firebase project and web config, then run browser Anonymous Auth plus Firestore mirror smoke; deploy rules only after owner approval.
3. Provide Firebase web config through `.env` and a Gemini key through a secure channel/Secret Manager; run configured live smoke in both languages.
4. Confirm Git remote, Google AI Studio Starter eligibility or Standard billing/quota plan, region, asset rights and explicit public access.
5. Deploy per [DEPLOYMENT.md](DEPLOYMENT.md), then record the public URL and incognito production smoke evidence here; complete [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) only with real links.
