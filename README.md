🀄 Chinese Image Translator AI

Ứng dụng AI trích xuất và dịch văn bản tiếng Trung từ hình ảnh sử dụng OCR và mô hình ngôn ngữ lớn (LLM).

---

## 📸 Demo

![App Demo](./demo.png)

> Upload hình ảnh chứa chữ Hán → AI tự động trích xuất & dịch sang tiếng Việt


✨ Tính năng


📷 OCR tiếng Trung — Nhận diện chữ Hán từ ảnh chụp, ảnh scan, manga, meme, v.v.
🤖 Dịch thuật bằng AI (LLM) — Dịch chính xác, giữ ngữ cảnh và thành ngữ
🌏 Hỗ trợ Giản thể & Phồn thể — Tự động nhận diện loại chữ
⚡ Giao diện web đơn giản — Upload ảnh và nhận kết quả ngay lập tức
📋 Copy kết quả — Sao chép văn bản gốc hoặc bản dịch chỉ một click




🛠️ Công nghệ sử dụng

Thành phầnCông nghệFrontendNext.js / ReactBackendNode.jsOCRTesseract.js / Google Vision APIDịch thuậtOpenAI GPT / Gemini / ClaudeMôi trường.env cho API keys


🚀 Cài đặt & Chạy

1. Clone repo

bashgit clone https://github.com/huyletrannhat27-prog/Chinese-Image-Translator-AI.git
cd Chinese-Image-Translator-AI

2. Cài dependencies

bashnpm install

3. Cấu hình biến môi trường

Tạo file .env từ file mẫu:

bashcp .env.example .env

Điền các API key vào .env:

envOPENAI_API_KEY=your_openai_api_key
GOOGLE_VISION_API_KEY=your_google_vision_api_key

4. Chạy ứng dụng

bashnpm run dev

Mở trình duyệt tại http://localhost:3000


📖 Hướng dẫn sử dụng


Truy cập ứng dụng tại http://localhost:3000
Upload ảnh chứa văn bản tiếng Trung
Ứng dụng tự động OCR và trích xuất chữ
Kết quả dịch sang tiếng Việt / tiếng Anh hiển thị ngay bên dưới
Copy kết quả nếu cần



📁 Cấu trúc thư mục

Chinese-Image-Translator-AI/
├── public/             # Static files
├── src/
│   ├── components/     # React components
│   ├── pages/          # Next.js pages & API routes
│   └── utils/          # OCR & translation helpers
├── .env.example        # Mẫu biến môi trường
├── package.json
└── README.md


📌 Yêu cầu hệ thống

Node.js >= 18
npm >= 9
API key của dịch vụ OCR và LLM tương ứng
