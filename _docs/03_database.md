# Database Schema — Chinese Image Translator AI

> **Lưu ý:** Ứng dụng hiện tại không yêu cầu database (xử lý stateless, cache in-memory).  
> Schema này dành cho Phase 5+ khi cần lưu lịch sử và quản lý user.

---

## Users & Authentication (NextAuth.js)

```sql
users
  id                UUID PRIMARY KEY
  email             VARCHAR(255) UNIQUE NOT NULL
  name              VARCHAR(100)
  image             TEXT                 -- avatar URL
  provider          VARCHAR(50)          -- google, github, email
  provider_id       VARCHAR(255)         -- ID từ provider
  tier              ENUM(free, pro, enterprise) DEFAULT 'free'
  daily_requests    INT DEFAULT 0
  last_request_at   TIMESTAMP
  created_at        TIMESTAMP
  updated_at        TIMESTAMP

  INDEX idx_email (email)
  INDEX idx_provider_provider_id (provider, provider_id)