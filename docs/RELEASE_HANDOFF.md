# Handoff local release candidate

## Đã có trong workspace

- Phaser 4 + React + TypeScript + Vite frontend, Fastify backend cùng service.
- Bốn quest deterministic, local-first save và Firebase mirror/rules emulator tùy cấu hình.
- Starter curated recommendations + Google Maps URLs; Standard Places chủ động trả `501`.
- Gemini Interactions boundary server-side, Zod, timeout/retry, semantic locked-stop guard và authored fallback.
- Privacy/Terms, accessibility baseline, pitch source, demo script và submission checklist.

## Xác minh trước release

```bash
npm run verify
npm run test:rules
npm run test:e2e
npm run test:e2e:bridge
npm run test:e2e:record
```

`test:e2e:bridge` chỉ bật dev flag cho reducer graph; `test:e2e` và technical capture giữ black-box input thật. `verify` cũng build client và quét artifact để cấm `__GAME_TEST__` cùng marker credential.

## Smoke production artifact local

Sau `npm run build`, khởi động Fastify với `NODE_ENV=production` rồi xác minh:

```bash
NODE_ENV=production PORT=8080 npm start
curl -i http://127.0.0.1:8080/api/health
curl -i http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/privacy
```

Expected: health JSON 200, shell SPA 200 ở `/` và `/privacy`, header CSP/nosniff/frame denial. Điều này là local artifact smoke, **không phải** Cloud Run production smoke.

## Handoff cần owner

1. Xác nhận repository remote/source-of-truth và commit/push policy.
2. Duyệt asset rights, Google project/region, public access và cost/billing boundary.
3. Cung cấp Firebase web config và Gemini secret qua kênh an toàn; không chat/commit secret.
4. Chọn AI Studio Starter nếu eligible; nếu không, phê duyệt Standard Cloud Run theo [DEPLOYMENT.md](DEPLOYMENT.md).
5. Sau deploy, cập nhật [STATUS.md](STATUS.md) và [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) bằng URL + evidence thật.
