# 🀄 Chinese Image Translator

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tesseract](https://img.shields.io/badge/Tesseract.js-3C3C3C?style=flat&logo=tesseract&logoColor=white)](https://github.com/naptha/tesseract.js)
[![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Ứng dụng dịch tiếng Trung từ hình ảnh - Không cần đăng nhập, chụp ảnh là dịch ngay!**

---

## 📱 Demo

| Chụp ảnh | OCR | Dịch |
|---|---|---|
| ![Camera](screenshots/camera.jpg) | ![OCR](screenshots/ocr.jpg) | ![Translate](screenshots/translate.jpg) |

---

## ✨ Tính năng

### 🎯 Tính năng chính
- **📸 Chụp ảnh ngay** - Mở camera, chụp ảnh, dịch tức thì
- **🖼️ Chọn từ thư viện** - Hỗ trợ ảnh có sẵn trong máy
- **✍️ Chữ viết tay** - Nhận diện cả chữ viết tay
- **🔀 Văn bản lộn xộn** - Tự động phân tích layout, nhóm cụm từ
- **🌏 Giản thể & Phồn thể** - Tự động nhận diện và dịch
- **📋 Lịch sử** - Lưu 15,000+ bản dịch, xem lại bất kỳ lúc nào
- **⬇️ Xuất dữ liệu** - Export lịch sử ra CSV/JSON

### ⚡ Điểm nổi bật
- ✅ **Không cần đăng nhập** - Dùng ngay khi tải app
- ✅ **Offline-first** - OCR hoạt động không cần mạng
- ✅ **Dịch chính xác** - Sử dụng Gemini 1.5 Flash
- ✅ **Xử lý nhanh** - < 3 giây cho mỗi ảnh
- ✅ **Bảo mật** - Ảnh không upload lên server

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Framework** | React Native / Expo | Ứng dụng di động |
| **Ngôn ngữ** | TypeScript | Type-safe |
| **OCR** | Tesseract.js v4 | Nhận diện chữ Trung |
| **Tiền xử lý** | Sharp / Canvas | Tăng chất lượng ảnh |
| **Dịch thuật** | Google Gemini 1.5 Flash | Dịch AI |
| **Fallback** | GPT-4o mini | Dịch AI (dự phòng) |
| **Lưu trữ** | AsyncStorage + SQLite | Lịch sử + cài đặt |
| **State** | Zustand | Quản lý state |

---

## 📊 Kiến trúc hệ thống
