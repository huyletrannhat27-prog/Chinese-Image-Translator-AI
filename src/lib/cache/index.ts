import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

// Phase 4 — Cache kết quả OCR/dịch. Xem _docs/07_phase4_optimization_tools.md
// mục 4. Chỉ cache response THÀNH CÔNG; không bao giờ cache lỗi (401/403/429/
// timeout...) - lỗi được gọi lại ở lib/retry, không đi qua cache.

const DEFAULT_TTL_SECONDS = Number(process.env.TRANSLATION_CACHE_TTL_SECONDS || 3600); // 1h, trong khoảng 1-24h tài liệu đề xuất

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  redisClient =
    url && token
      ? // Tắt automaticDeserialization: tự JSON.stringify/parse ở đây để hành vi
        // giống hệt fallback in-memory, không phụ thuộc "đoán" kiểu dữ liệu của SDK.
        new Redis({ url, token, automaticDeserialization: false })
      : null;

  return redisClient;
}

// --- Fallback trong bộ nhớ (chỉ hợp lệ trong 1 process/1 instance, mất khi
// cold start/deploy lại - xem bảng so sánh mục 4.2 của tài liệu) ---
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number) {
  if (memoryCache.size > 500) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Cache key = sha256(normalizedImageBytes|provider|model|source|target|promptVersion).
 * Không dùng tên file (2 file khác nhau có thể trùng tên); không nhét base64
 * thô vào chính key (key sẽ khổng lồ) - chỉ hash sau khi đã tiền xử lý ảnh.
 */
export function buildTranslationCacheKey(parts: {
  /** Base64 của ảnh ĐÃ chuẩn hoá (sau Sharp) - ưu tiên dùng field này. */
  imageData?: string;
  /** Dùng khi request chỉ có text, không có ảnh. */
  text?: string;
  provider: string;
  model: string;
  source: string;
  target: string;
  promptVersion: string;
}): string {
  const hash = createHash('sha256');
  hash.update(parts.imageData || parts.text || '');
  hash.update('|', 'utf8');
  hash.update(parts.provider);
  hash.update('|', 'utf8');
  hash.update(parts.model);
  hash.update('|', 'utf8');
  hash.update(parts.source);
  hash.update('|', 'utf8');
  hash.update(parts.target);
  hash.update('|', 'utf8');
  hash.update(parts.promptVersion);
  return `translate:${hash.digest('hex')}`;
}

export async function getCachedTranslation<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    const raw = redis ? await redis.get<string>(key) : memoryGet(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.warn('[cache] Đọc cache thất bại, bỏ qua cache:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCachedTranslation(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    const redis = getRedis();
    if (redis) {
      await redis.set(key, serialized, { ex: ttlSeconds });
    } else {
      memorySet(key, serialized, ttlSeconds);
    }
  } catch (err) {
    // Ghi cache thất bại không nên làm hỏng response dịch - chỉ log rồi bỏ qua.
    console.warn('[cache] Ghi cache thất bại, bỏ qua cache:', err instanceof Error ? err.message : err);
  }
}

// --- Single-flight / request coalescing (mục 4.3) ---
// Nếu 2 request giống hệt nhau (cùng cache key) đến gần như đồng thời trước
// khi cache kịp ghi, chỉ request đầu tiên thực sự gọi provider; request sau
// "đứng chờ" chung kết quả thay vì gọi trùng. Chỉ coalesce trong 1 process -
// đủ dùng cho use case camera/upload hiện tại (không cần Redis lock phân tán).
const inFlight = new Map<string, Promise<unknown>>();

export async function withSingleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
