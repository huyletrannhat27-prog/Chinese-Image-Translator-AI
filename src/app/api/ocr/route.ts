import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { runPaddleOcr, PaddleOCRError } from '@/lib/ocr/paddle';

// PaddleOCR chạy qua child_process Python, có thể chậm hơn API route thường.
export const maxDuration = 120;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * OCR độc lập bằng PaddleOCR (self-host), tách khỏi bước dịch - xem
 * _docs/04_ocr_tools.md và _docs/08_accuracy_verification.md. Dùng route
 * /api/verify nếu cần cả OCR + dịch + báo cáo độ chính xác trong 1 lần gọi.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Cần gửi ảnh dạng multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const imageValue = formData.get('image');
    const lang = String(formData.get('lang') || 'ch');

    if (!imageValue || typeof imageValue === 'string') {
      return NextResponse.json({ error: 'Thiếu ảnh để OCR' }, { status: 400 });
    }
    if (imageValue.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Ảnh vượt quá giới hạn 10MB' }, { status: 400 });
    }
    if (!imageValue.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File gửi lên không phải ảnh' }, { status: 400 });
    }

    const sourceBuffer = Buffer.from(await imageValue.arrayBuffer());
    // Chuẩn hoá giống vision.ts/translate route: xoay theo EXIF, resize, nén.
    const optimizedBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    // Optional preprocessing to improve OCR accuracy: convert to greyscale,
    // normalize contrast and sharpen. Controlled by ENABLE_OCR_PREPROCESSING.
    const enablePreproc = (process.env.ENABLE_OCR_PREPROCESSING || '1') !== '0';
    let preprocessedBuffer = optimizedBuffer;
    if (enablePreproc) {
      try {
        preprocessedBuffer = await sharp(optimizedBuffer)
          .greyscale()
          .normalize()
          .sharpen()
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer();
      } catch (preErr) {
        console.warn('OCR preprocessing failed, falling back to optimized image:', preErr);
        preprocessedBuffer = optimizedBuffer;
      }
    }

    const ocrResult = await runPaddleOcr(preprocessedBuffer, { lang });

    return NextResponse.json(ocrResult);
  } catch (error) {
    console.error('PaddleOCR Error:', error);
    const message =
      error instanceof PaddleOCRError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Lỗi OCR không xác định';
    return NextResponse.json({ error: message, code: 'OCR_FAILED' }, { status: 500 });
  }
}
