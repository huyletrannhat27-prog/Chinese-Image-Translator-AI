import { ApiError, GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
  withSingleFlight,
} from '@/lib/cache';
import { checkTranslateRateLimit, getClientIdentifier, retryAfterSecondsFromReset } from '@/lib/rate-limit';
import {
  createTimeoutSignal,
  isRetryableStatus,
  makeRetryableError,
  withRetry,
  type RetryableCallError,
} from '@/lib/retry';

export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const PROMPT_VERSION = 'v2';

type TranslationInput = {
  text: string;
  target: string;
  source: string;
  lines?: string[];
};

type GeminiTranslationPayload = {
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  segments: Array<{ original: string; translated: string }>;
  confidence: number;
  provider: 'gemini';
  translatedLines?: string[];
};

export async function POST(req: NextRequest) {
  const identifier = getClientIdentifier(req);
  const rate = await checkTranslateRateLimit(identifier);
  if (!rate.success) {
    const retryAfter = retryAfterSecondsFromReset(rate.reset);
    return NextResponse.json(
      {
        error: `Bạn đã gửi quá nhiều yêu cầu dịch. Vui lòng thử lại sau ${retryAfter} giây.`,
        code: 'RATE_LIMITED',
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  try {
    const { text, target, source, lines } = await readTranslationInput(req);
    const normalizedText = text.trim();
    if (!normalizedText) {
      return NextResponse.json({ error: 'Không có văn bản OCR để dịch' }, { status: 400 });
    }

    const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
    if (!isGeminiApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY chưa được cấu hình hợp lệ', code: 'INVALID_GEMINI_API_KEY' },
        { status: 503 }
      );
    }

    const cacheKey = buildTranslationCacheKey({
      text: normalizedText,
      provider: 'gemini',
      model: GEMINI_MODEL,
      source,
      target,
      promptVersion: PROMPT_VERSION,
    });
    const cached = await getCachedTranslation<GeminiTranslationPayload>(cacheKey);
    if (cached) return NextResponse.json({ ...cached, cached: true });

    const payload = await withSingleFlight(cacheKey, async () => {
      const recheck = await getCachedTranslation<GeminiTranslationPayload>(cacheKey);
      if (recheck) return recheck;

      const { signal, clear } = createTimeoutSignal();
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await withRetry(
          'gemini',
          async () => {
            try {
              return await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents: buildTranslationPrompt(normalizedText, target, source, lines),
                config: {
                  temperature: 0.2,
                  maxOutputTokens: 6144,
                  responseMimeType: 'application/json',
                },
              });
            } catch (error) {
              if (error instanceof ApiError) {
                throw makeRetryableError(error.message, {
                  status: error.status,
                  retryable: isRetryableStatus(error.status),
                });
              }
              if (error instanceof Error && error.name === 'AbortError') throw error;
              throw makeRetryableError(
                error instanceof Error ? error.message : 'Lỗi không xác định từ Gemini',
                { retryable: true }
              );
            }
          },
          { signal }
        );

        let parsed;
        try {
          console.error('Gemini raw response:', response.text?.slice(0, 1000));
          parsed = parseTranslationResponse(response.text || '', normalizedText);
        } catch (parseErr) {
          console.warn('Gemini response parse failed, attempting LibreTranslate fallback', parseErr);
          // Try LibreTranslate fallback
          const endpoint = process.env.LIBRETRANSLATE_ENDPOINT || 'https://libretranslate.com/translate';
          try {
            const body = JSON.stringify({ q: normalizedText, source, target, format: 'text' });
            const ltRes = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
            if (!ltRes.ok) throw new Error(`LibreTranslate failed: ${ltRes.status} ${ltRes.statusText}`);
            const ltJson = await ltRes.json();
            const translatedText = typeof ltJson.translatedText === 'string' ? ltJson.translatedText : String(ltJson);
            parsed = { translation: translatedText, script: 'mixed', segments: [{ original: normalizedText, translated: translatedText }], confidence: 0.6 };
            if (lines && lines.length) {
              // attempt to translate per-line
              try {
                const perLinePromises = lines.map((ln) => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: ln, source, target, format: 'text' }) }).then((r) => r.json()).then((j) => (typeof j.translatedText === 'string' ? j.translatedText : String(j))));
                const translatedLines = await Promise.all(perLinePromises);
                parsed.translatedLines = translatedLines;
              } catch { /* ignore per-line failure */ }
            }
          } catch (ltErr) {
            console.error('LibreTranslate fallback failed:', ltErr);
            // Nếu fallback cũng thất bại, chấp nhận lấy nguyên raw text từ Gemini
            console.warn('Using raw Gemini response text as fallback translation');
            const raw = (response.text || '').replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();
            parsed = {
              translation: raw || normalizedText,
              script: 'mixed',
              segments: [{ original: normalizedText, translated: raw || normalizedText }],
              confidence: 0.5,
            };
          }
        }

        const translatedLines =
          lines && parsed.translatedLines?.length === lines.length
            ? parsed.translatedLines
            : undefined;
        const result: GeminiTranslationPayload = {
          translation: parsed.translation,
          detectedScript: parsed.script || 'simplified',
          segments: parsed.segments?.length
            ? parsed.segments
            : [{ original: normalizedText, translated: parsed.translation }],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
          provider: 'gemini',
          translatedLines,
        };

        await setCachedTranslation(cacheKey, result);
        return result;
      } finally {
        clear();
      }
    });

    return NextResponse.json({ ...payload, cached: false });
  } catch (error) {
    console.error('Gemini translation error:', error);
    const message = error instanceof Error ? error.message : 'Dịch thuật thất bại';
    const status = (error as RetryableCallError).status;
    const isAuthError = /401|403|unauthorized|invalid authentication|api key/i.test(message);
    return NextResponse.json(
      {
        error: isAuthError ? 'Gemini từ chối API key. Vui lòng kiểm tra GEMINI_API_KEY.' : message,
        code: isAuthError ? 'INVALID_GEMINI_API_KEY' : 'TRANSLATION_FAILED',
      },
      { status: isAuthError ? 503 : status === 429 ? 429 : 500 }
    );
  }
}

