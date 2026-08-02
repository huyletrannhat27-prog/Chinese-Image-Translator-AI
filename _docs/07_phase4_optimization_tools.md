# Phase 4 — Rate limiting, cache và retry mechanism

> Cập nhật: 23/07/2026. Tài liệu này giải thích ba cơ chế tối ưu dành cho API OCR/dịch, so sánh các công cụ và đề xuất cấu hình phù hợp với dự án Next.js hiện tại.

## 1. Phase 4 dùng để làm gì?

Ứng dụng đang gọi Gemini, OpenAI hoặc Claude bằng API key của chủ dự án. Mỗi lần người dùng chụp/upload ảnh có thể phát sinh:

- Chi phí xử lý ảnh và token.
- Thời gian chờ cloud AI.
- Giới hạn request/token của provider.
- Lỗi mạng, timeout, HTTP 429 hoặc lỗi tạm thời 5xx.

Phase 4 bổ sung ba lớp bảo vệ:

```text
Request người dùng
→ Rate limiting: người này có được gọi tiếp không?
→ Cache: kết quả giống hệt đã có chưa?
→ Provider API
→ Retry: lỗi này có phải lỗi tạm thời và nên thử lại không?
→ Trả kết quả
```

| Cơ chế | Mục đích chính | Nếu không có |
|---|---|---|
| **Rate limiting** | Giới hạn số request theo IP/user/API key trong một khoảng thời gian | Bot hoặc lỗi UI có thể gọi liên tục, làm hết quota và tăng hóa đơn |
| **Cache** | Trả lại kết quả đã xử lý cho ảnh/nội dung giống nhau | Cùng một ảnh bị OCR/dịch lại, người dùng chờ lâu và dự án trả tiền nhiều lần |
| **Retry** | Thử lại có kiểm soát khi gặp lỗi tạm thời | Một lỗi mạng ngắn hoặc 503 làm request thất bại ngay |

Ba cơ chế bổ trợ nhau nhưng không thay thế nhau. Cache không ngăn spam ảnh mới; rate limit không phục hồi lỗi mạng; retry sai cách lại có thể làm provider quá tải hơn.

## 2. Trạng thái hiện tại của dự án

> Cập nhật lại 02/08/2026 sau khi triển khai và dọn luồng rate limiting, cache và retry.

| Hạng mục | Trạng thái | Bằng chứng trong source |
|---|---|---|
| Rate limiting inbound | **Đã có** | `src/lib/rate-limit`: sliding window 5 req/phút/IP dùng chung cho cả 3 route `/api/translate*`, qua Upstash Ratelimit (fallback in-memory nếu chưa cấu hình Upstash) |
| Cache kết quả dịch | **Đã có** | `src/lib/cache`: key SHA-256 theo text với Gemini hoặc ảnh chuẩn hóa với route vision, kèm provider/model/source/target/promptVersion; dùng Upstash Redis (fallback in-memory) và single-flight |
| Lịch sử trên trình duyệt | **Đã có nhưng không phải API cache** | `HistoryStorage` lưu kết quả vào `localStorage` của từng thiết bị (không đổi so với trước) |
| Retry provider thực tế | **Đã có** | `src/lib/retry`: `withRetry()` áp dụng cho cả 3 route, tối đa 2 lần thử lại, backoff + jitter |
| Phân loại lỗi API để quyết định retry | **Đã có, thống nhất cho cả 3 route** | `isRetryableStatus()`: chỉ retry 408/429/5xx/lỗi mạng; không retry 400/401/403/quota |
| Timeout/cancel provider | **Đã có** | `createTimeoutSignal()`: `AbortController` với deadline mặc định 45s (`PROVIDER_TIMEOUT_MS`) cho mỗi lượt gọi |
| Tiền xử lý ảnh | **Đã có ở route nhận ảnh** | PaddleOCR/OpenAI/Claude chuẩn hóa ảnh bằng Sharp; route Gemini chính chỉ nhận text OCR nên không xử lý ảnh |

