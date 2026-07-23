# So sánh công cụ OCR và dịch thuật

> Cập nhật: 23/07/2026. Giá, hạn mức miễn phí và danh sách ngôn ngữ có thể thay đổi; cần kiểm tra lại trang chính thức trước khi triển khai production.

## 1. Tiêu chí lựa chọn

Một pipeline dịch ảnh thường gồm hai bước:

```text
Ảnh/PDF → tiền xử lý ảnh → OCR → chuẩn hóa văn bản → dịch → hậu kiểm
```

Không có công cụ nào luôn tốt nhất cho mọi loại ảnh. Nên đánh giá bằng tập ảnh thật của ứng dụng theo các tiêu chí:

- **Độ chính xác OCR:** đo CER (Character Error Rate) hoặc WER (Word Error Rate), đặc biệt với dấu tiếng Việt, chữ Trung giản thể/phồn thể, chữ dọc và ảnh chụp màn hình.
- **Chất lượng dịch:** độ đúng nghĩa, tính tự nhiên, bảo toàn tên riêng/thuật ngữ, định dạng và khả năng dùng glossary.
- **Độ trễ và thông lượng:** thời gian xử lý một ảnh, số request đồng thời và giới hạn API.
- **Chi phí toàn pipeline:** OCR thường tính theo ảnh/trang; dịch truyền thống tính theo ký tự; LLM tính theo token và cả dữ liệu ảnh.
- **Quyền riêng tư:** dữ liệu chạy hoàn toàn trên thiết bị, trên máy chủ tự quản hay được gửi tới bên thứ ba.
- **Khả năng triển khai:** Windows, Android/iOS, web backend, CPU/GPU, kích thước model và công sức vận hành.

## 2. Bảng so sánh công cụ OCR

