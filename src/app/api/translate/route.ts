import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { GoogleGenAI, Part, ApiError } from '@google/genai';
import sharp from 'sharp';
import { checkTranslateRateLimit, getClientIdentifier, retryAfterSecondsFromReset } from '@/lib/rate-limit';
import {
  buildTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
  withSingleFlight,
} from '@/lib/cache';
import {
  createTimeoutSignal,
  isRetryableStatus,
  makeRetryableError,
  withRetry,
  type RetryableCallError,
} from '@/lib/retry';
=======
import { GoogleGenAI } from '@google/genai';
>>>>>>> origin/main

export const maxDuration = 60;

<<<<<<< HEAD
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const GEMINI_MODEL = 'gemini-3.5-flash';
// Bump khi buildTranslationPrompt() đổi nội dung, để cache không trả bản dịch
// cũ theo prompt đã lỗi thời (mục 4.3 tài liệu Phase 4).
const PROMPT_VERSION = 'v1';

=======
>>>>>>> origin/main
type TranslationInput = {
  text: string;
  target: string;
  source: string;
  lines?: string[];
};

type GeminiTranslationPayload = {
  translation: string;
  detectedScript: string;
  segments: Array<{ original: string; translated: string }>;
  confidence: number;
  provider: string;
  translatedLines?: string[];
  correctedText?: string;
  overlayRegions?: ReturnType<typeof normalizeVisualRegions>;
};

