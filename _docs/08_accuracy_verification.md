# Xác định độ chính xác OCR + dịch thuật (PaddleOCR + Gemini)

> Nhiệm vụ: tích hợp công cụ để xác định lại độ chính xác của kết quả OCR
> và bản dịch trả về, sau khi đổi OCR sang PaddleOCR và giữ dịch thuật bằng
> Gemini API (tách 2 bước, không dùng Vision LLM gộp chung như trước).

## 1. Kiến trúc mới

Trước đây (`_docs/04_ocr_tools.md`, `_docs/05_translation_tools.md`): ảnh gửi
thẳng cho Gemini/OpenAI/Claude Vision, model tự OCR + dịch trong 1 request.

Route mới `/api/verify` tách rõ 2 bước:

1. **OCR**: `scripts/paddle_ocr.py` chạy PaddleOCR (self-host, xem
   `_docs/04_ocr_tools.md` mục PaddleOCR) trên ảnh đã chuẩn hoá, trả JSON
   theo type `OCRResult` (`src/types/index.ts`) qua `src/lib/ocr/paddle.ts`.
2. **Dịch**: text OCR được đưa vào `GeminiTranslator.translate()`
   (`src/lib/translation/gemini.ts`) - chỉ gửi text, không gửi lại ảnh.

Route `/api/ocr` cũng được thêm để chỉ chạy riêng bước OCR khi cần.
Route `/api/translate` (Gemini Vision, OCR+dịch gộp) vẫn giữ nguyên, không
bị ảnh hưởng - dùng làm phương án dự phòng / so sánh chất lượng.

## 2. Xác định độ chính xác OCR

PaddleOCR tự tính sẵn confidence cho từng vùng chữ khi nhận dạng - không cần
gọi thêm công cụ ngoài cho bước này. `src/lib/verification/accuracy.ts` hàm
`evaluateOcrAccuracy()`:

- Gộp `wordBoxes[].confidence` PaddleOCR trả về thành `averageConfidence`.
- Gắn cờ (flag) từng vùng có confidence dưới ngưỡng
  `OCR_LOW_CONFIDENCE_THRESHOLD = 0.7` vào `lowConfidenceBoxes`.
- `reliable = true` chỉ khi confidence trung bình đạt ngưỡng **và** không có
  vùng nào bị flag - để UI có thể cảnh báo người dùng xem lại ảnh gốc ở đúng
  vùng chữ mờ/khó đọc thay vì tin tuyệt đối vào text.

## 3. Xác định độ chính xác bản dịch (back-translation)

Bản dịch không có "confidence" đáng tin cậy như OCR (số Gemini tự trả trong
JSON chỉ là model tự đánh giá, không phải phép đo độc lập). Vì dự án chưa có
bản dịch mẫu (reference) để so sánh trực tiếp, `evaluateTranslationAccuracy()`
dùng kỹ thuật phổ biến khi không có reference: **back-translation** (dịch
vòng):

1. Dịch ngược bản tiếng Việt vừa dịch được về lại tiếng Trung, cũng bằng
   `GeminiTranslator`.
2. So sánh bản dịch ngược với text OCR gốc bằng độ tương đồng bigram ký tự
   (`src/lib/verification/textSimilarity.ts`, hệ số Dice) - không cần tách từ
   nên phù hợp với tiếng Trung.
3. `similarityScore` càng cao thì bản dịch càng có khả năng giữ đúng nghĩa
   gốc. Ngưỡng `TRANSLATION_LOW_SIMILARITY_THRESHOLD = 0.55` dùng để đặt cờ
   `reliable`.

**Giới hạn cần lưu ý**: đây là tín hiệu tham khảo, không phải thước đo tuyệt
đối. Một bản dịch tốt vẫn có thể diễn đạt lại (paraphrase) nên back-translation
không khớp 100% với câu gốc - similarity thấp là dấu hiệu nên xem lại bằng
mắt, không nên dùng để tự động từ chối kết quả.

## 4. Response mẫu của `/api/verify`

```json
{
  "ocr": {
    "text": "...",
    "confidence": 0.93,
    "wordBoxes": [{ "text": "...", "confidence": 0.98, "bbox": { "x0": 10, "y0": 20, "x1": 100, "y1": 40 } }]
  },
  "translation": {
    "translation": "...",
    "detectedScript": "simplified",
    "segments": [{ "original": "...", "translated": "..." }],
    "confidence": 0.9
  },
  "accuracy": {
    "ocr": {
      "averageConfidence": 0.93,
      "totalBoxes": 12,
      "lowConfidenceBoxes": [{ "text": "...", "confidence": 0.61 }],
      "reliable": false
    },
    "translation": {
      "method": "back-translation",
      "backTranslatedText": "...",
      "similarityScore": 0.71,
      "reliable": true
    }
  }
}
```

## 5. Cài đặt PaddleOCR (local/dev)

```bash
pip install -r scripts/requirements-ocr.txt
python3 scripts/paddle_ocr.py duong_dan_anh.jpg
```

`paddlepaddle` khá nặng (vài trăm MB) và cài lâu hơn các package Node.js
thông thường trong dự án - đây là điều bình thường, không phải lỗi.

Nếu server không có sẵn `python3` trên PATH, set biến môi trường
`PADDLE_OCR_PYTHON_BIN` trỏ tới interpreter đúng (vd. venv riêng).

## 6. Việc chưa làm / có thể mở rộng thêm

- Hiện `/api/verify` chưa cache/rate-limit như `/api/translate` (Phase 4) -
  nếu đưa vào production nên áp dụng lại `src/lib/cache` và
  `src/lib/rate-limit` cho route này.
- UI (`src/app/page.tsx`) chưa hiển thị `accuracy` - hiện chỉ có ở tầng API,
  cần thêm phần hiển thị cảnh báo/độ tin cậy ở giao diện nếu muốn người dùng
  thấy trực tiếp.