| Công cụ | Kiểu triển khai | Việt / Trung | Chi phí tham khảo | Ưu điểm | Nhược điểm | Phù hợp nhất |
|---|---|---|---|---|---|---|
| **Tesseract OCR** | Mã nguồn mở, chạy offline trên Windows/Linux/macOS; có wrapper cho nhiều ngôn ngữ | Có model `vie`, `chi_sim`, `chi_tra`; phải tải đúng `traineddata` | Miễn phí, Apache 2.0 | Nhẹ, lâu đời, cộng đồng lớn; bảo mật vì xử lý local; có thể huấn luyện/fine-tune; tốt với bản scan sạch, chữ in rõ | Không tự xử lý tốt bố cục phức tạp; nhạy với ảnh nghiêng, mờ, nền nhiễu và font lạ; cần tiền xử lý ảnh; chất lượng model giữa các ngôn ngữ không đồng đều | Desktop/backend offline, tài liệu in sạch, ngân sách thấp |
| **PaddleOCR** | Mã nguồn mở; Python/C++; CPU, GPU và nhiều hướng triển khai edge/server | Có model tiếng Việt và tiếng Trung; các bản/model có phạm vi ngôn ngữ khác nhau | Miễn phí, Apache 2.0 | Pipeline đầy đủ hơn Tesseract: phát hiện vùng chữ, nhận dạng, xoay hướng và phân tích bố cục; mạnh với chữ Trung và ảnh đời thực; cho phép train/fine-tune | Cài đặt và dependency nặng hơn; chọn đúng phiên bản/model khá phức tạp; GPU hữu ích khi cần tốc độ cao; cần benchmark model cụ thể thay vì dựa vào số lượng ngôn ngữ quảng bá | Ứng dụng Trung–Việt offline/self-host, ảnh biển hiệu, screenshot, tài liệu có bố cục |
| **EasyOCR** | Mã nguồn mở trên PyTorch; chạy CPU/GPU | Hỗ trợ hơn 80 ngôn ngữ/script, gồm Trung; có giới hạn về các nhóm ngôn ngữ được nạp cùng lúc | Miễn phí, Apache 2.0 | API Python rất dễ dùng; trả bounding box, text và confidence; model tự tải; prototyping nhanh | Khởi tạo model tốn thời gian và bộ nhớ; dependency PyTorch khá nặng; roadmap chính thức vẫn ghi chữ viết tay là hướng phát triển; ít tính năng document layout hơn PaddleOCR | Prototype Python, ảnh scene text, dự án cần tích hợp nhanh |
| **Windows.Media.Ocr / Windows AI OCR** | On-device trên Windows | Phụ thuộc gói ngôn ngữ/OCR đã cài; cần kiểm tra trực tiếp bằng API trên máy đích | Có sẵn theo nền tảng Windows | Nhanh, không gửi ảnh lên cloud, tích hợp tốt với app Windows; không phải vận hành model riêng | Bị khóa vào Windows; `Windows.Media.Ocr` có ràng buộc package identity với desktop app; hỗ trợ thực tế phụ thuộc phiên bản Windows và language pack; Windows AI API mới có thể yêu cầu phần cứng/Windows phù hợp | App Windows native cần OCR nhanh và riêng tư |
| **Google ML Kit Text Recognition v2** | SDK on-device cho Android/iOS | Nhận dạng các script Latin, Chinese, Devanagari, Japanese, Korean; tiếng Việt thuộc Latin nhưng phải benchmark dấu và font thực tế | SDK on-device, không tính phí theo request; kiểm tra điều khoản/phân phối model | Chạy real-time trên điện thoại; trả block/line/element/symbol, bounding box và confidence; không cần gửi ảnh lên server | Không phải engine OCR tài liệu doanh nghiệp; phạm vi script/model hữu hạn; chất lượng giảm ở chữ nhỏ/mờ hoặc layout khó; làm web/backend không thuận tiện | Camera dịch trực tiếp trên Android/iOS, app ưu tiên offline và độ trễ thấp |
| **Google Cloud Vision API / Document AI** | Cloud REST/RPC API | OCR đa ngôn ngữ; phù hợp chữ in và Vision có nhận dạng chữ viết tay; phải benchmark riêng cặp Trung–Việt | Vision: 1.000 đơn vị đầu/tháng miễn phí, Document Text Detection từ khoảng **1,50 USD/1.000 đơn vị** ở tầng kế tiếp; Document AI tính theo processor/trang | Độ chính xác cao trên ảnh khó; Vision trả cấu trúc page/block/paragraph/word; Document AI mạnh về form, bảng, layout và trích xuất dữ liệu có cấu trúc; dễ scale | Cần mạng, billing và cấu hình Google Cloud; dữ liệu rời thiết bị; chi phí tăng theo ảnh/trang và feature; Document AI phức tạp hơn nếu chỉ cần text thuần | Web/mobile production, tài liệu phức tạp, cần độ chính xác và khả năng mở rộng |
| **Azure AI Vision Read** | Cloud API | Printed OCR có tiếng Việt và nhiều ngôn ngữ, nhận được dòng trộn ngôn ngữ; danh sách chữ viết tay hẹp hơn và cần kiểm tra theo model hiện hành | Trả phí theo tier/giao dịch; có tier thử nghiệm tùy khu vực/tài khoản | Universal model không bắt buộc chỉ định ngôn ngữ; xử lý ảnh và tài liệu nhiều trang; tích hợp tốt với hệ sinh thái Azure | Cần mạng và Azure resource; API/version thay đổi theo vòng đời dịch vụ; chữ viết tay không hỗ trợ rộng bằng chữ in; phải quản lý polling cho tác vụ bất đồng bộ | Doanh nghiệp dùng Azure, tài liệu in đa ngôn ngữ |
| **OCR.space API** | Cloud API; có bản PRO/on-premise | Hỗ trợ nhiều ngôn ngữ nhưng phải kiểm tra engine/language code cho Việt–Trung | Free API công bố giới hạn khoảng **500 request/ngày/IP**, không có SLA; PRO trả phí | REST API đơn giản; thử nghiệm nhanh, không cần dựng model; bản on-premise có thể chạy offline | Free tier không bảo đảm uptime; hạn mức, kích thước file và tính năng theo gói; ít quyền kiểm soát model; không nên là dependency duy nhất cho production | Demo, đồ án nhỏ, fallback không quan trọng SLA |
| **AI Vision đa phương thức (Gemini/OpenAI/Claude)** | Cloud LLM nhận ảnh và xuất text có cấu trúc/dịch trực tiếp | Đa ngôn ngữ, hiểu ngữ cảnh tốt; khả năng phụ thuộc model | Tính theo token và dữ liệu ảnh; một số nhà cung cấp có free tier/credit | Có thể OCR, phân đoạn, hiểu bố cục và dịch trong một request; xử lý tốt ngữ cảnh, font lạ và yêu cầu đầu ra JSON; giảm code ghép nhiều dịch vụ | Không phải OCR tất định: có thể bỏ sót hoặc “đoán” ký tự; khó đạt bounding box chính xác ổn định; chi phí/độ trễ biến động; cần validation, retry và chống prompt injection trong ảnh | Ảnh hội thoại, poster, screenshot cần hiểu ngữ cảnh và dịch tự nhiên |