Dấu `⬜`/`[ ]` ở Phase 4 mô tả đúng lúc tài liệu này mới viết (dự án mới có một số nền tảng, chưa có cơ chế tối ưu hoàn chỉnh); sau khi triển khai, `_docs/02_phases.md` đã cập nhật 3/4 mục thành `[x]`, chỉ còn tooltip hướng dẫn từng bước là chưa làm.

---

## 3. Rate limiting

### 3.1 Rate limiting dùng để làm gì?

Rate limiting đếm số lần một định danh gọi API trong một cửa sổ thời gian. Định danh có thể là:

- `userId` nếu đã đăng nhập — chính xác nhất.
- API key riêng của khách hàng nếu phát triển SaaS.
- IP khi chưa có đăng nhập — dễ triển khai nhưng nhiều người chung mạng có thể chung IP.
- Kết hợp IP + fingerprint nhẹ — cần cân nhắc quyền riêng tư.

Khi vượt giới hạn, server trả:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

Nên giới hạn riêng endpoint tốn tiền như `/api/translate`, không áp cùng một mức cho ảnh tĩnh, trang README hoặc health check.

### 3.2 Công cụ rate limiting

| Công cụ | Kiểu triển khai | Ưu điểm | Nhược điểm | Phù hợp |
|---|---|---|---|---|
| **Upstash Ratelimit + Upstash Redis** | Library TypeScript dùng Redis qua HTTP | Thiết kế cho Next.js/serverless/Vercel Edge; có fixed/sliding window, token bucket, analytics, timeout và cache request bị block; tích hợp nhanh | Thêm dịch vụ bên thứ ba và độ trễ gọi Redis; tính phí theo usage; multi-region/sliding window dùng nhiều lệnh hơn | **Khuyên dùng cho MVP hiện tại** |
| **Vercel WAF Rate Limiting** | Cấu hình tại lớp Vercel Firewall | Chặn trước khi request vào function/provider; giảm chi phí compute; không phải viết logic route; có trên các plan với giới hạn/giá theo plan | Gắn với Vercel; khả năng định danh/quota nghiệp vụ theo user không linh hoạt bằng app-level Redis | Lớp chống abuse/DDoS cho production trên Vercel |
| **Cloudflare WAF Rate Limiting** | Rule tại Cloudflare edge | Chặn traffic sớm; rule theo path/IP/header/đặc tính; bảo vệ origin và API | Cần đưa traffic qua Cloudflare; feature/giới hạn phụ thuộc plan; quota theo user nghiệp vụ vẫn cần code app | Website dùng Cloudflare proxy |
| **Arcjet** | SDK bảo vệ trực tiếp trong Next.js | Có fixed window, sliding window và token bucket; hỗ trợ giới hạn theo user và ngân sách token AI; kèm bot/security rules | Thêm vendor/SDK; cần đánh giá pricing, latency và fail-open/fail-closed; ít phổ quát hơn Redis tự quản | Muốn giải pháp security + AI quota tích hợp |
| **Redis/Valkey tự triển khai** | Tự viết counter/token bucket bằng Redis và Lua | Kiểm soát hoàn toàn; dùng cùng hạ tầng cache; atomic; không khóa vào SDK rate-limit cụ thể | Phải vận hành Redis, viết/test thuật toán, xử lý multi-region, outage và cleanup key | Team có hạ tầng backend/Redis |
| **Bottleneck** | Scheduler/rate limiter trong Node/browser; có chế độ Redis cluster | Tốt để giới hạn tốc độ gọi **ra provider**, concurrency và hàng đợi trong một tiến trình | Không thay thế WAF/inbound user limiter; queued jobs local có thể mất khi serverless instance dừng; serverless scale-to-zero không lý tưởng | Giới hạn outbound/concurrency trong server Node lâu dài |

### 3.3 Thuật toán rate limit

