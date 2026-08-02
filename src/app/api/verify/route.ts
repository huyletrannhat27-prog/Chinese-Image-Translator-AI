import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { runPaddleOcr, PaddleOCRError } from '@/lib/ocr/paddle';
import { GeminiTranslator } from '@/lib/translation/gemini';
import { evaluateOcrAccuracy, evaluateTranslationAccuracy } from '@/lib/verification/accuracy';

export const maxDuration = 120;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Pipeline theo yêu cầu team (nhắn của Nhật Huy): OCR = PaddleOCR (self-host),
 * dịch = Gemini API (chỉ gửi text, không gửi ảnh cho model dịch nữa như
 * /api/translate hiện tại), cộng thêm bước xác định độ chính xác cho cả OCR
 * và bản dịch - xem _docs/08_accuracy_verification.md.
 *
 * Route /api/translate (Gemini Vision, OCR+dịch gộp 1 request) vẫn giữ
 * nguyên làm phương án cũ/dự phòng, không bị ảnh hưởng bởi route này.
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
    const target = String(formData.get('target') || 'vi');

    if (!imageValue || typeof imageValue === 'string') {
      return NextResponse.json({ error: 'Thiếu ảnh để xử lý' }, { status: 400 });
    }
    if (imageValue.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Ảnh vượt quá giới hạn 10MB' }, { status: 400 });
    }
    if (!imageValue.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File gửi lên không phải ảnh' }, { status: 400 });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
    if (apiKey.length < 20) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY chưa hợp lệ. Dán API key hợp lệ vào file .env rồi khởi động lại server.',
          code: 'INVALID_GEMINI_API_KEY',
        },
        { status: 503 }
      );
    }

    const sourceBuffer = Buffer.from(await imageValue.arrayBuffer());
    const optimizedBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    // 1) OCR bằng PaddleOCR (self-host)
    const ocrResult = await runPaddleOcr(optimizedBuffer);
    if (!ocrResult.text.trim()) {
      return NextResponse.json(
        { error: 'PaddleOCR không nhận diện được chữ nào trong ảnh' },
        { status: 422 }
      );
    }

    // 2) Dịch bằng Gemini - chỉ gửi text đã OCR, không gửi lại ảnh
    const translator = new GeminiTranslator(apiKey);
    const translationResult = await translator.translate(ocrResult.text, target, 'zh');

    // 3) Xác định độ chính xác cho cả 2 bước
    const ocrAccuracy = evaluateOcrAccuracy(ocrResult);
    const translationAccuracy = await evaluateTranslationAccuracy(
      ocrResult.text,
      translationResult.translation,
      translator,
      ocrResult.detectedScript
    );

    return NextResponse.json({
      ocr: ocrResult,
      translation: translationResult,
      accuracy: {
        ocr: ocrAccuracy,
        translation: translationAccuracy,
      },
    });
  } catch (error) {
    console.error('Verify pipeline error:', error);
    const message =
      error instanceof PaddleOCRError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Lỗi không xác định';
    return NextResponse.json({ error: message, code: 'VERIFY_PIPELINE_FAILED' }, { status: 500 });
  }
}
