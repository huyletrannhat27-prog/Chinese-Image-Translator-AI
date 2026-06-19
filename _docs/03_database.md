# Database Design — Chinese Image Translator AI

## Goals

- Store user translation history and settings
- Keep OCR results and translation output for quick retrieval
- Support future user accounts and auth
- Enable analytics for request usage and error tracking

## Core Collections / Tables

### 1. translations

- `id` — unique translation record ID
- `userId` — reference to user (optional)
- `sourceText` — OCR-extracted text
- `translatedText` — translated output
- `sourceLanguage` — detected source language/script
- `targetLanguage` — selected target language
- `provider` — OpenAI / Gemini / Claude / custom service
- `imageFileName` — optional image reference or file URL
- `ocrConfidence` — OCR confidence score if available
- `createdAt` — timestamp
- `updatedAt` — timestamp

### 2. users

- `id` — unique user ID
- `email` — optional email
- `name` — display name
- `role` — user / admin
- `apiKeys` — stored provider keys metadata (if needed)
- `settings` — preferred target language, provider, theme
- `createdAt`
- `updatedAt`

### 3. request_logs

- `id`
- `userId` — optional
- `endpoint` — API route called
- `status` — success / error
- `responseTimeMs`
- `errorMessage`
- `createdAt`

## Schema Notes

- Use a document database like MongoDB for translation history flexibility.
- Embed translation metadata inside the `translations` document.
- Separate `request_logs` for analytics and rate limiting.
- Use indexes on `userId`, `createdAt`, and `provider`.

## Optional Enhancements

- Add `files` collection for uploaded images and PDF metadata
- Add `sessions` collection for auth sessions and refresh tokens
- Add `cache` collection for repeated OCR/translation results
- Add TTL indexes for temporary usage data and log pruning
