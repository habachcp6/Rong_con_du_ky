# Handoff local release candidate

## Đã có trong workspace

- Phaser 4 + React + TypeScript + Vite frontend, Fastify backend cùng service.
- Mười quest deterministic theo thứ tự, V1→V2 migration, local-first save và Firebase mirror/rules emulator tùy cấu hình.
- Starter curated recommendations + Google Maps URLs; Standard Places chủ động trả `501`.
- Gemini Interactions boundary server-side, Zod, timeout/retry, semantic locked-stop guard và authored fallback.
- Privacy/Terms, accessibility baseline, pitch source, demo script và submission checklist.

## Xác minh trước release

### Native Windows PowerShell — evidence Windows-authoritative

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

`verify` không chạy Firebase Emulator, nên `npm run test:rules` trong block trên là gate bắt buộc chứ không phải bước tùy chọn. `run-native-docker-e2e.ps1` ép `VITE_ENABLE_E2E_BRIDGE=false`, same-origin `/api`, local Firebase fallback và xóa Gemini/Maps key kế thừa trước khi build Compose; vì vậy Playwright host-side desktop + mobile không thể gọi provider hay emulator từ `.env`. Firebase/live-provider smoke là evidence opt-in riêng. `test:e2e:bridge` chỉ là development-only reducer check; không dùng nó làm Docker release evidence. `verify` cũng build client và quét artifact để cấm `__GAME_TEST__` cùng marker credential.

### WSL/Linux — alternative đã được operator cho phép

WSL evidence phải chạy từ Linux Node 24 với `node_modules` Linux riêng; không dùng
chung `node_modules` của PowerShell. Chạy:

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

Runner Bash giữ isolation production giống runner Windows, chạy Playwright
desktop + mobile với một worker, và ghi health/Compose/HTML report/screenshot/
trace/video tại `test-results/wsl-docker-e2e/<UTC-timestamp>-<pid>/`. Nó kiểm
tra `docker info` trước khi start Compose. Nếu daemon không có ở distro hiện
tại, nó dừng và lưu `docker-daemon-diagnostic.txt`; không tự chuyển Docker
context hoặc sửa Docker Desktop integration. Bundle WSL không thay thế hoặc
được ghi là Windows-native evidence; runner PowerShell vẫn giữ gate `win32`
riêng.

`test:firebase:browser` cần Auth/Firestore Emulator và Vite chạy với dummy emulator-only config; nó là bằng chứng local browser integration, không phải production Firebase evidence.

## Smoke production artifact local

Sau `npm run build`, khởi động Fastify với `NODE_ENV=production` rồi xác minh bằng PowerShell native:

```powershell
$env:NODE_ENV = "production"
$env:PORT = "8080"
npm start
# Trong PowerShell khác:
Invoke-WebRequest http://127.0.0.1:8080/api/health
Invoke-WebRequest http://127.0.0.1:8080/
Invoke-WebRequest http://127.0.0.1:8080/privacy
```

Expected: health JSON 200, shell SPA 200 ở `/` và `/privacy`, header CSP/nosniff/frame denial. Điều này là local artifact smoke, **không phải** Cloud Run production smoke.

## Handoff cần owner

1. Xác nhận repository remote/source-of-truth và commit/push policy.
2. Duyệt asset rights, Google project/region, public access và cost/billing boundary.
3. Cung cấp Firebase web config và Gemini secret qua kênh an toàn; không chat/commit secret.
4. Chọn AI Studio Starter nếu eligible; nếu không, phê duyệt Standard Cloud Run theo [DEPLOYMENT.md](DEPLOYMENT.md).
5. Sau deploy, cập nhật [STATUS.md](STATUS.md) và [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) bằng URL + evidence thật.
