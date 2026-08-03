# Deployment runbook — Cloud Run

## Human checkpoints (không tự động vượt qua)

1. Người dùng đăng nhập Google/AI Studio hoặc gcloud và xác nhận project đúng.
2. Xác nhận Starter Tier eligibility. Nếu không đủ điều kiện, phê duyệt Standard project, billing, region, quota và budget alert.
3. Cấu hình Firebase Anonymous Auth + Firestore, kiểm tra `firestore.rules`, rồi truyền secrets qua Secret Manager hoặc môi trường an toàn—not chat/not Git.
4. Duyệt public access, asset rights và chi phí trước deploy.

## Preflight

```bash
npm ci
npm run verify
npm run test:rules
npm run test:e2e
npm run test:e2e:bridge
npm run validate:client-build
docker build -t rong-con-du-ky .
```

For a local browser Auth/Firestore smoke, start the Auth and Firestore
emulators, run Vite with the dummy emulator config from `.env.example`, then
run `npm run test:firebase:browser`. This must report `Đã đồng bộ`/`Synced`,
successful `:9099` and `:8080` responses, and no browser errors. It does not
replace a production Firebase project smoke.

`test:e2e:bridge` is development-only verification; the production client bundle check must still pass with the bridge absent. Run `npm run test:e2e:record` separately when technical video evidence is needed; it is not a release gate for a public URL.

Tạo secrets cho production: `GEMINI_API_KEY` (và chỉ Standard: `GOOGLE_MAPS_API_KEY`). Không bật `ALLOW_LOCAL_AUTH`; không đặt `VITE_USE_FIREBASE_EMULATORS=true`; không đưa service-account JSON vào image.

## Đường ưu tiên: AI Studio Starter

1. Push source-of-truth Git repository sau khi owner xác nhận remote.
2. Trong Google AI Studio Build mode, import GitHub repository.
3. Gắn Firebase/secrets bằng UI được cấp; sửa lỗi build nếu có trong Git source-of-truth, không để AI Studio và local diverge.
4. Publish only after user approval. Lưu cả `run.app` và `*.ai.studio` URL.

## Fallback: Standard Cloud Run

Sau approval, dùng service account/IAM tối thiểu và Secret Manager. Mẫu lệnh (thay biến thật, không copy secret vào shell history):

```bash
gcloud run deploy rong-con-du-ky \
  --source . \
  --region=REGION \
  --min-instances=0 \
  --allow-unauthenticated \
  --set-env-vars=NODE_ENV=production,GOOGLE_CLOUD_PROJECT=PROJECT_ID,GEMINI_MODEL=gemini-3.6-flash \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

Only add Places secret/API after switching from Starter with explicit billing and policy approval.

## Production smoke evidence

Use an incognito browser and capture: title/assets, anonymous Auth/local fallback, Dragon Bridge plus refresh, recommendations + Maps link, chat fallback/Gemini in VI/EN, locked-stop-safe itinerary, `/privacy`, `/terms`, and `GET /api/health`. Record command, URL, timestamp, and sanitized screenshot path in `docs/STATUS.md`.
