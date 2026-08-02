import { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Phase 4 — Rate limiting cho các endpoint tốn tiền (/api/translate*).
// Xem _docs/07_phase4_optimization_tools.md mục 3 để biết lý do chọn thuật
// toán/công cụ bên dưới.
//
// Mặc định: sliding window, 5 request/phút/IP, dùng CHUNG cho cả 3 provider
// (Gemini/OpenAI/Claude) - vì đây là 3 "cổng" khác nhau vào cùng MỘT hành
// động tốn tiền (dịch 1 ảnh), không nên để user né rate limit bằng cách đổi
// provider.
//
// Có UPSTASH_REDIS_REST_URL/TOKEN -> dùng Upstash Ratelimit (đúng như khuyến
// nghị mục 8 của tài liệu, hoạt động đúng trên serverless/nhiều instance).
// Không có -> fallback về Map trong bộ nhớ tiến trình, CHỈ dùng để dev/demo
// local; KHÔNG dùng fallback này khi deploy nhiều instance/serverless thật
// (mục 9 của tài liệu liệt kê chính xác lỗi này: "Rate limit bằng Map trong
// serverless rồi tưởng mọi instance dùng chung").

const REQUESTS_PER_MINUTE = Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || 5);
const WINDOW_MS = 60_000;

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (ms) khi cửa sổ hiện tại hết hạn / có slot trống tiếp theo */
  reset: number;
};

let upstashLimiter: Ratelimit | null | undefined;

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter !== undefined) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    upstashLimiter = null;
    return upstashLimiter;
  }

  upstashLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(REQUESTS_PER_MINUTE, '60 s'),
    analytics: true,
    prefix: 'citr:ratelimit:translate',
  });
  return upstashLimiter;
}

// --- Fallback trong bộ nhớ (chỉ hợp lệ trong 1 process/1 instance) ---
const memoryHits = new Map<string, number[]>();

function checkMemorySlidingWindow(key: string): RateLimitResult {
  const now = Date.now();
  const recent = (memoryHits.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= REQUESTS_PER_MINUTE) {
    memoryHits.set(key, recent);
    return {
      success: false,
      limit: REQUESTS_PER_MINUTE,
      remaining: 0,
      reset: recent[0] + WINDOW_MS,
    };
  }

  recent.push(now);
  memoryHits.set(key, recent);

  // Giới hạn số key theo dõi để tránh phình bộ nhớ khi có nhiều IP lạ/dev
  // server chạy lâu ngày (không cần chính xác tuyệt đối, chỉ là an toàn tối thiểu).
  if (memoryHits.size > 2000) {
    const oldestKey = memoryHits.keys().next().value;
    if (oldestKey) memoryHits.delete(oldestKey);
  }

  return {
    success: true,
    limit: REQUESTS_PER_MINUTE,
    remaining: REQUESTS_PER_MINUTE - recent.length,
    reset: now + WINDOW_MS,
  };
}

/**
 * Kiểm tra quota dịch thuật cho một định danh (thường là IP).
 * Dùng chung cho /api/translate, /api/translate/openai, /api/translate/claude.
 */
export async function checkTranslateRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter();

  if (limiter) {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    return { success, limit, remaining, reset };
  }

  return checkMemorySlidingWindow(`translate:${identifier}`);
}

/** Lấy IP client từ header (hoạt động sau proxy/Vercel/Cloudflare). */
export function getClientIdentifier(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export function retryAfterSecondsFromReset(resetMs: number): number {
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}
