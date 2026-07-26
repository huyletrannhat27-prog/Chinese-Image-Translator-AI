# Tài liệu thuyết trình: OCR và dịch thuật trong ứng dụng

> Phạm vi: ứng dụng dịch tiếng Trung từ hình ảnh (Trung giản thể/phồn thể → tiếng Việt).  
> Cập nhật: 25/07/2026.

## 1. Tóm tắt để mở đầu bài thuyết trình

Ứng dụng có hai bài toán liên tiếp:

1. **OCR (Optical Character Recognition):** biến chữ trong ảnh thành văn bản máy có thể xử lý.
2. **Dịch thuật:** chuyển văn bản tiếng Trung đã nhận dạng sang tiếng Việt, giữ ngữ cảnh và hiển thị kết quả cho người dùng.

Trong phiên bản hiện tại, **Tesseract.js** nhận dạng chữ Trung trước, sau đó **Gemini API** dịch phần text OCR sang tiếng Việt. Đây là kiến trúc tách rời: OCR chuyên dụng → dịch bằng LLM.

## 2. OCR là gì và app sử dụng OCR ở đâu?

OCR là quá trình phát hiện vùng chữ, nhận dạng ký tự, ghép ký tự thành dòng/câu và trả về văn bản cùng độ tin cậy, tọa độ. Trong app:

```text
Chụp/Upload ảnh
      ↓
Sharp: xoay theo EXIF, resize, nén
      ↓
OCR: đọc chữ Trung + vùng chữ
      ↓
Dịch Trung → Việt
      ↓
Hiển thị câu gốc, câu dịch, confidence và overlay
```

OCR không đồng nghĩa với dịch. OCR chỉ trả lời “ảnh có chữ gì”; dịch thuật trả lời “chữ đó có nghĩa gì trong ngữ cảnh”.

## 3. Các nhóm công cụ OCR

| Công cụ | Kiểu triển khai | Điểm mạnh | Hạn chế chính | Phù hợp với app |
|---|---|---|---|---|
| **Tesseract OCR** | Mã nguồn mở, chạy local/server | Miễn phí, Apache 2.0, offline, nhẹ, nhiều language pack (`chi_sim`, `chi_tra`, `vie`) | Nhạy với ảnh mờ, nghiêng, font lạ và bố cục phức tạp; cần tiền xử lý | Ảnh scan rõ, backend offline, dữ liệu nhạy cảm |
| **PaddleOCR** | Mã nguồn mở, CPU/GPU | Phát hiện vùng chữ + nhận dạng + xoay + layout; mạnh với scene text và tiếng Trung | Cài đặt/model nặng hơn; cần benchmark và tối ưu khi realtime | Self-host chất lượng cao, biển hiệu, screenshot |
| **EasyOCR** | Python/PyTorch | API đơn giản, trả bbox/text/confidence, dựng prototype nhanh | Tốn RAM/thời gian khởi tạo; layout kém chuyên sâu hơn PaddleOCR | Prototype Python, ảnh có chữ rời |
| **Tesseract.js** | WebAssembly trong browser/Node | Có thể chạy offline trong PWA, không cần upload ảnh | Tải model lâu, ngốn CPU/RAM điện thoại; tiếng Trung từng frame khó realtime | Web offline, ảnh tĩnh hoặc frame throttle |
| **ML Kit Text Recognition v2** | On-device Android/iOS | Độ trễ thấp, có bbox và cấu trúc chữ, phù hợp camera | Phải quản lý model; hiệu năng/ngôn ngữ tùy thiết bị | Camera mobile realtime |
| **Google Cloud Vision / Azure Read** | Cloud OCR chuyên dụng | Chính xác, trả cấu trúc tài liệu, mở rộng tốt | Cần mạng/billing, ảnh rời thiết bị, phụ thuộc quota | Production cần SLA hoặc tài liệu phức tạp |
| **Gemini/OpenAI/Claude Vision** | AI đa phương thức | Hiểu ngữ cảnh; có thể OCR + dịch + JSON trong một request | Không hoàn toàn tất định; latency/token cao hơn OCR local; bbox có thể dao động | Chụp ảnh rồi dịch, screenshot, hội thoại |

## 4. Kịch bản chọn Tesseract: vì sao không chọn công cụ khác?

Tesseract là lựa chọn hợp lý khi nhóm ưu tiên:

- **Offline và riêng tư:** ảnh không phải gửi lên cloud; phù hợp dữ liệu cá nhân hoặc tài liệu nội bộ.
- **Chi phí thấp:** không có phí theo request/token và có thể chạy trên máy chủ nhỏ.
- **Dễ kiểm soát:** mã nguồn mở, language pack rõ ràng, có wrapper cho nhiều ngôn ngữ.
- **Có thể tái lập:** cùng ảnh và cùng cấu hình thường cho kết quả ổn định, thuận tiện kiểm thử.
- **Đủ tốt cho ảnh chữ in rõ:** đặc biệt khi ảnh đã được crop, tăng tương phản, khử nhiễu và deskew.

Đổi lại, Tesseract không phải lựa chọn tốt nhất cho mọi tình huống. PaddleOCR thường mạnh hơn với bố cục và chữ trong cảnh; ML Kit phù hợp camera mobile; cloud OCR phù hợp quy mô doanh nghiệp; AI Vision phù hợp khi muốn OCR và dịch theo ngữ cảnh trong một lần gọi.

**Cách trả lời ngắn khi bị hỏi “tại sao không dùng mấy cái kia?”**

> “Nhóm chọn Tesseract vì bài toán cần chạy offline, không mất phí theo ảnh và dễ kiểm soát dữ liệu. Với ảnh scan/chữ in rõ, chất lượng đáp ứng được. Nhóm chấp nhận việc phải tiền xử lý ảnh và không dùng Tesseract cho camera realtime hoặc bố cục quá phức tạp; các trường hợp đó PaddleOCR/ML Kit sẽ phù hợp hơn.”

## 5. Nếu triển khai Tesseract trong app

Một pipeline thực tế nên là:

1. Crop vùng cần đọc, xoay đúng hướng và resize.
2. Chuyển grayscale, tăng tương phản, khử nhiễu, threshold và deskew.
3. Chạy đúng language pack: `chi_sim` hoặc `chi_tra` (có thể kết hợp `vie`/`eng`).
4. Chọn page segmentation mode phù hợp (`--psm 6` cho một khối văn bản, `--psm 11` cho chữ rời).
5. Lấy text, confidence và bbox; loại bỏ kết quả có confidence thấp.
6. Chỉ gửi **text đã ổn định** sang bộ dịch; không gửi ảnh cho mỗi frame camera.

Với web/PWA có thể dùng Tesseract.js trong Web Worker. Với mobile, nên cân nhắc ML Kit hoặc native Tesseract vì WebAssembly có thể chậm và tốn bộ nhớ.

## 6. Các nhóm công cụ dịch thuật

| Công cụ | Kiểu dịch | Điểm mạnh | Hạn chế chính | Phù hợp với app |
|---|---|---|---|---|
| **Google Cloud Translation** | NMT cloud | Nhanh, ổn định, nhiều ngôn ngữ, glossary/custom translation | Cần mạng và billing; ít linh hoạt với tiếng lóng hơn LLM | Dịch text sau OCR, lưu lượng lớn |
| **Azure Translator** | NMT cloud | Autodetect, transliteration, dictionary, hợp hệ sinh thái Azure | Cấu hình tier/region phức tạp; tính phí theo ký tự/target | Hệ thống Microsoft/Azure |
| **DeepL API** | NMT cloud | Văn phong tự nhiên ở cặp ngôn ngữ được hỗ trợ, có glossary | Phạm vi ngôn ngữ hẹp hơn; cần benchmark Trung–Việt | Văn bản cần giọng tự nhiên |
| **Argos Translate** | Offline/self-host | Không API key, riêng tư, có thể chạy local | Chất lượng phụ thuộc model, câu dài/tiếng lóng yếu hơn cloud | Chế độ offline |
| **LibreTranslate** | REST self-host | API nội bộ đơn giản, toàn quyền dữ liệu | Nhóm phải vận hành server/model và chống abuse | Backend nội bộ |
| **ML Kit On-device Translation** | On-device mobile | Nhanh, offline sau khi tải model | Model nhỏ, ngữ cảnh hạn chế; phải kiểm tra cặp Trung–Việt | Camera mobile ưu tiên tốc độ |
| **Gemini/OpenAI/Claude** | LLM đa phương thức | Hiểu ngữ cảnh, tone, tiếng lóng; nhận ảnh trực tiếp; output JSON | Latency/chi phí cao hơn NMT; có thể diễn giải hoặc không nhất quán | Ảnh khó, cần OCR + dịch cùng lúc |

## 7. App hiện đang dùng công cụ dịch nào?

