# Tài liệu thuyết trình: Công cụ OCR và dịch thuật

> Phạm vi: ứng dụng dịch hình ảnh tiếng Trung giản thể/phồn thể sang tiếng Việt.
> Cập nhật: 27/07/2026. Chi phí trong tài liệu là giá tham khảo bằng USD, cần kiểm tra lại trang chính thức trước khi triển khai production.

## Tổng quan

Ứng dụng xử lý hai bài toán khác nhau:

1. **OCR:** tìm vùng chữ trong ảnh và chuyển chúng thành văn bản.
2. **Dịch thuật:** hiểu văn bản OCR trong ngữ cảnh và chuyển sang tiếng Việt.

Pipeline hiện tại của Hanzi Lens:

```text
Chụp hoặc tải ảnh
        ↓
Tiền xử lý: phóng lớn, tăng tương phản, sharpen
        ↓
Tesseract.js tạo bản OCR nháp + confidence + bounding box
        ↓
Gemini Vision đối chiếu ảnh, sửa OCR, hiểu ngữ cảnh và dịch
        ↓
Hiển thị bản dịch tiếng Việt trên đúng vùng chữ gốc
```

---

# PHẦN I — CÔNG CỤ OCR

## 1. OCR có nhiệm vụ gì?

OCR (Optical Character Recognition) không thực hiện dịch thuật. Một engine OCR thường trả:

- Văn bản nhận dạng được.
- Độ tin cậy (`confidence`).
- Vị trí chữ (`bounding box`).
- Cấu trúc block, paragraph, line hoặc word.
- Hướng chữ ngang/dọc và ngôn ngữ dự đoán.

Chất lượng OCR phụ thuộc mạnh vào độ phân giải, ánh sáng, độ nghiêng, kích thước chữ, font, nền ảnh và bước tiền xử lý.

## 2. Các cách tiếp cận OCR

### 2.1. OCR mã nguồn mở

Model chạy trên trình duyệt, máy người dùng hoặc server do nhóm quản lý. Cách này không phát sinh phí theo request nhưng nhóm phải tự tối ưu chất lượng và tài nguyên.

Các công cụ tiêu biểu:

- Tesseract OCR và Tesseract.js.
- PaddleOCR.
- EasyOCR.

### 2.2. OCR on-device

Model chạy trực tiếp trên Android/iOS. Phù hợp camera realtime, riêng tư và hoạt động khi mất mạng.

Các công cụ tiêu biểu:

- Google ML Kit Text Recognition v2.
- Apple Vision `VNRecognizeTextRequest`.

### 2.3. OCR cloud chuyên dụng

Ảnh được gửi đến API OCR. Nhà cung cấp chịu trách nhiệm model, hạ tầng và khả năng mở rộng; ứng dụng trả phí theo ảnh/trang/request.

Các công cụ tiêu biểu:

- Google Cloud Vision.
- Azure AI Vision Read.
- Google Document AI.

### 2.4. OCR bằng AI đa phương thức

LLM Vision nhìn trực tiếp ảnh, vừa nhận dạng chữ vừa hiểu bố cục và ngữ cảnh. Phù hợp ảnh khó nhưng kết quả ít tất định hơn OCR chuyên dụng.

Các công cụ tiêu biểu:

- Google Gemini Vision.
- OpenAI Vision.
- Anthropic Claude Vision.

## 3. Bảng so sánh công cụ OCR

