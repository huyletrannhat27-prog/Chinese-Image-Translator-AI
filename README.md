# 🀄 Chinese Image Translator AI

Ứng dụng AI trích xuất và dịch văn bản tiếng Trung từ hình ảnh sử dụng OCR và mô hình ngôn ngữ lớn (LLM).

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

---

## 📸 Demo

Upload hình ảnh chứa chữ Hán → AI tự động trích xuất & dịch sang tiếng Việt

![Demo](https://via.placeholder.com/800x400?text=Demo+Screenshot)

---

## ✨ Tính năng

- 📷 **OCR tiếng Trung** — Nhận diện chữ Hán từ ảnh chụp, ảnh scan, manga, meme, v.v.
- 🤖 **Dịch thuật bằng AI (LLM)** — Dịch chính xác, giữ ngữ cảnh và thành ngữ
- 🌏 **Hỗ trợ Giản thể & Phồn thể** — Tự động nhận diện loại chữ
- ⚡ **Giao diện web đơn giản** — Upload ảnh và nhận kết quả ngay lập tức
- 📋 **Copy kết quả** — Sao chép văn bản gốc hoặc bản dịch chỉ một click
- 🔒 **Bảo mật** — Xử lý ảnh tạm thời, không lưu trữ vĩnh viễn
- 📱 **Responsive** — Hỗ trợ mọi thiết bị

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Backend | Next.js API Routes |
| UI Framework | Tailwind CSS + Shadcn/ui |
| OCR | Tesseract.js (client) + Google Vision API (server) |
| Dịch thuật | OpenAI GPT-4 / Gemini / Claude |
| Xử lý ảnh | Sharp |
| Môi trường | `.env` cho API keys |
| Deploy | Vercel / Docker |

---

## 🚀 Cài đặt & Chạy

### Yêu cầu hệ thống
- Node.js >= 18
- npm >= 9

### Clone repo
```bash
git clone https://github.com/huyletrannhat27-prog/Chinese-Image-Translator-AI.git
cd Chinese-Image-Translator-AI