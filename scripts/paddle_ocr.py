#!/usr/bin/env python3
"""
PaddleOCR CLI wrapper dùng cho Chinese-Image-Translator-AI.

Đọc 1 ảnh, chạy PaddleOCR (nhận diện chữ Trung/Latin/số), in JSON ra stdout
theo đúng schema OCRResult (src/types/index.ts) để Node.js
(src/lib/ocr/paddle.ts) đọc và parse.

Cài đặt: pip install -r scripts/requirements-ocr.txt
Dùng thử: python3 scripts/paddle_ocr.py duong_dan_anh.jpg
Xem thêm: _docs/04_ocr_tools.md (mục PaddleOCR) và
_docs/08_accuracy_verification.md.
"""
import argparse
import json
import os
import sys

# Phải set TRƯỚC khi import paddle/paddleocr (native lib đọc biến này lúc
# khởi tạo). Một số bản paddlepaddle 3.x bị lỗi nội bộ khi chạy vài model
# qua "PIR" (IR mới) kết hợp oneDNN trên CPU - tắt PIR + tắt oneDNN để dùng
# executor/kernel CPU thường, ổn định hơn. Không ảnh hưởng tới độ chính xác
# OCR, chỉ chậm hơn một chút vì không tận dụng tăng tốc oneDNN.
os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "false")

# Trên Windows, khi stdout bị pipe (không phải terminal tương tác - đúng
# trường hợp khi Node.js spawn tiến trình này), Python có thể mặc định dùng
# codepage cũ (vd. cp1252) thay vì UTF-8, gây lỗi UnicodeEncodeError ngay
# khi in chữ Trung ra. Ép UTF-8 tường minh để luôn in được bất kể môi trường.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Vài ký tự phổ biến để phân biệt giản thể/phồn thể - dùng chung logic với
# hàm detectChineseScript() trong src/app/api/detect-script/route.ts để 2 nơi
# cho kết quả nhất quán.
SIMPLIFIED_SET = set(
    "学国开关门问对说话书写爱亲边这还过来时间长马鸟鱼龙风电东南西北见车红绿蓝黄"
)
TRADITIONAL_SET = set(
    "學國開關門問對說話書寫愛親邊這還過來時間長馬鳥魚龍風電東南西北見車紅綠藍黃"
)


def detect_script(text: str) -> str:
    if not text:
        return "simplified"
    simplified_count = sum(1 for ch in text if ch in SIMPLIFIED_SET)
    traditional_count = sum(1 for ch in text if ch in TRADITIONAL_SET)
    total = simplified_count + traditional_count
    if total == 0:
        return "simplified"
    ratio = simplified_count / total
    if ratio > 0.7:
        return "simplified"
    if ratio < 0.3:
        return "traditional"
    return "mixed"


def normalize_ocr_output(ocr_output):
    """
    PaddleOCR đã đổi định dạng trả về qua nhiều bản: bản cũ .ocr() trả
    list[list[[box, (text, score)]]], bản mới (PaddleX pipeline) .predict()
    trả list[dict] với rec_texts/rec_scores/rec_polys. Hàm này gộp cả 2 dạng
    về 1 danh sách (text, score, polygon) phẳng.
    """
    lines = []
    if not ocr_output or not isinstance(ocr_output, list):
        return lines

    first = ocr_output[0] if ocr_output else None

    if isinstance(first, dict):
        for page in ocr_output:
            texts = page.get("rec_texts", []) or []
            scores = page.get("rec_scores", []) or []
            polys = page.get("rec_polys", page.get("dt_polys", [])) or []
            for i, text in enumerate(texts):
                score = float(scores[i]) if i < len(scores) else 0.0
                poly = polys[i] if i < len(polys) else None
                lines.append((text, score, poly))
        return lines

    # Định dạng cũ: mỗi "page" là 1 list các [box, (text, score)]
    for page in ocr_output:
        if not page:
            continue
        for entry in page:
            box, (text, score) = entry[0], entry[1]
            lines.append((text, float(score), box))
    return lines


