# Video backup và bằng chứng quay màn hình

## Hai artifact khác nhau

1. **Technical capture local**: Playwright quay lại Cầu Rồng bằng input thật, retry, reward, postcard và refresh. Đây là bằng chứng hồi quy có thể tái lập, không phải video pitch 3 phút để nộp.
2. **Video demo/pitch 3 phút**: cần người dẫn chuyện, visual đã duyệt quyền và URL public nếu yêu cầu submission. Chưa được đánh dấu hoàn tất khi các điều kiện release chưa có.

## Tạo technical capture

Từ **Windows PowerShell native** đã cài Chromium, chạy:

```powershell
Set-Location "D:\Hackthon-GG2026"

if ((node -p "process.platform").Trim() -ne "win32") {
  throw "Phải chạy bằng Node native Windows."
}

npm run test:e2e:record
```

Video WebM được Playwright lưu dưới `test-results/playwright/**/video.webm`; thư mục này bị Git ignore vì là evidence tái tạo được. Lệnh chỉ bật video cho một journey desktop black-box; không bật E2E bridge.

Khi operator cho phép WSL/Linux, có thể chạy cùng lệnh bằng Linux Node 24 và
Chromium Linux đã cài, với `node_modules` Linux riêng. Capture này vẫn chỉ là
technical capture bổ sung; Docker release evidence phải đến từ
`run-wsl-docker-e2e.sh` trong bundle shell-specific, không phải từ root
`test-results/playwright/`.

## Evidence local lịch sử

Ngày 2026-08-03, lệnh đã PASS trên local release candidate. Artifact hiện có tại `test-results/playwright/dragon-bridge-journey-Drag-ce566--the-postcard-after-refresh-chromium-desktop/video.webm` (1,524,690 bytes). Đây là output local bị Git ignore; hãy chạy lại lệnh trước khi chia sẻ để tạo artifact tương ứng với commit/release candidate được duyệt.

Không dùng lại artifact WSL lịch sử cho campaign V2. Khi runner native hoặc WSL
được chạy lại cho commit hiện tại, lưu timestamp và đường dẫn video/report trong
bundle tương ứng (`native-docker-e2e/` hoặc `wsl-docker-e2e/`); không gắn nhãn
bundle WSL là evidence Windows-native.

## Shot list video demo 3 phút

| Mốc       | Khung hình                                         | Câu nói cần kiểm chứng                                                |
| --------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| 0:00–0:25 | Title, đổi ngôn ngữ, keyboard/touch                | Mười quest, hành trình ngắn và không bắt buộc âm thanh.               |
| 0:25–1:20 | Cầu Rồng: đi, dialogue, fail/retry, thắng          | Rule 7/10, reward deterministic, postcard có source ID.               |
| 1:20–2:05 | Sáu quest V2, Passport 10/10 và ending             | Nội dung học qua hành động, không ép người chơi đuổi động vật.        |
| 2:05–2:40 | Companion, curated card, Maps link, fallback       | Starter curated, nguồn rõ ràng và fallback authored.                  |
| 2:40–3:00 | Privacy/Terms, `/api/health`, Cloud Run URL nếu có | Key server-side, persistence fallback và trạng thái deploy chính xác. |

Kịch bản lời nói chi tiết nằm ở [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## Gate trước khi dùng video để submit

- Đã có quyền dùng mọi ảnh/nhạc/voice xuất hiện trong bản quay.
- Không lộ `.env`, key, token, UID thật, console log nhạy cảm hay cửa sổ quản trị.
- Nếu không có public URL, caption phải ghi “local technical demo”; không ám chỉ Cloud Run đã publish.
- Nếu có URL public, quay lại một pass incognito và lưu URL/timestamp/screenshot đã sanitize trong `STATUS.md`.
- Xuất bản MP4/WebM theo rule cuộc thi; chỉ thêm file video vào submission khi owner xác nhận quyền và dung lượng.
