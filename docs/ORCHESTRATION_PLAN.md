# Kế hoạch điều phối triển khai — Rồng Con Du Ký

> Phạm vi: kế hoạch delivery cho đội agent, không phải một orchestrator AI chạy trong game production. Kiến trúc runtime vẫn là Phaser 4 + React + Fastify + Firebase + Gemini theo AGENTS.md.
>
> Nguồn yêu cầu: GG2026_Rong_Con_Du_Ky_AI_Agent_Blueprint.md, bản tại C:\Users\hahoa\Downloads\GG2026_Rong_Con_Du_Ky_AI_Agent_Blueprint.md.
>
> Track mặc định hiện tại: Starter Tier, dùng curated place cards và Google Maps URLs. Places API (New) chỉ là nhánh Standard sau khi có chấp thuận billing.

## Execution snapshot — 2026-08-03

Đây là trạng thái do O0 kiểm soát sau các wave local; section P0 bên dưới là gap snapshot ban đầu và đã được thay thế bởi evidence này.

| Gate  | O0 verdict                                | Evidence hiện có                                                                                                                                                                      | Cổng còn lại                                                                   |
| ----- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0–G4 | PASS local                                | Node 24.18.1 trong WSL fallback được user cho phép; 4 quest, keyboard/touch, content/assets validation và E2E.                                                                        | Native Windows PowerShell pass chưa được thực hiện.                            |
| G5    | PASS local/emulator                       | Firebase Auth + Firestore Rules Emulator 7/7; browser emulator smoke `npm run test:firebase:browser` reports `Đã đồng bộ`; local-first fallback.                                      | Firebase project/browser Anonymous Auth smoke trên project thật cần owner.     |
| G6–G7 | PASS local / provider-live pending        | Starter curated cards/Maps, Fastify API, Gemini schema/retry/fallback mock coverage.                                                                                                  | Gemini key/production call và any Standard approval cần owner.                 |
| G8–G9 | PASS local pre-release                    | 19 unit files/75 tests, full Playwright 22 pass/18 intentional skips/0 failures, Rules Emulator 7/7, focus cycle/return, client-bundle guard, latest local production-artifact smoke. | Real mobile-network performance measurement vẫn cần trước khi công bố KPI.     |
| G10   | BLOCKED external                          | Google Cloud SDK 578.0.0 đã cài nhưng `gcloud auth list` rỗng; Docker Desktop chưa bật WSL integration; chưa có project/IAM/secrets/public-access approval.                           | Human login/2FA, project, billing/quota (nếu cần), secret và publish approval. |
| G11   | PREPARED local; public submission blocked | Pitch 7 slide, demo script, technical WebM capture, checklist và handoff đã có.                                                                                                       | Public URL + incognito Cloud smoke + narrated video + asset rights.            |

O0 không được chuyển G10/G11 thành PASS chỉ từ local test; các URL và external approval phải do owner cung cấp/duyệt.

## 1. Kết quả cần đạt

Đội phải bàn giao một web game pixel song ngữ Việt–Anh, chơi được trong 10–15 phút, có bốn quest hoàn chỉnh, lưu tiến trình, gợi ý du lịch, Gemini có fallback, và URL Cloud Run công khai. Phạm vi không bao gồm combat, multiplayer, inventory phức tạp, economy, crafting, procedural world hoặc bản đồ Đà Nẵng theo tỷ lệ thật.

Thứ tự không được đảo:

1. Baseline tái lập được.
2. M1 content và asset contract.
3. M2 core movement.
4. M3 Dragon Bridge vertical slice hoàn chỉnh.
5. Chỉ sau G3 mới nhân bản sang ba quest còn lại.
6. Tích hợp persistence, Starter recommendations và Gemini.
7. Hardening, deploy, submission.

## 2. Baseline P0 ban đầu và worklist lịch sử

> Historical snapshot: các quan sát trong section này là điểm xuất phát của kế hoạch, không phải trạng thái hiện tại. Xem execution snapshot ở trên để biết verdict hiện hành.

Không được tiếp tục feature work dựa đơn thuần vào dòng M0 PASS trong STATUS. Kiểm tra ở checkout hiện tại cho thấy các chênh lệch sau:

