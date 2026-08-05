# Rồng Con Du Ký — Dấu Ấn Đà Nẵng

Web game pixel song ngữ Việt–Anh cho hành trình khám phá 10 danh thắng Đà Nẵng, 10 trò chơi deterministic, 12 thẻ ẩm thực biên tập, Thư viện danh thắng và gợi ý lịch trình. Mỗi địa danh có một icon pixel riêng, một postcard tối giản, một thử thách và đúng một Mảnh Ký Ức.

Track hiện tại là **Starter Tier**: gợi ý ẩm thực dùng thẻ địa điểm đã biên tập và Google Maps URLs. Không có Places rating, review, giờ mở cửa hoặc ảnh Places được lưu/hình thành trong app.

## Trạng thái phát hành

- Campaign V2 đã được tích hợp: 10 landmark quest theo thứ tự, migration save V1→V2, 10 icon/map postcard, 12 food cards, Firebase adapter, Fastify API, Gemini fallback và legal pages.
- Runner PowerShell native (`scripts/run-native-docker-e2e.ps1`) vẫn là evidence Windows-authoritative. Khi operator cho phép WSL/Linux, dùng riêng `scripts/run-wsl-docker-e2e.sh`; bundle `wsl-docker-e2e/` phải luôn được ghi nhận là evidence Linux/WSL, không gắn nhãn native Windows.
- Public Cloud Run URL: **chưa có**. Cần người dùng đăng nhập Google, chọn Starter/Standard, cấu hình Firebase và cho phép public deployment.

## Kiến trúc

| Layer                     | Vai trò                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| React + TypeScript + Vite | Header, dialogue, passport, postcard, Journey Companion, Privacy/Terms và accessibility UI.                                            |
| Phaser 4                  | Overworld, va chạm, bàn phím/touch joystick và mười mini-game deterministic.                                                           |
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

### WSL/Linux — fallback cô lập

Khi operator cho phép chạy release gate từ WSL/Linux, dùng Node 24 và
`node_modules` Linux riêng (tốt nhất là WSL checkout riêng, hoặc chạy lại
`npm ci` sau khi chuyển shell). Runner không thay đổi Docker Desktop, Docker
context hay WSL integration. Nếu Docker daemon chưa được expose cho distro đang
chạy, runner dừng trước `compose up` và lưu diagnostic thay vì thử workaround.