Ứng dụng dùng **Gemini API (`gemini-3.5-flash`)**. Gemini nhận text và danh sách dòng do Tesseract.js trả về, rồi trả bản dịch hoàn chỉnh, segments và `translatedLines` để ghép lại với bbox OCR. Nhược điểm là vẫn phụ thuộc Internet/API key và chi phí token.

## 8. Vì sao không dùng Google Translate/DeepL cho ảnh trực tiếp?

Google Cloud Translation và DeepL chủ yếu nhận **text**, không phải OCR ảnh trong cùng luồng. Nếu dùng chúng, app cần tách thành:

```text
Ảnh → OCR (Tesseract/ML Kit/PaddleOCR) → text → NMT (Google/Azure/DeepL) → giao diện
```

Cách tách này thường nhanh, rẻ và dễ kiểm soát hơn khi đã có text sạch. Ngược lại, LLM Vision thuận tiện cho prototype và ảnh cần hiểu ngữ cảnh, nhưng khó đảm bảo tính tất định như NMT chuyên dụng.

## 9. So sánh kiến trúc để chốt lựa chọn

| Tiêu chí | Tesseract + NMT | OCR on-device + NMT | LLM Vision hiện tại |
|---|---:|---:|---:|
| Offline | Tốt | Tốt sau khi tải model | Không |
| Riêng tư | Tốt | Tốt | Phụ thuộc provider |
| Chi phí mỗi ảnh | Rất thấp | Rất thấp | Theo token/request |
| Camera realtime | Trung bình/thấp | Tốt | Không nên gọi mỗi frame |
| Ngữ cảnh/tiếng lóng | Phụ thuộc NMT | Phụ thuộc NMT | Tốt |
| Tính ổn định bbox | Tốt nếu OCR chuẩn | Tốt | Có thể dao động |
| Dễ làm prototype | Trung bình | Trung bình | Tốt nhất |

**Đề xuất cho các phiên bản:**

- Demo chụp ảnh: giữ Gemini/OpenAI/Claude Vision.
- Bản privacy/offline: Tesseract (hoặc PaddleOCR) → Argos/LibreTranslate.
- Camera realtime mobile: ML Kit OCR → Google Cloud Translation/Azure/ML Kit Translation.

## 10. Kết luận nói trong 30 giây

> “OCR và dịch là hai bước khác nhau. Ứng dụng dùng Tesseract.js để nhận dạng chữ Trung vì dễ kiểm soát, có model `chi_sim`/`chi_tra` và trả được confidence cùng bounding box. Sau đó Gemini API dịch text OCR sang tiếng Việt và trả kết quả theo từng dòng để overlay. Cách này giữ OCR tách biệt với dịch, nhưng phần dịch vẫn cần Internet và API key.”

## 11. Câu hỏi thường gặp

**Tesseract có dịch được không?** Không. Tesseract chỉ nhận dạng chữ; cần một engine dịch riêng.

**Tesseract có phải luôn chính xác hơn AI Vision không?** Không. Kết quả phụ thuộc chất lượng ảnh, ngôn ngữ, bố cục và tiền xử lý. Cần benchmark trên bộ ảnh Trung–Việt thực tế của app.

**Có nên gửi từng frame camera lên LLM không?** Không nên: độ trễ và chi phí cao, kết quả dao động. Hãy throttle frame, phát hiện text ổn định rồi mới dịch.

**Làm sao đánh giá công cụ công bằng?** Dùng cùng một bộ ảnh, đo CER/WER cho OCR, độ đúng bản dịch bằng đánh giá người dùng/BLEU hoặc COMET tham khảo, đồng thời đo latency, RAM, chi phí và tỷ lệ lỗi.

## 12. Nguồn tham khảo

- [Tesseract documentation](https://tesseract-ocr.github.io/tessdoc/)
- [PaddleOCR documentation](https://www.paddleocr.ai/main/en/index/)
- [EasyOCR](https://github.com/JaidedAI/EasyOCR)
- [Tesseract.js](https://tesseract.projectnaptha.com/)
- [ML Kit Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- [Google Cloud Vision OCR](https://cloud.google.com/vision)
- [Google Cloud Translation](https://cloud.google.com/translate)
- [Azure AI Vision Read](https://learn.microsoft.com/azure/ai-services/computer-vision/overview-ocr)
- [DeepL API](https://developers.deepl.com/docs)
- [Argos Translate](https://www.argosopentech.com/)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
