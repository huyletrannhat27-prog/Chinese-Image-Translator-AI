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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || /^your_/i.test(apiKey)) {
      return NextResponse.json(
        { error: 'Chưa cấu hình OPENAI_API_KEY trên server', code: 'MISSING_OPENAI_API_KEY' },
        { status: 503 }
      );
    }

    const prompt = buildVisionTranslationPrompt(text, target);
    const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }];
    if (image) {
      content.push({
        type: 'input_image',
        image_url: `data:${image.mimeType};base64,${image.data}`,
        detail: 'high',
      });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
        input: [{ role: 'user', content }],
        reasoning: { effort: 'low' },
        max_output_tokens: 6144,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `OpenAI API error: ${response.status}`);
    }

    const outputText = data.output_text || data.output
      ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
      .find((item: { type?: string }) => item.type === 'output_text')?.text || '';
    const parsed = parseVisionTranslation(outputText, text);
    return NextResponse.json(createVisionResponse(parsed, 'openai'));
  } catch (error) {
    console.error('OpenAI Translation Error:', error);
    return NextResponse.json(
      { error: `OpenAI OCR/dịch thất bại: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