| Quan sát                                                                                                              | Ảnh hưởng                                                                                    | Việc P0 phải đóng                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Không có thư mục .git; git status không nhận đây là repository.                                                       | Không thể kiểm tra diff/secret, dùng worktree, tạo commit hay theo luồng GitHub → AI Studio. | Khôi phục hoặc khởi tạo Git tại đúng source-of-truth; xác nhận remote trước khi push.                                    |
| Shell hiện chạy Node 22 trong khi package yêu cầu Node 24.x.                                                          | Kết quả build/test không đại diện runtime mục tiêu.                                          | Chọn một shell duy nhất và cài Node 24 LTS trong shell đó.                                                               |
| node_modules có dấu hiệu trộn Windows/WSL; Vite thiếu native binary và tsx IPC lỗi trên đường dẫn mount.              | npm run verify và validator chưa tái lập được.                                               | Cài lại dependency bằng đúng một môi trường sau khi đã chọn shell; không dùng chung node_modules giữa PowerShell và WSL. |
| README vẫn là Vite template, Playwright chưa có config/spec, verify chưa chứa lint hoặc các validator.                | M0/M9 chưa có bằng chứng đầy đủ; release docs chưa bắt đầu.                                  | Chỉnh M0 guardrails, sau đó lưu evidence thực tế trước khi đổi trạng thái milestone.                                     |
| M1 mới có một phần: art bible, JSON content và source IDs; asset validator còn là stub, asset thật/chính xác chưa có. | M1 chưa thể PASS.                                                                            | Chốt canonical content, metadata nguồn/asset và validator thật.                                                          |

### P0 — Reconciliation and reproducible baseline

**Owner:** O0 Orchestrator. Không giao P0 cho nhiều writer.

1. Ghi quyết định D-001: dùng toàn bộ Windows PowerShell native hoặc toàn bộ WSL2. Với checkout ở ổ Windows, mặc định khuyến nghị PowerShell native; người dùng đã chấp thuận WSL chỉ như fallback khi native không thành công. Nếu dùng WSL thì mọi Node/Firebase/gcloud/node_modules phải nằm trong WSL và evidence phải ghi đúng là WSL, không gắn nhãn PowerShell.
2. Xác nhận đúng source-of-truth. Nếu đây là bản copy, không tự ý push; xác định repository/remote do người dùng sở hữu trước.
3. Bảo đảm Node 24.x, npm tương ứng và package-lock nhất quán; tạo sạch dependency chỉ trong môi trường đã chọn.
4. Chạy lại các lệnh nền: npm ci, npm run typecheck, npm run lint, npm run test, npm run build, npm run validate:content và npm run validate:assets.
5. Bổ sung guardrails còn thiếu vào M0: verify phải bao phủ lint và validation có ý nghĩa; tạo khung Playwright/CI tối thiểu; loại hoặc ghi rõ entrypoint Vite template không dùng.
6. Chỉ khi tất cả pass, O0 mới cập nhật M0 trong docs/STATUS.md bằng output thật và checkpoint Git.

**G0 PASS:** có Git source-of-truth; một shell duy nhất; Node 24; install/build/test/validators tái lập được; không có secret trong tracked files. Nếu bất kỳ mục nào không đạt, trạng thái là BLOCKED, không phải PASS.

## 3. Mô hình điều phối

### 3.1 O0 — Orchestrator duy nhất

O0 là người giữ kế hoạch, không phải worker viết mọi feature. O0 có các quyền và trách nhiệm sau:

- Sở hữu duy nhất: docs/STATUS.md, decision log, package/config/lockfile, src/shared contracts, final integration, milestone gate, release gate và evidence index.
- Chỉ O0 được đổi trạng thái milestone thành PASS hoặc BLOCKED sau khi tự kiểm tra evidence của worker và QA.
- Chỉ O0 được chấp thuận thay đổi stack, state machine, API contract, dependency major, track Starter/Standard hoặc scope.
- Tạo task card có scope file rõ ràng, dependency, acceptance criteria và lệnh verify trước khi giao worker.
- Giữ tối đa ba worker hoạt động cùng lúc. Với giới hạn bốn slots, đội luôn là O0 + tối đa ba sub-agent.
- Dừng đúng checkpoint cần con người: login/2FA, billing/terms, IAM/quota, bản quyền asset, public deploy hoặc chi phí đáng kể.
- Không để Gemini, AI Studio hay một worker tự quyết quest state, score, reward, secret hoặc public release.

### 3.2 Trạng thái công việc

