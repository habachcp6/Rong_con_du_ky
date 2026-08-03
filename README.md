# Rồng Con Du Ký — Dấu Ấn Đà Nẵng

Web game pixel song ngữ Việt–Anh cho một hành trình Đà Nẵng 10–15 phút. Người chơi điều khiển Rồng Con qua Cầu Rồng, biển Mỹ Khê, Ngũ Hành Sơn và Sơn Trà; mỗi quest mở một Mảnh Ký Ức, bưu thiếp có nguồn và một điểm dừng cho lịch trình.

Track hiện tại là **Starter Tier**: gợi ý ẩm thực dùng thẻ địa điểm đã biên tập và Google Maps URLs. Không có Places rating, review, giờ mở cửa hoặc ảnh Places được lưu/hình thành trong app.

## Trạng thái phát hành

- Local MVP: hoàn chỉnh bốn quest, local-first save, Firebase adapter, Fastify API, Gemini fallback, legal pages và test harness.
- Public Cloud Run URL: **chưa có**. Cần người dùng đăng nhập Google, chọn Starter/Standard, cấu hình Firebase và cho phép public deployment.
- Môi trường đã xác minh trong lần triển khai này: WSL fallback + Node 24.18.1. Chưa có bằng chứng chạy native Windows PowerShell; xem `scripts/bootstrap-windows.ps1` để thực hiện pass đó.

## Kiến trúc

| Layer                     | Vai trò                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| React + TypeScript + Vite | Header, dialogue, passport, postcard, Journey Companion, Privacy/Terms và accessibility UI.                                            |
| Phaser 4                  | Overworld, va chạm, bàn phím/touch joystick và bốn mini-game deterministic.                                                            |
| Shared domain             | Quest graph `LOCKED → AVAILABLE → ACTIVE → COMPLETED → REWARDED`; Gemini không thể thay đổi state/reward/score.                        |
| Fastify                   | Same-origin `/api`, Firebase token verification, body/rate limits, Starter recommendations, Gemini Interactions API và fallback typed. |
| Firebase                  | Anonymous Auth + Firestore mirror tùy cấu hình; localStorage luôn là fallback first.                                                   |
| Cloud Run                 | Một service phục vụ cả API và `dist/` frontend sau build.                                                                              |