```bash
node -p 'process.platform' # phải là linux
node -v                    # phải là 24.x
npm ci
npx playwright install chromium
npm run verify
npm run test:rules
./scripts/run-wsl-docker-e2e.sh
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

Rules ở `firestore.rules` owner-scope UID, chặn collection listing, kiểm tra shape, postcard/reward correspondence và transition graph. Lần tạo document chỉ nhận frontier khởi tạo 10 quest; V1 Firestore đã tồn tại vẫn được nâng lên V2 theo transition hợp lệ. Local progress đã có nhưng chưa có document cloud vẫn tiếp tục chạy local-first thay vì bị upload như một ending giả. Game không có leaderboard hoặc tài sản có giá trị nên Firestore không được xem là anti-cheat boundary.

## Kiểm tra

```powershell
npm run verify
npm run test:rules
npm run test:e2e
npm run test:e2e:bridge
npm run test:e2e:record
```

With Auth and Firestore emulators running and Vite started using the emulator-only values in `.env.example`, run `npm run test:firebase:browser`. It verifies the browser reaches `Đã đồng bộ`/`Synced`, observes successful Auth and Firestore emulator responses, and reports browser errors. It does not replace production Firebase smoke.

`verify` chạy TypeScript, Oxlint, Vitest unit suite, content/assets validators, Vite build, server TypeScript và quét browser bundle để cấm test bridge/marker credential. `test:rules` tự khởi động Auth + Firestore Emulator với demo project cục bộ và kiểm tra owner-only access, cấm listing/cross-UID, schema và lifecycle reward; không cần Firebase project thật. `test:e2e` kiểm tra desktop/mobile cho 10 icon landmark, panel, game, retry/reward/postcard, Passport 10/10 và fallback Journey Companion. `test:e2e:bridge` chỉ bật automation reducer trong Vite development; không dùng cho production Docker validation.

Để test production artifact thay vì Vite:

```powershell
npm run build
$env:NODE_ENV = "production"
$env:PORT = "8080"
npm start
# Trong PowerShell khác:
Invoke-WebRequest http://127.0.0.1:8080/api/health
```

## Content, attribution và privacy

- `content/locations.{vi,en}.json`, `content/dialogue.{vi,en}.json` và `content/curated-places.json` là các nguồn canonical.
- Mọi fact/travel card có source ID; registry và asset attribution ở [content/sources.md](content/sources.md).
- Asset hiện tại là placeholder pixel-art do đội tạo; phải được duyệt quyền trước release nếu thay thế/bổ sung.
- Trang public: `/privacy` và `/terms`; bản Markdown nguồn tương ứng ở `docs/PRIVACY.md` và `docs/TERMS.md`.
- Analytics chỉ phát custom event đã sanitize trong bộ nhớ trình duyệt; không có provider, PII, nội dung chat hoặc GPS được gửi trong MVP này.

## Chuẩn bị Cloud Run

Dockerfile đã là multi-stage, chạy `npm run build`, rồi chỉ mang runtime dependencies, `build/`, `dist/` và canonical `content/` sang image. Cục bộ:

```powershell
docker build -t rong-con-du-ky .
docker run --rm -p 8080:8080 -e NODE_ENV=production rong-con-du-ky
```

Đường release chính bằng Docker Compose là PowerShell native:

```powershell
npm run verify
npm run test:rules
.\scripts\run-native-docker-e2e.ps1
```

`verify` không khởi động Firebase Emulator; vì vậy `npm run test:rules` là bước bắt buộc riêng cho Rules. Runner chỉ chạy trong **PowerShell native**: nó kiểm tra `node -p process.platform` phải trả về `win32` và Node phải là `24.x` đúng với `package.json`, ép same-origin `/api`, tắt Firebase browser config/emulator và xóa Gemini/Maps key kế thừa trước khi build, đặt `APP_PORT=18080`, chờ `GET /api/health`, rồi chạy cả project Playwright desktop và mobile với một worker. Vì thế Docker gate kiểm tra deterministic authored fallback, không âm thầm gọi provider từ `.env`; Firebase/live-provider smoke là opt-in riêng. `health.json`, `docker-compose-ps.txt`, báo cáo HTML, screenshot, trace và video được thu thập tại `test-results/native-docker-e2e/<UTC-timestamp>/`. Runner không dừng Compose để có thể xem lại container và UI tại `http://127.0.0.1:18080/`; sau khi xem xong, chạy thủ công:

```powershell
docker compose ps
docker compose down
```

Mặc định image chạy authored fallback, không cần Gemini key hay Firebase production config. Nếu cần dùng một port khác, truyền `-HostPort 18081`; runner truyền giá trị đó qua `APP_PORT` và `PLAYWRIGHT_BASE_URL`.

Khi WSL/Linux đã được cho phép, chạy block WSL ở trên. `run-wsl-docker-e2e.sh`
ép cùng isolation và chạy desktop + mobile một worker, nhưng lưu evidence riêng
tại `test-results/wsl-docker-e2e/<UTC-timestamp>-<pid>/`; không dùng bundle đó
để tuyên bố native Windows pass. Nếu Docker daemon không có trong distro WSL,
đọc `docker-daemon-diagnostic.txt`, bật integration đúng ở Docker Desktop ngoài
project hoặc quay lại native runner; script không tự đổi context/integration.
Nếu muốn dùng Firebase web config, truyền các `VITE_FIREBASE_*` qua build args
trong file `.env` local; không commit file đó. Script smoke HTTP-only native
PowerShell vẫn là `./scripts/docker-smoke.ps1`.

Không tự deploy hay bật billing. Sau khi người dùng đăng nhập/duyệt project, vùng, quota, secrets và public access, ưu tiên AI Studio Starter Tier theo [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Nếu Starter không đủ điều kiện, Standard Cloud Run là fallback có kiểm soát chi phí (`min-instances=0`, budget alert, quota).

## Demo và submission

Kịch bản demo 3 phút: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Deck 7 slide: [docs/PITCH_DECK.md](docs/PITCH_DECK.md). Technical video/pitch boundary: [docs/VIDEO_BACKUP.md](docs/VIDEO_BACKUP.md). Checklist/link nộp bài: [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md). Known limitations, evidence và blocker deploy: [docs/STATUS.md](docs/STATUS.md).
