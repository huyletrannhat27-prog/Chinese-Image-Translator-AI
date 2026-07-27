# Tài liệu thuyết trình: Công cụ OCR và dịch thuật

> Dùng cho đồ án dịch chữ tiếng Trung từ hình ảnh.

## 1. Mở đầu

Đồ án tách bài toán thành hai nhiệm vụ độc lập:

1. **OCR:** PaddleOCR nhận ảnh và chuyển chữ trong ảnh thành văn bản.
2. **Dịch thuật:** Gemini nhận văn bản OCR và dịch từ tiếng Trung sang tiếng Việt.

Gemini **không nhận ảnh và không thực hiện OCR**. Cách tách này giúp xác định rõ chất lượng nhận dạng thuộc PaddleOCR, còn chất lượng bản dịch thuộc Gemini.

> “Muốn dịch được ảnh, trước tiên PaddleOCR phải đọc chữ trong ảnh. Sau đó Gemini mới nhận phần văn bản đã đọc được để dịch sang tiếng Việt.”

## 2. Luồng xử lý hiện tại

```text
Người dùng chụp hoặc tải ảnh
            ↓
Next.js dùng Sharp xoay ảnh, resize và nén
            ↓
PaddleOCR service nhận dạng chữ Trung
            ↓
Trả văn bản + confidence + bounding box
            ↓
Next.js chỉ gửi văn bản OCR sang Gemini
            ↓
Gemini dịch Trung → Việt và trả JSON
            ↓
Giao diện hiển thị văn bản gốc, bản dịch
và đặt bản dịch vào bounding box của PaddleOCR
```

Điểm cần nhấn mạnh:

- Ảnh chỉ được gửi đến PaddleOCR service.
- Gemini chỉ nhận chuỗi văn bản và danh sách dòng OCR.
- Bounding box và độ tin cậy đến từ PaddleOCR.
- Bản dịch, loại chữ và các cặp câu đến từ Gemini.
- Không dùng Tesseract.js và không dùng Gemini Vision để OCR.

# PHẦN I — CÔNG CỤ OCR

## 3. OCR có nhiệm vụ gì?

OCR (Optical Character Recognition) chuyển chữ trong ảnh thành văn bản có thể xử lý bằng phần mềm.

Đối với ảnh tiếng Trung, OCR cần xử lý:

- Chữ giản thể và phồn thể.
- Chữ ngang, chữ dọc và chữ bị xoay.
- Chữ nhỏ, ảnh mờ, thiếu sáng hoặc nền phức tạp.
- Tọa độ vùng chữ để overlay bản dịch lên ảnh.
- Điểm tin cậy để người dùng tham khảo.

## 4. So sánh ba công cụ OCR chính

| Công cụ | Chức năng và điểm mạnh | Khó khăn, hạn chế | Đánh giá đối với đồ án |
|---|---|---|---|
| **Tesseract.js** | OCR mã nguồn mở chạy trong trình duyệt hoặc Node.js; có dữ liệu ngôn ngữ tiếng Trung; không cần Python | Tải model và khởi tạo chậm; dùng CPU/RAM phía client; chất lượng giảm với chữ nhỏ, ảnh mờ, nền rối và bố cục khó | Dễ tích hợp với Next.js nhưng chưa đáp ứng tốt ảnh thực tế. **Không còn được sử dụng** |
| **PaddleOCR — được chọn** | Mạnh về phát hiện và nhận dạng chữ Trung; hỗ trợ hướng chữ, confidence, polygon và bounding box; có pipeline OCR chuyên dụng | Cần Python, PaddlePaddle, model riêng và nhiều RAM hơn; lần đầu khởi động phải tải model | Phù hợp nhất vì đây là engine OCR chuyên dụng, trả text và vị trí chữ rõ ràng để giao diện overlay |
| **Gemini Vision** | Có thể nhìn ảnh, nhận dạng chữ và suy luận dựa trên ngữ cảnh | Kết quả OCR và bbox có thể biến thiên; khó tách riêng lỗi OCR với lỗi suy luận; dùng Vision chỉ để OCR có thể lẫn nhiệm vụ với dịch thuật | Có thể làm OCR nhưng không được chọn vì đồ án cần tách riêng bước nhận dạng và bước dịch |

## 5. Vì sao chọn PaddleOCR?

### 5.1. Là công cụ OCR chuyên dụng

PaddleOCR được thiết kế cho phát hiện và nhận dạng văn bản. Kết quả gồm:

- `rec_texts`: các dòng chữ nhận dạng được.
- `rec_scores`: độ tin cậy của từng dòng.
- `rec_boxes` hoặc `rec_polys`: vị trí vùng chữ.

Đây là đúng dữ liệu đồ án cần trước khi dịch.

### 5.2. Phù hợp với chữ Trung

Service cấu hình ngôn ngữ `ch` và bật nhận diện hướng tài liệu, hướng dòng chữ. Điều này phù hợp với ảnh có chữ Trung ngang, dọc hoặc bị xoay.

### 5.3. Model được nạp một lần

