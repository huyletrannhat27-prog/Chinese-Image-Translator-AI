# Công cụ camera realtime và giảm độ trễ

> Cập nhật: 23/07/2026. File này tách riêng phần camera, xử lý frame realtime, OCR realtime và các nguyên nhân gây trễ.

## 1. Dự án hiện tại đang dùng loại nào?

### Camera

Dự án đang dùng **Web Camera API**, cụ thể:

```text
navigator.mediaDevices.getUserMedia()
→ MediaStream
→ thẻ <video>
→ Canvas drawImage()
→ canvas.toBlob(JPEG 0.95)
→ File/FormData
→ upload lên Next.js API
```

Thông số hiện tại:

- Camera sau: `facingMode: environment`.
- Độ phân giải yêu cầu lý tưởng: **1920 × 1080**.
- Ảnh chụp giữ nguyên kích thước frame và nén JPEG quality **0.95**.
- Nếu `getUserMedia` không dùng được, app mở file input có `capture="environment"`.
- Project có Capacitor để đóng gói Android, nhưng camera trong màn hình này vẫn là API web; **chưa cài và chưa dùng `@capacitor/camera` hoặc native CameraX**.

### OCR và dịch

- Provider mặc định: **Google Gemini 3.5 Flash**.
- Có thể chọn OpenAI hoặc Claude.
- Ảnh được upload lên cloud để **OCR + dịch + tìm bounding box trong một request**.
- Gemini hiện nhận ảnh camera gần như nguyên bản; nhánh OpenAI/Claude có Sharp xoay, resize tối đa 2560 và JPEG quality 90 trên server trước khi gọi AI.

### Kết luận

Tính năng hiện tại là **“mở camera → bấm chụp → chờ dịch ảnh tĩnh”**, không phải “dịch video realtime liên tục”. App không OCR từng frame và không giữ một kết nối streaming tới model.

## 2. Độ trễ hiện tại đến từ đâu?

| Công đoạn | Hiện trạng | Mức ảnh hưởng | Nguyên nhân |
|---|---|---:|---|
| Mở camera | `getUserMedia`, 1920×1080 ideal | Thấp/trung bình, chủ yếu lần đầu | Xin quyền, khởi tạo camera, autofocus |
| Chụp frame | Vẽ full frame vào Canvas | Thấp | Copy pixel trên main thread |
| Mã hóa ảnh | JPEG quality 0.95, full resolution | Trung bình | Ảnh lớn, encode trên main thread |
| Upload | `multipart/form-data` lên Next.js | Trung bình/cao | Phụ thuộc kích thước ảnh, mạng 4G/Wi-Fi và vị trí server |
| Xử lý server | Đọc multipart/base64; một số provider chạy Sharp | Thấp/trung bình | Parse file, rotate, resize, encode lại |
| Cloud AI Vision | OCR + dịch + bbox + JSON, tối đa 6144 output token | **Cao nhất** | Model phải đọc ảnh, suy luận, dịch và sinh nhiều trường |
| Render kết quả | Đọc kích thước ảnh và dựng overlay | Thấp | Chỉ diễn ra sau khi API trả kết quả |

Điểm nghẽn chính là **ảnh lớn + upload + cloud AI Vision**. Tối ưu nút chụp hoặc CSS gần như không làm thời gian chờ AI giảm đáng kể.

## 3. Công cụ lấy hình từ camera

| Công cụ | Ưu điểm | Nhược điểm | Phù hợp |
|---|---|---|---|
| **MediaDevices.getUserMedia + `<video>`** | Chuẩn web phổ biến; chạy PWA/browser; xem preview liên tục; không cần plugin; kiểm soát camera qua constraints | Chỉ hoạt động trong secure context/HTTPS; khác biệt giữa browser/WebView; phải tự capture/encode frame | **Dự án đang dùng**; web/PWA đa nền tảng |
| **Canvas `drawImage` + `toBlob`** | Tương thích rộng; crop/resize/nén trước upload; dễ triển khai | Encode/copy ảnh trên main thread có thể làm UI giật; nếu giữ full resolution/quality cao thì payload lớn | Chụp ảnh tĩnh; **dự án đang dùng** |
| **ImageCapture API (`takePhoto`/`grabFrame`)** | Lấy Blob hoặc ImageBitmap trực tiếp từ `MediaStreamTrack`; có thể truy cập photo capabilities | Tương thích browser không đồng đều; vẫn cần fallback Canvas; `takePhoto` có thể chậm do camera chụp ảnh độ phân giải cao | Progressive enhancement cho Chrome/Android |
| **`@capacitor/camera`** | Dùng camera native; xử lý quyền và ảnh tốt trên app Android/iOS; truy cập tính năng thiết bị | Thường mở native camera UI riêng; không phải lựa chọn lý tưởng để OCR từng frame liên tục; cần plugin/config native | Chụp một ảnh chất lượng cao trong app Capacitor |
| **Camera preview plugin / CameraX / AVFoundation** | Preview native, truy cập frame, autofocus/exposure tốt; phù hợp ML Kit realtime | Tăng code native, plugin và công sức bảo trì; khác biệt Android/iOS | Bản mobile cần dịch camera realtime thật sự |

