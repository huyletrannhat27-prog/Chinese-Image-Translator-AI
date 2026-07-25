import { NextRequest, NextResponse } from 'next/server';
import {
  buildVisionTranslationPrompt,
  createVisionResponse,
  parseVisionTranslation,
  readVisionInput,
} from '@/lib/translation/vision';
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
  parseRetryAfterMs,
  withRetry,
  type RetryableCallError,
} from '@/lib/retry';

// Tăng timeout
export const maxDuration = 60;

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
// Bump khi buildVisionTranslationPrompt() đổi nội dung.
const PROMPT_VERSION = 'v1';

type ClaudeTranslationPayload = ReturnType<typeof createVisionResponse>;

export async function POST(req: NextRequest) {
  // 1) Rate limiting.
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
    const { text, target, image } = await readVisionInput(req);

    if (!text.trim() && !image) {
      return NextResponse.json(
        { error: 'Không có văn bản hoặc hình ảnh để dịch' },
        { status: 400 }
      );
    }

    const apiKey = [process.env.ANTHROPIC_API_KEY, process.env.CLAUDE_API_KEY]
      .map((value) => value?.trim())
      .find((value): value is string => Boolean(value && !/^your_/i.test(value)));
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chưa cấu hình ANTHROPIC_API_KEY (hoặc CLAUDE_API_KEY) trên server', code: 'MISSING_CLAUDE_API_KEY' },
        { status: 503 }
      );
    }

    // 2) Cache.
    const cacheKey = buildTranslationCacheKey({
      imageData: image?.data,
      text: image ? undefined : text,
      provider: 'claude',
      model: CLAUDE_MODEL,
      source: 'zh',
      target,
      promptVersion: PROMPT_VERSION,
    });

    const cached = await getCachedTranslation<ClaudeTranslationPayload>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // 3) Cache miss -> gọi Claude, có retry + timeout + single-flight.
    const payload = await withSingleFlight(cacheKey, async () => {
      const recheck = await getCachedTranslation<ClaudeTranslationPayload>(cacheKey);
      if (recheck) return recheck;

      const { signal, clear } = createTimeoutSignal();
      try {
        const prompt = buildVisionTranslationPrompt(text, target);
        const content: Array<Record<string, unknown>> = [];
        if (image) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: image.mimeType, data: image.data },
          });
        }
        content.push({ type: 'text', text: prompt });

        const data = await withRetry(
          'claude',
          async () => {
            let response: Response;
            try {
              response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: CLAUDE_MODEL,
                  max_tokens: 6144,
                  temperature: 0.2,
                  messages: [{ role: 'user', content }],
                }),
                signal,
              });
            } catch (err) {
              if (err instanceof Error && err.name === 'AbortError') throw err;
              throw makeRetryableError(
                err instanceof Error ? err.message : 'Lỗi mạng khi gọi Claude',
                { retryable: true }
              );
            }

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
              const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
              throw makeRetryableError(
                body?.error?.message || `Claude API error: ${response.status}`,
                { status: response.status, retryable: isRetryableStatus(response.status), retryAfterMs }
              );
            }
            return body;
          },
          { signal }
        );

        const outputText =
          data.content
            ?.filter((item: { type?: string }) => item.type === 'text')
            .map((item: { text?: string }) => item.text || '')
            .join('\n') || '';
        const parsed = parseVisionTranslation(outputText, text);
        const result = createVisionResponse(parsed, 'claude');

        await setCachedTranslation(cacheKey, result);
        return result;
      } finally {
        clear();
      }
    });

    return NextResponse.json({ ...payload, cached: false });
  } catch (error) {
    console.error('Claude Translation Error:', error);
    const typedError = error as RetryableCallError;
    return NextResponse.json(
      { error: `Claude OCR/dịch thất bại: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: typedError?.status === 429 ? 429 : 500 }
    );
  }
}
