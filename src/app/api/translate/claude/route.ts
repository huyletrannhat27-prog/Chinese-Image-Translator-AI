import { NextRequest, NextResponse } from 'next/server';
import {
  buildVisionTranslationPrompt,
  createVisionResponse,
  parseVisionTranslation,
  readVisionInput,
} from '@/lib/translation/vision';

// Tăng timeout
export const maxDuration = 60;

class ClaudeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

function claudeErrorMessage(status: number, code?: string, message?: string) {
  const normalizedMessage = message?.toLowerCase() || '';
  if (normalizedMessage.includes('credit balance is too low')) {
    return 'Tài khoản Anthropic Claude không đủ credit. Hãy nạp credit trong Plans & Billing rồi thử lại.';
  }
  if (status === 401) return 'ANTHROPIC_API_KEY/CLAUDE_API_KEY không hợp lệ hoặc đã bị thu hồi.';
  if (status === 429) return 'Claude đang giới hạn tần suất yêu cầu. Vui lòng thử lại sau ít phút.';
  if (status === 403) return 'API key Claude không có quyền dùng model đã chọn.';
  return message || `Claude API trả về lỗi ${status}${code ? ` (${code})` : ''}`;
}

export async function POST(req: NextRequest) {
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

    const prompt = buildVisionTranslationPrompt(text, target);
    const content: Array<Record<string, unknown>> = [];
    if (image) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType, data: image.data },
      });
    }
    content.push({ type: 'text', text: prompt });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 6144,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const code = typeof data?.error?.type === 'string' ? data.error.type : undefined;
      throw new ClaudeRequestError(
        claudeErrorMessage(response.status, code, data?.error?.message),
        response.status,
        code
      );
    }

    const outputText = data.content
      ?.filter((item: { type?: string }) => item.type === 'text')
      .map((item: { text?: string }) => item.text || '')
      .join('\n') || '';
    const parsed = parseVisionTranslation(outputText, text);
    return NextResponse.json(createVisionResponse(parsed, 'claude'));

  } catch (error) {
    console.error('Claude Translation Error:', error);
    if (error instanceof ClaudeRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code || 'CLAUDE_API_ERROR' },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: `Claude OCR/dịch thất bại: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