| Công cụ | Công dụng và cách tiếp cận | Mức thuận tiện | Hỗ trợ tiếng Trung/bbox | Chi phí sử dụng | Điểm mạnh | Hạn chế |
|---|---|---|---|---|---|---|
| **Tesseract OCR** | OCR truyền thống chạy local/server, dùng language pack | Trung bình; cần cài engine và tiền xử lý | Có `chi_sim`, `chi_tra`; có word/line bbox | Miễn phí, Apache 2.0; chỉ tốn tài nguyên máy/server | Riêng tư, offline, kết quả dễ tái lập, cộng đồng lớn | Yếu với chữ nhỏ, biển báo xa, nền phức tạp, font lạ và chữ nghiêng |
| **Tesseract.js** | Đưa Tesseract sang browser/Node bằng WebAssembly | Cao với web/PWA; import package và tải model | Có thể dùng `chi_sim + chi_tra + eng`; có bbox | Miễn phí; không tính phí request; tốn CPU/RAM và dung lượng model | Không cần backend OCR, ảnh có thể xử lý tại client | Khởi tạo chậm, model lớn, hiệu năng mobile thấp hơn native |
| **PaddleOCR** | Deep learning: text detection + recognition + direction/layout | Trung bình; cần Python/C++, model và runtime | Mạnh với tiếng Trung, scene text, chữ xoay; bbox tốt | Mã nguồn mở; miễn phí phần mềm; tự trả chi phí CPU/GPU/server | Chính xác hơn Tesseract trong nhiều ảnh đời thực; fine-tune được | Dependency nặng, deploy web trực tiếp khó, cần tối ưu GPU/ONNX |
| **EasyOCR** | OCR deep learning dựa trên PyTorch | Dễ cho prototype Python | Có tiếng Trung và bbox | Mã nguồn mở; miễn phí phần mềm; tự trả hạ tầng | API đơn giản, dựng demo nhanh | Model/PyTorch nặng, khởi động chậm, layout kém chuyên sâu hơn PaddleOCR |
| **ML Kit Text Recognition v2** | OCR native chạy on-device Android/iOS | Cao với ứng dụng mobile native | Có model Chinese; trả block/line/element và bbox | SDK on-device được cung cấp miễn phí | Nhanh, offline, riêng tư, phù hợp camera realtime | Cần code native/plugin Capacitor; chất lượng và tốc độ phụ thuộc thiết bị |
| **Apple Vision OCR** | OCR on-device trong hệ sinh thái Apple | Cao nếu app iOS/macOS native | Trả observation và bounding box; cần kiểm tra language support theo OS | Không có phí API riêng; cần thiết bị/hệ sinh thái Apple | Tích hợp camera tốt, riêng tư, có chế độ fast/accurate | Chỉ dùng trên Apple, cần code native |
| **Google Cloud Vision OCR** | API cloud Text Detection/Document Text Detection | Cao; gửi ảnh qua REST/SDK | OCR đa ngôn ngữ, trả page/block/paragraph/word/bbox | 1.000 đơn vị đầu/tháng miễn phí; Text/Document Text Detection khoảng **1,50 USD/1.000 ảnh** ở tier tiếp theo | Scale tốt, ít phải vận hành, xử lý tài liệu tốt | Cần mạng/billing, ảnh rời thiết bị, phí tăng theo số ảnh |
| **Azure AI Vision Read** | API cloud OCR, đồng bộ hoặc bất đồng bộ tùy tác vụ | Cao nếu hệ thống đã dùng Azure | Hỗ trợ printed text đa ngôn ngữ và cấu trúc dòng/từ | Có tier miễn phí và trả phí; giá thay đổi theo region/tier, xem Azure Calculator | Tích hợp hệ sinh thái Microsoft, phù hợp doanh nghiệp | Cấu hình resource/region phức tạp hơn, cần mạng và billing |
| **Gemini Vision** | LLM đa phương thức nhìn ảnh, OCR và suy luận theo ngữ cảnh | Rất cao cho prototype: một request có thể OCR + sửa lỗi + dịch + JSON | Đọc được chữ Trung và có thể yêu cầu bbox chuẩn hóa | Có free tier giới hạn; `gemini-3.5-flash` Standard tham khảo **1,50 USD/1M input token** và **9 USD/1M output token** | Hiểu ảnh khó, bố cục, tên riêng, ngữ cảnh; sửa OCR truyền thống | Không hoàn toàn tất định; bbox có thể dao động; ảnh/token dài làm tăng chi phí |
| **OpenAI/Claude Vision** | LLM đa phương thức nhận ảnh và prompt | Cao; API trực tiếp | Có thể OCR, hiểu layout và trả JSON/bbox theo prompt | Trả phí theo model và token; ảnh được quy đổi thành token | Hiểu ngữ cảnh tốt, phù hợp tài liệu/ảnh khó | Chi phí/latency cao hơn OCR local; output cần validation |

