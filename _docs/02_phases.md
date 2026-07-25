# Lộ trình phát triển — Chinese Image Translator AI

## Phase 1 — Foundation ✅

**Mục tiêu:** Dự án chạy được, giao diện cơ bản, upload ảnh hoạt động.

- [x] Init Next.js 14 với App Router
- [x] Cài Tailwind CSS + Radix UI
- [x] Tạo layout cơ bản
- [x] Component Upload + Camera trực tiếp (getUserMedia)
- [x] Xem trước ảnh sau khi chụp/upload
- [x] Base API structure (`/api/*`)
- [x] Environment variables (`.env.example`)
- [x] Error handling cơ bản (banner lỗi trong UI)

---

## Phase 2 — OCR (Optical Character Recognition) ✅

**Mục tiêu:** Trích xuất văn bản tiếng Trung từ ảnh.

- [x] Thay Tesseract bằng AI Vision OCR (Gemini / OpenAI / Claude)
- [x] OCR và dịch trực tiếp từ ảnh trong một request
- [x] Hiển thị kết quả OCR (văn bản thô)
- [x] Xử lý trường hợp AI không nhận diện được (báo lỗi rõ ràng)
- [x] Tiền xử lý ảnh trước OCR (Sharp: EXIF rotate, resize, JPEG optimize)
- [x] Loading state trong quá trình OCR (progress bar)

---

## Phase 3 — Phát hiện ngôn ngữ & Dịch thuật 🔄

**Mục tiêu:** Nhận diện loại chữ (Giản thể / Phồn thể) và dịch sang tiếng Việt.

- [x] Detect script: Giản thể (简体) vs Phồn thể (繁體) bằng AI Vision
- [x] Hiển thị loại chữ đã phát hiện trên UI
- [x] Integration Google Gemini: `/api/translate` (endpoint chính)
- [x] Integration OpenAI Vision: `/api/translate/openai` (cần `OPENAI_API_KEY`)
- [x] Integration Claude Vision: `/api/translate/claude` (cần `ANTHROPIC_API_KEY`)
- [x] Hiển thị bản dịch + văn bản gốc + phân đoạn câu
- [x] Cho phép user chọn provider ngay trên UI
- [ ] Cho phép user chọn ngôn ngữ đích khác tiếng Việt trên UI

---

## Phase 4 — Tối ưu hóa & Trải nghiệm 🔄

**Mục tiêu:** Nâng cao trải nghiệm người dùng và hiệu suất.

- [x] Copy to clipboard: copy gốc, copy dịch
- [x] Xử lý ảnh trước khi OCR: Sharp rotate, resize và nén tối ưu (đồng bộ cho cả 3 route Gemini/OpenAI/Claude)
- [x] Responsive cơ bản (mobile-first, Tailwind)
- [x] Rate limiting: giới hạn request/phút (`src/lib/rate-limit`, sliding window, Upstash + fallback in-memory)
- [x] Cache kết quả dịch (`src/lib/cache`, Upstash Redis + fallback in-memory, key SHA-256 theo ảnh đã chuẩn hoá + provider/model/prompt version, có single-flight)
- [x] Retry mechanism khi API thất bại (`src/lib/retry`, dùng p-retry, backoff + jitter, tôn trọng `Retry-After`, chỉ retry lỗi tạm thời)
- [ ] Tooltip hướng dẫn cho từng bước

---

## Phase 5 — Lịch sử & Nâng cao 🔄

**Mục tiêu:** Lưu lịch sử và các tính năng mở rộng.

- [x] Lịch sử dịch: lưu vào `localStorage` qua `HistoryStorage` (`src/lib/history/storage.ts`)
- [x] Xem lại lịch sử: sidebar trong trang chính + trang riêng `/history`
- [x] Export lịch sử ra JSON
- [ ] Export CSV / TXT hàng loạt, Word/PDF
- [ ] Upload PDF: trích xuất văn bản từ file PDF
- [ ] Batch processing: upload nhiều ảnh cùng lúc
- [ ] Chia sẻ kết quả: tạo link public

---

## Phase 6 — Authentication & Admin ⬜

**Mục tiêu:** Cho phép user đăng ký và admin giám sát hệ thống.

- [ ] Auth: NextAuth.js với Google/GitHub
- [ ] User tier: Free / Pro
- [ ] Admin dashboard: thống kê request, lỗi, API usage
- [ ] Quản lý API keys tập trung
- [ ] Logs: ghi log OCR và translation
- [ ] Rate limiting per user

---

## Backlog / Future Features

- Support thêm ngôn ngữ OCR (Nhật, Hàn, Thái...)
- Dịch song song nhiều ngôn ngữ cùng lúc
- Tự động sửa lỗi chính tả sau OCR
- API endpoints cho developer (SaaS)
- Webhook: gửi kết quả qua email/Telegram
