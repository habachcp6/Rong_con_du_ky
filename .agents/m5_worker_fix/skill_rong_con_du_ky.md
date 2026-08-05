---
name: rong-con-du-ky
description: "Skill hướng dẫn phát triển, kiến trúc, quy tắc game và quy trình kiểm thử cho dự án Rồng Con Du Ký (Phaser 4 + React + Fastify + Firebase + Gemini Interactions API)."
---

# Rồng Con Du Ký — Skill Hướng Dẫn Dự Án

Skill này lưu trữ toàn bộ nguyên tắc kiến trúc, quy trình phát triển, quy tắc bất biến, và bộ lệnh kiểm thử dành riêng cho dự án **Rồng Con Du Ký**.

---

## 1. Kiến Trúc Cố Định (Fixed Architecture)

- **Frontend**: Phaser 4 + React 19 + TypeScript + Vite.
- **Backend**: Fastify Node.js server (cùng repository & Cloud Run service).
- **Authentication & Database**: Firebase Anonymous Auth + Cloud Firestore.
- **AI Integration**: Gemini Interactions API (`@google/genai`) xử lý ở phía Server.
- **Google Maps & Places**:
  - *Starter Track*: Curated place cards + Google Maps URLs trực tiếp.
  - *Standard Track*: Places API (New) trên server.

> ⚠️ **Quy tắc cứng**: Không được tự ý thay đổi game engine (Phaser 4), framework (React/Fastify), hosting target (Cloud Run), hoặc data store (Firestore) nếu chưa có sự phê duyệt từ Lead.

---

## 2. Quy Tắc Hoạt Động & Phát Triển (Core Working Rules)

1. **Dragon Bridge Vertical Slice**:
   - Hoàn thành và kiểm thử toàn bộ tính năng ở vertical slice Cầu Rồng (Dragon Bridge) trước khi clone pattern sang các địa danh khác (10 landmarks, 12 food cards, 6 discovery POIs).
2. **Không commit secret**:
   - Tuyệt đối không commit file `.env`, service account JSON, API key, credentials hoặc dữ liệu cá nhân/phản hồi private của provider.
3. **Logic Game mang tính Quyết định (Deterministic Game Rules)**:
   - AI (Gemini) chỉ làm nhiệm vụ tương tác/nội dung; **Gemini không bao giờ tự ý thay đổi trạng thái quest, phần thưởng, đáp án hay điểm số của người chơi**.
4. **Xác thực Thông tin Du lịch (Curated Tourism Content)**:
   - Mọi thông tin/sự thật du lịch phải đi kèm một `source_id` được thẩm định.
5. **Quản lý Dữ liệu Google Places**:
   - Chỉ lưu vết `Place ID` trên Firestore/Database.
   - **Không lưu trữ (persist)** rating, review, giờ mở cửa, ảnh hoặc bất kỳ nội dung bị giới hạn nào của Google Places.
   - Hiển thị đầy đủ Google Maps URL và attribution tác giả ảnh/đánh giá theo quy định của Google Maps Platform.
6. **Xử lý Offline & Fallback**:
   - Luôn chuẩn bị sẵn authored offline fallbacks khi Gemini hoặc Places API gặp sự cố/quá tải.
7. **Đa nền tảng**:
   - Đảm bảo hỗ trợ đồng thời cả bàn phím (desktop) và cảm ứng (mobile touch).

---

## 3. Quy Trình Kiểm Thử & Xác Thực (Verification & Testing)

Mọi thay đổi code, API schema, chuyển đổi trạng thái (state transition), hoặc sửa lỗi đều phải có test tương ứng.

### Các Lệnh Kiểm Thử Chính:
- **Tập lệnh kiểm tra tổng thể (Bắt buộc chạy trước khi hoàn thành công việc)**:
  ```bash
  npm run verify
  ```
  *(Thực hiện lần lượt: `typecheck` -> `lint` -> `format:check` -> `test` -> `validate:content` -> `validate:assets` -> `build` -> `validate:client-build`)*

- **Kiểm thử Đơn vị & Integration**:
  ```bash
  npm run test
  ```

- **Kiểm thử Content & Assets**:
  ```bash
  npm run validate:content
  npm run validate:assets
  ```

- **Kiểm thử Rule Firebase**:
  ```bash
  npm run test:rules
  ```

- **Kiểm thử E2E & Smoke Test**:
  ```bash
  npm run test:e2e
  npm run test:e2e:bridge
  ```

---

## 4. Cấu Trúc Dự Án (Directory Layout Overview)

```
Hackthon-GG2026/
├── .agents/skills/       # Bộ skills dành riêng cho dự án (rong-con-du-ky, generate2dsprite, generate2dmap, video2dsprite)
├── content/              # Dữ liệu địa danh, câu hỏi, food cards, discovery POIs dạng JSON/curated
├── public/               # Static assets, audio, pixel art icons, sprite sheets
├── src/
│   ├── client/           # Phaser 4 scenes, React UI components, i18n, Canvas overlay
│   ├── server/           # Fastify routes, Gemini service, Google Places service, Auth middleware
│   └── shared/           # Types, schemas (Zod), constants, game state definitions
├── tests/                # Unit tests, E2E tests, rules test
├── scripts/              # Validation scripts (validate-content, validate-assets, client-build check)
└── Dockerfile            # Container build cho Cloud Run deployment
```

---

## 5. Danh Sách Sản Phẩm Handoff Yêu Cầu

Khi bàn giao tính năng hoặc phiên bản MVP Cloud Run, bắt buộc chuẩn bị:
1. Public Cloud Run URL.
2. Hướng dẫn thiết lập và triển khai (Setup & Deploy instructions).
3. Kết quả chạy thành công các lệnh verification (`npm run verify`).
4. Bằng chứng kiểm thử thực tế (Production smoke-test evidence).
5. Ghi chú về giới hạn kỹ thuật, chi phí và hạn ngạch API (Cost/quota notes).
