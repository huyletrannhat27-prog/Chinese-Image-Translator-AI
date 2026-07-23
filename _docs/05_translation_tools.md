# Công cụ dịch thuật

> Cập nhật: 23/07/2026. File này chỉ đánh giá bước **dịch văn bản**. OCR và camera realtime được tách sang tài liệu riêng.

## 1. Dự án đang dùng công cụ dịch nào?

Dự án cho phép chọn ba AI đa phương thức:

1. **Google Gemini 3.5 Flash** – lựa chọn mặc định.
2. **OpenAI** – model đọc từ `OPENAI_MODEL`, mặc định trong code là `gpt-5.6-terra`.
3. **Anthropic Claude** – model đọc từ `CLAUDE_MODEL`, mặc định trong code là `claude-haiku-4-5-20251001`.

Ảnh được đưa thẳng vào model. Model thực hiện **OCR + dịch Trung–Việt + tạo vùng overlay trong cùng một request**. Dự án chưa dùng Google Cloud Translation, Azure Translator, DeepL, Argos hay LibreTranslate trong luồng hiện tại.

## 2. Dịch máy chuyên dụng trên cloud

| Công cụ | Ưu điểm | Nhược điểm | Chi phí tham khảo | Nên dùng khi |
|---|---|---|---|---|
| **Google Cloud Translation** | Hơn 100 ngôn ngữ; Trung–Việt; nhanh, ổn định, scale tốt; autodetect, glossary, custom/adaptive translation và dịch document | Cần mạng/billing; NMT đôi khi cứng ở hội thoại/tiếng lóng; custom model cần dữ liệu và chi phí | NMT có credit tương đương 500.000 ký tự đầu/tháng; sau đó khoảng 20 USD/1 triệu ký tự; kiểm tra lại trước production | Dịch text realtime sau OCR, lưu lượng lớn, cần glossary/SLA |
| **Azure Translator** | Hơn 100 ngôn ngữ/phương ngữ; autodetect, transliteration, dictionary, document và custom translation | Tier/region/feature phức tạp; dịch batch document cần thêm luồng storage; tính phí theo số target | Tính theo ký tự/tier; kiểm tra portal theo region | Hệ thống dùng Azure/Microsoft |
| **DeepL API** | Văn phong tự nhiên ở các cặp được hỗ trợ tốt; glossary; dịch file; API rõ ràng | Phủ ngôn ngữ/biến thể hẹp hơn Google/Microsoft; quota/plan thay đổi; phải benchmark riêng Trung–Việt | Theo plan và ký tự; quota Free cũ/mới khác nhau | Nội dung cần văn phong, khi cặp ngôn ngữ đã được kiểm chứng |

## 3. Dịch offline và self-host

| Công cụ | Ưu điểm | Nhược điểm | Nên dùng khi |
|---|---|---|---|
| **Argos Translate** | Thư viện/CLI/GUI Python; offline; không cần API key; train và đóng gói model được | Chất lượng phụ thuộc model; câu dài/tiếng lóng thường kém cloud/LLM; pivot qua ngôn ngữ trung gian tích lũy lỗi | Desktop/offline, dữ liệu nhạy cảm |
| **LibreTranslate** | REST API mã nguồn mở, self-host; chạy trên Argos; toàn quyền dữ liệu | Tự vận hành, cập nhật model, chống abuse; chất lượng/số cặp thấp hơn dịch vụ thương mại | Cần API nội bộ, riêng tư |
| **ML Kit On-device Translation** | Dịch trực tiếp trên Android/iOS; không cần gửi text lên server sau khi tải model; độ trễ thấp | Model mobile nhỏ nên chất lượng/ngữ cảnh hạn chế; phải tải/quản lý model; cần kiểm tra cặp ngôn ngữ và chất lượng thực tế | Camera mobile realtime, ưu tiên tốc độ/offline |

