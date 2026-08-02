import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { runPaddleOcr, PaddleOCRError } from '@/lib/ocr/paddle';
import { GeminiTranslator } from '@/lib/translation/gemini';
import { evaluateOcrAccuracy, evaluateTranslationAccuracy } from '@/lib/verification/accuracy';
import type { OCRResult } from '@/types';

export const maxDuration = 120;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Nhận kết quả OCR từ client để phản hồi nhanh, hoặc tự chạy PaddleOCR khi
 * caller chỉ gửi ảnh. Cả hai nhánh đều dịch text bằng Gemini và đo độ tin
 * cậy OCR + độ tương đồng dịch vòng.
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
    const clientOcrValue = formData.get('ocr');
    const target = String(formData.get('target') || 'vi');

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

    // UI gửi sẵn kết quả Tesseract để tránh khởi tạo Paddle model ~1 phút ở
    // mỗi cold start. API vẫn hỗ trợ PaddleOCR đầy đủ khi chỉ nhận field image.
    const clientOcr = parseClientOcr(clientOcrValue);
    let ocrResult: OCRResult;
    if (clientOcr) {
      ocrResult = clientOcr;
    } else {
      if (!imageValue || typeof imageValue === 'string') {
        return NextResponse.json({ error: 'Thiếu ảnh hoặc kết quả OCR để xử lý' }, { status: 400 });
      }
      if (imageValue.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: 'Ảnh vượt quá giới hạn 10MB' }, { status: 400 });
      }
      if (!imageValue.type.startsWith('image/')) {
        return NextResponse.json({ error: 'File gửi lên không phải ảnh' }, { status: 400 });
      }
      const sourceBuffer = Buffer.from(await imageValue.arrayBuffer());
      const optimizedBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      ocrResult = await runPaddleOcr(optimizedBuffer);
    }
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
    const isPaddleError = error instanceof PaddleOCRError;
    const message = isPaddleError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Lỗi không xác định';
    return NextResponse.json(
      { error: message, code: isPaddleError ? 'PADDLE_OCR_FAILED' : 'VERIFY_PIPELINE_FAILED' },
      { status: 500 }
    );
  }
}

function parseClientOcr(value: FormDataEntryValue | null): OCRResult | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  let parsed: Partial<OCRResult>;
  try {
    parsed = JSON.parse(value) as Partial<OCRResult>;
  } catch {
    throw new Error('Kết quả OCR gửi lên không phải JSON hợp lệ');
  }

  const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
  if (!text || text.length > 50_000) {
    throw new Error('Văn bản OCR rỗng hoặc vượt quá giới hạn');
  }

  const confidence = clampConfidence(parsed.confidence);
  const detectedScript =
    parsed.detectedScript === 'traditional' || parsed.detectedScript === 'mixed'
      ? parsed.detectedScript
      : 'simplified';
  const wordBoxes = Array.isArray(parsed.wordBoxes)
    ? parsed.wordBoxes.flatMap((box) => {
        if (!box || typeof box.text !== 'string' || !box.bbox) return [];
        const { x0, y0, x1, y1 } = box.bbox;
        if (![x0, y0, x1, y1].every(Number.isFinite)) return [];
        return [{
          text: box.text,
          confidence: clampConfidence(box.confidence),
          bbox: { x0, y0, x1, y1 },
        }];
      })
    : [];

  return {
    text,
    confidence,
    detectedScript,
    language: typeof parsed.language === 'string' ? parsed.language : 'zh',
    wordBoxes,
  };
}

function clampConfidence(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}
