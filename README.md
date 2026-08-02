# Hanzi Lens — Chinese Image Translator AI

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OCR](https://img.shields.io/badge/OCR-Tesseract.js_%2B_PaddleOCR-4F46E5?style=flat)](#kiến-trúc)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Ứng dụng nhận dạng chữ Trung trong ảnh, dịch sang tiếng Việt và hiển thị độ tin cậy của OCR cùng độ tương đồng của bản dịch.

## Dùng thử trực tuyến

**[Mở Hanzi Lens tại chinese-image-translator-ai-1.onrender.com](https://chinese-image-translator-ai-1.onrender.com)**

> Bản miễn phí trên Render có thể cần một ít thời gian để khởi động sau thời gian không hoạt động.

## Tính năng

- Chụp ảnh trực tiếp bằng camera hoặc chọn ảnh từ thiết bị, tối đa 10 MB.
- Nhận dạng chữ Trung giản thể, phồn thể và văn bản Latin bằng PaddleOCR (server) theo mặc định; Tesseract.js được dùng làm fallback trên trình duyệt nếu môi trường deploy không có Python/Paddle.
- Dịch văn bản OCR sang tiếng Việt bằng Google Gemini.
- Ước lượng độ tin cậy OCR từ confidence của từng vùng chữ.
- Kiểm tra bản dịch bằng dịch vòng Việt → Trung và hệ số tương đồng Dice.
- Hiển thị bản dịch theo vùng khi số đoạn dịch khớp với vùng OCR.
- Lưu lịch sử trong `localStorage`, sao chép và tải kết quả dạng văn bản.
- Hỗ trợ PWA và đóng gói Android bằng Capacitor.
- Rate limit, cache và retry có kiểm soát cho API dịch.

## Kiến trúc

```text
Chụp hoặc tải ảnh
        |
        v
Tesseract.js trên trình duyệt
(text, bbox, confidence, loại chữ)
        |
        v
Gemini: Trung -> Việt
        |
        +--> Gemini: Việt -> Trung (dịch vòng)
        |
        v
Tính điểm OCR + điểm tương đồng bản dịch
        |
        v
Hiển thị kết quả và lưu lịch sử cục bộ
```

Luồng trên được dùng trên giao diện để phản hồi nhanh và deploy thuận tiện. Dự án còn cung cấp `/api/ocr` và nhánh gửi ảnh của `/api/verify` để chạy PaddleOCR self-host khi môi trường đã cài Python và các gói trong `scripts/requirements-ocr.txt`.

## Công nghệ

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript | Giao diện và API routes |
| UI | Tailwind CSS, Lucide React | Giao diện responsive |
| OCR chính | PaddleOCR (server) + Tesseract.js (fallback) | PaddleOCR (server-side, chính); Tesseract.js dùng làm fallback nhanh trên trình duyệt |
| OCR tùy chọn | PaddleOCR, Python | OCR self-host và kiểm thử đối chiếu |
| Dịch | Google Gemini API | Dịch Trung → Việt và dịch vòng |
| Xử lý ảnh server | Sharp | Xoay, resize và nén ảnh cho PaddleOCR/API vision |
| Tối ưu API | Upstash, `p-retry` | Rate limit, cache, retry và timeout |
| Lịch sử | `localStorage` | Lưu cục bộ, không cần database |
| Mobile | PWA, Capacitor | Cài trên điện thoại và build Android |

## Cài đặt

### Yêu cầu

- Node.js 20.9 trở lên.
- npm 9 trở lên.
- Một Gemini API key hợp lệ.
- Python 3 và PaddleOCR chỉ cần khi sử dụng OCR self-host.

### Chạy web app

```bash
git clone https://github.com/huyletrannhat27-prog/Chinese-Image-Translator-AI.git
cd Chinese-Image-Translator-AI
npm ci
```

Sao chép `.env.example` thành `.env`, sau đó cấu hình tối thiểu:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
```

Lấy API key tại [Google AI Studio](https://aistudio.google.com/app/apikey).

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### Kiểm tra trước khi chạy production

```bash
npm run lint
npm run type-check
npm run build
npm run start
```

### PaddleOCR tùy chọn

```bash
python -m pip install -r scripts/requirements-ocr.txt
python scripts/paddle_ocr.py assets/icon.png
```

Trên Linux/macOS có thể dùng `python3`. Nếu executable có tên khác, đặt `PADDLE_OCR_PYTHON_BIN` trong `.env`.

## API chính

| Endpoint | Chức năng |
|---|---|
| `POST /api/verify` | Dịch và tính độ tin cậy OCR/độ tương đồng bản dịch; nhận kết quả OCR hoặc ảnh |
| `POST /api/translate` | Dịch text OCR bằng Gemini, có rate limit/cache/retry |
| `POST /api/ocr` | Chạy PaddleOCR self-host trên ảnh |
| `GET /api/detect-script` | Hỗ trợ xác định giản thể/phồn thể |

Điểm dịch vòng chỉ là tín hiệu tham khảo. Một bản dịch đúng nhưng diễn đạt khác vẫn có thể có độ tương đồng thấp; không nên dùng điểm này làm tiêu chí duy nhất để kết luận bản dịch sai.

## Mobile

- Mở website trên Android/iOS và chọn **Thêm vào màn hình chính** để cài PWA.
- Xem [MOBILE.md](MOBILE.md) để build APK Android bằng Capacitor hoặc GitHub Actions.

## Tài liệu đồ án

- [Tổng quan hệ thống](_docs/01_overview.md)
- [Các giai đoạn phát triển](_docs/02_phases.md)
- [Công cụ OCR](_docs/04_ocr_tools.md)
- [Công cụ dịch thuật](_docs/05_translation_tools.md)
- [Camera realtime và giảm độ trễ](_docs/06_realtime_camera_tools.md)
- [Rate limiting, cache và retry](_docs/07_phase4_optimization_tools.md)
- [Xác định độ chính xác OCR và dịch thuật](_docs/08_accuracy_verification.md)
- [Tài liệu thuyết trình OCR và dịch thuật](_docs/08_thuyet_trinh_ocr_va_dich_thuat.md)

## Giấy phép

MIT © huyletrannhat27-prog
