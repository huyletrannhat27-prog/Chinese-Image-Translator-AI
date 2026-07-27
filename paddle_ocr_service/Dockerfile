FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY paddle_ocr_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir paddlepaddle==3.2.0 \
        -i https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
    && pip install --no-cache-dir -r requirements.txt

COPY paddle_ocr_service ./paddle_ocr_service

EXPOSE 8001

CMD ["uvicorn", "paddle_ocr_service.app:app", "--host", "0.0.0.0", "--port", "8001"]
