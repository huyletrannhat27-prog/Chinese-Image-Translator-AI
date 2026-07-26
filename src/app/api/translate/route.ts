import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

type TranslationInput = {
  text: string;
  target: string;
  source: string;
  lines?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const { text, target, source, lines } = await readTranslationInput(req);
    if (!text.trim()) {
      return NextResponse.json({ error: 'Không có văn bản OCR để dịch' }, { status: 400 });
    }

    const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
    if (!isGeminiApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY chưa được cấu hình hợp lệ', code: 'INVALID_GEMINI_API_KEY' },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      contents: buildTranslationPrompt(text, target, source, lines),
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const parsed = parseTranslationResponse(response.text || '');
    const translatedLines =
      lines && parsed.translatedLines?.length === lines.length
        ? parsed.translatedLines
        : undefined;

    return NextResponse.json({
      translation: parsed.translation,
      correctedText: text,
      detectedScript: parsed.script || 'simplified',
      segments: parsed.segments?.length
        ? parsed.segments
        : [{ original: text, translated: parsed.translation }],
      translatedLines,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      provider: 'gemini',
    });
  } catch (error) {
    console.error('Gemini translation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dịch thuật thất bại', code: 'TRANSLATION_FAILED' },
      { status: 500 }
    );
  }
}

async function readTranslationInput(req: NextRequest): Promise<TranslationInput> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const linesValue = formData.get('lines');
    let lines: string[] | undefined;
    if (typeof linesValue === 'string' && linesValue.trim()) {
      const parsed = JSON.parse(linesValue);
      if (Array.isArray(parsed)) lines = parsed.filter((line): line is string => typeof line === 'string');
    }
    return {
      text: String(formData.get('text') || ''),
      target: String(formData.get('target') || 'vi'),
      source: String(formData.get('source') || 'zh'),
      lines,
    };
  }

  const body = (await req.json()) as Partial<TranslationInput>;
  return {
    text: typeof body.text === 'string' ? body.text : '',
    target: typeof body.target === 'string' ? body.target : 'vi',
    source: typeof body.source === 'string' ? body.source : 'zh',
    lines: Array.isArray(body.lines)
      ? body.lines.filter((line): line is string => typeof line === 'string')
      : undefined,
  };
}

function buildTranslationPrompt(text: string, target: string, source: string, lines?: string[]) {
  const targetName = target === 'vi' ? 'Tiếng Việt' : target;
  const sourceName = source === 'zh' ? 'tiếng Trung' : source;
  const lineInstruction = lines?.length
    ? `\nDanh sách dòng OCR theo đúng thứ tự (phải trả translatedLines đúng ${lines.length} phần tử):\n${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
    : '';

  return `Bạn là dịch giả chuyên nghiệp. Dịch văn bản ${sourceName} sang ${targetName}.
Giữ đúng ý nghĩa, ngữ cảnh, tên riêng, số và đơn vị; văn phong tự nhiên, không giải thích thêm.
Chỉ trả JSON hợp lệ:
{
  "translation": "bản dịch hoàn chỉnh",
  "script": "simplified | traditional | mixed",
  "segments": [{"original": "câu gốc", "translated": "câu dịch"}],
  "confidence": 0.95${lines?.length ? ',\n  "translatedLines": ["bản dịch dòng 1", "bản dịch dòng 2"]' : ''}
}
Văn bản OCR:
${text}${lineInstruction}`;
}

function parseTranslationResponse(content: string): {
  translation: string;
  script?: 'simplified' | 'traditional' | 'mixed';
  segments?: Array<{ original: string; translated: string }>;
  confidence?: number;
  translatedLines?: string[];
} {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || content;
  const parsed = JSON.parse(fenced.match(/\{[\s\S]*\}/)?.[0] || fenced);
  if (typeof parsed.translation !== 'string' || !parsed.translation.trim()) {
    throw new Error('Gemini không trả về bản dịch hợp lệ');
  }
  return parsed;
}

function normalizeApiKey(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function isGeminiApiKey(value: string) {
  return value.length >= 20 && !/\s/.test(value) && !/^(aa|your_)/i.test(value)
    && !/^ya29\./.test(value) && !/\.apps\.googleusercontent\.com$/.test(value);
}