| Thuật toán | Ưu điểm | Nhược điểm | Gợi ý |
|---|---|---|---|
| **Fixed window** | Rẻ, dễ hiểu | Có burst ở ranh giới cửa sổ | MVP nhỏ, giới hạn không quá nghiêm |
| **Sliding window** | Mượt và công bằng hơn fixed window | Tốn thêm dữ liệu/tính toán | **Phù hợp request/phút của app** |
| **Token bucket** | Cho phép burst nhỏ nhưng giữ mức trung bình; có thể tính theo token/chi phí | Cấu hình capacity/refill khó hơn | User tier Free/Pro hoặc ngân sách AI |
| **Concurrency limit** | Chặn quá nhiều tác vụ AI chạy cùng lúc | Không giới hạn tổng request theo thời gian | Dùng cùng rate limit, không dùng một mình |

### 3.4 Cấu hình đề xuất cho dự án

Khi chưa có đăng nhập:

- 5 request/phút/IP cho endpoint OCR + dịch.
- Burst tối đa 2 request gần nhau.
- 30–50 request/ngày/IP nếu cần bảo vệ free demo.
- Trả `429`, `Retry-After` và thông báo rõ trên UI.
- Thêm giới hạn concurrency tổng cho từng provider để tránh cùng lúc vượt quota.

Khi có tài khoản:

- Dùng `userId` thay IP.
- Token bucket theo tier Free/Pro.
- Theo dõi cả số request và chi phí ước tính; ảnh lớn/model mạnh không nên có trọng số giống text ngắn.

---

## 4. Cache kết quả OCR và dịch

### 4.1 Cache dùng để làm gì?

Cache lưu kết quả thành công trong một thời gian. Khi cùng ảnh, provider, model, prompt và ngôn ngữ đích xuất hiện lại, API trả kết quả cũ mà không gọi AI lần nữa.

Cache key đề xuất:

```text
sha256(
  normalizedImageBytes
  + provider
  + model
  + sourceLanguage
  + targetLanguage
  + promptVersion
)
```

Không dùng tên file làm key vì hai file khác nhau có thể cùng tên. Không đưa raw base64/ảnh vào tên key vì key sẽ rất lớn và có thể lộ dữ liệu. Nên hash ảnh sau bước chuẩn hóa để cùng một ảnh có key ổn định hơn.

### 4.2 Công cụ cache

| Công cụ | Kiểu triển khai | Ưu điểm | Nhược điểm | Phù hợp |
|---|---|---|---|---|
| **Upstash Redis** | Redis serverless qua REST | Hợp Vercel/Next.js; cùng database có thể dùng cache + rate limit; TTL đơn giản; không cần connection pool TCP | Thêm network hop/vendor; phải quản lý quota, TTL và vùng đặt database | **Khuyên dùng cho MVP serverless** |
| **Redis/Valkey managed hoặc self-host** | Cache key-value in-memory | Rất nhanh; TTL, LRU/LFU/eviction; hệ sinh thái lớn; kiểm soát dữ liệu | Chi phí/vận hành; connection handling trong serverless; cần chọn eviction và max memory đúng | Production có backend ổn định |
| **Next.js Data Cache / `unstable_cache`** | Cache tích hợp framework | Ít dependency; ở Next.js 14 có thể cache kết quả hàm đắt tiền qua `unstable_cache`; hỗ trợ revalidate/tag | Hành vi phụ thuộc version/deployment; Next.js 16 đã thay hướng sang `use cache`; dynamic request/image hashing cần thiết kế cẩn thận; ít linh hoạt cho rate limit | Cache dữ liệu framework/đơn giản, không muốn thêm Redis |
| **LRU cache in-memory** | `Map` hoặc package LRU trong process | Rất nhanh, miễn phí, dễ làm | Mất khi deploy/cold start; không chia sẻ giữa serverless instance; nguy cơ RAM tăng; hit rate thấp khi scale ngang | Local dev hoặc cache L1 ngắn hạn |
| **Cloudflare KV** | Distributed edge key-value | Đọc toàn cầu, tích hợp Workers/Cloudflare | Eventual consistency; gắn Cloudflare; không lý tưởng cho counter rate limit cần nhất quán mạnh | App chạy trên Cloudflare Workers |
| **CDN/HTTP cache** | `Cache-Control`, CDN edge | Trả response rất nhanh, giảm tải origin | POST không được cache thuận tiện như GET; kết quả dịch có thể riêng tư; cache key/header dễ cấu hình sai | Nội dung public, bất biến; không phải lựa chọn chính cho ảnh riêng tư |

