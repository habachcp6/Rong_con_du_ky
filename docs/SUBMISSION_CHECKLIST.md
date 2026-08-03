# Submission checklist — Rồng Con Du Ký

Trạng thái trong bảng là trạng thái release hiện tại, không phải checklist dự đoán. Owner chỉ tick các hàng external sau khi có evidence thật.

| Hạng mục                   | Trạng thái            | Evidence / hành động còn lại                                                                                                                                                             |
| -------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source local + lockfile    | READY local           | `package.json`, `package-lock.json`, `npm run verify`. Chưa có Git remote được owner xác nhận.                                                                                           |
| README / setup / deploy    | READY local           | [README.md](../README.md), [DEPLOYMENT.md](DEPLOYMENT.md).                                                                                                                               |
| 7-slide pitch source       | READY local           | [PITCH_DECK.md](PITCH_DECK.md); xuất PDF/Slides theo template chính thức nếu cuộc thi yêu cầu.                                                                                           |
| Demo script                | READY local           | [DEMO_SCRIPT.md](DEMO_SCRIPT.md).                                                                                                                                                        |
| Technical video evidence   | PASS local 2026-08-03 | `npm run test:e2e:record` PASS; latest WebM 1,536,270 bytes dưới `test-results/playwright/**/video.webm`, bị Git ignore. Không thay thế video pitch.                                     |
| Video pitch 3 phút         | OWNER ACTION          | Quay/export sau khi quyền asset và phạm vi demo được duyệt.                                                                                                                              |
| Public Cloud Run URL       | BLOCKED external      | Cần Google project, login/2FA, Starter eligibility hoặc billing approval, IAM, secrets và `--allow-unauthenticated` approval. Điền: `________________`.                                  |
| Public production smoke    | BLOCKED by URL        | Incognito: title/assets, auth/local fallback, Dragon Bridge refresh, Companion/Maps, chat VI/EN, privacy/terms, `/api/health`. Ghi URL/timestamp/screenshot sanitized trong `STATUS.md`. |
| Firebase production config | BLOCKED external      | Bật Anonymous Auth + Firestore; truyền web config an toàn; browser Auth/Firestore smoke; deploy rules sau approval.                                                                      |
| Gemini live proof          | BLOCKED external      | Tạo Secret Manager secret và key qua kênh an toàn; chạy sanitized server-side chat/itinerary smoke, không ghi key/log raw.                                                               |
| Asset rights               | OWNER ACTION          | Duyệt placeholder hiện có hoặc thay bằng asset có author/license/URL đã kiểm tra.                                                                                                        |
| Starter/Standard decision  | OWNER ACTION          | Track hiện tại: Starter curated cards. Chỉ bật Standard Places sau billing/quota/policy approval.                                                                                        |
| Legal                      | READY local           | `/privacy`, `/terms`, [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md). Cần review pháp lý của owner nếu cuộc thi yêu cầu.                                                                 |
| Cost/quota notes           | READY local           | `min-instances=0` là fallback Standard; xác nhận actual quota/budget trước publish.                                                                                                      |

## Trường nộp bài cần owner điền

```text
Repository URL:
Public app URL:
AI Studio URL (nếu có):
Demo video URL/file:
Pitch URL/file:
Project/region:
Timestamp production smoke (UTC):
Owner xác nhận asset rights:
Owner xác nhận public access/cost:
```

## Quy tắc nộp bài

Không nộp `.env`, service-account JSON, output provider thô, screenshot có credential, hoặc Place restricted content. Nếu một ô BLOCKED chưa có evidence, giữ nguyên trạng thái và nêu rõ giới hạn thay vì điền placeholder như một URL thật.