PaddleOCR chạy trong một Python service riêng:

```text
Service khởi động → nạp model PaddleOCR → giữ model trong RAM
```

Mỗi request chỉ gửi ảnh đến model đã nạp. Không khởi tạo PaddleOCR lại cho từng ảnh vì cách đó rất chậm và dễ timeout.

### 5.4. Tách biệt trách nhiệm

```text
PaddleOCR = đọc chữ và xác định vị trí
Gemini     = hiểu văn bản và dịch
```

Khi kết quả sai, nhóm có thể kiểm tra rõ:

- Văn bản gốc sai: lỗi ở OCR hoặc chất lượng ảnh.
- Văn bản gốc đúng nhưng bản dịch sai: lỗi ở prompt hoặc mô hình dịch.

## 6. Khó khăn OCR và cách xử lý

| Khó khăn | Cách xử lý trong đồ án |
|---|---|
| Ảnh camera bị xoay | Sharp xoay ảnh theo EXIF trước khi gửi sang PaddleOCR |
| Ảnh quá lớn | Resize cạnh dài tối đa 2560 px và nén JPEG |
| Chữ bị nghiêng hoặc viết dọc | Bật document orientation và text-line orientation |
| Model nặng, khởi động chậm | Chạy service riêng và nạp model một lần |
| Tọa độ phụ thuộc kích thước ảnh OCR | Service chuẩn hóa bbox về thang `0..1000` |
| PaddleOCR không đọc được chữ | API trả lỗi 422, không gọi Gemini với chuỗi rỗng |
| Service không hoạt động | Next.js trả lỗi cấu hình/kết nối rõ ràng |

# PHẦN II — CÔNG CỤ DỊCH THUẬT

## 7. Dịch thuật có nhiệm vụ gì?

Gemini nhận văn bản đã được PaddleOCR tạo ra và thực hiện:

- Dịch từ tiếng Trung sang tiếng Việt.
- Hiểu nghĩa theo toàn câu thay vì dịch từng ký tự.
- Giữ nguyên tên riêng, số, đơn vị và mã sản phẩm.
- Xác định chữ giản thể, phồn thể hoặc hỗn hợp.
- Dịch từng dòng theo đúng thứ tự bbox của PaddleOCR.

## 8. So sánh ba công cụ dịch thuật chính

| Công cụ | Chức năng và điểm mạnh | Khó khăn, hạn chế | Đánh giá đối với đồ án |
|---|---|---|---|
| **Gemini API — được chọn** | Dịch theo prompt và ngữ cảnh; hỗ trợ structured output; có thể trả bản dịch tổng, segments, loại chữ và danh sách bản dịch từng dòng | Cần API key và Internet; phải kiểm soát JSON; bản dịch có thể biến thiên | Phù hợp vì dịch tự nhiên và trả đúng cấu trúc mà giao diện cần. Trong đồ án, Gemini **chỉ nhận text** |
| **Google Cloud Translation** | Dịch máy chuyên dụng, API ổn định, phù hợp lưu lượng văn bản lớn; hỗ trợ glossary và quản lý thuật ngữ | Chỉ trả kết quả dịch, không linh hoạt bằng LLM khi cần segments hoặc schema riêng; cần cấu hình dịch vụ Google Cloud | Phù hợp hệ thống doanh nghiệp và text sạch, nhưng đồ án cần output tùy biến nên không chọn |
| **DeepL API** | Tập trung vào chất lượng văn phong và cung cấp API dịch văn bản/tài liệu | Cần kiểm thử riêng chất lượng cặp Trung–Việt; không xử lý bbox và cần ghép kết quả với từng dòng OCR | Có thể dùng cho dịch text nhưng không thuận tiện bằng Gemini với JSON tùy chỉnh |

## 9. Vì sao chọn Gemini để dịch?

### 9.1. Dịch theo ngữ cảnh văn bản

Gemini nhận toàn bộ văn bản PaddleOCR cùng danh sách từng dòng. Nhờ đó, mô hình hiểu nội dung chung trước khi dịch từng vùng.

### 9.2. Structured output

Gemini được yêu cầu trả JSON:

```json
{
  "translation": "bản dịch hoàn chỉnh",
  "script": "simplified | traditional | mixed",
  "segments": [
    {
      "original": "câu gốc",
      "translated": "câu dịch"
    }
  ],
  "translatedLines": [
    "bản dịch dòng OCR thứ nhất"
  ]
}
```

`translatedLines` phải có số phần tử bằng số vùng PaddleOCR. Nhờ đó, giao diện ghép:

```text
PaddleOCR bbox thứ i ↔ Gemini translatedLines thứ i
```

### 9.3. Gemini không nhìn thấy ảnh

Endpoint dịch chỉ chấp nhận JSON:

```json
{
  "text": "văn bản PaddleOCR",
  "lines": ["dòng 1", "dòng 2"],
  "target": "vi"
}
```

Không có file ảnh hoặc dữ liệu base64 trong request gửi Gemini. Prompt cũng nói rõ mô hình không được thực hiện OCR hoặc tự thêm nội dung không có trong văn bản.