## 4. Công cụ xử lý frame và nén ảnh

| Công cụ | Ưu điểm | Nhược điểm | Phù hợp |
|---|---|---|---|
| **Canvas API** | Crop ROI, resize và JPEG/WebP ngay trong browser; tương thích tốt | Chạy trên main thread nếu dùng canvas thường; dễ gây giật khi xử lý liên tục | Ảnh tĩnh hoặc frame tần suất thấp |
| **OffscreenCanvas + Web Worker** | Đưa resize/crop/encode khỏi main thread; UI camera mượt hơn; `convertToBlob` thuận tiện | Cần code worker và fallback; không làm giảm thời gian cloud AI; hỗ trợ có khác biệt ở WebView cũ | Web realtime hoặc auto-capture |
| **`createImageBitmap`** | Decode/resize/crop hiệu quả; truyền ImageBitmap sang Worker | Cần quản lý bộ nhớ/`close()`; pipeline phức tạp hơn Canvas đơn giản | Tối ưu frame trước OCR/nén |
| **Sharp trên Next.js server** | Rotate EXIF, resize và nén chất lượng cao; giảm payload gửi tiếp tới AI | Ảnh đã phải upload tới server; encode thêm một lần; tăng CPU server | Chuẩn hóa upload trước cloud AI; project dùng ở OpenAI/Claude |
| **OpenCV.js** | Deskew, threshold, perspective correction, crop và phát hiện vùng chữ trong browser | WASM lớn, CPU cao, khó tối ưu trên mobile; không tự OCR | Tiền xử lý ảnh tài liệu/biển hiệu khó |

## 5. Công cụ OCR realtime từ video

| Công cụ | Ưu điểm | Nhược điểm | Phù hợp |
|---|---|---|---|
| **Google ML Kit Text Recognition v2** | On-device Android/iOS; nhận frame camera; model Chinese; độ trễ thấp; trả bbox; không upload ảnh | Chinese chậm hơn Latin; cần tích hợp native/plugin; model tải lần đầu hoặc tăng app size | **Lựa chọn khuyên dùng cho APK realtime** |
| **Apple Vision text recognition** | On-device iOS; tích hợp camera/native; có thể ưu tiên speed | Chỉ Apple; cần code/plugin iOS; phải benchmark Chinese trên OS đích | App iOS native/Capacitor |
| **PaddleOCR mobile/ONNX** | Self-host/on-device; mạnh với chữ Trung; tùy biến được | Tích hợp mobile và tối ưu model phức tạp; app/model nặng; cần CPU/GPU/NPU phù hợp | Cần offline, kiểm soát model |
| **Tesseract.js Worker** | Chạy trực tiếp trong browser, không gửi ảnh | Khởi tạo/tải language data chậm; CPU cao; khó OCR tiếng Trung ở tốc độ video | PWA offline, xử lý 1–2 frame/giây hoặc thấp hơn |
| **Cloud Vision OCR** | Độ chính xác tốt, API ổn định | Mỗi frame là request/upload/chi phí; không phù hợp gửi 15–30 FPS | Auto-capture thưa, ảnh được chọn lọc |
| **Gemini/OpenAI/Claude Vision** | OCR và dịch theo ngữ cảnh; xử lý ảnh khó | Độ trễ cao, tính token, không tất định; gọi mỗi frame cực tốn và dễ rate-limit | “Chụp rồi dịch” hoặc gọi khi nội dung đã ổn định; **dự án đang dùng kiểu này** |

## 6. Công cụ hỗ trợ realtime khác

| Công cụ/kỹ thuật | Vai trò | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **Web Worker** | Chạy crop/resize/OCR WASM ngoài main thread | Camera/UI không bị đứng | Không giảm network/model latency |
| **Frame throttling** | Chỉ xử lý 1 frame mỗi 300–1000 ms | Giảm CPU, nhiệt, pin và request | Phản hồi không phải từng frame |
| **Backpressure** | Không nhận frame mới khi frame trước chưa xử lý xong | Tránh hàng đợi và kết quả cũ ghi đè | Có thể bỏ qua thay đổi nhanh |
| **ROI/crop guide** | Chỉ OCR vùng người dùng căn chữ vào | Ảnh nhỏ, OCR nhanh và ít nhiễu | Người dùng phải căn khung |
| **Text stability/debounce** | Chỉ dịch khi cùng text xuất hiện 2–3 lần liên tiếp | Tránh dịch lặp và overlay nhảy | Tăng thêm một khoảng chờ nhỏ |
| **Hash/cache text** | Không dịch lại nội dung không đổi | Giảm chi phí và độ trễ lặp | Phải chuẩn hóa text và quản lý cache |
| **AbortController** | Hủy request cũ khi có ảnh mới | Không render kết quả lỗi thời | Request cloud có thể vẫn đã phát sinh chi phí |
| **WebSocket/WebRTC data channel** | Giữ kết nối streaming tùy backend/model | Giảm overhead bắt tay, cho kết quả incremental | Kiến trúc phức tạp; không giúp nếu API model không hỗ trợ streaming image phù hợp |

