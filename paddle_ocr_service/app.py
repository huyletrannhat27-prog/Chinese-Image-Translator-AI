import os
import tempfile
from threading import Lock
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from paddleocr import PaddleOCR
from PIL import Image

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_SUFFIXES = {".bmp", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
ocr_engine: PaddleOCR | None = None
inference_lock = Lock()


@asynccontextmanager
async def lifespan(_: FastAPI):
    global ocr_engine
    # Model được nạp một lần khi service khởi động, không nạp lại cho mỗi ảnh.
    ocr_engine = PaddleOCR(
        lang=os.getenv("PADDLE_OCR_LANG", "ch"),
        use_doc_orientation_classify=True,
        use_doc_unwarping=False,
        use_textline_orientation=True,
    )
    yield
    ocr_engine = None


app = FastAPI(title="PaddleOCR Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "modelLoaded": ocr_engine is not None}


@app.post("/ocr")
async def recognize(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File gửi lên không phải ảnh")

    content = await image.read(MAX_IMAGE_SIZE + 1)
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Ảnh vượt quá giới hạn 10MB")
    if not content:
        raise HTTPException(status_code=400, detail="File ảnh rỗng")
    if ocr_engine is None:
        raise HTTPException(status_code=503, detail="Model PaddleOCR chưa sẵn sàng")

    requested_suffix = Path(image.filename or "image.jpg").suffix.lower()
    suffix = requested_suffix if requested_suffix in ALLOWED_SUFFIXES else ".jpg"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        with Image.open(temp_path) as source_image:
            width, height = source_image.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail=f"Ảnh vượt quá giới hạn {MAX_IMAGE_PIXELS:,} pixel",
                )
            source_image.verify()

        predictions = await run_in_threadpool(predict_image, temp_path)
        texts: list[str] = []
        scores: list[float] = []
        regions: list[dict[str, Any]] = []

        for prediction in predictions:
            result = prediction.json
            if callable(result):
                result = result()
            data = result.get("res", result)
            rec_texts = list(data.get("rec_texts") or [])
            rec_scores = list(data.get("rec_scores") or [])
            rec_boxes = data.get("rec_boxes")
            rec_polys = data.get("rec_polys")

            if hasattr(rec_boxes, "tolist"):
                rec_boxes = rec_boxes.tolist()
            if hasattr(rec_polys, "tolist"):
                rec_polys = rec_polys.tolist()

            for index, raw_text in enumerate(rec_texts):
                text = str(raw_text).strip()
                if not text:
                    continue
                score = float(rec_scores[index]) if index < len(rec_scores) else 0.0
                box = get_box(index, rec_boxes, rec_polys)
                if box is None:
                    continue
                x0, y0, x1, y1 = box
                if x1 <= x0 or y1 <= y0:
                    continue

                texts.append(text)
                scores.append(score)
                regions.append({
                    "text": text,
                    "confidence": score,
                    "orientation": "vertical" if y1 - y0 > (x1 - x0) * 1.35 else "horizontal",
                    "lineCount": 1,
                    "bbox": {
                        "x0": clamp(x0 / width * 1000),
                        "y0": clamp(y0 / height * 1000),
                        "x1": clamp(x1 / width * 1000),
                        "y1": clamp(y1 / height * 1000),
                    },
                })

        if not texts:
            raise HTTPException(status_code=422, detail="PaddleOCR không nhận diện được chữ trong ảnh")

        return {
            "text": "\n".join(texts),
            "confidence": sum(scores) / len(scores) if scores else 0.0,
            "regions": regions,
            "imageWidth": width,
            "imageHeight": height,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"PaddleOCR xử lý thất bại: {error}") from error
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


def get_box(index: int, boxes: Any, polygons: Any):
    if isinstance(boxes, list) and index < len(boxes) and len(boxes[index]) >= 4:
        x0, y0, x1, y1 = map(float, boxes[index][:4])
        return x0, y0, x1, y1
    if isinstance(polygons, list) and index < len(polygons):
        points = polygons[index]
        if isinstance(points, list) and points:
            xs = [float(point[0]) for point in points if len(point) >= 2]
            ys = [float(point[1]) for point in points if len(point) >= 2]
            if xs and ys:
                return min(xs), min(ys), max(xs), max(ys)
    return None


def clamp(value: float):
    return max(0.0, min(1000.0, value))


def predict_image(image_path: str):
    if ocr_engine is None:
        raise RuntimeError("Model PaddleOCR chưa sẵn sàng")
    # PaddleOCR/PaddlePaddle dùng chung model trong RAM. Tuần tự hóa inference
    # để tránh nhiều request cùng lúc tranh chấp predictor và tăng vọt bộ nhớ.
    with inference_lock:
        return list(ocr_engine.predict(image_path))
