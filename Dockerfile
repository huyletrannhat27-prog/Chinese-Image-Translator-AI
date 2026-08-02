# Dockerfile for deploying Hanzi Lens with PaddleOCR (server-side)
# - Node 20 for Next.js
# - Python3 + pip to run PaddleOCR via scripts/paddle_ocr.py
# Build will install Node deps, Python deps, build Next and start the app

FROM node:20-bullseye-slim

# Install system packages needed by Pillow/sharp and Python
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv build-essential ca-certificates \
    libglib2.0-0 libsm6 libxrender1 libxext6 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package manifests first for better Docker layer caching
COPY package.json package-lock.json ./

# Install Node dependencies (production + dev needed for build)
RUN npm ci

# Copy app source
COPY . .

# Install Python requirements for PaddleOCR (if present)
# This step may require additional system libs for paddlepaddle on some platforms.
RUN python3 -m pip install --upgrade pip setuptools wheel && \
    if [ -f scripts/requirements-ocr.txt ]; then python3 -m pip install -r scripts/requirements-ocr.txt; fi

# Build Next.js app
RUN npm run build

# Runtime environment
ENV NODE_ENV=production
# Default python binary used by src/lib/ocr/paddle.ts
ENV PADDLE_OCR_PYTHON_BIN=/usr/bin/python3
# Render and many platforms provide PORT env var; fallback to 3000
ENV PORT=3000
EXPOSE 3000

# Start command uses provided $PORT
CMD ["sh", "-lc", "npm run start -- --hostname 0.0.0.0 --port ${PORT}"]