### 4.3 Chính sách cache đề xuất

- Cache **chỉ response thành công và đã validate JSON**.
- Không cache lỗi 401, 403, 429, timeout hoặc response bị cắt.
- TTL ban đầu: 1–24 giờ; đo hit rate rồi điều chỉnh.
- Lưu JSON kết quả, không cần lưu ảnh gốc nếu không có yêu cầu.
- Thêm `promptVersion` và `model` vào key để tránh trả kết quả cũ sau khi đổi prompt/model.
- Không cache tài liệu nhạy cảm nếu chưa có consent/chính sách retention.
- Có giới hạn kích thước value và eviction policy.
- Gộp request đồng thời cùng key bằng **single-flight/request coalescing** để hai request giống nhau không cùng gọi provider trước khi cache được ghi.

### 4.4 Cache khác lịch sử như thế nào?

| Lịch sử `localStorage` hiện tại | Cache server Phase 4 |
|---|---|
| Nằm trên một trình duyệt | Nằm ở server/Redis |
| Dùng để người dùng xem lại | Dùng để tránh gọi AI lặp |
| Thiết bị khác không dùng chung | Có thể phục vụ mọi request có cùng cache key |
| Xóa trình duyệt là mất | Có TTL và eviction do server quản lý |
| Không bảo vệ API key/quota | Trực tiếp giảm số lần gọi provider |

---

## 5. Retry mechanism

### 5.1 Retry dùng để làm gì?

Retry chỉ nên chạy khi lỗi có khả năng tự hết:

- Mất kết nối tạm thời.
- Timeout.
- HTTP 408.
- HTTP 429 nếu có `Retry-After` và chưa vượt ngân sách retry.
- HTTP 500, 502, 503, 504.

Không retry tự động:

- HTTP 400 do payload/prompt sai.
- HTTP 401 do API key sai.
- HTTP 403 do thiếu quyền.
- Hết credit/quota cứng.
- File không hợp lệ/quá lớn.
- Response đã thành công nhưng client tự hủy sau khi provider tính phí, trừ khi có idempotency/dedup phù hợp.

### 5.2 Exponential backoff và jitter

Không retry ngay liên tục. Nên dùng:

```text
delay = min(maxDelay, baseDelay × 2^attempt) + randomJitter
```

Ví dụ:

```text
Lần 1 → chờ khoảng 500–1.000 ms
Lần 2 → chờ khoảng 1.000–2.000 ms
Sau đó dừng và trả lỗi/fallback
```

Jitter làm các request không đồng loạt thử lại cùng lúc khi provider vừa phục hồi.

### 5.3 Công cụ retry và resilience

