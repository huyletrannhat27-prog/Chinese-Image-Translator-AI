# Công cụ OCR

> Cập nhật: 23/07/2026. File này chỉ đánh giá bước **nhận dạng chữ từ ảnh**. Công cụ dịch và camera realtime được tách sang tài liệu riêng.

## 1. Dự án đang dùng OCR nào?

Dự án hiện tại dùng **Tesseract.js** chạy phía client để nhận dạng chữ Trung trước khi dịch:

- Language data: `chi_sim.traineddata`, `chi_tra.traineddata` và `eng.traineddata` trong `public/tessdata`.
- Tesseract trả văn bản, confidence, từng dòng và bounding box.
- Sau khi OCR xong, chỉ phần text được gửi đến endpoint Gemini để dịch.

Như vậy pipeline hiện tại là **Tesseract OCR → Gemini API translation**, không gửi ảnh cho Gemini để OCR.

## 2. OCR mã nguồn mở và offline

| Công cụ | Nền tảng | Hỗ trợ Việt–Trung | Ưu điểm | Nhược điểm | Nên dùng khi |
|---|---|---|---|---|---|
| **Tesseract OCR** | Windows, Linux, macOS, server; nhiều wrapper | Có `vie`, `chi_sim`, `chi_tra` | Miễn phí, Apache 2.0; chạy offline; nhẹ; cộng đồng lớn; dễ dùng với tài liệu in sạch | Nhạy với ảnh mờ/nghiêng, font lạ và bố cục phức tạp; cần tiền xử lý; không tối ưu cho video camera liên tục | Scan rõ, desktop/backend offline, ngân sách thấp |
| **PaddleOCR** | Python/C++; CPU/GPU; server/edge | Có model Việt và Trung; phải chọn đúng model/version | Phát hiện vùng chữ, nhận dạng, xoay hướng và phân tích bố cục; mạnh với chữ Trung và ảnh đời thực; train/fine-tune được | Dependency và triển khai nặng hơn; cần benchmark model cụ thể; muốn realtime thường phải tối ưu model/phần cứng | Ứng dụng Trung–Việt self-host, biển hiệu, screenshot, tài liệu nhiều bố cục |
| **EasyOCR** | Python/PyTorch; CPU/GPU | Hơn 80 ngôn ngữ/script, gồm Trung; các nhóm ngôn ngữ có giới hạn khi nạp cùng nhau | API đơn giản; trả bounding box, text và confidence; prototype nhanh | Model/PyTorch khá nặng; khởi tạo chậm; ít chức năng document layout hơn PaddleOCR; chữ viết tay chưa phải thế mạnh | Prototype Python và scene text |
| **Tesseract.js** | Browser hoặc Node.js qua WebAssembly | Hỗ trợ nhiều language data của Tesseract | Không phải upload ảnh; có thể chạy trong Web Worker; phù hợp PWA/web offline | Tải model ban đầu và khởi tạo worker chậm; ngốn CPU/RAM trên điện thoại; OCR tiếng Trung từng frame khó đạt realtime mượt | Web offline, xử lý ảnh tĩnh hoặc frame được throttle mạnh |

## 3. OCR on-device theo hệ điều hành

| Công cụ | Nền tảng | Ưu điểm | Nhược điểm | Nên dùng khi |
|---|---|---|---|---|
| **Google ML Kit Text Recognition v2** | Android/iOS | Chạy on-device; nhận ảnh/video; model Latin thường realtime trên đa số thiết bị; có model Chinese; trả cấu trúc và tọa độ | Model Chinese chậm hơn Latin; app tăng dung lượng nếu bundle model; bản tải động có độ trễ lần đầu | Camera dịch trực tiếp trên mobile, cần phản hồi nhanh và riêng tư |
| **Windows.Media.Ocr / Windows AI OCR** | Windows | Local, nhanh, không gửi dữ liệu lên cloud; tích hợp app Windows | Khóa vào Windows; phụ thuộc Windows/language pack; `Windows.Media.Ocr` có ràng buộc package identity ở desktop | App Windows native |
| **Apple Vision framework – Recognize Text** | iOS/iPadOS/macOS | OCR on-device, tích hợp camera/native tốt, có chế độ ưu tiên tốc độ hoặc độ chính xác | Chỉ trong hệ sinh thái Apple; phải kiểm tra ngôn ngữ/model trên OS đích; cần code native/plugin cho Capacitor | App iOS cần OCR camera nhanh |