### Nhận xét quan trọng về OCR

- “Có hỗ trợ tiếng Việt” không đồng nghĩa với độ chính xác luôn cao. Dấu tiếng Việt, font trang trí, độ phân giải và bước tiền xử lý ảnh ảnh hưởng rất lớn.
- Với tiếng Trung, cần test riêng **giản thể**, **phồn thể**, chữ viết dọc và ảnh có cả Trung–Anh. Một số engine không xử lý tốt chữ dọc.
- Tesseract thường hiệu quả hơn sau khi grayscale, tăng tương phản, khử nhiễu, deskew và upscale. PaddleOCR/AI Vision chịu ảnh đời thực tốt hơn nhưng vẫn hưởng lợi từ tiền xử lý.
- Nếu cần tọa độ từng vùng chữ để vẽ overlay, nên ưu tiên OCR chuyên dụng. Nếu chỉ cần bản dịch cuối cùng theo ngữ cảnh, AI Vision có thể đơn giản hóa pipeline.

## 3. Bảng so sánh công cụ dịch thuật

| Công cụ | Kiểu triển khai | Hỗ trợ/ngữ cảnh | Chi phí tham khảo | Ưu điểm | Nhược điểm | Phù hợp nhất |
|---|---|---|---|---|---|---|
| **Google Cloud Translation** | Cloud API, NMT/Translation LLM, text và document | Hơn 100 ngôn ngữ; có Trung–Việt, tự phát hiện ngôn ngữ, glossary và custom/adaptive translation | NMT có credit tương đương 500.000 ký tự đầu/tháng; sau đó khoảng **20 USD/1 triệu ký tự**; document tính theo trang | Phủ ngôn ngữ rộng, tốc độ cao, ổn định, dễ scale; dịch document và giữ định dạng; glossary/custom model cho thuật ngữ | Cần billing và mạng; NMT đôi khi dịch cứng hoặc sai ngữ cảnh; custom/adaptive tốn thêm chi phí và dữ liệu; dữ liệu gửi lên cloud | Production đa ngôn ngữ, lưu lượng lớn, cần SLA và glossary |
| **Azure Translator** | Cloud REST API; text, document, container và custom translation tùy tính năng/tier | Hơn 100 ngôn ngữ/phương ngữ; có Trung–Việt, autodetect, transliteration, dictionary và custom model | Tính theo ký tự; tier F0 từng cung cấp hạn mức miễn phí, giá/tier cần kiểm tra theo region tại thời điểm triển khai | Nhanh, scale tốt; dịch cả document và giữ bố cục; tích hợp Azure; có container cho một số nhu cầu; hỗ trợ nhiều target trong một request | Hệ thống tier/region/feature khá phức tạp; document translation cần thêm hạ tầng Blob trong luồng batch; tính phí nhân theo số ngôn ngữ đích | Doanh nghiệp Microsoft/Azure, dịch tài liệu và localization |
| **DeepL API** | Cloud API cho text/document, glossary | Thường rất tự nhiên ở các ngôn ngữ được hỗ trợ; phải kiểm tra danh sách source/target hiện hành bằng endpoint `/languages` | Các plan mới thay đổi theo thị trường; tài khoản Free cũ có thể có 500.000 ký tự/tháng, plan Developer mới có quota tổng; document có mức ký tự tối thiểu tính phí | Câu văn mượt, kiểm soát hình thức xưng hô ở ngôn ngữ hỗ trợ; glossary và dịch file; API dễ tích hợp | Độ phủ ngôn ngữ/biến thể không rộng bằng Google/Microsoft; gói và quota đã thay đổi; không nên mặc định DeepL luôn tốt nhất cho mọi cặp, đặc biệt phải benchmark Trung–Việt | Nội dung cần văn phong tự nhiên, marketing/tài liệu ở cặp ngôn ngữ được hỗ trợ tốt |
| **LibreTranslate** | API/web app mã nguồn mở, self-host; xây trên Argos Translate | Phụ thuộc các language model được cài trên instance | Phần mềm miễn phí; tự trả chi phí máy chủ/vận hành; public instance có thể có quota/API key | Toàn quyền dữ liệu, API đơn giản, chạy offline/self-host, tránh vendor lock-in | Chất lượng và số cặp ngôn ngữ thấp hơn dịch vụ thương mại/LLM; public instance không phù hợp SLA; phải tự vận hành, cập nhật model và chống lạm dụng | Backend riêng tư, lab/đồ án, API nội bộ không gửi dữ liệu ra ngoài |
| **Argos Translate** | Thư viện/CLI/GUI Python offline dùng OpenNMT | Cài package model theo từng cặp ngôn ngữ; có thể pivot qua ngôn ngữ trung gian | Miễn phí, mã nguồn mở; tự chịu tài nguyên máy | Offline hoàn toàn, dễ nhúng vào Python, cho phép train/đóng gói model; không cần API key | Chất lượng phụ thuộc model và thường kém dịch vụ cloud/LLM ở câu dài, tiếng lóng; pivot nhiều bước làm tích lũy lỗi; model chiếm dung lượng và cần quản lý | App desktop/offline, dữ liệu nhạy cảm, chấp nhận chất lượng vừa phải |
| **Google Gemini API** | Cloud LLM đa phương thức | Hiểu ảnh và văn bản; dịch theo ngữ cảnh, tone, thuật ngữ và có thể OCR+dich một lần | Có free tier giới hạn cho một số model; paid tính theo token đầu vào/đầu ra và model | Mạnh về ngữ cảnh, hội thoại, tiếng lóng; nhận ảnh trực tiếp; có thể xuất JSON theo schema và giải thích chỗ mơ hồ | Đầu ra không hoàn toàn tất định; có thể diễn giải quá mức hoặc làm mất câu; cần prompt, temperature phù hợp, validation và retry; free tier có điều kiện sử dụng dữ liệu khác paid tier | Dịch ảnh/screenshot, nội dung hội thoại, MVP đa phương thức |
| **OpenAI API** | Cloud LLM đa phương thức qua API | Các model mới hỗ trợ text, image input, multilingual và vision; có thể OCR+dich theo hướng dẫn | Tính theo token/model và image input; kiểm tra bảng giá model hiện hành | Hiểu ngữ cảnh và bố cục tốt; dịch tự nhiên; dễ yêu cầu output có cấu trúc, giữ tên riêng và xử lý câu mơ hồ; gộp OCR + dịch | Không phải translation engine tất định; có rủi ro hallucination/bỏ sót; chi phí cao hơn NMT khi dịch khối lượng văn bản lớn; cần giữ API key ở server và kiểm thử model cụ thể | Pipeline AI Vision của web app, nội dung khó và cần output JSON |
| **API Google Translate không chính thức** | Reverse-engineer endpoint web qua thư viện cộng đồng | Có thể phủ nhiều ngôn ngữ giống giao diện web nhưng không có cam kết API | Thường được gọi là “miễn phí” nhưng không có SLA hay hợp đồng sử dụng API | Dễ thử nghiệm cá nhân, không cần thiết lập Google Cloud | Có thể vi phạm điều khoản, thay đổi/bị chặn bất kỳ lúc nào, rate limit không rõ, không có hỗ trợ hoặc SLA; rủi ro bảo mật dependency | **Không khuyến nghị cho production**; dùng API chính thức hoặc LibreTranslate tự host |