Mỗi task đi theo: READY → IN_PROGRESS → REVIEW → PASS hoặc BLOCKED.

- READY: dependency và file ownership đã rõ.
- IN_PROGRESS: chỉ owner được sửa file trong scope.
- REVIEW: worker đã bàn giao diff, test và evidence; không được tự merge/đổi status.
- PASS: O0 và QA độc lập xác nhận acceptance criteria.
- BLOCKED: chỉ dùng khi cần human action hoặc blocker kỹ thuật có evidence; phải nêu một hành động để gỡ.

### 3.3 Quy tắc chống xung đột

1. Một file chỉ có một writer tại một thời điểm.
2. Sau P0, mỗi worker dùng branch/worktree riêng; không làm trực tiếp trên branch tích hợp.
3. Không worker nào sửa package.json, package-lock.json, firebase config, docs/STATUS.md hoặc src/shared/** nếu O0 chưa cấp task riêng.
4. Không hai worker sửa cùng scene, cùng quest hoặc cùng UI flow.
5. Worker integration gửi proposal cho shared contract; O0 là người duy nhất thực hiện merge contract.
6. AI Studio/Jules chỉ được dùng trên release candidate; thay đổi phát sinh phải quay lại Git source-of-truth trước khi local work tiếp tục.

## 4. Pool sub-agent và quyền sở hữu

Các agent bên dưới là pool vai trò, không phải tất cả chạy đồng thời. O0 lập lịch tối đa ba agent theo từng wave ở phần 6.

| ID  | Vai trò                       | Milestone chính  | Scope được sửa                                                                                           | Không được sửa                                                              | Bàn giao tối thiểu                                                            |
| --- | ----------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A1  | Content & Assets              | M1, hỗ trợ M4/M8 | content/**, public/assets/**, docs/ART_BIBLE.md, scripts/validate-content.ts, scripts/validate-assets.ts | quest state, backend, shared types                                          | Canonical data, nguồn/giấy phép, asset manifest, validators, screenshots      |
| A2  | Game Core + Dragon Bridge     | M2–M3            | src/client/game/**, src/client/app/** trong giai đoạn G3, local-state module mới                         | src/shared/**, Firebase/server/config                                       | Movement/input/collision/bridge/quest flow, unit test, keyboard evidence      |
| A3  | QA Harness                    | M1–M3, M9        | tests/**, playwright.config.ts, test fixtures/mocks, CI workflow                                         | Production gameplay và shared contracts                                     | Test matrix, config/spec, logs, visual evidence, regression verdict           |
| A4  | Persistence Platform          | M5               | Firebase client/service modules, firestore.rules, indexes, emulator config, persistence tests            | quest rules, backend AI/Places                                              | Auth/save/load/fallback/rules evidence và merge policy                        |
| A5  | Backend Integrations          | M6–M7            | src/server/routes/**, src/server/services/**, src/server/prompts/**, backend integration tests           | game state logic, client secret handling, shared contracts không được duyệt | Auth middleware, Zod handling, curated/AI adapters, mock tests, redacted logs |
| A6a | Quest Mỹ Khê                  | M4 sau G3        | MyKheCleanupScene và asset/test cục bộ                                                                   | Overworld, shared quest logic, passport                                     | Intro/tutorial/retry/reward scene, test và screenshot                         |
| A6b | Quest Ngũ Hành Sơn            | M4 sau G3        | MarbleMountainsPuzzleScene và asset/test cục bộ                                                          | Overworld, shared quest logic, passport                                     | Intro/tutorial/hints/retry/reward scene, test và screenshot                   |
| A6c | Quest Sơn Trà                 | M4 sau G3        | SonTraWildlifeScene và asset/test cục bộ                                                                 | Overworld, shared quest logic, passport                                     | Intro/tutorial/retry/reward scene, test và screenshot                         |
| A7  | UI, Accessibility & Analytics | M6/M8            | src/client/components/**, src/client/styles/**, UI panel modules, analytics adapter                      | Phaser internal objects, game transitions, server contracts                 | Responsive/a11y checks, analytics map, screenshots                            |
| A8  | Release & Documentation       | M8–M11           | README.md, docs trừ STATUS, submission artefacts, screenshot index                                       | secrets, deploy/public action, source feature logic                         | Setup/deploy/smoke guide, Privacy/Terms, demo script, handoff pack            |

O0 giữ mọi file chưa được giao rõ ràng, đặc biệt các contract sau:

- src/shared/types.ts: GameState, QuestStatus, event types và persistence interface.
- src/shared/quests.ts: quest definitions, unlock policy và transition rules.
- src/shared/schemas.ts: request/response schema và track flags. Dữ liệu Starter curated chỉ có một nguồn canonical tại `content/curated-places.json`.
- package.json, lockfile, Dockerfile, vite/tsconfig, firebase.json và docs/STATUS.md.

## 5. Contract cần chốt trước khi chạy song song

### C1 — Content và asset contract (sau M1)

- Có đúng một nguồn canonical cho location, dialogue, curated places và source metadata. Không duy trì song song JSON và TypeScript mà không có generator/ownership rõ.
- File VI/EN có key parity; mọi fact lịch sử có source ID; ảnh có author, URL, license và local asset path.
- Asset manifest quy định kích thước, grid, alpha và owner; placeholder hợp lệ được dùng để không chặn gameplay.
- Validator thất bại nếu thiếu source, key, asset, grid, dimension hoặc attribution bắt buộc.

### C2 — Game domain contract (freeze trước M3)

- Quest chỉ đi: LOCKED → AVAILABLE → ACTIVE → COMPLETED → REWARDED; retry từ ACTIVE về AVAILABLE là exception đã được test.
- Game code là authority cho transition, memory fragments, postcard và ending. Gemini chỉ trả dialogue/hint/next action được whitelist.
- Phaser phát event typed; React gửi command typed. React không giữ reference scene nội bộ.
- Có GameStateStore interface để localStorage và Firestore thay thế nhau mà không thay đổi gameplay.

### C3 — Service boundary (freeze trước M5–M7)

- Client chỉ gọi Fastify qua same-origin /api; Gemini và Places key không xuất hiện trong browser bundle.
- API request/response được Zod validate; server returns typed fallback thay vì raw provider response.
- Starter RecommendationService chỉ lọc curated data và Maps URLs. Standard Places adapter bị feature-gate, chỉ bật khi D-002 được đổi và billing/IAM đã được người dùng chấp thuận.
- Persistence chỉ lưu Place ID; không persist rating, review, photo hoặc opening hours.

### C4 — Test contract

- Unit: quest transitions, save migration, schema, content/i18n parity, ranking/itinerary.
- Integration: invalid token, Gemini valid/invalid schema, timeout/retry, curated fallback, Places 429/empty khi Standard.
- E2E: có test keyboard thật; test bridge chỉ tồn tại khi VITE_ENABLE_E2E_BRIDGE=true và bị vô hiệu ở production.
- Visual: title desktop/mobile, overworld, bốn mini-game, postcard, recommendation attribution, itinerary VI/EN, fallback state.

## 6. Lịch thực thi theo wave

| Wave         | Active workers bên cạnh O0                | Mục tiêu và dependency                                                                                                                 | Gate để chuyển |
| ------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| W0 / P0      | Chỉ O0; A1/A3 chỉ audit read-only nếu cần | Khôi phục Git, chọn shell, Node 24, clean install, guardrails, baseline evidence.                                                      | G0             |
| W1 / M1      | A1 + A3; O0                               | Canonical content/source/asset pipeline; validator và test harness foundation. A2 chỉ thiết kế M2, chưa viết vào contract chưa freeze. | G1             |
| W2 / M2–M3   | A2 + A3 + A1; O0                          | A2 làm movement rồi Dragon Bridge end-to-end. A1 bổ sung asset đúng manifest; A3 mở rộng test mà không sửa gameplay.                   | G2 rồi G3      |
| W3 / M4      | A6a + A6b + A6c; O0                       | Ba mini-game chạy song song theo scene boundary, chỉ sau G3. O0 tích hợp unlock/passport/ending lần lượt.                              | G4             |
| W4 / M5–M7   | A4 + A5 + A7; O0                          | Firebase, Starter curated recommendation UI, Gemini backend/UI. M4 regression vẫn thuộc O0/A3 theo từng batch.                         | G5, G6, G7     |
| W5 / M8–M9   | A3 + A7 + A8; O0                          | A11y, responsive, analytics/privacy, test matrix, performance/security, docs/evidence.                                                 | G8, G9         |
| W6 / M10–M11 | A3 + A8; O0 + human checkpoints           | Release candidate, AI Studio Starter publication, production smoke, demo/pitch/submission.                                             | G10, G11       |

### M0/P0 — Guardrails and baseline

| Task                               | Owner                         | Acceptance                                                                                  |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| P0.1 Chốt shell và Node 24         | O0                            | D-001 ghi trong decision log; node -v trả 24.x trong shell được chọn.                       |
| P0.2 Khôi phục Git source-of-truth | O0 + human nếu remote chưa rõ | git rev-parse hoạt động; branch/remote policy được ghi; không push nhầm repository.         |
| P0.3 Cài dependency tái lập được   | O0                            | npm ci không dùng node_modules của môi trường khác; Vite/tsx native module chạy được.       |
| P0.4 Sửa guardrail M0              | O0                            | verify có lint và validation phù hợp; test:e2e có config hoặc báo rõ chưa có spec trước G3. |
| P0.5 Evidence baseline             | O0                            | Output command, version, file inventory và known limitation được đưa vào STATUS.            |

### M1 — Art bible and content schema

| Task                               | Owner | Acceptance                                                                                                         |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| M1.1 Canonical content             | A1    | Bốn địa danh và dialogue VI/EN cùng key; no unsourced tourism fact; starter curated data không bị duplicate drift. |
| M1.2 Asset manifest + placeholders | A1    | Sprite/tile/landmark/UI asset hoặc placeholder có dimension/grid hợp lệ, asset path tồn tại.                       |
| M1.3 Validators                    | A1    | Content/asset validation fail có chủ đích với key/source/asset/grid sai và pass dữ liệu đúng.                      |
| M1.4 Harness foundation            | A3    | Unit coverage cho schema/content/transition; Playwright config có thể khởi động ứng dụng local.                    |

**G1 PASS:** validator thật pass, source metadata đầy đủ, asset placeholder không làm game block, canonical source được ghi rõ.

### M2 — Core movement

| Task                       | Owner | Acceptance                                                                              |
| -------------------------- | ----- | --------------------------------------------------------------------------------------- |
| M2.1 Scene pipeline        | A2    | Boot, Preload, Title, Overworld chạy đúng lifecycle và responsive canvas pixel-art.     |
| M2.2 World system          | A2    | Map/layer/collision/interactable metadata, camera follow, player animation bốn hướng.   |
| M2.3 Input and local state | A2    | WASD/arrows, E/Space, Esc, touch joystick, interaction prompt, local autosave debounce. |
| M2.4 Test and visual audit | A3    | Ít nhất một keyboard E2E; screenshot desktop/mobile; no console error nghiêm trọng.     |

**G2 PASS:** đi được desktop/mobile, không xuyên collision, camera/pixel không blur, state local còn sau refresh.

### M3 — Dragon Bridge hard gate

Chỉ A2 được là feature writer của flow Dragon Bridge; đây là nơi tránh tách Phaser/UI/quest transition thành nhiều agent gây lỗi integration.

1. NPC interaction mở dialogue React overlay và pause movement.
2. O0 tích hợp transition contract đã freeze; A2 gọi command, không tự sửa src/shared.
3. Rhythm game có tutorial, tín hiệu hình ảnh, feedback đúng/sai, tối đa 60 giây, threshold 70%, retry.
4. Win đi qua COMPLETED → REWARDED, tăng memory fragment đúng một lần, unlock postcard và autosave.
5. A3 chạy unit/integration/E2E happy-path, retry-path và refresh-path; giữ screenshot evidence.

**G3 PASS — không có ngoại lệ:** từ title đến Cầu Rồng đến quest đến postcard chạy hoàn chỉnh, keyboard và touch đều hoạt động, refresh không mất local progress, fallback UI không chặn input. M4 không được bắt đầu trước G3.

### M4 — Three remaining quests

Ba agent A6a/A6b/A6c chạy song song, mỗi agent chỉ sở hữu scene mình:

| Agent | Quest               | Acceptance đặc thù                                                           |
| ----- | ------------------- | ---------------------------------------------------------------------------- |
| A6a   | Mỹ Khê cleanup      | Thu gom đủ 8 rác trong 60 giây, có obstacle, tutorial/retry/reward.          |
| A6b   | Ngũ Hành Sơn puzzle | Ghép đủ Kim–Mộc–Thủy–Hỏa–Thổ, tối đa 3 hints, tutorial/retry/reward.         |
| A6c   | Sơn Trà observation | Tìm đủ 3 dấu vết, thông điệp không săn đuổi động vật, tutorial/retry/reward. |

O0 lần lượt tích hợp mỗi scene qua canonical reward/unlock; sau đó thêm passport, four memory fragments và ending. A3 chạy regression sau mỗi merge, không đợi cuối batch.

**G4 PASS:** bốn quest không placeholder, có flow giới thiệu–tutorial–feedback–retry–win–reward–postcard–autosave, một lượt chơi hợp lý 10–15 phút.

### M5 — Firebase persistence

| Task                             | Owner | Acceptance                                                                             |
| -------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| M5.1 Anonymous auth and emulator | A4    | Client login anonymous và emulator development config hoạt động.                       |
| M5.2 Firestore state store       | A4    | Save/load GameState, debounce player position, merge semantics theo ADR được O0 duyệt. |
| M5.3 Security rules              | A4    | Unauthenticated deny, same uid allow, cross-uid deny, malformed payload deny.          |
| M5.4 Offline fallback            | A4    | Firestore lỗi vẫn chơi/save local; reconnect có đường sync kiểm soát được.             |

**G5 PASS:** refresh/đổi tab vẫn giữ progress; dữ liệu A/B tách biệt; emulator rules tests pass; fallback đã được demo.

### M6 — Recommendation path

Starter là product path bắt buộc trước:

1. A5 tạo backend endpoint authenticated để lọc curated recommendation theo preference.
2. A7 làm PlaceCard, Maps URL, attribution/source và retry/fallback UI.
3. A1 kiểm tra nội dung/Maps URL/attribution của curated cards.
4. Không hiển thị rating, review, hours hoặc photo động ở Starter.

Nhánh Standard chỉ được chuẩn bị qua interface/mock. Sau human approval D-002, A5 mới triển khai Places Text Search/Details/Photo proxy, field mask tối thiểu, 3–5 kết quả, Google branding/photo attribution và test “only placeId persists”.

**G6 PASS Starter:** preference trả curated results hữu ích và mở Maps URL; không có dữ liệu Places bị giả là dữ liệu động.  
**G6 PASS Standard (nếu đã duyệt):** APIs, attribution, policy và persistence contract đạt yêu cầu.

### M7 — Gemini

| Task                     | Owner   | Acceptance                                                                                             |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| M7.1 Server boundary     | A5      | Firebase token verification, request id, body limit, rate limit by uid + IP, redacted structured logs. |
| M7.2 Dragon chat/hint    | A5 + A7 | Gemini Interactions API server-side, Zod parse, one retry, authored fallback và UI error state.        |
| M7.3 Food recommendation | A5 + A7 | Starter uses curated function/adapter; Standard function calling only calls whitelist search_places.   |
| M7.4 Itinerary           | A5 + A7 | Structured itinerary uses unlocked postcards/preference only; language VI/EN; no game mutation.        |

O0 phải quyết định một GEMINI_MODEL config source sau khi xác minh official docs, vì blueprint nêu hai model ở hai mục khác nhau.

**G7 PASS:** API timeout/schema failure không treo game; model không thể đổi quest/reward/score; client bundle không có server secret.

### M8 — Polish, accessibility, analytics and legal pages

- A7 hoàn thiện mute, fullscreen, language, focus trap, keyboard navigation, alt/aria, safe area và layout 390×844/1366×768.
- A7/A8 map analytics không PII: game_start, language_selected, quest_start/complete, postcard_open, place_card_open, google_maps_open, food_preferences_submitted, itinerary_created, game_complete.
- A8 viết Privacy, Terms, attribution policy và known limitation hiện hành.

**G8 PASS:** game hoàn thành không cần audio; no input trap; responsive screenshots và a11y checks có evidence.

### M9 — Test, hardening and performance

A3 dẫn nhưng không tự đánh dấu release ready:

1. Hoàn thiện unit/integration/E2E/visual matrix C4.
2. Kiểm tra E2E bridge không vào production.
3. Dependency/secret scan, CSP/same-origin/API error hygiene.
4. Review lazy loading assets, size, WebP/OGG, first playable mobile 4G.
5. O0 chạy full verify, E2E và review evidence độc lập.

**G9 PASS:** npm run verify và test:e2e pass, no unexplained high severity issue, no secret, visual QA complete.

### M10–M11 — Release and submission

| Gate                    | Owner      | Human action boundary                                                                                                                |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| G10 Publish preparation | O0 + A8    | Người dùng login/2FA, duyệt Starter eligibility hoặc Standard billing/IAM/quota, cung cấp secrets qua secure channel.                |
| G10 Production deploy   | O0 + human | AI Studio Starter first; Standard Cloud Run only after approval. Public URL cần người dùng duyệt.                                    |
| G10 Smoke               | A3 + O0    | Incognito: title/assets/auth, Dragon Bridge + refresh, recommendation/Maps, Gemini VI/EN, itinerary, logs redacted.                  |
| G11 Submission          | A8 + O0    | README setup/architecture/API/test/deploy, demo script 3 phút, video backup, pitch/slides, public URL, known limitations/cost notes. |

## 7. Mẫu giao việc và bàn giao bắt buộc

### Task card do O0 phát hành

```text
Task ID:
Milestone / gate:
Goal:
Allowed files:
Forbidden files:
Input contracts and dependencies:
Acceptance criteria:
Required narrow tests:
Required evidence:
Escalate immediately if:
```

### Handoff do worker trả về

```text
Task ID:
Status: READY | REVIEW | BLOCKED
Summary:
Files changed:
Contract assumptions:
Commands run and exact results:
Evidence paths / screenshots:
Known limitations or regression risk:
Needs O0 decision:
```

Worker không ghi PASS cho milestone. O0 chỉ chấp nhận handoff khi có file path, command output, test result và evidence tương ứng. QA A3 xác nhận độc lập khi task có user flow, persistence, API hoặc visual impact.

## 8. Decision log và escalation

| ID    | Quyết định                     | Owner                  | Mặc định / deadline                                                                                                                                                                            |
| ----- | ------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Shell và dependency ownership  | O0                     | Ưu tiên PowerShell native; user cho phép WSL fallback nếu native không thành công. Hiện evidence là WSL Node 24; native PowerShell vẫn cần output thật trước khi tuyên bố đã xác nhận Windows. |
| D-002 | Starter hay Standard           | O0 + user              | Starter đã chọn trong STATUS; Standard chỉ sau billing/quota approval.                                                                                                                         |
| D-003 | Git source-of-truth/remote     | O0 + user nếu không rõ | Chặn push/deploy cho đến khi xác nhận.                                                                                                                                                         |
| D-004 | Asset license/rights           | A1 + user              | Placeholder hợp lệ cho development; release cần source/license được duyệt.                                                                                                                     |
| D-005 | Gemini model name/availability | O0 + A5                | Một env/config source sau khi kiểm tra official docs trước integration/deploy.                                                                                                                 |
| D-006 | Places photo endpoint          | O0 + A5                | Chuẩn hóa: có authenticated proxy Standard-only hoặc không expose nếu chưa dùng.                                                                                                               |
| D-007 | Firestore conflict merge       | O0 + A4                | Viết ADR và test trước M5; không tự suy đoán field-level merge.                                                                                                                                |

Escalate ngay thay vì tự quyết khi cần billing, consent, credentials, IAM, copyright, public release, thay đổi stack, thêm dependency major, hoặc có policy/privacy uncertainty. Lỗi implementation nhỏ phải được worker tự xử lý trong scope.

## 9. Definition of done do O0 xác nhận

- Public Cloud Run URL mở không cần đăng nhập ngoài anonymous game auth.
- Bốn quest hoàn chỉnh, sourced postcard VI/EN, keyboard và touch.
- Save/load có Firebase + local fallback; isolation/rules được test.
- Starter curated path hoặc Standard Places path đúng track, Maps URL/attribution/persistence policy đúng.
- Gemini chat/recommendation/itinerary có schema, rate-limit, timeout/retry và fallback; không điều khiển game state.
- Không có secret trong source hoặc client build.
- Full verification, E2E, visual QA và production smoke có evidence.
- README, privacy/terms, setup/deploy/test, demo 3 phút, video backup, limitations và quota/cost notes hoàn chỉnh.

## 10. Bước chạy ngay

O0 chỉ mở task P0.1–P0.5. Khi G0 PASS, mở W1 cho A1 và A3; A2 chỉ bắt đầu M2 sau G1. Không mở bất kỳ task M4, Firebase production, Places production, Gemini production hoặc deploy công khai trước các gate phụ thuộc và human checkpoint tương ứng.