Nguồn giá OCR: [Google Cloud Vision Pricing](https://cloud.google.com/vision/pricing), [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing), [ML Kit](https://developers.google.com/ml-kit/guides).

## 4. Chọn OCR theo nhu cầu

| Nhu cầu | Công cụ nên ưu tiên | Lý do |
|---|---|---|
| Web/PWA, không muốn backend OCR | Tesseract.js | Chạy ngay trong browser, miễn phí theo request |
| Camera Android/iOS realtime | ML Kit Text Recognition | Native, on-device, độ trễ thấp |
| Self-host và cần chất lượng chữ Trung tốt | PaddleOCR | Detection/recognition mạnh với scene text và bố cục phức tạp |
| Tài liệu, form, bảng ở quy mô doanh nghiệp | Cloud Vision/Document AI/Azure Read | API ổn định, scale và trả cấu trúc tài liệu |
| Ảnh nhỏ, biển báo xa, cần hiểu ngữ cảnh | Gemini/OpenAI/Claude Vision | Có thể suy luận dựa trên toàn ảnh thay vì chỉ nhận dạng từng nét |
| Dữ liệu nhạy cảm, bắt buộc offline | Tesseract/PaddleOCR/ML Kit | Không gửi ảnh sang cloud |

## 5. Vì sao app dùng Tesseract.js kết hợp Gemini Vision?

Chỉ dùng Tesseract.js có ưu điểm miễn phí, offline và có bbox, nhưng chất lượng giảm rõ rệt với chữ nhỏ hoặc biển báo ngoài đường. Chỉ dùng Gemini Vision hiểu ngữ cảnh tốt hơn nhưng bbox có thể không ổn định và mọi ảnh đều phải gửi lên cloud.

Ứng dụng dùng cách kết hợp:

- **Tesseract.js** tạo OCR nháp, confidence và bbox ban đầu.
- **Gemini Vision** nhìn ảnh để sửa chữ Tesseract nhận sai, khôi phục chữ nhỏ và hiểu bố cục.
- Gemini dịch theo ngữ cảnh và trả `visualRegions`.
- Nếu Gemini thiếu vùng, app có thể fallback về bbox Tesseract.

Đây là sự cân bằng giữa khả năng kiểm soát của OCR chuyên dụng và khả năng hiểu ngữ cảnh của AI Vision.

---

# PHẦN II — CÔNG CỤ DỊCH THUẬT

## 6. Dịch thuật có nhiệm vụ gì?

Bộ dịch nhận văn bản nguồn và tạo văn bản đích. Ngoài đúng nghĩa từng từ, ứng dụng Trung–Việt còn cần:

- Hiểu nghĩa theo cả câu/biển báo.
- Phân biệt tên đường, địa danh và tên riêng.
- Giữ nguyên số, đơn vị và mã sản phẩm.
- Xử lý giản thể/phồn thể.
- Trả kết quả có cấu trúc để ghép với bbox OCR.

## 7. Các cách tiếp cận dịch thuật

### 7.1. NMT cloud chuyên dụng

Neural Machine Translation được tối ưu cho tốc độ, tính ổn định và lưu lượng lớn.

- Google Cloud Translation.
- Azure Translator.
- DeepL API.

### 7.2. Dịch bằng LLM

LLM hiểu prompt, ngữ cảnh, văn phong và có thể trả JSON. Model Vision còn có thể đối chiếu trực tiếp ảnh gốc.

- Gemini API.
- OpenAI API.
- Anthropic Claude API.

### 7.3. Dịch offline/on-device

Model chạy tại máy người dùng hoặc server nội bộ, không gửi nội dung ra bên ngoài.

- Argos Translate.
- LibreTranslate.
- ML Kit On-device Translation.

## 8. Bảng so sánh công cụ dịch thuật

| Công cụ | Công dụng và cách tiếp cận | Mức thuận tiện | Ngữ cảnh Trung–Việt | Chi phí sử dụng | Điểm mạnh | Hạn chế |
|---|---|---|---|---|---|---|
| **Gemini API** | LLM text/vision; dịch bằng prompt và trả JSON | Rất cao; app có thể gửi ảnh + OCR nháp trong một request | Tốt với biển báo, hội thoại, tên riêng và câu cần suy luận | Có free tier giới hạn; `gemini-3.5-flash` Standard tham khảo 1,50 USD/1M input token và 9 USD/1M output token | Hiểu ngữ cảnh, sửa OCR, dịch tự nhiên, tạo segments/visualRegions | Kết quả có biến thiên; cần schema, validation và retry; phụ thuộc mạng |
| **Google Cloud Translation** | NMT/Translation LLM nhận text hoặc document | Cao; REST/SDK rõ ràng | Ổn định với text sạch; NMT ít linh hoạt hơn LLM ở tiếng lóng | NMT: credit tương đương 500.000 ký tự đầu/tháng; sau đó khoảng **20 USD/1M ký tự** | Nhanh, dễ dự toán, glossary, document/custom translation | Không OCR ảnh; cần một bước OCR trước; tính phí theo ký tự/target |
| **Azure Translator** | NMT cloud, document/custom translation | Cao nếu đã dùng Azure | Tốt với văn bản thông dụng; có dictionary/transliteration | Có free tier và pay-as-you-go; giá phụ thuộc region/agreement, xem Azure Calculator | Hợp hệ sinh thái Microsoft, scale và SLA doanh nghiệp | Portal/tier phức tạp; không tự hiểu ảnh trong API dịch text |
| **DeepL API** | NMT cloud tập trung chất lượng văn phong | Cao; API text/file rõ ràng | Cần benchmark riêng cho cặp Trung–Việt và loại nội dung | Có gói Free/Pro; quota, phí cố định và phí ký tự phụ thuộc plan hiện hành | Văn phong tự nhiên ở các cặp ngôn ngữ mạnh, glossary tốt | Phủ ngôn ngữ/tính năng hẹp hơn Google/Microsoft; không OCR ảnh trực tiếp |
| **OpenAI API** | LLM text/vision, dịch theo prompt | Cao | Tốt với ngữ cảnh, tone và output có cấu trúc | Trả phí theo model, input/output token và ảnh | Linh hoạt, reasoning tốt, nhận ảnh trực tiếp | Chi phí khó dự toán hơn NMT; cần chống hallucination |
| **Claude API** | LLM text/vision, mạnh với tài liệu và context dài | Cao | Tốt với tài liệu dài và prompt chi tiết | Trả phí theo model và token | Context dài, dịch/giải thích linh hoạt | Cần mạng, billing và validation; không phải engine dịch tất định |
| **Argos Translate** | Thư viện/CLI/GUI dịch offline bằng model cài local | Trung bình; cần Python và model ngôn ngữ | Phụ thuộc model; thường yếu hơn cloud/LLM ở câu khó | Mã nguồn mở, không phí API; tự trả tài nguyên máy | Riêng tư, offline, không API key | Chất lượng cặp ngôn ngữ không đồng đều; pivot làm tích lũy lỗi |
| **LibreTranslate** | REST API self-host xây trên Argos | Cao với client vì dùng REST; vận hành server ở mức trung bình | Chất lượng phụ thuộc model Argos | Mã nguồn mở khi self-host; tốn server/bảo trì; hosted service có gói riêng | Dễ tạo API nội bộ, toàn quyền dữ liệu | Phải quản lý scale, model, bảo mật và chống abuse |
| **ML Kit On-device Translation** | Model dịch chạy trực tiếp Android/iOS sau khi tải | Cao trên mobile native | Phù hợp câu đơn giản; Trung–Việt có thể đi qua tiếng Anh trung gian | SDK on-device miễn phí | Offline, nhanh, riêng tư, không phí request | Chất lượng hạn chế hơn cloud; model chiếm bộ nhớ; không phù hợp văn bản chuyên ngành |

Nguồn giá dịch: [Google Cloud Translation Pricing](https://cloud.google.com/translate/pricing), [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing), [Azure Translator Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/translator/), [ML Kit Translation](https://developers.google.com/ml-kit/language/translation).

## 9. So sánh NMT chuyên dụng và LLM

| Tiêu chí | NMT chuyên dụng | LLM/Gemini |
|---|---|---|
| Input chính | Văn bản sạch | Văn bản, prompt và có thể cả ảnh |
| Tốc độ text ngắn | Thường nhanh và ổn định | Thường chậm hơn do sinh token |
| Ngữ cảnh/tiếng lóng | Tốt nhưng ít linh hoạt | Thường hiểu ngữ cảnh tốt hơn |
| Glossary/thuật ngữ cố định | Có tính năng chính thức | Điều khiển bằng prompt, không bảo đảm tuyệt đối |
| Output JSON/segments/bbox | Không hoặc cần xử lý thêm | Có thể yêu cầu trực tiếp |
| Tính tất định | Cao hơn | Có biến thiên; cần schema/retry |
| Chi phí lớn | Dễ dự toán theo ký tự | Theo token; ảnh và reasoning làm tăng chi phí |
| Phù hợp app dịch ảnh | Cần OCR riêng trước | Có thể đối chiếu ảnh và sửa OCR |

## 10. Vì sao app chọn Gemini để dịch?

Ứng dụng không chỉ cần một bản dịch text thông thường. Nó còn cần:

- Đối chiếu ảnh gốc khi Tesseract nhận sai.
- Hiểu biển báo và bố cục nhiều dòng.
- Dịch tự nhiên theo ngữ cảnh.
- Trả `correctedText`, `segments`, confidence và `visualRegions`.
- Dùng bounding box để đặt bản dịch trở lại ảnh.

Google Cloud Translation, Azure Translator và DeepL phù hợp hơn khi đầu vào đã là text sạch và cần tốc độ/chi phí ổn định. Gemini phù hợp với Hanzi Lens vì ảnh thực tế thường chứa chữ nhỏ, chữ Trung lẫn Latin, tên đường và bố cục khó.

## 11. Lựa chọn theo nhu cầu dịch

| Nhu cầu | Công cụ nên ưu tiên |
|---|---|
| Dịch text số lượng lớn, cần chi phí ổn định | Google Cloud Translation hoặc Azure Translator |
| Dịch cần văn phong tự nhiên, cặp ngôn ngữ đã được kiểm chứng | DeepL |
| Dịch ảnh và cần sửa OCR theo ngữ cảnh | Gemini/OpenAI/Claude Vision |
| Offline hoàn toàn | Argos Translate hoặc ML Kit Translation |
| Muốn REST API nội bộ và toàn quyền dữ liệu | LibreTranslate |
| Cần glossary/thuật ngữ doanh nghiệp | Google Cloud Translation, Azure Custom Translator hoặc DeepL glossary |

---

# KẾT LUẬN CHO BÀI THUYẾT TRÌNH

## 12. Kết luận ngắn

> “OCR và dịch thuật là hai bước khác nhau. Tesseract.js giúp ứng dụng nhận dạng chữ tại client, trả confidence và vị trí chữ mà không phát sinh phí OCR theo ảnh. Tuy nhiên, OCR truyền thống yếu với biển báo xa và chữ nhỏ. Vì vậy, ứng dụng dùng Gemini Vision để đối chiếu ảnh, sửa kết quả OCR, hiểu ngữ cảnh và dịch sang tiếng Việt. Cách kết hợp này tận dụng khả năng kiểm soát của Tesseract và khả năng suy luận của Gemini.”

## 13. Câu hỏi thường gặp

**Tesseract có dịch được không?**

Không. Tesseract chỉ nhận dạng ký tự. Gemini hoặc một translation engine khác mới thực hiện dịch.

**Tại sao không chỉ dùng Tesseract?**

Tesseract hoạt động tốt với tài liệu sạch nhưng dễ sai khi chữ nhỏ, ảnh nghiêng, nền phức tạp hoặc biển báo xa. Nó cũng không hiểu ngữ cảnh để tự sửa từ.

**Tại sao không chỉ dùng Gemini Vision?**

Gemini hiểu ngữ cảnh tốt nhưng cần mạng, phát sinh token và bbox có thể dao động. Tesseract cung cấp một kết quả OCR/bbox độc lập để kiểm tra và fallback.

**Công cụ nào rẻ nhất?**

Tesseract, PaddleOCR, EasyOCR, Argos và LibreTranslate self-host không thu phí theo request, nhưng vẫn có chi phí thiết bị/server và công vận hành. Cloud API thuận tiện hơn nhưng tính phí theo ảnh, ký tự hoặc token.

**Đánh giá công cụ thế nào cho công bằng?**

Dùng cùng một bộ ảnh thật của ứng dụng; đo CER/WER cho OCR, đánh giá bản dịch bằng người dùng/BLEU/COMET tham khảo, đồng thời đo latency, RAM, dung lượng model, tỷ lệ lỗi và chi phí trên 1.000 ảnh.

## 14. Nguồn tham khảo chính

- [Tesseract documentation](https://tesseract-ocr.github.io/tessdoc/)
- [Tesseract.js](https://tesseract.projectnaptha.com/)
- [PaddleOCR documentation](https://www.paddleocr.ai/main/en/index/)
- [EasyOCR](https://github.com/JaidedAI/EasyOCR)
- [ML Kit Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- [Google Cloud Vision Pricing](https://cloud.google.com/vision/pricing)
- [Azure AI Vision OCR](https://learn.microsoft.com/azure/ai-services/computer-vision/overview-ocr)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google Cloud Translation Pricing](https://cloud.google.com/translate/pricing)
- [Azure Translator Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/translator/)
- [DeepL API](https://developers.deepl.com/docs)
- [Argos Translate](https://www.argosopentech.com/)
- [LibreTranslate](https://libretranslate.com/)
- [ML Kit Translation](https://developers.google.com/ml-kit/language/translation)
