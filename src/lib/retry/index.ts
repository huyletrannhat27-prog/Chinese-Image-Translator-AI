import pRetry from 'p-retry';

// Phase 4 — Retry mechanism. Xem _docs/07_phase4_optimization_tools.md mục 5.
//
// Dùng p-retry cho vòng lặp gọi lại + AbortSignal, nhưng KHÔNG dùng
// minTimeout/factor mặc định của thư viện để tính delay - tài liệu mục 5.3
// nói rõ "phải tự đọc Retry-After và phân loại lỗi provider", nên toàn bộ
// việc tính backoff + đọc Retry-After được tự viết trong onFailedAttempt bên
// dưới, bám sát công thức mục 5.2:
//   delay = min(maxDelay, baseDelay × 2^attempt) + jitter

export type RetryableCallError = Error & {
  /** HTTP status nếu lỗi đến từ provider (không có = lỗi mạng/không xác định) */
  status?: number;
  /** true = nên thử lại (network tạm thời/408/429/5xx); false = lỗi vĩnh viễn */
  retryable?: boolean;
  /** Nếu provider trả header Retry-After, quy đổi ra ms để tôn trọng đúng mục 5.4 */
  retryAfterMs?: number;
};

export function makeRetryableError(
  message: string,
  opts: { status?: number; retryable: boolean; retryAfterMs?: number }
): RetryableCallError {
  const err = new Error(message) as RetryableCallError;
  err.status = opts.status;
  err.retryable = opts.retryable;
  err.retryAfterMs = opts.retryAfterMs;
  return err;
}

/**
 * Chỉ retry lỗi CÓ KHẢ NĂNG TỰ HẾT: 408, 429, 5xx (mục 5.1).
 * KHÔNG retry 400 (payload sai), 401/403 (auth/quyền), 404, hoặc hết quota -
 * những lỗi đó gọi lại cũng chỉ lỗi y hệt, tốn thêm tiền/thời gian chờ.
 */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500 && status < 600;
}

/** Đọc header Retry-After (giây hoặc HTTP-date) và quy đổi ra ms. */
export function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return undefined;
}

/** Deadline tổng cho một lượt gọi (tính cả các lần retry) - mục 5.4. */
export const DEFAULT_PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 45_000);

export function createTimeoutSignal(timeoutMs: number = DEFAULT_PROVIDER_TIMEOUT_MS): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Quá thời gian chờ provider (${Math.round(timeoutMs / 1000)}s)`));
  }, timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4000;

function computeBackoffMs(attemptNumber: number, retryAfterMs?: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attemptNumber - 1));
  const jitter = exp * (0.25 + Math.random() * 0.5); // +25% đến +75% - tránh retry đồng loạt
  const backoff = Math.round(exp + jitter);
  // Nếu provider yêu cầu Retry-After dài hơn backoff tự tính, tôn trọng provider.
  return retryAfterMs ? Math.max(backoff, retryAfterMs) : backoff;
}

export type WithRetryOptions = {
  signal?: AbortSignal;
  /** Tối đa 2 lần retry SAU lần gọi đầu (mục 5.4) => tối đa 3 lần gọi tổng. */
  maxRetries?: number;
};

/**
 * Gọi `fn` với retry có kiểm soát. `fn` PHẢI throw lỗi tạo bởi
 * `makeRetryableError` (hoặc để lỗi mạng thô đi qua) để hàm này biết lỗi nào
 * nên thử lại. Log provider/attempt/status/độ trễ - KHÔNG log API key hay ảnh gốc.
 */
export async function withRetry<T>(
  providerName: string,
  fn: (attempt: number) => Promise<T>,
  opts: WithRetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const startedAt = Date.now();

  return pRetry((attemptNumber) => fn(attemptNumber), {
    retries: maxRetries,
    minTimeout: 0, // tự sleep trong onFailedAttempt bên dưới
    signal: opts.signal,
    shouldRetry: ({ error }) => Boolean((error as RetryableCallError)?.retryable),
    onFailedAttempt: async ({ error, attemptNumber, retriesLeft }) => {
      const typedError = error as RetryableCallError;
      console.warn(
        `[retry] provider=${providerName} attempt=${attemptNumber} ` +
          `status=${typedError.status ?? 'network'} retriesLeft=${retriesLeft} ` +
          `elapsedMs=${Date.now() - startedAt}`
      );
      if (retriesLeft > 0) {
        await sleep(computeBackoffMs(attemptNumber, typedError.retryAfterMs));
      }
    },
  });
}
