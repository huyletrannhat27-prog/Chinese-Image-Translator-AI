# Tổng quan dự án — Chinese Image Translator AI

## Mục tiêu

Xây dựng một ứng dụng web cho phép người dùng upload ảnh chứa văn bản tiếng Trung, tự động trích xuất (OCR) và dịch sang tiếng Việt (hoặc các ngôn ngữ khác) sử dụng mô hình ngôn ngữ lớn (LLM).

---

## Tech Stack

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | Next.js 14 | App Router, React Server Components |
| UI | Tailwind CSS + Shadcn/ui | Giao diện hiện đại, responsive |
| OCR | PaddleOCR 3.x (Python service) | Nhận ảnh, trả text/confidence/bbox |
| Dịch | Google Gemini API | Chỉ nhận text OCR và dịch sang tiếng Việt |
| Xử lý ảnh | Sharp | Xoay theo EXIF, resize, tối ưu trước khi gửi AI |
| File upload | Next.js Route Handler (FormData) | Xử lý multipart/form-data |
| Lịch sử | localStorage (client) | Xem `src/lib/history/storage.ts` |
| Deploy | Vercel / Docker | |

---

## Actors

### Người dùng (User)
- Upload ảnh có chứa văn bản tiếng Trung
- Xem kết quả OCR và bản dịch
- Copy nội dung gốc và bản dịch
- Chọn ngôn ngữ đích (Việt/Anh/...)
- Xem lịch sử dịch

### Admin (hệ thống) — dự kiến Phase 6
- Giám sát số lượng request
- Quản lý API keys
- Xem logs và lỗi hệ thống
- Điều chỉnh cấu hình dịch vụ

---

## Nguyên tắc thiết kế

- **Giữ ngữ cảnh** — Dịch theo câu/đoạn văn, không word-by-word
- **Bảo mật** — Ảnh không được lưu trữ vĩnh viễn trên server
- **Trải nghiệm người dùng** — Camera trực tiếp hoặc upload ảnh, xem trước ảnh, xử lý bất đồng bộ có progress bar
- **Rate limiting** — Giới hạn số request để tránh lạm dụng API (kế hoạch Phase 4)

---

## Tính năng cốt lõi (MVP) — đã có

1. **Chụp ảnh / Upload ảnh** — Camera trực tiếp hoặc chọn file từ máy
2. **Xem trước ảnh** — Hiển thị ảnh sau khi chụp/upload
3. **OCR** — PaddleOCR nhận diện chữ Hán, confidence và bounding box
4. **Phát hiện loại chữ** — Gemini phân loại Giản thể / Phồn thể / hỗn hợp từ text OCR
5. **Dịch văn bản** — Gemini dịch text PaddleOCR sang tiếng Việt
6. **Copy kết quả** — Sao chép nội dung gốc và bản dịch
7. **Lịch sử dịch** — Lưu, xem lại, xoá, export JSON

---

## Tính năng mở rộng (Future) — xem chi tiết ở `02_phases.md`

- Chọn ngôn ngữ đích khác ngoài tiếng Việt
- Dịch file PDF nhiều trang
- Dịch theo batch (nhiều ảnh cùng lúc)
- Export kết quả ra Word/PDF
- Auth + quản lý tier người dùng (Phase 6)
