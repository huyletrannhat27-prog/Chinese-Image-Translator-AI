import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

export const maxDuration = 60;

type TranslationInput = {
  text: string;
  target: string;
  source: string;
  lines?: string[];
  image?: { data: string; mimeType: string };
};

export async function POST(req: NextRequest) {
  try {
    const { text, target, source, lines, image } = await readTranslationInput(req);
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
    const prompt = buildTranslationPrompt(text, target, source, lines, Boolean(image));
    const contents = image
      ? [
          { text: prompt },
          { inlineData: { data: image.data, mimeType: image.mimeType } },
        ]
      : prompt;
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      contents,
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            translation: { type: 'string' },
            correctedText: { type: 'string' },
            script: { type: 'string', enum: ['simplified', 'traditional', 'mixed'] },
            segments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  original: { type: 'string' },
                  translated: { type: 'string' },
                },
              },
            },
            confidence: { type: 'number' },
            translatedLines: { type: 'array', items: { type: 'string' } },
            visualRegions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  original: { type: 'string' },
                  translated: { type: 'string' },
                  orientation: { type: 'string', enum: ['horizontal', 'vertical'] },
                  bbox: { type: 'array', items: { type: 'number' } },
                },
              },
            },
          },
          required: ['translation'],
        },
      },
    });

    const parsed = parseTranslationResponse(response.text || '');
    const translatedLines =
      lines && parsed.translatedLines?.length === lines.length
        ? parsed.translatedLines
        : undefined;

    return NextResponse.json({
      translation: parsed.translation,
      correctedText: parsed.correctedText || text,
      detectedScript: parsed.script || 'simplified',
      segments: parsed.segments?.length
        ? parsed.segments
        : [{ original: text, translated: parsed.translation }],
      translatedLines,
      overlayRegions: normalizeVisualRegions(parsed.visualRegions),
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
    const imageValue = formData.get('image');
    const linesValue = formData.get('lines');
    let lines: string[] | undefined;
    if (typeof linesValue === 'string' && linesValue.trim()) {
      const parsed = JSON.parse(linesValue);
      if (Array.isArray(parsed)) lines = parsed.filter((line): line is string => typeof line === 'string');
    }
    let image: TranslationInput['image'];
    if (imageValue && typeof imageValue !== 'string') {
      if (imageValue.size > 10 * 1024 * 1024) throw new Error('Ảnh vượt quá giới hạn 10MB');
      if (!imageValue.type.startsWith('image/')) throw new Error('File gửi lên không phải ảnh');
      const sourceBuffer = Buffer.from(await imageValue.arrayBuffer());
      const metadata = await sharp(sourceBuffer).metadata();
      const longestEdge = Math.max(metadata.width || 0, metadata.height || 0);
      const targetEdge = Math.min(3200, Math.max(longestEdge, 2400));
      const optimizedBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(targetEdge, targetEdge, {
          fit: 'inside',
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3,
        })
        .sharpen({ sigma: 1, m1: 0.7, m2: 2 })
        .jpeg({ quality: 94, mozjpeg: true })
        .toBuffer();
      image = {
        data: optimizedBuffer.toString('base64'),
        mimeType: 'image/jpeg',
      };
    }
    return {
      text: String(formData.get('text') || ''),
      target: String(formData.get('target') || 'vi'),
      source: String(formData.get('source') || 'zh'),
      lines,
      image,
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

function buildTranslationPrompt(
  text: string,
  target: string,
  source: string,
  lines?: string[],
  hasImage = false
) {
  const targetName = target === 'vi' ? 'Tiếng Việt' : target;
  const sourceName = source === 'zh' ? 'tiếng Trung' : source;
  const lineInstruction = lines?.length
    ? `\nDanh sách dòng OCR theo đúng thứ tự (phải trả translatedLines đúng ${lines.length} phần tử):\n${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
    : '';

  return `Bạn là chuyên gia OCR hình ảnh và dịch ${sourceName} sang ${targetName}.
${hasImage ? 'Hãy nhìn trực tiếp ảnh để sửa mọi lỗi OCR, khôi phục chữ bị thiếu và hiểu bố cục/ngữ cảnh. Văn bản OCR bên dưới chỉ là bản nháp tham khảo, không được tin tuyệt đối.' : ''}
Giữ đúng ý nghĩa, ngữ cảnh, tên riêng, số và đơn vị; văn phong tự nhiên, không giải thích thêm.
Chỉ trả JSON hợp lệ:
{
  "translation": "bản dịch hoàn chỉnh",
  "correctedText": "toàn bộ chữ gốc đã sửa theo ảnh",
  "script": "simplified | traditional | mixed",
  "segments": [{"original": "câu gốc", "translated": "câu dịch"}],
  "confidence": 0.95${lines?.length ? ',\n  "translatedLines": ["bản dịch dòng 1", "bản dịch dòng 2"]' : ''}${hasImage ? ',\n  "visualRegions": [{"original":"chữ gốc","translated":"bản dịch","orientation":"horizontal","bbox":[yMin,xMin,yMax,xMax]}]' : ''}
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
  correctedText?: string;
  visualRegions?: Array<{
    original?: string;
    translated?: string;
    orientation?: 'horizontal' | 'vertical';
    bbox?: number[];
  }>;
} {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || content;
  try {
    const parsed = JSON.parse(fenced.match(/\{[\s\S]*\}/)?.[0] || fenced);
    if (typeof parsed.translation !== 'string' || !parsed.translation.trim()) {
      throw new Error('empty translation');
    }
    return parsed;
  } catch {
    // Gemini đôi khi cắt JSON ở cuối mảng. Lấy các field quan trọng để không
    // làm hỏng toàn bộ bản dịch chỉ vì segments/visualRegions chưa đóng đủ.
    const translation = extractJsonString(fenced, 'translation');
    if (!translation) throw new Error('Gemini không trả về bản dịch hợp lệ');
    return {
      translation,
      correctedText: extractJsonString(fenced, 'correctedText'),
      translatedLines: extractJsonStringArray(fenced, 'translatedLines'),
      confidence: Number(extractJsonString(fenced, 'confidence')) || 0.75,
    };
  }
}

function extractJsonString(content: string, field: string) {
  const match = content.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (match) {
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  const numberMatch = content.match(new RegExp(`"${field}"\\s*:\\s*([0-9.]+)`));
  return numberMatch?.[1];
}

function extractJsonStringArray(content: string, field: string) {
  const match = content.match(new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`));
  if (!match) return undefined;
  return [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)].map((item) => {
    try {
      return JSON.parse(`"${item[1]}"`);
    } catch {
      return item[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  });
}

function normalizeVisualRegions(regions: ReturnType<typeof parseTranslationResponse>['visualRegions']) {
  if (!Array.isArray(regions)) return undefined;
  const normalized = regions.flatMap((region) => {
    if (!region || typeof region.original !== 'string' || typeof region.translated !== 'string') return [];
    if (!Array.isArray(region.bbox) || region.bbox.length !== 4) return [];
    const [rawY0, rawX0, rawY1, rawX1] = region.bbox.map(Number);
    if (![rawY0, rawX0, rawY1, rawX1].every(Number.isFinite)) return [];
    const x0 = Math.max(0, Math.min(1000, rawX0));
    const y0 = Math.max(0, Math.min(1000, rawY0));
    const x1 = Math.max(0, Math.min(1000, rawX1));
    const y1 = Math.max(0, Math.min(1000, rawY1));
    if (x1 <= x0 || y1 <= y0 || !region.translated.trim()) return [];
    return [{
      original: region.original.trim(),
      translated: region.translated.trim(),
      orientation: region.orientation === 'vertical' || y1 - y0 > (x1 - x0) * 1.35
        ? 'vertical'
        : 'horizontal',
      bbox: { x0, y0, x1, y1 },
    }];
  });
  const nonOverlapping = normalized.filter((region, index, all) =>
    all.slice(0, index).every((previous) => overlapRatio(region.bbox, previous.bbox) < 0.55)
  );
  return nonOverlapping.length ? nonOverlapping.slice(0, 12) : undefined;
}

function overlapRatio(
  first: { x0: number; y0: number; x1: number; y1: number },
  second: { x0: number; y0: number; x1: number; y1: number }
) {
  const width = Math.max(0, Math.min(first.x1, second.x1) - Math.max(first.x0, second.x0));
  const height = Math.max(0, Math.min(first.y1, second.y1) - Math.max(first.y0, second.y0));
  const intersection = width * height;
  const firstArea = (first.x1 - first.x0) * (first.y1 - first.y0);
  const secondArea = (second.x1 - second.x0) * (second.y1 - second.y0);
  return intersection / Math.max(1, Math.min(firstArea, secondArea));
}

function normalizeApiKey(value: string | undefined) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function isGeminiApiKey(value: string) {
  return value.length >= 20 && !/\s/.test(value) && !/^(aa|your_)/i.test(value)
    && !/^ya29\./.test(value) && !/\.apps\.googleusercontent\.com$/.test(value);
}
