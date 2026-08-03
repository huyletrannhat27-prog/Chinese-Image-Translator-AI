import { NextRequest, NextResponse } from 'next/server';
import {
  buildTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
  withSingleFlight,
} from '@/lib/cache';
import { checkTranslateRateLimit, getClientIdentifier, retryAfterSecondsFromReset } from '@/lib/rate-limit';
import { type RetryableCallError } from '@/lib/retry';
import type { TranslationResult } from '@/lib/translation/gemini';

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

      try {
        // Use shared GeminiTranslator to centralize fallback logic (Gemini -> LibreTranslate -> raw)
        const { GeminiTranslator } = await import('@/lib/translation/gemini');
        const translator = new GeminiTranslator(apiKey, GEMINI_MODEL);
        let translatedResult: TranslationResult;
        try {
          translatedResult = await translator.translate(normalizedText, target, source, lines);
        } catch (err) {
          // If GeminiTranslator throws (eg auth error), propagate to outer catch to handle
          throw err instanceof Error ? err : new Error('Translation provider failed');
        }

        const parsed = {
          translation: translatedResult.translation,
          script: translatedResult.detectedScript,
          segments: translatedResult.segments,
          confidence: translatedResult.confidence,
          translatedLines: translatedResult.translatedLines,
        } as const;

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
        // no cleanup required here
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


function normalizeApiKey(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function isGeminiApiKey(value: string) {
  return value.length >= 20 && !/\s/.test(value) && !/^(aa|your_)/i.test(value)
    && !/^ya29\./.test(value) && !/\.apps\.googleusercontent\.com$/.test(value);
}