### Dịch truyền thống và LLM khác nhau thế nào?

| Tiêu chí | NMT chuyên dụng (Google/Azure/DeepL) | LLM (Gemini/OpenAI/Claude) |
|---|---|---|
| Tốc độ/chi phí ở quy mô lớn | Thường nhanh, dễ dự toán theo ký tự | Thường đắt và chậm hơn vì tính token, nhất là khi gửi ảnh |
| Tính ổn định | Kết quả khá nhất quán | Có biến thiên; cần schema/validation/retry |
| Ngữ cảnh, tiếng lóng, tone | Tốt nhưng phụ thuộc engine và glossary | Thường linh hoạt hơn khi prompt cung cấp đầy đủ ngữ cảnh |
| Thuật ngữ cố định | Glossary/custom model rõ ràng | Có thể đưa glossary vào prompt nhưng không bảo đảm tuyệt đối nếu không hậu kiểm |
| OCR trực tiếp từ ảnh | Không; cần OCR riêng | Có, nếu model hỗ trợ vision |
| Rủi ro “sáng tác” nội dung | Thấp hơn | Cao hơn; phải yêu cầu không đoán và đánh dấu phần không đọc được |

## 4. Combo đề xuất

### A. Miễn phí và offline

- **Windows native:** Windows OCR + Argos Translate.
- **Đa nền tảng/self-host:** PaddleOCR hoặc Tesseract + Argos Translate/LibreTranslate.
- **Lưu ý:** tránh gọi “Google Translate API không chính thức” là giải pháp offline; nó vẫn cần mạng và không có độ ổn định pháp lý/kỹ thuật của API chính thức.