| Công cụ | Khả năng | Ưu điểm | Nhược điểm | Phù hợp |
|---|---|---|---|---|
| **`p-retry`** | Exponential backoff, randomize, timeout tổng, callback phân loại, `AbortSignal` | Nhẹ, API rõ, kiểm soát lỗi nào retry; hợp fetch/SDK call | Chỉ giải quyết retry, không có circuit breaker/queue đầy đủ; phải tự đọc `Retry-After` và phân loại lỗi provider | **Khuyên dùng cho route hiện tại** |
| **Retry helper tự viết** | Loop + exponential delay | Không thêm dependency; dự án đã có khung cơ bản | Helper hiện retry mọi lỗi, không jitter, không timeout/cancel, không đọc HTTP status/`Retry-After`; dễ retry nhầm 401/quota | Chỉ dùng sau khi nâng cấp logic đáng kể |
| **Cockatiel** | Retry, circuit breaker, timeout, bulkhead, fallback | Bộ resilience TypeScript đầy đủ; ghép policy được; phù hợp nhiều provider | Phức tạp hơn nhu cầu MVP; cấu hình sai circuit breaker/retry gây lỗi khó hiểu | Production cần fallback/circuit breaker |
| **SDK chính thức của provider** | Một số SDK có retry/backoff mặc định hoặc tùy chỉnh | Ít code, hiểu lỗi provider tốt hơn fetch thô | Hành vi khác nhau giữa SDK/version; có thể retry chồng với app; phải kiểm tra mặc định từng SDK | Khi dùng SDK chính thức ổn định |
| **Upstash QStash** | Queue, retry, exponential backoff, flow control, callback/DLQ | Tác vụ không mất khi function kết thúc; điều khiển concurrency/rate; phù hợp batch/background | Chuyển UX sang bất đồng bộ/polling; thêm dịch vụ và chi phí; không hợp request camera cần trả ngay | Batch OCR/PDF hoặc tác vụ nền Phase 5 |
| **Bottleneck** | Queue/concurrency/outbound rate | Tránh vượt quota provider, điều tiết request | Queue local có thể mất ở serverless; không phải durable retry | Server dài hạn hoặc phối hợp với durable queue |

### 5.4 Cấu hình retry đề xuất

- Tối đa 2 lần retry sau lần gọi đầu.
- Tổng thời gian request có deadline rõ ràng.
- Tôn trọng header `Retry-After`.
- Exponential backoff có jitter.
- Chỉ retry network error, 408, 429 tạm thời và 5xx.
- Không retry auth, permission, invalid payload hoặc insufficient quota.
- Cho phép `AbortController` hủy khi user chọn ảnh mới/đóng tác vụ.
- Ghi log `provider`, `attempt`, `status`, latency; tuyệt đối không log API key hay raw ảnh nhạy cảm.
- Nếu Gemini lỗi sau retry, có thể đề nghị người dùng chọn OpenAI/Claude; không tự động gọi provider trả phí khác nếu chưa thống nhất chính sách chi phí.

---

## 6. Circuit breaker, queue và observability

Ba công cụ trên là cốt lõi, nhưng production nên cân nhắc:

| Cơ chế | Dùng để làm gì | Công cụ |
|---|---|---|
| **Circuit breaker** | Tạm ngừng gọi provider đang lỗi hàng loạt, tránh retry storm | Cockatiel |
| **Concurrency/bulkhead** | Giới hạn số request đang chạy, cô lập provider lỗi | Cockatiel, Bottleneck, QStash Flow Control |
| **Durable queue** | Không làm mất batch job khi serverless function dừng | Upstash QStash, BullMQ/Redis |
| **Error/performance monitoring** | Đo error rate, P50/P95 latency, cache hit, retry count | Sentry, Vercel Observability/logs |

Không nên triển khai retry mà không có metric. Nếu retry làm tỷ lệ thành công tăng 1% nhưng nhân đôi số API call, cấu hình đó có thể không hiệu quả.

## 7. Combo công cụ đề xuất

### A. MVP đơn giản trên Vercel

```text
Vercel WAF
→ Upstash Ratelimit sliding window
→ Upstash Redis cache
→ p-retry (tối đa 2 retry, jitter)
→ Gemini/OpenAI/Claude
```

Ưu điểm:

- Phù hợp Next.js serverless.
- Một Redis dùng được cho rate limit và cache.
- Tích hợp nhanh, ít hạ tầng.

Nhược điểm:

- Thêm phụ thuộc Upstash.
- WAF + Redis + provider đều có chi phí/hạn mức riêng.

### B. Tự host, kiểm soát cao

```text
Cloudflare/Nginx rate limit
→ Redis/Valkey
→ Cockatiel retry + circuit breaker
→ provider router
```