async function readTranslationInput(req: NextRequest): Promise<TranslationInput> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    return {
      text: String(formData.get('text') || ''),
      target: String(formData.get('target') || 'vi'),
      source: String(formData.get('source') || 'zh'),
      lines: parseLines(formData.get('lines')),
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

function parseLines(value: FormDataEntryValue | null): string[] | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((line): line is string => typeof line === 'string')
      : undefined;
  } catch {
    throw new Error('Danh sách vùng OCR không hợp lệ');
  }
}

function buildTranslationPrompt(text: string, target: string, source: string, lines?: string[]) {
  const targetName = target === 'vi' ? 'Tiếng Việt' : target;
  const sourceName = source === 'zh' ? 'tiếng Trung' : source;
  const lineInstruction = lines?.length
    ? `\nDanh sách dòng OCR theo đúng thứ tự (trả translatedLines đúng ${lines.length} phần tử):\n${lines
        .map((line, index) => `${index + 1}. ${line}`)
        .join('\n')}`
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

function parseTranslationResponse(
  content: string,
  originalText: string
): {
  translation: string;
  script?: 'simplified' | 'traditional' | 'mixed';
  segments?: Array<{ original: string; translated: string }>;
  confidence?: number;
  translatedLines?: string[];
} {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || content;
  try {
    const parsed = JSON.parse(fenced.match(/\{[\s\S]*\}/)?.[0] || fenced);
    if (typeof parsed.translation !== 'string' || !parsed.translation.trim()) {
      throw new Error('Gemini không trả về bản dịch hợp lệ');
    }
    return parsed;
  } catch (error) {
    const translationField = fenced.match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (translationField) {
      const translation = JSON.parse(`"${translationField[1]}"`) as string;
      return {
        translation,
        segments: [{ original: originalText, translated: translation }],
        confidence: 0.7,
      };
    }
    throw error instanceof Error ? error : new Error('Không đọc được phản hồi dịch từ Gemini');
  }
}

function normalizeApiKey(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function isGeminiApiKey(value: string) {
  return value.length >= 20 && !/\s/.test(value) && !/^(aa|your_)/i.test(value)
    && !/^ya29\./.test(value) && !/\.apps\.googleusercontent\.com$/.test(value);
}
