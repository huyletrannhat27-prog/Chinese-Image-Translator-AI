# Tổng quan dự án — Chinese Image Translator AI

## Mục tiêu

Xây dựng một ứng dụng web cho phép người dùng upload ảnh chứa văn bản tiếng Trung, tự động trích xuất (OCR) và dịch sang tiếng Việt (hoặc các ngôn ngữ khác) sử dụng mô hình ngôn ngữ lớn (LLM).

---

## Tech Stack

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | Next.js 16 | App Router, React Server Components |
| UI | Tailwind CSS + Lucide React | Giao diện hiện đại, responsive |
| OCR | Tesseract.js; PaddleOCR tùy chọn | OCR client nhanh; OCR Python để kiểm thử/self-host |
| Dịch và kiểm chứng | Google Gemini | Dịch Trung → Việt và dịch vòng Việt → Trung |
| Xử lý ảnh | Sharp | Chuẩn hóa ảnh cho các API OCR/vision phía server |
| File upload | Next.js Route Handler (FormData) | Xử lý multipart/form-data |
| Lịch sử | localStorage (client) | Xem `src/lib/history/storage.ts` |
| Deploy | Render, PWA, Capacitor | Web production và Android |

---

## Actors

### Người dùng (User)
- Upload ảnh có chứa văn bản tiếng Trung
- Xem kết quả OCR và bản dịch
- Copy nội dung gốc và bản dịch
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
- **Rate limiting** — Giới hạn số request để tránh lạm dụng API
- **Minh bạch độ chính xác** — Điểm OCR và dịch vòng là tín hiệu tham khảo, không phải bảo đảm tuyệt đối

---

## Tính năng cốt lõi (MVP) — đã có

1. **Chụp ảnh / Upload ảnh** — Camera trực tiếp hoặc chọn file từ máy
2. **Xem trước ảnh** — Hiển thị ảnh sau khi chụp/upload
3. **OCR** — Tesseract.js nhận dạng chữ Hán, confidence và bounding box
4. **Phát hiện ngôn ngữ** — Tự động nhận diện Giản thể / Phồn thể
5. **Dịch văn bản** — Gemini dịch text OCR sang tiếng Việt
6. **Copy kết quả** — Sao chép nội dung gốc và bản dịch
7. **Lịch sử dịch** — Lưu, xem lại, xoá, export JSON
8. **Kiểm chứng** — Tổng hợp confidence OCR và so sánh bản dịch vòng

---

## Tính năng mở rộng (Future) — xem chi tiết ở `02_phases.md`

- Chọn ngôn ngữ đích khác ngoài tiếng Việt
- Dịch file PDF nhiều trang
- Dịch theo batch (nhiều ảnh cùng lúc)
- Export kết quả ra Word/PDF
- Auth + quản lý tier người dùng (Phase 6)