## 7. Ba kiến trúc đề xuất

### A. Tối ưu ít thay đổi nhất cho web hiện tại

```text
getUserMedia
→ Canvas crop/resize còn khoảng 1280 px
→ JPEG/WebP quality 0.75–0.85
→ upload
→ Gemini Flash OCR + dịch
```

Ưu điểm:

- Không đổi kiến trúc chính.
- Giảm kích thước upload và token ảnh.
- Vẫn giữ chất lượng dịch theo ngữ cảnh.

Nhược điểm:

- Vẫn phải chờ cloud AI.
- Vẫn là chụp rồi dịch, chưa phải video realtime.

### B. Web auto-capture cân bằng

```text
getUserMedia
→ lấy 1 frame mỗi 500–1000 ms
→ OffscreenCanvas/Web Worker + crop ROI
→ OCR local hoặc OCR endpoint nhẹ
→ kiểm tra text ổn định
→ chỉ gửi text mới tới Translation API
```

Ưu điểm:

- Camera có cảm giác realtime.
- Translation API nhận text nhỏ nên nhanh hơn gửi ảnh.
- Không gọi dịch lặp ở mỗi frame.

Nhược điểm:

- OCR browser tiếng Trung cần benchmark.
- Mất một phần khả năng hiểu toàn bộ bố cục ảnh của LLM Vision.

### C. Mobile realtime tốt nhất

```text
CameraX/AVFoundation preview
→ ML Kit Text Recognition on-device
→ throttle + backpressure
→ text stability
→ ML Kit Translation local hoặc Cloud Translation
→ overlay native/webview
```

Ưu điểm:

- Độ trễ thấp nhất, không phải upload ảnh cho OCR.
- Hoạt động tốt hơn trên APK và có thể hỗ trợ offline.
- Chi phí cloud thấp nếu chỉ gửi text mới.

Nhược điểm:

- Cần plugin/native bridge cho Capacitor.
- Phải xử lý tọa độ giữa frame native và overlay WebView.

## 8. Thứ tự tối ưu đề xuất cho dự án

1. **Đo thời gian từng bước**: capture, encode, upload, server preprocess, provider API và render. Không chỉ đo tổng thời gian.
2. **Giảm ảnh trước upload**: giới hạn cạnh dài khoảng 1280–1600 px, JPEG/WebP 0.75–0.85; benchmark độ chính xác chữ nhỏ.
3. **Crop theo khung căn chữ** thay vì gửi toàn ảnh.
4. **Giảm output không cần thiết**: bbox/segments làm response dài; chỉ yêu cầu khi người dùng bật overlay.
5. **Dùng Worker/OffscreenCanvas** nếu UI giật lúc auto-capture.
6. **Nếu cần realtime thật trên APK**, chuyển OCR sang ML Kit on-device và chỉ gửi text sang engine dịch.
7. **Giữ AI Vision làm chế độ chất lượng cao/fallback** cho ảnh khó, font lạ hoặc khi OCR local confidence thấp.

## 9. Lựa chọn nên dùng

| Mục tiêu | Công cụ nên chọn |
|---|---|
| Giữ web hiện tại, cải thiện nhanh | `getUserMedia` + Canvas resize/crop + Gemini Flash |
| Web/PWA auto-scan | `getUserMedia` + OffscreenCanvas Worker + OCR local/throttle + Translation API |
| APK realtime tốt nhất | CameraX/preview plugin + ML Kit Text Recognition + ML Kit/Cloud Translation |
| Chất lượng ảnh khó | Chụp một frame tốt rồi dùng Gemini/OpenAI/Claude Vision |
| Riêng tư/offline | Native camera + ML Kit/PaddleOCR + ML Kit Translation/Argos |

## 10. Nguồn tham khảo

- [MDN: `getUserMedia`](https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: ImageCapture](https://developer.mozilla.org/docs/Web/API/ImageCapture)
- [MDN: OffscreenCanvas](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas)
- [MDN: `createImageBitmap` trong Worker](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/createImageBitmap)
- [Capacitor documentation](https://capacitorjs.com/docs)
- [ML Kit Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- [ML Kit Android text recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [MediaPipe Tasks](https://developers.google.com/edge/mediapipe/solutions/tasks)
- [Tesseract.js](https://tesseract.projectnaptha.com/)