## 10. Khó khăn dịch thuật và cách xử lý

| Khó khăn | Cách xử lý trong đồ án |
|---|---|
| OCR sai dẫn đến dịch sai | Hiển thị cả văn bản PaddleOCR để người dùng đối chiếu |
| Từ tiếng Trung có nhiều nghĩa | Gửi toàn bộ đoạn văn để Gemini dịch theo ngữ cảnh |
| Tên riêng, số và đơn vị bị thay đổi | Prompt yêu cầu giữ nguyên |
| Gemini thêm nội dung | Prompt cấm thêm nội dung không có trong OCR |
| JSON sai định dạng | Dùng `responseMimeType`, JSON schema và parser |
| Số dòng dịch không khớp bbox | Chỉ dùng `translatedLines` khi số phần tử khớp số dòng OCR |
| API key không hợp lệ | Trả mã lỗi cấu hình, không tạo bản dịch mô phỏng |

# KẾT LUẬN CHO BÀI THUYẾT TRÌNH

## 11. Kết luận ngắn

> “Ở phần OCR, nhóm so sánh Tesseract.js, PaddleOCR và Gemini Vision, sau đó chọn PaddleOCR vì đây là engine OCR chuyên dụng cho chữ Trung và trả confidence cùng bounding box rõ ràng. Ở phần dịch thuật, nhóm so sánh Gemini API, Google Cloud Translation và DeepL, sau đó chọn Gemini vì khả năng dịch theo ngữ cảnh và trả JSON theo cấu trúc của ứng dụng. Kiến trúc cuối cùng là PaddleOCR đọc ảnh, còn Gemini chỉ dịch văn bản.”

## 12. Cách chốt bài

> “Đồ án không dùng Gemini Vision để làm tất cả. PaddleOCR chịu trách nhiệm đọc chữ và xác định vị trí trên ảnh. Sau đó Gemini chỉ nhận văn bản để dịch sang tiếng Việt. Việc tách hai công cụ giúp hệ thống rõ ràng, dễ đánh giá và dễ xác định lỗi nằm ở OCR hay dịch thuật.”

## 13. Câu hỏi thường gặp

**Đồ án hiện dùng công cụ nào?**

PaddleOCR cho nhận dạng chữ; Gemini cho dịch thuật.

**Gemini có nhận ảnh không?**

Không. Chỉ PaddleOCR service nhận ảnh. Gemini nhận text và danh sách dòng OCR dưới dạng JSON.

**Đồ án còn dùng Tesseract.js không?**

Không. Dependency và code Tesseract.js đã được loại bỏ.

**Tại sao không dùng Gemini Vision để OCR và dịch luôn?**

Nếu dùng Gemini Vision cho cả hai nhiệm vụ thì khó tách riêng và đánh giá chất lượng OCR. PaddleOCR tạo kết quả nhận dạng độc lập, còn Gemini tập trung vào dịch.

**Tại sao phải chạy Python service riêng?**

PaddleOCR và PaddlePaddle là hệ sinh thái Python, model khá nặng. Service riêng giúp nạp model một lần và cho Next.js gọi qua HTTP.

**Khi PaddleOCR sai thì Gemini có tự sửa theo ảnh không?**

Không. Gemini không nhận ảnh nên chỉ dịch đúng phần văn bản được cung cấp. Giao diện hiển thị văn bản OCR để người dùng nhận biết sai sót.

**Bản dịch được đặt lên ảnh bằng cách nào?**

PaddleOCR trả bbox theo từng dòng. Gemini trả `translatedLines` cùng thứ tự. Giao diện ghép hai mảng theo chỉ số.

## 14. Thuật ngữ chuyên môn

| Thuật ngữ | Giải thích |
|---|---|
| OCR | Nhận dạng ký tự quang học, chuyển chữ trong ảnh thành văn bản |
| PaddleOCR | Bộ công cụ OCR chuyên dụng dựa trên PaddlePaddle |
| Bounding box | Hộp tọa độ bao quanh một vùng chữ |
| Confidence | Điểm tin cậy của kết quả OCR |
| Preprocessing | Tiền xử lý ảnh trước khi OCR |
| Structured output | Phản hồi AI tuân theo cấu trúc JSON được định nghĩa |
| Prompt | Hướng dẫn gửi cho Gemini |
| API key | Khóa cho phép ứng dụng gọi Gemini API |
| Giản thể / Phồn thể | Hai hệ chữ viết tiếng Trung |

## 15. Nguồn tham khảo chính

- [PaddleOCR — Usage tutorial](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html)
- [PaddleOCR — Installation](https://www.paddleocr.ai/main/en/version3.x/installation.html)
- [PaddlePaddle installation](https://www.paddleocr.ai/main/en/version3.x/paddlepaddle_installation.html)
- [Gemini API — Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Google Cloud Translation documentation](https://cloud.google.com/translate/docs)
- [DeepL API documentation](https://developers.deepl.com/docs)
