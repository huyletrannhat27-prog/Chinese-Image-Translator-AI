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

## 🔄 Luồng xử lý

```mermaid
flowchart TD
    A[📸 Chụp ảnh] --> B[🖼️ Tiền xử lý]
    B --> C[📝 OCR - Tesseract.js]
    C --> D[🔤 Phát hiện ngôn ngữ]
    D --> E{Confidence > 60%?}
    E -- Yes --> F[🤖 Dịch bằng Gemini]
    E -- No --> G[🔄 Retry với preprocessing]
    G --> C
    F --> H[📋 Lưu lịch sử]
    H --> I[🎯 Hiển thị kết quả]

🚀 Cài đặt & Chạy:

    - Yêu cầu hệ thống:

        Node.js >= 18

        npm / yarn / bun

        iOS: Xcode 14+ / Android: Android Studio

        Expo CLI



Clone & Cài đặt:
# Clone repo
git clone https://github.com/huyletrannhat27-prog/chinese-image-translator.git
cd chinese-image-translator

# Cài dependencies
npm install

# Cài thêm packages
npm install expo-camera expo-image-picker expo-file-system
npm install tesseract.js react-native-canvas
npm install @react-native-async-storage/async-storage
npm install zustand react-native-sqlite-storage

# Chạy app
npx expo start





Cấu hình biến môi trường:
# .env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key  # Fallback



📖 Hướng dẫn sử dụng
1. Mở ứng dụng
Không cần đăng nhập, mở app là dùng được ngay.

2. Chụp ảnh
Nhấn nút 📸 Camera để chụp ảnh mới

Hoặc nhấn 🖼️ Gallery để chọn ảnh có sẵn

3. Đợi xử lý
Ứng dụng tự động OCR và dịch

Hiển thị tiến trình: Đang OCR... → Đang dịch...

4. Xem kết quả
Văn bản gốc (tiếng Trung)

Bản dịch (tiếng Việt)

Độ chính xác (0-100%)

5. Lưu & xem lịch sử
Tự động lưu vào Lịch sử

Mở tab 📋 History để xem lại

Nhấn vào item để xem chi tiết

🎯 Demo dữ liệu
Input: Ảnh chứa văn bản
Output: OCR & Dịch


🎯 Kế hoạch phát triển
Phase 1: Foundation ✅
Setup React Native + TypeScript

Camera & Gallery integration

Tesseract.js integration

Basic UI

Phase 2: OCR & Translation 🔄
Image preprocessing (Sharp/Canvas)

Layout analysis (xử lý văn bản lộn xộn)

Gemini API integration

Fallback translation (OpenAI)

Phase 3: History & Storage 🔄
SQLite/IndexedDB setup

Save/load history

Export CSV/JSON

Auto-cleanup old entries

Phase 4: Polish & Performance 🔄
Offline mode optimization

Batch processing

UI/UX improvements

Performance optimization

🤝 Đóng góp
Chúng tôi rất hoan nghênh mọi đóng góp!

Fork dự án

Tạo branch mới (git checkout -b feature/amazing)

Commit thay đổi (git commit -m 'Add amazing feature')

Push lên branch (git push origin feature/amazing)

Mở Pull Request

📄 License
MIT © huyletrannhat27-prog

