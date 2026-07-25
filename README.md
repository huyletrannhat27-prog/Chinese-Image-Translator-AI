# Chinese Image Translator AI

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vision OCR](https://img.shields.io/badge/OCR-AI_Vision-4F46E5?style=flat)](#)
[![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Ứng dụng web dịch tiếng Trung từ hình ảnh - Không cần đăng nhập, chụp/upload ảnh là dịch ngay!**

---

## Tính năng

### Tính năng chính
- **Chụp ảnh trực tiếp** - Dùng camera trình duyệt, chụp là dịch
- **Upload từ máy** - Hỗ trợ ảnh có sẵn (tối đa 10MB)
- **Giản thể & Phồn thể** - Tự động nhận diện và dịch
- **Phân đoạn** - Hiển thị từng câu gốc + câu dịch song song
- **Lịch sử** - Lưu lại các bản dịch trong trình duyệt (localStorage), xem lại/xoá/export JSON
- **Tải kết quả** - Export bản dịch ra file .txt

### Điểm nổi bật
- **Không cần đăng nhập** - Dùng ngay khi mở trang
- **Dịch chính xác** - Chọn Google Gemini, OpenAI hoặc Anthropic Claude ngay trên giao diện
- **Bảo mật** - Ảnh xử lý theo request, không lưu trữ vĩnh viễn trên server

---

## Công nghệ sử dụng

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Web app, API routes |
| **Ngôn ngữ** | TypeScript | Type-safe |
| **UI** | Tailwind CSS + Radix UI | Giao diện responsive |
| **OCR + dịch** | Gemini Vision / OpenAI Vision / Claude Vision | Đọc trực tiếp ảnh và dịch trong một lần gọi |
| **Tiền xử lý ảnh** | Sharp | Xoay ảnh theo EXIF, resize và tối ưu payload |
| **Lịch sử** | localStorage (client) | Không cần database |

---

## Luồng xử lý

```
Chụp/Upload ảnh
      ↓
Tiền xử lý (Sharp: xoay đúng chiều, resize, nén ảnh)
      ↓
AI Vision đã chọn: OCR + phát hiện hệ chữ + dịch + định vị vùng chữ
      ↓
Lưu lịch sử (localStorage) + hiển thị kết quả
```

---

## Cài đặt & Chạy

### Yêu cầu hệ thống
- Node.js >= 18
- npm (hoặc yarn/pnpm)

### Clone & Cài đặt

```bash
git clone https://github.com/huyletrannhat27-prog/Chinese-Image-Translator-AI.git
cd Chinese-Image-Translator-AI

npm install
```

### Cấu hình biến môi trường

Copy `.env.example` thành `.env` rồi điền API key:

```bash
cp .env.example .env
```

```env
# Cấu hình ít nhất một provider mà bạn muốn dùng
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.6-terra
ANTHROPIC_API_KEY=your_anthropic_api_key
CLAUDE_MODEL=claude-haiku-4-5-20251001
```

Lấy Gemini API key miễn phí tại: https://aistudio.google.com/app/apikey

### Chạy dev server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### Build production

```bash
npm run build
npm run start
```

### Cài trên điện thoại / build APK

- Trên Android hoặc iPhone: mở website bằng trình duyệt và chọn **Thêm vào màn hình chính** để cài bản PWA.
- Để tạo APK Android: deploy website trước, sau đó xem hướng dẫn trong [`MOBILE.md`](MOBILE.md). Workflow GitHub Actions có thể tự build file `app-debug.apk` để tải về và chia sẻ.

---

## Hướng dẫn sử dụng

1. **Mở trang** - Không cần đăng nhập, dùng ngay.
2. **Chụp/Upload ảnh** - Nhấn "Mở Camera" để chụp, hoặc "Chọn ảnh từ máy".
3. **Chọn AI và đợi xử lý** - Gemini, OpenAI hoặc Claude sẽ đọc ảnh rồi dịch trực tiếp.
4. **Xem kết quả** - Văn bản gốc, bản dịch tiếng Việt, độ chính xác, loại chữ (giản thể/phồn thể).
5. **Lưu & xem lịch sử** - Tự động lưu vào lịch sử; nhấn biểu tượng lịch sử để mở, hoặc vào `/history`.

---

## Kế hoạch phát triển

Xem chi tiết từng phase tại [`_docs/02_phases.md`](_docs/02_phases.md). Tóm tắt:

- (Hoàn thành) **Phase 1 — Foundation**: Next.js + Tailwind, upload/camera, API structure cơ bản
- (Hoàn thành) **Phase 2 — OCR**: AI Vision OCR, tiền xử lý ảnh với Sharp
- (Hoàn thành) **Phase 3 — Dịch thuật nâng cao**: chọn provider Gemini/OpenAI/Claude trên UI
- (Đang làm) **Phase 4 — Tối ưu**: rate limiting, cache, retry mechanism đã xong; còn tooltip hướng dẫn
- (Đang làm) **Phase 5 — Lịch sử nâng cao**: export CSV/PDF, batch nhiều ảnh
- (Chưa bắt đầu) **Phase 6 — Auth & Admin**: đăng nhập, quản lý tier người dùng

## Tài liệu nghiên cứu

- [Công cụ OCR](_docs/04_ocr_tools.md) — các lựa chọn OCR offline, on-device, cloud và AI Vision; ưu/nhược điểm và công cụ dự án đang dùng.
- [Công cụ dịch thuật](_docs/05_translation_tools.md) — so sánh NMT, dịch offline/self-host và LLM đa phương thức.
- [Camera realtime và giảm độ trễ](_docs/06_realtime_camera_tools.md) — công cụ chụp/stream frame, nguyên nhân gây trễ và kiến trúc realtime đề xuất.
- [Phase 4: rate limiting, cache và retry](_docs/07_phase4_optimization_tools.md) — mục đích, công cụ, ưu/nhược điểm và combo tối ưu đề xuất cho Next.js/Vercel.

---

## Đóng góp

1. Fork dự án
2. Tạo branch mới (`git checkout -b feature/amazing`)
3. Commit thay đổi (`git commit -m 'Add amazing feature'`)
4. Push lên branch (`git push origin feature/amazing`)
5. Mở Pull Request

## License

MIT © huyletrannhat27-prog
