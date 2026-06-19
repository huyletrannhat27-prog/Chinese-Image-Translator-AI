# Lộ trình phát triển — Chinese Image Translator AI

## Phase 1 — Foundation ⬜

**Mục tiêu:** Dự án chạy được, giao diện cơ bản, upload ảnh hoạt động.

- [ ] Init Next.js 14 với App Router
- [ ] Cài Tailwind CSS + Shadcn/ui
- [ ] Tạo layout cơ bản (Header, Footer, Container)
- [ ] Component Upload: drag-and-drop, file input
- [ ] Xem trước ảnh sau khi upload
- [ ] Base API structure (`/api/*`)
- [ ] Environment variables (.env)
- [ ] Error handling cơ bản (toast notifications)

---

## Phase 2 — OCR (Optical Character Recognition) ⬜

**Mục tiêu:** Trích xuất văn bản tiếng Trung từ ảnh.

- [ ] Cài Tesseract.js trên client
- [ ] Hàm OCR client-side: `ocrTesseract(file)`
- [ ] Hiển thị kết quả OCR (văn bản thô)
- [ ] Xử lý trường hợp Tesseract không nhận diện được
- [ ] Server fallback: Google Vision API (`/api/ocr/vision`)
- [ ] So sánh độ chính xác của 2 phương pháp
- [ ] Chọn phương pháp tốt nhất (hoặc cho phép user chọn)
- [ ] Loading state trong quá trình OCR

---

## Phase 3 — Phát hiện ngôn ngữ & Dịch thuật ⬜

**Mục tiêu:** Nhận diện loại chữ (Giản thể / Phồn thể) và dịch sang tiếng Việt.

- [ ] Detect script: Giản thể (简体) vs Phồn thể (繁體)
- [ ] Hàm `detectChineseScript(text)` → `simplified` / `traditional`
- [ ] Hiển thị loại chữ đã phát hiện trên UI
- [ ] Integration OpenAI GPT-4: `/api/translate/openai`
- [ ] Integration Google Gemini: `/api/translate/gemini`
- [ ] Integration Claude: `/api/translate/claude`
- [ ] Cho phép user chọn provider (OpenAI / Gemini / Claude)
- [ ] Cho phép user chọn ngôn ngữ đích (Việt, Anh, Nhật, Hàn...)
- [ ] Hiển thị bản dịch + văn bản gốc side-by-side

---

## Phase 4 — Tối ưu hóa & Trải nghiệm ⬜

**Mục tiêu:** Nâng cao trải nghiệm người dùng và hiệu suất.

- [ ] Copy to clipboard: copy gốc, copy dịch, copy cả 2
- [ ] Xử lý ảnh trước khi OCR: Sharp resize, tăng độ tương phản
- [ ] Tăng độ chính xác OCR: preprocess với OpenCV (Sharp + filters)
- [ ] Rate limiting: 10 requests/phút (client + server)
- [ ] Cache kết quả: lưu tạm trong memory 1 giờ
- [ ] Retry mechanism khi API thất bại
- [ ] Thêm tooltip hướng dẫn cho từng bước
- [ ] Responsive: mobile + tablet + desktop

---

## Phase 5 — Lịch sử & Nâng cao ⬜

**Mục tiêu:** Lưu lịch sử và các tính năng mở rộng.

- [ ] Lịch sử dịch: lưu vào localStorage (hoặc database nếu có auth)
- [ ] Xem lại lịch sử: hiển thị danh sách các lần dịch trước
- [ ] Export kết quả: TXT, Word, PDF
- [ ] Upload PDF: trích xuất văn bản từ file PDF
- [ ] Batch processing: upload nhiều ảnh cùng lúc
- [ ] Chia sẻ kết quả: tạo link public (tạm thời)

---

## Phase 6 — Authentication & Admin ⬜

**Mục tiêu:** Cho phép user đăng ký và admin giám sát hệ thống.

- [ ] Auth: NextAuth.js với Google/GitHub
- [ ] User tier: Free (10 requests/ngày) / Pro (không giới hạn)
- [ ] Admin dashboard: thống kê request, lỗi, API usage
- [ ] Quản lý API keys: Open AI, Gemini, Google Vision...
- [ ] Logs: ghi log OCR và translation
- [ ] Rate limiting per user

---

## Backlog / Future Features

- Support thêm 5+ ngôn ngữ OCR (Nhật, Hàn, Thái, Nga, Ả Rập)
- Dịch song song nhiều ngôn ngữ cùng lúc
- Tự động sửa lỗi chính tả sau OCR
- API endpoints cho developer (SaaS)
- Webhook: gửi kết quả qua email/Telegram
- Mobile app (React Native/Flutter)