# 🀄 Chinese Image Translator AI

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tesseract](https://img.shields.io/badge/Tesseract.js-3C3C3C?style=flat&logo=tesseract&logoColor=white)](https://github.com/naptha/tesseract.js)
[![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Ứng dụng web dịch tiếng Trung từ hình ảnh - Không cần đăng nhập, chụp/upload ảnh là dịch ngay!**

---

## ✨ Tính năng

### 🎯 Tính năng chính
- **📸 Chụp ảnh trực tiếp** - Dùng camera trình duyệt, chụp là dịch
- **🖼️ Upload từ máy** - Hỗ trợ ảnh có sẵn (tối đa 10MB)
- **🌏 Giản thể & Phồn thể** - Tự động nhận diện và dịch
- **📖 Phân đoạn** - Hiển thị từng câu gốc + câu dịch song song
- **📋 Lịch sử** - Lưu lại các bản dịch trong trình duyệt (localStorage), xem lại/xoá/export JSON
- **⬇️ Tải kết quả** - Export bản dịch ra file .txt

### ⚡ Điểm nổi bật
- ✅ **Không cần đăng nhập** - Dùng ngay khi mở trang
- ✅ **Dịch chính xác** - Sử dụng Gemini 1.5 Flash (có fallback OpenAI / Claude)
- ✅ **Bảo mật** - Ảnh xử lý theo request, không lưu trữ vĩnh viễn trên server

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Web app, API routes |
| **Ngôn ngữ** | TypeScript | Type-safe |
| **UI** | Tailwind CSS + Radix UI | Giao diện responsive |
| **OCR** | Tesseract.js v6 (server-side) | Nhận diện chữ Trung |
| **Tiền xử lý ảnh** | Sharp | Resize, grayscale, tăng độ tương phản |
| **Dịch thuật** | Google Gemini 1.5 Flash | Dịch AI chính |
| **Fallback dịch** | OpenAI GPT-4o mini / Claude 3 Haiku | Dịch AI dự phòng |
| **Lịch sử** | localStorage (client) | Không cần database |

---

## 🔄 Luồng xử lý

```
📸 Chụp/Upload ảnh
      ↓
🖼️ Tiền xử lý (Sharp: resize, grayscale, normalize, sharpen)
      ↓
📝 OCR (Tesseract.js, chi_sim + chi_tra)
      ↓
🔤 Phát hiện Giản thể / Phồn thể
      ↓
🤖 Dịch bằng Gemini (kèm phân đoạn câu)
      ↓
📋 Lưu lịch sử (localStorage) + hiển thị kết quả
```

---

## 🚀 Cài đặt & Chạy

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
# Bắt buộc để dịch thật (nếu bỏ trống, app vẫn chạy nhưng trả bản dịch [Mock])
GEMINI_API_KEY=your_gemini_api_key

# Tuỳ chọn - fallback khi không dùng Gemini
OPENAI_API_KEY=your_openai_api_key
CLAUDE_API_KEY=your_claude_api_key
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

## 📖 Hướng dẫn sử dụng

1. **Mở trang** - Không cần đăng nhập, dùng ngay.
2. **Chụp/Upload ảnh** - Nhấn "Mở Camera" để chụp, hoặc "Chọn ảnh từ máy".
3. **Đợi xử lý** - App tự động OCR rồi dịch, có progress bar (Đang OCR... → Đang dịch...).
4. **Xem kết quả** - Văn bản gốc, bản dịch tiếng Việt, độ chính xác, loại chữ (giản thể/phồn thể).
5. **Lưu & xem lịch sử** - Tự động lưu vào lịch sử; nhấn biểu tượng 📋 để mở, hoặc vào `/history`.

---

## 🎯 Kế hoạch phát triển

Xem chi tiết từng phase tại [`_docs/02_phases.md`](_docs/02_phases.md). Tóm tắt:

- ✅ **Phase 1 — Foundation**: Next.js + Tailwind, upload/camera, API structure cơ bản
- ✅ **Phase 2 — OCR**: Tesseract.js server-side, tiền xử lý ảnh với Sharp
- 🔄 **Phase 3 — Dịch thuật nâng cao**: chọn provider (Gemini/OpenAI/Claude) và ngôn ngữ đích trên UI
- 🔄 **Phase 4 — Tối ưu**: rate limiting, cache, retry mechanism
- 🔄 **Phase 5 — Lịch sử nâng cao**: export CSV/PDF, batch nhiều ảnh
- ⬜ **Phase 6 — Auth & Admin**: đăng nhập, quản lý tier người dùng

---

## 🤝 Đóng góp

1. Fork dự án
2. Tạo branch mới (`git checkout -b feature/amazing`)
3. Commit thay đổi (`git commit -m 'Add amazing feature'`)
4. Push lên branch (`git push origin feature/amazing`)
5. Mở Pull Request

## 📄 License

MIT © huyletrannhat27-prog