Ưu điểm là riêng tư, không có phí theo request và vẫn hoạt động khi mất mạng. Đổi lại, cần tải model, tốn tài nguyên máy và chất lượng dịch thường thấp hơn cloud/LLM.

### B. Chất lượng và vận hành production

- **OCR:** Google Cloud Vision/Document AI hoặc Azure AI Vision.
- **Dịch:** Google Cloud Translation/Azure Translator; thử DeepL nếu cặp Trung–Việt đang được hỗ trợ và cho kết quả tốt trên bộ test.

Đây là lựa chọn dễ dự toán, scale và giám sát. Nên dùng glossary cho tên sản phẩm, nhân vật, địa danh và thuật ngữ chuyên ngành.

### C. Linh hoạt cho ứng dụng dịch ảnh hiện tại

- **Chính:** Gemini/OpenAI/Claude Vision để OCR + dịch trong một request.
- **Fallback:** PaddleOCR hoặc Tesseract để lấy text, sau đó gửi text vào một translation engine.
- **Validation:** yêu cầu model trả JSON; kiểm tra schema, chuỗi rỗng và confidence; không tự động tin nội dung model đoán từ vùng ảnh mờ.

Kiến trúc fallback giúp ứng dụng không phụ thuộc hoàn toàn vào một provider, đồng thời có thể chọn giữa chi phí, tốc độ và chất lượng.

## 5. Khuyến nghị benchmark cho dự án

Tạo một bộ test tối thiểu 100–300 ảnh thật, chia theo:

1. Trung giản thể, Trung phồn thể, Trung–Anh trộn lẫn.
2. Screenshot rõ, ảnh camera rung/mờ, ảnh nghiêng, ánh sáng yếu.
3. Chữ ngang, chữ dọc, font trang trí, hội thoại manga/manhua.
4. Đoạn ngắn, đoạn dài, tên riêng, tiếng lóng và thuật ngữ chuyên ngành.

Với mỗi pipeline, ghi lại:

- CER/WER của OCR.
- Tỷ lệ bỏ sót vùng chữ và sai giản thể/phồn thể.
- Điểm đánh giá bản dịch bởi người biết tiếng Trung–Việt.
- P50/P95 latency.
- Chi phí trung bình trên 1.000 ảnh.
- Tỷ lệ lỗi, timeout và số lần retry.

Không nên chọn nhà cung cấp chỉ dựa trên mô tả marketing. Pipeline thắng benchmark trên chính dữ liệu của ứng dụng mới là lựa chọn phù hợp.

## 6. Nguồn tham khảo chính thức

### OCR

- [Tesseract: dữ liệu và ngôn ngữ được hỗ trợ](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html)
- [PaddleOCR: tài liệu chính thức](https://www.paddleocr.ai/main/en/index/)
- [PaddleOCR: model đa ngôn ngữ và mã `vi`](https://www.paddleocr.ai/v2.10.0/en/ppocr/blog/multi_languages.html)
- [EasyOCR: repository và hướng dẫn](https://github.com/JaidedAI/EasyOCR)
- [Windows.Media.Ocr API](https://learn.microsoft.com/uwp/api/windows.media.ocr)
- [Windows AI APIs](https://learn.microsoft.com/windows/ai/)
- [ML Kit Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- [Google Cloud Vision OCR chữ viết tay](https://cloud.google.com/vision/docs/handwriting)
- [Google Cloud Vision pricing](https://cloud.google.com/vision/pricing)
- [Google Document AI pricing](https://cloud.google.com/document-ai/pricing)
- [Azure Vision OCR language support](https://learn.microsoft.com/azure/ai-services/computer-vision/language-support)
- [OCR.space Free API](https://ocr.space/ocrapi)

### Dịch thuật và AI Vision

- [Google Cloud Translation: ngôn ngữ](https://cloud.google.com/translate/docs/languages)
- [Google Cloud Translation: giá](https://cloud.google.com/translate/pricing)
- [Azure Translator: tổng quan](https://learn.microsoft.com/azure/ai-services/translator/)
- [Azure Translator: ngôn ngữ](https://learn.microsoft.com/azure/ai-services/translator/language-support)
- [DeepL API: ngôn ngữ](https://developers.deepl.com/api-reference/languages)
- [DeepL API: giới hạn sử dụng](https://developers.deepl.com/docs/resources/usage-limits)
- [Argos Translate và LibreTranslate](https://www.argosopentech.com/)
- [Gemini API: image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini API: pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI API: model và khả năng đa phương thức](https://developers.openai.com/api/docs/models)

