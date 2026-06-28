import { NextRequest, NextResponse } from 'next/server';

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
    if (!process.env.CLAUDE_API_KEY) {
      // Fallback: gọi Gemini
      const geminiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target }),
      });
      return geminiResponse;
    }

    // Claude API integration
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: `Bạn là dịch giả chuyên nghiệp. Dịch văn bản tiếng Trung sau sang ${target === 'vi' ? 'Tiếng Việt' : target === 'en' ? 'Tiếng Anh' : target}.
Phát hiện Giản thể (简体) hay Phồn thể (繁體).
Trả về JSON duy nhất: {"translation": "...", "script": "simplified|traditional|mixed"}

Văn bản: ${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

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
      provider: 'claude',
    });

  } catch (error) {
    console.error('Claude Translation Error:', error);
    return NextResponse.json(
      { error: 'Dịch thuật thất bại' },
      { status: 500 }
    );
  }
}