## 4. OCR cloud chuyên dụng

| Công cụ | Điểm mạnh | Điểm yếu | Chi phí/triển khai | Nên dùng khi |
|---|---|---|---|---|
| **Google Cloud Vision / Document AI** | OCR ảnh khó, chữ viết tay; trả page/block/paragraph/word; Document AI xử lý form, bảng và layout | Cần mạng/billing; dữ liệu rời thiết bị; Document AI quá nặng nếu chỉ cần text | Vision có miễn phí 1.000 đơn vị đầu/tháng; tính phí theo ảnh/feature, Document AI theo trang/processor | Production cần độ chính xác, scale hoặc tài liệu phức tạp |
| **Azure AI Vision Read** | Printed OCR đa ngôn ngữ, gồm tiếng Việt; nhận dòng trộn ngôn ngữ; hợp hệ sinh thái Azure | Cần mạng; model/version và chữ viết tay có phạm vi hỗ trợ khác nhau; tác vụ có thể bất đồng bộ | Theo tier/giao dịch | Doanh nghiệp đang dùng Azure |
| **OCR.space API** | REST đơn giản; thử nhanh; có bản on-premise | Free tier không SLA; ít kiểm soát model; quota/file limit theo gói | Free API công bố khoảng 500 request/ngày/IP; PRO trả phí | Demo/đồ án nhỏ, không phụ thuộc SLA |

## 5. OCR bằng AI Vision đa phương thức

| Công cụ | Ưu điểm | Nhược điểm | Nên dùng khi |
|---|---|---|---|
| **Google Gemini Vision** | Hiểu ảnh, chữ và ngữ cảnh; có thể OCR + dịch + JSON trong một request; phù hợp screenshot/hội thoại | Cần mạng; tính token; có thể bỏ sót hoặc đoán chữ; bbox không hoàn toàn ổn định | Muốn pipeline gọn hoặc dùng làm phương án thử nghiệm; **không phải luồng UI mặc định** |
| **OpenAI Vision** | Hiểu bố cục/ngữ cảnh, output có cấu trúc; xử lý ảnh trực tiếp | Cần mạng; image detail cao làm tăng độ trễ/chi phí; không phải OCR tất định | Ảnh khó, cần OCR + dịch và JSON |
| **Anthropic Claude Vision** | Hiểu tài liệu/ảnh và dịch theo ngữ cảnh; prompt linh hoạt | Cần mạng; độ trễ/chi phí theo model; bbox và OCR không tất định | Provider dự phòng hoặc so sánh chất lượng |

## 6. Khuyến nghị chọn OCR

### Muốn camera mobile nhanh nhất

Ưu tiên **ML Kit Text Recognition v2** trên Android/iOS. Chỉ gửi phần text đã ổn định lên translation API, không gửi toàn bộ ảnh cho mỗi frame.

### Muốn web/PWA offline

Thử **Tesseract.js trong Web Worker**, nhưng chỉ OCR vùng quan tâm và throttle frame. Cần benchmark kỹ tiếng Trung trên điện thoại yếu.

### Muốn ưu tiên ngữ cảnh bằng AI Vision

Giữ **Gemini/OpenAI/Claude Vision**, nhưng đây nên là chế độ “chụp rồi dịch”, không gọi cloud AI liên tục 15–30 frame/giây.

### Muốn self-host

Ưu tiên **PaddleOCR** cho Trung–Việt. Tesseract phù hợp hơn với tài liệu sạch và yêu cầu tài nguyên thấp.

## 7. Nguồn tham khảo

- [Tesseract: ngôn ngữ được hỗ trợ](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html)
- [PaddleOCR documentation](https://www.paddleocr.ai/main/en/index/)
- [PaddleOCR multilingual models](https://www.paddleocr.ai/v2.10.0/en/ppocr/blog/multi_languages.html)
- [EasyOCR](https://github.com/JaidedAI/EasyOCR)
- [Tesseract.js](https://tesseract.projectnaptha.com/)
- [ML Kit Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- [Windows AI](https://learn.microsoft.com/windows/ai/)
- [Google Cloud Vision pricing](https://cloud.google.com/vision/pricing)
- [Azure Vision OCR language support](https://learn.microsoft.com/azure/ai-services/computer-vision/language-support)
- [OCR.space API](https://ocr.space/ocrapi)
