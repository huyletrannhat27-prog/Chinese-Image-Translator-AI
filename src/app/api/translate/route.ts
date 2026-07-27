import { NextRequest, NextResponse } from 'next/server';
import { ApiError, GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

const MAX_TEXT_LENGTH = 50_000;
const MAX_LINES = 500;
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

type TranslationInput = {
  text: string;
  lines: string[];
  target: 'vi';
};

type GeminiTranslation = {
  translation: string;
  script?: 'simplified' | 'traditional' | 'mixed';
  segments?: Array<{ original: string; translated: string }>;
  translatedLines?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const input = await readTranslationInput(req);
    if (!input.text.trim()) {
      return NextResponse.json({ error: 'Không có văn bản PaddleOCR để dịch' }, { status: 400 });
    }

    const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
    if (!isGeminiApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY chưa được cấu hình hợp lệ', code: 'INVALID_GEMINI_API_KEY' },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 55_000 },
    });
    const response = await ai.models.generateContent({
      model: normalizeModel(process.env.GEMINI_MODEL) || DEFAULT_MODEL,
      contents: buildTranslationPrompt(input),
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            translation: { type: 'string' },
            script: { type: 'string', enum: ['simplified', 'traditional', 'mixed'] },
            segments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  original: { type: 'string' },
                  translated: { type: 'string' },
                },
                required: ['original', 'translated'],
              },
            },
            translatedLines: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['translation', 'script', 'segments', 'translatedLines'],
        },
      },
    });

    const parsed = parseTranslation(response.text || '');
    const translatedLines = normalizeTranslatedLines(parsed.translatedLines, input.lines.length);

    return NextResponse.json({
      translation: parsed.translation,
      correctedText: input.text,
      detectedScript: parsed.script || 'mixed',
      segments: parsed.segments?.length
        ? parsed.segments
        : [{ original: input.text, translated: parsed.translation }],
      translatedLines,
      provider: 'gemini',
    });
  } catch (error) {
    console.error('Gemini text translation error:', error);
    const responseError = toResponseError(error);
    return NextResponse.json(
      {
        error: responseError.message,
        code: responseError.code,
      },
      { status: responseError.status }
    );
  }
}

async function readTranslationInput(req: NextRequest): Promise<TranslationInput> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new InputError('Endpoint dịch chỉ nhận JSON từ kết quả PaddleOCR');
  }
  let body: Partial<TranslationInput>;
  try {
    body = await req.json() as Partial<TranslationInput>;
  } catch {
    throw new InputError('JSON gửi lên không hợp lệ');
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length > MAX_TEXT_LENGTH) {
    throw new InputError(`Văn bản OCR vượt quá ${MAX_TEXT_LENGTH.toLocaleString('vi-VN')} ký tự`);
  }
  const lines = Array.isArray(body.lines)
    ? body.lines
      .filter((line): line is string => typeof line === 'string')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_LINES)
    : [];

  return {
    text,
    lines,
    target: 'vi',
  };
}

function buildTranslationPrompt(input: TranslationInput) {
  const targetName = input.target === 'vi' ? 'Tiếng Việt' : input.target;
  const numberedLines = input.lines
    .map((line, index) => `${index + 1}. ${line}`)
    .join('\n');

  return `Bạn là chuyên gia dịch tiếng Trung sang ${targetName}.
Đầu vào bên dưới là văn bản do PaddleOCR nhận dạng. Chỉ dịch văn bản này; bạn không được thực hiện OCR và không có quyền truy cập ảnh gốc.

YÊU CẦU:
1. Dịch đúng nghĩa và tự nhiên bằng ${targetName}; giữ nguyên tên riêng, số, đơn vị và mã sản phẩm.
2. Không tự thêm nội dung không có trong văn bản OCR.
3. Xác định văn bản là simplified, traditional hoặc mixed.
4. translatedLines phải có đúng ${input.lines.length} phần tử, theo đúng thứ tự từng dòng PaddleOCR.
5. Chỉ trả JSON hợp lệ, không kèm markdown hoặc giải thích.

Toàn bộ văn bản PaddleOCR:
${input.text}

Các dòng PaddleOCR:
${numberedLines}`;
}

function parseTranslation(content: string): GeminiTranslation {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || content;
  try {
    const parsed = JSON.parse(fenced.match(/\{[\s\S]*\}/)?.[0] || fenced) as GeminiTranslation;
    if (typeof parsed.translation !== 'string' || !parsed.translation.trim()) {
      throw new Error('Gemini không trả về bản dịch');
    }
    return parsed;
  } catch {
    throw new Error('Không đọc được phản hồi dịch JSON từ Gemini');
  }
}

function normalizeApiKey(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function normalizeModel(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function isGeminiApiKey(value: string) {
  return value.length >= 20 && !/\s/.test(value) && !/^(aa|your_)/i.test(value)
    && !/^ya29\./.test(value) && !/\.apps\.googleusercontent\.com$/.test(value);
}

function normalizeTranslatedLines(value: unknown, expectedLength: number) {
  const lines = Array.isArray(value)
    ? value.map((line) => typeof line === 'string' ? line.trim() : '')
    : [];
  return Array.from({ length: expectedLength }, (_, index) => lines[index] || '');
}

class InputError extends Error {}

function toResponseError(error: unknown) {
  if (error instanceof InputError) {
    return { message: error.message, code: 'INVALID_TRANSLATION_INPUT', status: 400 };
  }
  if (error instanceof ApiError) {
    if (error.status === 400 && /api[_\s-]?key|invalid_argument/i.test(error.message)) {
      return {
        message: 'GEMINI_API_KEY không hợp lệ. Hãy tạo key mới trong Google AI Studio.',
        code: 'GEMINI_INVALID_API_KEY',
        status: 503,
      };
    }
    if (error.status === 429) {
      return {
        message: 'Gemini đang vượt giới hạn lượt gọi. Vui lòng thử lại sau.',
        code: 'GEMINI_RATE_LIMITED',
        status: 429,
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        message: 'GEMINI_API_KEY không hợp lệ hoặc không có quyền dùng model đã chọn.',
        code: 'GEMINI_UNAUTHORIZED',
        status: 503,
      };
    }
    if (error.status === 404) {
      return {
        message: 'GEMINI_MODEL không tồn tại hoặc không hỗ trợ generateContent.',
        code: 'GEMINI_MODEL_NOT_FOUND',
        status: 503,
      };
    }
  }
  const timedOut = error instanceof Error
    && (/timeout/i.test(error.message) || error.name === 'AbortError');
  return {
    message: timedOut
      ? 'Gemini dịch quá thời gian cho phép. Vui lòng thử lại.'
      : error instanceof Error
        ? error.message
        : 'Gemini dịch văn bản thất bại',
    code: timedOut ? 'GEMINI_TIMEOUT' : 'GEMINI_TRANSLATION_FAILED',
    status: timedOut ? 504 : 500,
  };
}