## 4. Dịch bằng LLM đa phương thức

| Công cụ | Ưu điểm | Nhược điểm | Nên dùng khi |
|---|---|---|---|
| **Google Gemini API** | Nhận ảnh trực tiếp; hiểu ngữ cảnh, tiếng lóng, tone; OCR + dịch một request; JSON schema | Không hoàn toàn tất định; có thể diễn giải/bỏ sót; ảnh và output dài làm tăng token/độ trễ | Ảnh hội thoại/screenshot; **mặc định hiện tại** |
| **OpenAI API** | Multilingual/vision; hiểu bố cục; dịch tự nhiên; output có cấu trúc | Cần mạng; tính token/image detail; có thể hallucinate; thường tốn hơn NMT ở volume lớn | Ảnh khó, cần reasoning và JSON |
| **Anthropic Claude API** | Hiểu ngữ cảnh/tài liệu; prompt linh hoạt; có thể nhận ảnh | Cần mạng; độ trễ/giá tùy model; không phải translation engine tất định | Provider thay thế hoặc so sánh chất lượng |

## 5. Dịch chuyên dụng hay LLM?

| Tiêu chí | NMT chuyên dụng | LLM |
|---|---|---|
| Độ trễ text ngắn | Thường thấp và ổn định hơn | Thường cao hơn vì sinh token |
| Chi phí số lượng lớn | Dễ dự toán theo ký tự | Tính theo token; ảnh làm tăng chi phí |
| Ngữ cảnh/tiếng lóng | Tốt nhưng ít linh hoạt hơn | Thường hiểu ngữ cảnh tốt hơn |
| Thuật ngữ cố định | Glossary/custom model rõ ràng | Có thể nhắc trong prompt nhưng không bảo đảm tuyệt đối |
| Nhận ảnh trực tiếp | Không | Có nếu model hỗ trợ vision |
| Tính nhất quán | Cao hơn | Có biến thiên, cần validation/retry |

## 6. Khuyến nghị cho camera realtime

### Ưu tiên tốc độ

Chạy OCR on-device, sau đó chỉ gửi **text mới hoặc text đã ổn định** tới Google Cloud Translation/Azure Translator. Không gửi lại cùng một đoạn text ở mọi frame.

### Ưu tiên offline

Dùng ML Kit Translation trên mobile hoặc Argos Translate ở desktop/server local. Chất lượng cần được đánh giá bằng dữ liệu Trung–Việt thật.

### Ưu tiên chất lượng theo ngữ cảnh

Giữ Gemini/OpenAI/Claude, nhưng chỉ gọi sau khi người dùng bấm chụp hoặc sau khi OCR phát hiện nội dung đã ổn định. Không gọi một LLM Vision mới cho mọi frame camera.

## 7. Cảnh báo về Google Translate không chính thức

Không khuyến nghị reverse-engineer endpoint web hoặc dùng package “Google Translate miễn phí” không chính thức cho production. Các endpoint này có thể thay đổi, bị chặn, không có SLA và có rủi ro điều khoản sử dụng. Nên dùng Cloud Translation chính thức hoặc giải pháp self-host.

## 8. Nguồn tham khảo

- [Google Cloud Translation languages](https://cloud.google.com/translate/docs/languages)
- [Google Cloud Translation pricing](https://cloud.google.com/translate/pricing)
- [Azure Translator](https://learn.microsoft.com/azure/ai-services/translator/)
- [Azure Translator language support](https://learn.microsoft.com/azure/ai-services/translator/language-support)
- [DeepL API languages](https://developers.deepl.com/api-reference/languages)
- [DeepL API limits](https://developers.deepl.com/docs/resources/usage-limits)
- [Argos Translate và LibreTranslate](https://www.argosopentech.com/)
- [ML Kit](https://developers.google.com/ml-kit)
- [Gemini API image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [OpenAI API models](https://developers.openai.com/api/docs/models)