Ưu điểm:

- Kiểm soát dữ liệu và chính sách.
- Dùng được cache, counter và distributed lock.

Nhược điểm:

- Phải vận hành/monitor hạ tầng.
- Cấu hình multi-region và failover phức tạp.

### C. Batch/PDF trong tương lai

```text
Rate limit
→ cache/dedup
→ QStash durable queue
→ worker OCR/dịch
→ callback/poll kết quả
```

Ưu điểm:

- Không giữ HTTP request lâu.
- Có retry, flow control và xử lý nền.

Nhược điểm:

- UX và backend phức tạp hơn.
- Không phù hợp camera cần kết quả tức thời.

## 8. Lựa chọn khuyên dùng cho dự án

| Hạng mục | Lựa chọn |
|---|---|
| Rate limit ứng dụng | **Upstash Ratelimit sliding window** |
| Chống abuse trước server | **Vercel WAF Rate Limiting** nếu deploy Vercel |
| Cache | **Upstash Redis**, key bằng SHA-256 của ảnh chuẩn hóa + provider/model/prompt/language |
| Retry | **p-retry**, tối đa 2 retry, exponential backoff + jitter |
| Timeout/cancel | `AbortController`/`AbortSignal` |
| Outbound concurrency | Bottleneck hoặc semaphore nhỏ; QStash khi chuyển sang batch |
| Resilience nâng cao | Cockatiel circuit breaker sau khi đã có metric |
| Monitoring | Vercel logs/Observability; thêm Sentry khi cần alert và tracing |

Thứ tự triển khai:

1. Rate limit endpoint tốn phí.
2. Cache + hash key + TTL.
3. Retry có phân loại lỗi, timeout và jitter.
4. Metric: cache hit, blocked request, retry success, provider latency/cost.
5. Circuit breaker/queue khi lưu lượng thực tế chứng minh là cần.

## 9. Những lỗi thiết kế cần tránh

- Rate limit bằng `Map` trong serverless rồi tưởng mọi instance dùng chung.
- Dùng IP duy nhất sau khi đã có user login.
- Cache response lỗi hoặc cache vô thời hạn.
- Cache key thiếu model/prompt version làm trả bản dịch cũ sai phiên bản.
- Retry mọi lỗi, kể cả 401, 403 và hết quota.
- Retry 5 lần cho request camera khiến người dùng chờ quá lâu và tăng hóa đơn.
- Để SDK tự retry rồi bọc thêm nhiều lớp retry mà không biết tổng số lần gọi.
- Retry đồng loạt không jitter khi provider vừa hết sự cố.
- Log raw ảnh, API key hoặc dữ liệu nhạy cảm để debug.
- Tự động fallback sang nhiều provider cùng lúc mà không giới hạn chi phí.

## 10. Nguồn tham khảo

### Rate limiting

- [Upstash Ratelimit overview](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Upstash rate-limit algorithms](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms)
- [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [Cloudflare rate-limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Arcjet documentation](https://docs.arcjet.com/)
- [Redis token-bucket rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/nodejs/)

### Cache

- [Upstash Redis TypeScript client](https://upstash.com/docs/redis/howto/connect-with-upstash-redis)
- [Redis key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [Redis key expiration/TTL](https://redis.io/docs/latest/develop/using-commands/keyspace/)
- [Next.js 14 `unstable_cache`](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)
- [Next.js caching guide](https://nextjs.org/docs/app/guides/caching-without-cache-components)

### Retry, queue và monitoring

- [`p-retry`](https://www.npmjs.com/package/p-retry)
- [Cockatiel](https://www.npmjs.com/package/cockatiel)
- [Upstash QStash queues](https://upstash.com/docs/qstash/features/queues)
- [Upstash QStash flow control](https://upstash.com/docs/qstash/features/flowcontrol)
- [Sentry Next.js SDK](https://www.npmjs.com/package/@sentry/nextjs)

