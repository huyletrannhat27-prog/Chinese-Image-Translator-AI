import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Tăng timeout
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, target = 'vi' } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Không có văn bản để dịch' },
        { status: 400 }
      );
    }

    // Kiểm tra API key
    if (!process.env.OPENAI_API_KEY) {
      // Fallback: gọi Gemini
      const geminiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target }),
      });
      return geminiResponse;
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Bạn là dịch giả chuyên nghiệp. Dịch văn bản tiếng Trung sang ${target === 'vi' ? 'Tiếng Việt' : target === 'en' ? 'Tiếng Anh' : target}.
                    Phát hiện Giản thể (简体) hay Phồn thể (繁體).
                    Trả về JSON: {"translation": "...", "script": "simplified|traditional|mixed"}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const content = response.choices[0].message.content || '';
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { translation: content, script: 'simplified' };
    } catch (e) {
      parsed = { translation: content, script: 'simplified' };
    }

    return NextResponse.json({
      translation: parsed.translation || content,
      detectedScript: parsed.script || 'simplified',
      segments: [{ original: text, translated: parsed.translation || content }],
      confidence: 0.9,
      provider: 'openai',
    });

  } catch (error) {
    console.error('OpenAI Translation Error:', error);
    return NextResponse.json(
      { error: 'Dịch thuật thất bại' },
      { status: 500 }
    );
  }
}