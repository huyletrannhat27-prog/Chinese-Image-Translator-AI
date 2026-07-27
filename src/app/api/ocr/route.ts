import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const maxDuration = 120;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_REGIONS = 500;

type PaddleRegion = {
  text: string;
  confidence: number;
  orientation: 'horizontal' | 'vertical';
  lineCount: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export async function POST(req: NextRequest) {
  try {
    const serviceUrl = normalizeServiceUrl(
      process.env.PADDLE_OCR_URL
        || (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:8001' : '')
    );
    if (!serviceUrl) {
      return NextResponse.json(
        {
          error: 'PADDLE_OCR_URL chưa được cấu hình',
          code: 'PADDLE_OCR_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const imageValue = formData.get('image');
    if (!imageValue || typeof imageValue === 'string') {
      return NextResponse.json({ error: 'Vui lòng gửi file ảnh' }, { status: 400 });
    }
    if (!imageValue.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File gửi lên không phải ảnh' }, { status: 400 });
    }
    if (imageValue.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Ảnh vượt quá giới hạn 10MB' }, { status: 413 });
    }

    const sourceBuffer = Buffer.from(await imageValue.arrayBuffer());
    const optimizedBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    const paddleForm = new FormData();
    paddleForm.append(
      'image',
      new Blob([new Uint8Array(optimizedBuffer)], { type: 'image/jpeg' }),
      'image.jpg'
    );

    const response = await fetch(`${serviceUrl}/ocr`, {
      method: 'POST',
      body: paddleForm,
      signal: AbortSignal.timeout(110_000),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data && typeof data.detail === 'string'
        ? data.detail
        : `PaddleOCR service trả về lỗi ${response.status}`;
      return NextResponse.json(
        {
          error: detail,
          code: response.status === 422 ? 'PADDLE_OCR_NO_TEXT' : 'PADDLE_OCR_UPSTREAM_ERROR',
        },
        { status: response.status === 422 ? 422 : 502 }
      );
    }

    if (!data || typeof data.text !== 'string' || !data.text.trim()) {
      return NextResponse.json(
        { error: 'PaddleOCR không nhận diện được chữ trong ảnh' },
        { status: 422 }
      );
    }

    const regions = normalizeRegions(data.regions);
    return NextResponse.json({
      text: data.text.trim(),
      confidence: clamp01(data.confidence),
      regions,
      provider: 'paddleocr',
    });
  } catch (error) {
    console.error('PaddleOCR error:', error);
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      {
        error: timedOut
          ? 'PaddleOCR xử lý quá thời gian cho phép'
          : error instanceof Error
            ? error.message
            : 'PaddleOCR xử lý ảnh thất bại',
        code: timedOut ? 'PADDLE_OCR_TIMEOUT' : 'PADDLE_OCR_FAILED',
      },
      { status: 502 }
    );
  }
}

function normalizeServiceUrl(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
}

function normalizeRegions(value: unknown): PaddleRegion[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_REGIONS).flatMap((region): PaddleRegion[] => {
    if (!region || typeof region !== 'object') return [];
    const candidate = region as Record<string, unknown>;
    const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
    const rawBox = candidate.bbox;
    if (!text || !rawBox || typeof rawBox !== 'object') return [];

    const box = rawBox as Record<string, unknown>;
    const x0 = clampCoordinate(box.x0);
    const y0 = clampCoordinate(box.y0);
    const x1 = clampCoordinate(box.x1);
    const y1 = clampCoordinate(box.y1);
    if (x1 <= x0 || y1 <= y0) return [];

    return [{
      text,
      confidence: clamp01(candidate.confidence),
      orientation: candidate.orientation === 'vertical' ? 'vertical' : 'horizontal',
      lineCount: 1,
      bbox: { x0, y0, x1, y1 },
    }];
  });
}

function clampCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1000, number)) : 0;
}

function clamp01(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}
