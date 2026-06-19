# 🀄 Chinese Image Translator AI

Ứng dụng AI trích xuất và dịch văn bản tiếng Trung từ hình ảnh sử dụng OCR và mô hình ngôn ngữ lớn (LLM).

> Tài liệu kỹ thuật chi tiết: xem thư mục [_docs/](_docs/)

---

## 📸 Demo

Upload hình ảnh chứa chữ Hán → AI tự động trích xuất & dịch sang tiếng Việt

---

## ✨ Tính năng

- **📷 OCR tiếng Trung** — Nhận diện chữ Hán từ ảnh chụp, ảnh scan, manga, meme, v.v.
- **🤖 Dịch thuật bằng AI (LLM)** — Dịch chính xác, giữ ngữ cảnh và thành ngữ
- **🌏 Hỗ trợ Giản thể & Phồn thể** — Tự động nhận diện loại chữ
- **⚡ Giao diện web đơn giản** — Upload ảnh và nhận kết quả ngay lập tức
- **📋 Copy kết quả** — Sao chép văn bản gốc hoặc bản dịch chỉ một click
- **🔒 Bảo mật** — Xử lý ảnh tạm thời, không lưu trữ vĩnh viễn

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Backend | Next.js API Routes |
| UI Framework | Tailwind CSS + Shadcn/ui |
| OCR | Tesseract.js (client-side) + Google Vision API (server-side fallback) |
| Dịch thuật | OpenAI GPT-4 / Gemini / Claude |
| Xử lý ảnh | Sharp |
| Môi trường | `.env` cho API keys |
| Deploy | Vercel / Docker |

---

## 🚀 Cài đặt & Chạy

## 📌 Yêu cầu hệ thống
Node.js >= 18

npm >= 9

API key của dịch vụ OCR và LLM tương ứng

## 🤝 Đóng góp
Mọi đóng góp đều được chào đón! Vui lòng tạo issue hoặc pull request.

### Clone repo
```bash
git clone https://github.com/huyletrannhat27-prog/Chinese-Image-Translator-AI.git
cd Chinese-Image-Translator-AI