export async function POST(req: NextRequest) {
  // 1) Rate limiting - dùng CHUNG bucket với /api/translate/openai và
  // /api/translate/claude (src/lib/rate-limit) để user không né giới hạn
  // bằng cách đổi provider trên UI.
  const identifier = getClientIdentifier(req);
  const rate = await checkTranslateRateLimit(identifier);
  if (!rate.success) {
    const retryAfterSeconds = retryAfterSecondsFromReset(rate.reset);
    return NextResponse.json(
      {
        error: `Bạn đã gửi quá nhiều yêu cầu dịch. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
        code: 'RATE_LIMITED',
      },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  try {
    const { text, target, source, lines } = await readTranslationInput(req);
    if (!text.trim()) {
      return NextResponse.json({ error: 'Không có văn bản OCR để dịch' }, { status: 400 });
    }

    const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
    if (!isGeminiApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY chưa được cấu hình hợp lệ', code: 'INVALID_GEMINI_API_KEY' },
        { status: 503 }
      );
    }

<<<<<<< HEAD
    // Prompt engineering
    const ocrText = text.trim() || '[OCR không đọc được chữ; hãy nhận diện trực tiếp từ ảnh]';
    const prompt = buildTranslationPrompt(ocrText, target, lines, Boolean(image));

    // 2) Cache - key theo ảnh ĐÃ CHUẨN HOÁ (sau Sharp, xem readTranslationInput
    // bên dưới) hoặc text nếu không có ảnh, cộng provider/model/source/target/
    // promptVersion (mục 4.1 tài liệu Phase 4).
    const cacheKey = buildTranslationCacheKey({
      imageData: image?.data,
      text: image ? undefined : ocrText,
      provider: 'gemini',
      model: GEMINI_MODEL,
      source: 'zh',
      target,
      promptVersion: PROMPT_VERSION,
    });

    const cached = await getCachedTranslation<GeminiTranslationPayload>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // 3) Cache miss -> gọi Gemini, có retry + timeout + single-flight (2 request
    // giống hệt đến gần như đồng thời chỉ gọi Gemini một lần).
    const payload = await withSingleFlight(cacheKey, async () => {
      const recheck = await getCachedTranslation<GeminiTranslationPayload>(cacheKey);
      if (recheck) return recheck;

      const { signal, clear } = createTimeoutSignal();
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contents: string | Part[] = image
          ? [
              { text: prompt },
              {
                inlineData: {
                  data: image.data,
                  mimeType: image.mimeType,
                },
              },
            ]
          : prompt;

        const response = await withRetry(
          'gemini',
          async () => {
            try {
              return await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents,
                config: {
                  temperature: 0.3,
                  // 1024 quá thấp cho gemini-3.5-flash: model "thinking" tiêu tốn một phần
                  // token trước khi trả JSON, dễ bị cắt cụt giữa chừng khi văn bản dài/lộn
                  // xộn (nhiều segments) - tăng lên để tránh JSON bị hỏng do cắt cụt.
                  maxOutputTokens: 6144,
                  topP: 0.95,
                  topK: 40,
                  responseMimeType: 'application/json',
                },
              });
            } catch (err) {
              if (err instanceof ApiError) {
                throw makeRetryableError(err.message, {
                  status: err.status,
                  retryable: isRetryableStatus(err.status),
                });
              }
              if (err instanceof Error && err.name === 'AbortError') throw err;
              throw makeRetryableError(
                err instanceof Error ? err.message : 'Lỗi không xác định từ Gemini',
                { retryable: true }
              );
            }
          },
          { signal }
        );
        const content = response.text || '';

        const parsed = parseTranslationResponse(content, ocrText);

        // Chỉ tin translatedLines nếu đúng số dòng đầu vào - model đôi khi gộp/tách
        // dòng dù được dặn không làm vậy; sai số dòng thì bỏ, để client tự fallback
        // về hiển thị không overlay thay vì overlay lệch vị trí.
        const translatedLines =
          lines && parsed.translatedLines && parsed.translatedLines.length === lines.length
            ? parsed.translatedLines
            : undefined;

        const result: GeminiTranslationPayload = {
          translation: parsed.translation || content,
          detectedScript: parsed.script || 'simplified',
          segments: parsed.segments || [{ original: text, translated: parsed.translation || content }],
          confidence: parsed.confidence || 0.9,
          provider: 'gemini',
          translatedLines,
          correctedText: parsed.correctedText,
          overlayRegions: normalizeVisualRegions(parsed.visualRegions),
        };

        // Chỉ cache response THÀNH CÔNG đã validate được JSON.
        await setCachedTranslation(cacheKey, result);
        return result;
      } finally {
        clear();
      }
    });

    return NextResponse.json({ ...payload, cached: false });

  } catch (error) {
    console.error('Translation Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isAuthError =
      /401|unauthorized|invalid authentication|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(message);
    const typedError = error as RetryableCallError;

    return NextResponse.json(
      {
        error: isAuthError
          ? 'Gemini từ chối credential. GEMINI_API_KEY phải là Standard API key hoặc Authorization API key tạo từ Google AI Studio, không phải OAuth access token hoặc Client ID.'
          : `Lỗi dịch thuật: ${message}`,
        code: isAuthError ? 'INVALID_GEMINI_API_KEY' : 'TRANSLATION_FAILED',
      },
      { status: isAuthError ? 503 : typedError?.status === 429 ? 429 : 500 }
=======
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      contents: buildTranslationPrompt(text, target, source, lines),
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const parsed = parseTranslationResponse(response.text || '');
    const translatedLines =
      lines && parsed.translatedLines?.length === lines.length
        ? parsed.translatedLines
        : undefined;

    return NextResponse.json({
      translation: parsed.translation,
      correctedText: text,
      detectedScript: parsed.script || 'simplified',
      segments: parsed.segments?.length
        ? parsed.segments
        : [{ original: text, translated: parsed.translation }],
      translatedLines,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      provider: 'gemini',
    });
  } catch (error) {
    console.error('Gemini translation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dịch thuật thất bại', code: 'TRANSLATION_FAILED' },
      { status: 500 }
>>>>>>> origin/main
    );
  }
}

async function readTranslationInput(req: NextRequest): Promise<TranslationInput> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const linesValue = formData.get('lines');
    let lines: string[] | undefined;
    if (typeof linesValue === 'string' && linesValue.trim()) {
      const parsed = JSON.parse(linesValue);
      if (Array.isArray(parsed)) lines = parsed.filter((line): line is string => typeof line === 'string');
    }
<<<<<<< HEAD

    let image: TranslationInput['image'];
    if (imageValue && typeof imageValue !== 'string') {
      if (imageValue.size > MAX_IMAGE_SIZE) {
        throw new Error('Ảnh vượt quá giới hạn 10MB');
      }
      if (!imageValue.type.startsWith('image/')) {
        throw new Error('File gửi lên không phải ảnh');
      }
      const sourceBuffer = Buffer.from(await imageValue.arrayBuffer());
      // Đồng bộ tiền xử lý với luồng OpenAI/Claude (src/lib/translation/vision.ts):
      // xoay theo EXIF, resize, nén JPEG. Trước đây route này encode base64 thô,
      // khiến 2 lần chụp gần giống nhau ra base64 khác nhau và cache miss liên tục -
      // chuẩn hoá ở đây giúp cache key ổn định hơn, đúng "normalizedImageBytes" mà
      // tài liệu Phase 4 mục 4.1 yêu cầu.
      const optimizedBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      image = {
        data: optimizedBuffer.toString('base64'),
        mimeType: 'image/jpeg',
      };
    }

=======
>>>>>>> origin/main
    return {
      text: String(formData.get('text') || ''),
      target: String(formData.get('target') || 'vi'),
      source: String(formData.get('source') || 'zh'),
      lines,
    };
  }

  const body = (await req.json()) as Partial<TranslationInput>;
  return {
    text: typeof body.text === 'string' ? body.text : '',
    target: typeof body.target === 'string' ? body.target : 'vi',
    source: typeof body.source === 'string' ? body.source : 'zh',
    lines: Array.isArray(body.lines)
      ? body.lines.filter((line): line is string => typeof line === 'string')
      : undefined,
  };
}

function buildTranslationPrompt(text: string, target: string, source: string, lines?: string[]) {
  const targetName = target === 'vi' ? 'Tiếng Việt' : target;
  const sourceName = source === 'zh' ? 'tiếng Trung' : source;
  const lineInstruction = lines?.length
    ? `\nDanh sách dòng OCR theo đúng thứ tự (phải trả translatedLines đúng ${lines.length} phần tử):\n${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
    : '';

  return `Bạn là dịch giả chuyên nghiệp. Dịch văn bản ${sourceName} sang ${targetName}.
Giữ đúng ý nghĩa, ngữ cảnh, tên riêng, số và đơn vị; văn phong tự nhiên, không giải thích thêm.
Chỉ trả JSON hợp lệ:
{
  "translation": "bản dịch hoàn chỉnh",
  "script": "simplified | traditional | mixed",
  "segments": [{"original": "câu gốc", "translated": "câu dịch"}],
  "confidence": 0.95${lines?.length ? ',\n  "translatedLines": ["bản dịch dòng 1", "bản dịch dòng 2"]' : ''}
}
Văn bản OCR:
${text}${lineInstruction}`;
}

function parseTranslationResponse(content: string): {
  translation: string;
  script?: 'simplified' | 'traditional' | 'mixed';
  segments?: Array<{ original: string; translated: string }>;
  confidence?: number;
  translatedLines?: string[];
} {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || content;
  const parsed = JSON.parse(fenced.match(/\{[\s\S]*\}/)?.[0] || fenced);
  if (typeof parsed.translation !== 'string' || !parsed.translation.trim()) {
    throw new Error('Gemini không trả về bản dịch hợp lệ');
  }
  return parsed;
}

function normalizeApiKey(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function isGeminiApiKey(value: string) {
  return value.length >= 20 && !/\s/.test(value) && !/^(aa|your_)/i.test(value)
    && !/^ya29\./.test(value) && !/\.apps\.googleusercontent\.com$/.test(value);
}