def build_result(ocr_output, image_width, image_height):
    word_boxes = []
    full_text_parts = []
    confidences = []

    for text, score, poly in normalize_ocr_output(ocr_output):
        if not text or not str(text).strip():
            continue

        # poly có thể là numpy array (từ .predict()/PaddleX) - không dùng
        # "if poly:" trực tiếp vì numpy báo lỗi "truth value ... ambiguous"
        # với mảng có nhiều hơn 1 phần tử. Kiểm tra None + độ dài thay vào đó.
        has_poly = poly is not None and len(poly) > 0
        if has_poly:
            xs = [float(p[0]) for p in poly]
            ys = [float(p[1]) for p in poly]
            bbox = {
                "x0": min(xs),
                "y0": min(ys),
                "x1": max(xs),
                "y1": max(ys),
            }
        else:
            bbox = {"x0": 0.0, "y0": 0.0, "x1": 0.0, "y1": 0.0}

        word_boxes.append({"text": text, "confidence": round(score, 4), "bbox": bbox})
        full_text_parts.append(text)
        confidences.append(score)

    full_text = "\n".join(full_text_parts)
    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "text": full_text,
        "confidence": round(average_confidence, 4),
        "detectedScript": detect_script(full_text),
        "language": "zh",
        "wordBoxes": word_boxes,
        "imageWidth": image_width,
        "imageHeight": image_height,
    }


def get_image_size(image_path):
    try:
        from PIL import Image

        with Image.open(image_path) as img:
            return img.size
    except Exception:
        return 0, 0


def run_ocr(image_path: str, lang: str):
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        print(
            json.dumps(
                {
                    "error": (
                        "PaddleOCR chưa được cài trên máy/server. Chạy: "
                        "pip install -r scripts/requirements-ocr.txt"
                    )
                }
            ),
            file=sys.stderr,
        )
        sys.exit(1)

    # Tham số khởi tạo đổi khá nhiều giữa các bản PaddleOCR (PaddleOCR 3.x
    # dựa trên PaddleX: show_log bị bỏ hẳn, use_angle_cls đổi tên thành
    # use_textline_orientation) - thử dần nhiều bộ tham số, từ mới nhất tới
    # tối thiểu, để không phụ thuộc đúng 1 phiên bản pin cứng.
    #
    # LƯU Ý: bản PaddleOCR mới raise lỗi kiểu khác nhau tuỳ tham số sai
    # (không chỉ TypeError như bản cũ) nên ở đây bắt Exception nói chung,
    # không chỉ TypeError - nếu không các bộ tham số sau sẽ không được thử.
    init_attempts = [
        # Kết hợp: tắt doc-orientation/unwarping/textline-orientation (không
        # cần cho ảnh đã thẳng) VÀ tắt oneDNN (enable_mkldnn=False) - lỗi
        # "ConvertPirAttribute2RuntimeAttribute not support ..." nằm trong
        # chính oneDNN instruction của paddlepaddle 3.x (PIR + oneDNN không
        # tương thích với vài kernel), không chỉ ở model doc-orientation.
        {
            "lang": lang,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "enable_mkldnn": False,
        },
        # Nếu enable_mkldnn không được hỗ trợ ở bản này, thử không có key đó
        {
            "lang": lang,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
        },
        {"lang": lang, "enable_mkldnn": False},
        {"use_textline_orientation": True, "lang": lang},
        {"lang": lang},
        {"use_angle_cls": True, "lang": lang, "show_log": False},
        {"use_angle_cls": True, "lang": lang},
        {},
    ]
    ocr_engine = None
    last_error = None
    for kwargs in init_attempts:
        try:
            ocr_engine = PaddleOCR(**kwargs)
            break
        except Exception as err:  # noqa: BLE001 - cần bắt rộng, xem ghi chú trên
            last_error = err
            continue
    if ocr_engine is None:
        raise last_error or RuntimeError("Không khởi tạo được PaddleOCR")

    # PaddleOCR 3.x ưu tiên .predict(), bản cũ dùng .ocr(). Thử theo thứ tự.
    for call in (
        lambda: ocr_engine.predict(image_path),
        lambda: ocr_engine.ocr(image_path, cls=True),
        lambda: ocr_engine.ocr(image_path),
    ):
        try:
            return call()
        except (AttributeError, TypeError):
            continue
    raise RuntimeError("Không gọi được PaddleOCR (predict()/ocr() đều thất bại)")


def main():
    parser = argparse.ArgumentParser(
        description="Chạy PaddleOCR trên 1 ảnh, in JSON (schema OCRResult) ra stdout"
    )
    parser.add_argument("image_path", help="Đường dẫn ảnh cần OCR")
    parser.add_argument(
        "--lang",
        default="ch",
        help="Model ngôn ngữ PaddleOCR, mặc định 'ch' (chữ Trung, hỗ trợ cả Latin/số)",
    )
    args = parser.parse_args()

    width, height = get_image_size(args.image_path)

    try:
        raw_result = run_ocr(args.image_path, args.lang)
    except Exception as err:  # noqa: BLE001 - in lỗi ra JSON có kiểm soát
        print(json.dumps({"error": f"PaddleOCR lỗi khi xử lý ảnh: {err}"}), file=sys.stderr)
        sys.exit(1)

    output = build_result(raw_result, width, height)
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
