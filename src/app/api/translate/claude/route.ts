import { NextRequest, NextResponse } from 'next/server';
import {
  buildVisionTranslationPrompt,
  createVisionResponse,
  parseVisionTranslation,
  readVisionInput,
} from '@/lib/translation/vision';

// Tăng timeout
export const maxDuration = 60;

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
      throw new Error(data?.error?.message || `Claude API error: ${response.status}`);
    }

    const outputText = data.content
      ?.filter((item: { type?: string }) => item.type === 'text')
      .map((item: { text?: string }) => item.text || '')
      .join('\n') || '';
    const parsed = parseVisionTranslation(outputText, text);
    return NextResponse.json(createVisionResponse(parsed, 'claude'));

  } catch (error) {
    console.error('Claude Translation Error:', error);
    return NextResponse.json(
      { error: `Claude OCR/dịch thất bại: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