Sơ đồ và quyết định kỹ thuật nằm ở [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Theo dõi milestone ở [docs/STATUS.md](docs/STATUS.md).

## Chạy local

### Windows PowerShell — đường ưu tiên

Mở **PowerShell native** tại repository và bảo đảm Node 24 LTS:

```powershell
node -v
npm ci
npx playwright install chromium
Copy-Item .env.example .env
npm run dev
```

Mở `http://localhost:5173`. Vite proxy `/api` sang Fastify tại `http://127.0.0.1:8080`.

Nếu Node/Firebase/gcloud chưa cài, script hỗ trợ kiểm tra và bootstrap PowerShell là:

```powershell
.\scripts\bootstrap-windows.ps1
```

Không dùng chung `node_modules` giữa PowerShell và WSL.

### WSL fallback đã được cho phép

Chỉ dùng khi pass PowerShell không thực hiện được. Từ WSL, dùng Node 24 và dependencies cài trong chính WSL. Trong workspace hiện tại, Node đã dùng là `/home/bach/.local/node-v24.18.1/bin/node`.

```bash
export PATH=/home/bach/.local/node-v24.18.1/bin:$PATH
npm ci
npx playwright install chromium
cp .env.example .env
npm run dev
```

## Cấu hình môi trường

Sao chép `.env.example` thành `.env`; không commit file này. Các giá trị cần chú ý:

- `GEMINI_API_KEY`: chỉ có ở backend/Secret Manager. Bỏ trống vẫn cho fallback authored.
- `GEMINI_MODEL`: mặc định `gemini-3.6-flash` từ một nguồn config.
- `VITE_FIREBASE_*`: Firebase web config; khi thiếu, game vẫn local-first.
- `VITE_USE_FIREBASE_EMULATORS=true`, `VITE_FIREBASE_AUTH_EMULATOR_URL`, `VITE_FIREBASE_FIRESTORE_EMULATOR_*`: chỉ local development.
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`: cần trên Fastify khi test token Auth Emulator.
- `ALLOW_LOCAL_AUTH=true`: dev/test shim duy nhất; Fastify tự vô hiệu hóa trong `NODE_ENV=production`.

Bật **Anonymous sign-in** và Firestore trước khi dùng Firebase thật. Firebase CLI đã là dev dependency; cần JDK 17/21 để chạy emulator. Có thể mở emulator thủ công:

```powershell
firebase emulators:start --only auth,firestore
```

Rules ở `firestore.rules` owner-scope UID, chặn collection listing, kiểm tra shape, postcard/reward correspondence và transition graph. Local offline progress có thể được import khi document lần đầu tạo; game không có leaderboard hoặc tài sản có giá trị nên Firestore không được xem là anti-cheat boundary.

## Kiểm tra

```bash
npm run verify
npm run test:rules
npm run test:e2e
npm run test:e2e:bridge
npm run test:e2e:record
```

With Auth and Firestore emulators running and Vite started using the emulator-only values in `.env.example`, run `npm run test:firebase:browser`. It verifies the browser reaches `Đã đồng bộ`/`Synced`, observes successful Auth and Firestore emulator responses, and reports browser errors. It does not replace production Firebase smoke.

`verify` chạy TypeScript, Oxlint, Vitest unit suite, content/assets validators, Vite build, server TypeScript và quét browser bundle để cấm test bridge/marker credential. `test:rules` tự khởi động Auth + Firestore Emulator với demo project cục bộ và kiểm tra owner-only access, cấm listing/cross-UID, schema và lifecycle reward; không cần Firebase project thật. `test:e2e` kiểm tra desktop/mobile title, keyboard, bridge guard, retry/reward/refresh của Cầu Rồng, ba quest còn lại, passport/ending và fallback Journey Companion. `test:e2e:bridge` chỉ bật automation reducer trong Vite development; `test:e2e:record` tạo technical video evidence local, không thay thế video pitch.

Trong WSL hiện tại, Chromium cần thư viện đã provision và thư mục temp Linux:

```bash
export PATH=/home/bach/.local/node-v24.18.1/bin:$PATH
export TMPDIR=/tmp TEMP=/tmp TMP=/tmp
export LD_LIBRARY_PATH=/tmp/gg2026-playwright-libs/root/usr/lib/x86_64-linux-gnu
npm run test:e2e
```

Để test production artifact thay vì Vite:

```bash
npm run build
NODE_ENV=production PORT=8080 npm start
curl -i http://127.0.0.1:8080/api/health
```

## Content, attribution và privacy

- `content/locations.{vi,en}.json`, `content/dialogue.{vi,en}.json` và `content/curated-places.json` là các nguồn canonical.
- Mọi fact/travel card có source ID; registry và asset attribution ở [content/sources.md](content/sources.md).
- Asset hiện tại là placeholder pixel-art do đội tạo; phải được duyệt quyền trước release nếu thay thế/bổ sung.
- Trang public: `/privacy` và `/terms`; bản Markdown nguồn tương ứng ở `docs/PRIVACY.md` và `docs/TERMS.md`.
- Analytics chỉ phát custom event đã sanitize trong bộ nhớ trình duyệt; không có provider, PII, nội dung chat hoặc GPS được gửi trong MVP này.

## Chuẩn bị Cloud Run

Dockerfile đã là multi-stage, chạy `npm run build`, rồi chỉ mang runtime dependencies, `build/`, `dist/` và canonical `content/` sang image. Cục bộ:

```bash
docker build -t rong-con-du-ky .
docker run --rm -p 8080:8080 -e NODE_ENV=production rong-con-du-ky
```

Không tự deploy hay bật billing. Sau khi người dùng đăng nhập/duyệt project, vùng, quota, secrets và public access, ưu tiên AI Studio Starter Tier theo [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Nếu Starter không đủ điều kiện, Standard Cloud Run là fallback có kiểm soát chi phí (`min-instances=0`, budget alert, quota).

## Demo và submission

Kịch bản demo 3 phút: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Deck 7 slide: [docs/PITCH_DECK.md](docs/PITCH_DECK.md). Technical video/pitch boundary: [docs/VIDEO_BACKUP.md](docs/VIDEO_BACKUP.md). Checklist/link nộp bài: [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md). Known limitations, evidence và blocker deploy: [docs/STATUS.md](docs/STATUS.md).
