# Kịch bản demo 3 phút

## Trước khi trình diễn

1. Mở bản production hoặc `npm run dev`; xóa localStorage nếu cần bắt đầu mới.
2. Chuẩn bị viewport desktop 1366×768 và mobile 390×844.
3. Nếu Gemini/Firebase thật không được cấu hình, nói rõ demo đang hiển thị fallback authored—đó là product behavior, không phải lỗi giả lập.

## 0:00–0:25 — Lời hứa sản phẩm

Mở title, đổi Việt/Anh, chỉ controls keyboard/touch, mute/fullscreen. Nêu bốn địa danh, mục tiêu 10–15 phút và rằng không cần âm thanh để thắng.

## 0:25–1:20 — Gameplay và nguồn

Vào Overworld, tới Cầu Rồng bằng WASD, mở dialogue bằng E/Space, bắt đầu rhythm game và hoàn thành. Mở postcard, chỉ source ID, rồi mở Passport để chứng minh progress là deterministic.

## 1:20–2:05 — Ba quest còn lại

Tóm tắt hoặc chạy nhanh Mỹ Khê (8 vật thể/60 s), Ngũ Hành Sơn (5 nguyên tố, tối đa 3 hint), Sơn Trà (3 dấu vết, không đuổi động vật). Mở Passport bốn stamp và ending.

## 2:05–2:40 — Trợ lý và fallback

Mở Companion, lưu preference ẩm thực, hiển thị thẻ curated có source ID và mở Google Maps. Tạo itinerary để chứng minh chỉ điểm đã mở khóa xuất hiện. Tắt backend hoặc dùng local run không credential để hiển thị authored fallback vẫn chơi được.

## 2:40–3:00 — Kỹ thuật và deployment

Nêu Fastify giữ Gemini key server-side, Firebase anonymous/local fallback, security rules và Cloud Run một service. Mở `/privacy`/`/terms`. Nếu URL public đã có, chạy smoke bằng cửa sổ incognito; nếu chưa có, nêu chính xác human checkpoint deploy thay vì hứa URL.
