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

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
// Bump khi buildVisionTranslationPrompt() đổi nội dung, để cache không trả
// bản dịch cũ theo prompt đã lỗi thời (mục 4.3 tài liệu Phase 4).
const PROMPT_VERSION = 'v1';

type OpenAiTranslationPayload = ReturnType<typeof createVisionResponse>;

export async function POST(req: NextRequest) {
  // 1) Rate limiting - áp trước khi làm bất cứ việc gì tốn tiền (mục 3).
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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || /^your_/i.test(apiKey)) {
      return NextResponse.json(
        { error: 'Chưa cấu hình OPENAI_API_KEY trên server', code: 'MISSING_OPENAI_API_KEY' },
        { status: 503 }
      );
    }

    // 2) Cache - image.data ở đây đã qua Sharp chuẩn hoá trong readVisionInput().
    const cacheKey = buildTranslationCacheKey({
      imageData: image?.data,
      text: image ? undefined : text,
      provider: 'openai',
      model: OPENAI_MODEL,
      source: 'zh',
      target,
      promptVersion: PROMPT_VERSION,
    });

    const cached = await getCachedTranslation<OpenAiTranslationPayload>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // 3) Cache miss -> gọi OpenAI, có retry + timeout. withSingleFlight tránh
    // 2 request giống hệt nhau cùng gọi OpenAI khi đến gần như đồng thời.
    const payload = await withSingleFlight(cacheKey, async () => {
      const recheck = await getCachedTranslation<OpenAiTranslationPayload>(cacheKey);
      if (recheck) return recheck;

      const { signal, clear } = createTimeoutSignal();
      try {
        const prompt = buildVisionTranslationPrompt(text, target);
        const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }];
        if (image) {
          content.push({
            type: 'input_image',
            image_url: `data:${image.mimeType};base64,${image.data}`,
            detail: 'high',
          });
        }

        const data = await withRetry(
          'openai',
          async () => {
            let response: Response;
            try {
              response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: OPENAI_MODEL,
                  input: [{ role: 'user', content }],
                  reasoning: { effort: 'low' },
                  max_output_tokens: 6144,
                }),
                signal,
              });
            } catch (err) {
              if (err instanceof Error && err.name === 'AbortError') throw err;
              throw makeRetryableError(
                err instanceof Error ? err.message : 'Lỗi mạng khi gọi OpenAI',
                { retryable: true }
              );
            }

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
              const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
              throw makeRetryableError(
                body?.error?.message || `OpenAI API error: ${response.status}`,
                { status: response.status, retryable: isRetryableStatus(response.status), retryAfterMs }
              );
            }
            return body;
          },
          { signal }
        );

        const outputText =
          data.output_text ||
          data.output
            ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
            .find((item: { type?: string }) => item.type === 'output_text')?.text ||
          '';
        const parsed = parseVisionTranslation(outputText, text);
        const result = createVisionResponse(parsed, 'openai');

        // Chỉ cache response THÀNH CÔNG đã validate được JSON.
        await setCachedTranslation(cacheKey, result);
        return result;
      } finally {
        clear();
      }
    });

    return NextResponse.json({ ...payload, cached: false });
  } catch (error) {
    console.error('OpenAI Translation Error:', error);
    const typedError = error as RetryableCallError;
    return NextResponse.json(
      { error: `OpenAI OCR/dịch thất bại: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: typedError?.status === 429 ? 429 : 500 }
    );
  }
}
