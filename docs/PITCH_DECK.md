# Pitch deck 7 slide — Rồng Con Du Ký

Tài liệu này là nội dung nguồn cho deck 5–7 slide. Dùng đúng bảy slide dưới đây; không chèn ảnh, số liệu hoặc URL production chưa được xác minh.

## Slide 1 — Rồng Con Du Ký: khám phá Đà Nẵng qua chơi ngắn

- Web game pixel Việt–Anh cho hành trình 10–15 phút.
- Người chơi là Rồng Con; mục tiêu là gom mười Mảnh Ký Ức qua mười địa danh thay vì chỉ đọc một danh sách địa danh.
- Câu hỏi mở đầu: làm sao để một chuyến đi Đà Nẵng vừa đáng nhớ, vừa có nguồn nội dung và vẫn chơi được khi dịch vụ AI vắng mặt?

Visual: title screen desktop hoặc mobile từ Playwright evidence.

## Slide 2 — Core loop có thể demo trong ba phút

`Khám phá icon landmark → panel thử thách → mini-game deterministic → postcard có source ID → passport → lịch trình chỉ từ điểm đã mở khóa`

- Cầu Rồng: nhịp đèn, cần 7/10 trong 60 giây.
- Mỹ Khê: dọn 8 vật thể trong 60 giây.
- Ngũ Hành Sơn: chuỗi năm nguyên tố, tối đa ba hint.
- Sơn Trà: quan sát ba dấu vết, không cổ vũ đuổi động vật.
- Sáu điểm tiếp theo: Cầu Sông Hàn, Linh Ứng, Bảo tàng Chăm, Non Nước, Chợ Hàn và Bà Nà đều có game riêng.

Visual: một postcard, Passport 10 stamp và một mini-game.

## Slide 3 — AI là người đồng hành, không phải game master

- Phaser 4 giữ toàn bộ luật quest, reward, điểm và transition deterministic.
- React cung cấp dialogue, Passport, Companion và accessibility; Fastify là same-origin API trong cùng Cloud Run service.
- Gemini chỉ trả dialogue/hint/lịch trình có schema; response vi phạm schema hoặc thêm điểm chưa mở khóa sẽ retry một lần rồi fallback authored.
- `GEMINI_API_KEY` chỉ ở server; kiểm tra production bundle chặn key và `__GAME_TEST__` khỏi client artifact.

Visual: sơ đồ trong [ARCHITECTURE.md](ARCHITECTURE.md).

## Slide 4 — Du lịch có nguồn và có fallback

- Track Starter hiện dùng curated place cards + Google Maps URLs, không lưu rating, review, giờ mở cửa hay ảnh Places.
- Mỗi fact/card có source ID; nội dung Việt–Anh được kiểm tra parity.
- Firebase Anonymous Auth + Firestore là mirror tùy cấu hình; localStorage luôn giữ game chơi/lưu được khi offline.
- Companion vẫn trả itinerary authored khi API hoặc credential không sẵn sàng.

Visual: Journey Companion, source ID và nút Google Maps.

## Slide 5 — Tin cậy, bao gồm và quyền riêng tư

- Keyboard: WASD/arrows, E/Space, Escape; mobile: joystick và nút tương tác.
- Modal hỗ trợ focus initial, Tab/Shift+Tab cyclic, Escape và focus return; giao diện có kiểm tra 1366×768 và 390×844.
- Privacy/Terms public routes; analytics hiện là seam in-memory đã sanitize, không gửi PII, chat hay GPS.
- Asset hiện là placeholder do đội tạo: chỉ phát hành sau khi chủ sở hữu duyệt quyền dùng.

Visual: mobile Companion và trang Privacy.

## Slide 6 — Bằng chứng local và giới hạn phải nói thẳng

- Bộ verify, Firestore Rules Emulator, browser E2E, E2E bridge dev-only và production-artifact smoke đều phải được chạy trước demo.
- Các quest individual có keyboard/touch evidence; bridge chỉ kiểm tra reducer/quest graph, không thay thế gameplay black-box.
- Phaser chunk còn lớn; cần đo first-playable trên mạng mobile thật trước khi công bố KPI hiệu năng.
- Chưa có URL public, Firebase production browser smoke hoặc Gemini live evidence nếu owner chưa cấu hình Google/Firebase/secrets.

Visual: bảng ngắn từ [STATUS.md](STATUS.md), không đổi BLOCKED thành PASS trong deck.

## Slide 7 — Lời mời demo và release gate

- Demo: hoàn thành Cầu Rồng, xem postcard/source, mở Companion fallback, rồi Passport/ending.
- Public Cloud Run URL: **điền sau** khi owner duyệt project, IAM/billing (nếu cần), Firebase, Secret Manager, asset rights và public access.
- Fallback phát hành: nếu AI Studio Starter không eligible, chỉ chuyển Standard Cloud Run sau phê duyệt chi phí/quota.
- Handoff đầy đủ: [DEPLOYMENT.md](DEPLOYMENT.md), [VIDEO_BACKUP.md](VIDEO_BACKUP.md), [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md).

## Ghi chú nói trong 60–90 giây

Không nói rằng Gemini “điều khiển game”, rằng thẻ Starter là Places live, hoặc rằng dự án đã public khi không có URL. Nếu demo dùng fallback, hãy nói đó là hành vi có chủ đích: hành trình vẫn hữu ích và không bịa thông tin khi provider không phản hồi.
