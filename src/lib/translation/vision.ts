import { NextRequest } from 'next/server';
import sharp from 'sharp';

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export type VisionTranslationInput = {
  text: string;
  target: string;
  source: string;
  image?: {
    data: string;
    mimeType: string;
  };
};

export type ParsedVisionTranslation = {
  translation: string;
  script?: 'simplified' | 'traditional' | 'mixed';
  segments?: Array<{ original: string; translated: string }>;
  confidence?: number;
  correctedText?: string;
  visualRegions?: Array<{
    original?: string;
    translated?: string;
    bbox?: number[];
    orientation?: 'horizontal' | 'vertical';
  }>;
};

export async function readVisionInput(req: NextRequest): Promise<VisionTranslationInput> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const imageValue = formData.get('image');
    let image: VisionTranslationInput['image'];

    if (imageValue && typeof imageValue !== 'string') {
      if (imageValue.size > MAX_IMAGE_SIZE) throw new Error('Ảnh vượt quá giới hạn 10MB');
      if (!imageValue.type.startsWith('image/')) throw new Error('File gửi lên không phải ảnh');
      const sourceBuffer = Buffer.from(await imageValue.arrayBuffer());
      // Chuẩn hóa ảnh từ camera và chiều xoay EXIF,
      // đồng thời giảm token ảnh và tránh vượt giới hạn payload của AI Vision.
      const optimizedBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
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
      image,
    };
  }

  const body = (await req.json()) as Partial<VisionTranslationInput>;
  return {
    text: typeof body.text === 'string' ? body.text : '',
    target: typeof body.target === 'string' ? body.target : 'vi',
    source: typeof body.source === 'string' ? body.source : 'zh',
  };
}

export function buildVisionTranslationPrompt(text: string, target: string): string {
  const targetName = target === 'vi' ? 'Tiếng Việt' : target === 'en' ? 'Tiếng Anh' : target;
  const reference = text.trim()
    ? `\nVăn bản tham khảo (có thể sai):\n${text.trim()}`
    : '';

  return `Bạn là chuyên gia OCR hình ảnh và dịch Trung - Việt. Hãy nhìn trực tiếp toàn bộ ảnh, nhận diện chữ và dịch sang ${targetName} trong một lần xử lý.

YÊU CẦU:
1. Nhận diện cả chữ Trung giản thể, phồn thể, chữ dọc, chữ cách điệu và chữ viết tay. Không bịa phần bị che hoặc quá mờ; dùng "[không rõ]".
2. correctedText phải chứa nguyên văn theo đúng thứ tự đọc. Loại bỏ ký tự rác do ảnh nhiễu nhưng giữ nguyên số, đơn vị, mã sản phẩm và tên riêng.
3. Dịch theo nghĩa toàn câu/đoạn, tự nhiên bằng ${targetName}; không dịch máy móc từng chữ.
4. Gom chữ thành tối đa 8 khối ngữ nghĩa. Mỗi visualRegions.bbox dùng [yMin,xMin,yMax,xMax] theo thang 0..1000 của toàn ảnh và ôm sát chữ gốc.
5. Chỉ trả JSON hợp lệ, không kèm markdown hay giải thích ngoài JSON.

JSON ĐẦU RA:
{
  "translation": "bản dịch hoàn chỉnh",
  "correctedText": "toàn bộ nguyên văn nhận diện được",
  "script": "simplified | traditional | mixed",
  "segments": [{"original": "câu gốc", "translated": "câu dịch"}],
  "confidence": 0.95,
  "visualRegions": [{"original":"nguyên văn khối","translated":"bản dịch khối","orientation":"horizontal","bbox":[100,200,300,800]}]
}${reference}`;
}

export function parseVisionTranslation(
  content: string,
  originalText = ''
): ParsedVisionTranslation {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const unfenced = (fenceMatch ? fenceMatch[1] : content).trim();

  try {
    const jsonMatch = unfenced.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : unfenced) as ParsedVisionTranslation;
    if (typeof parsed.translation !== 'string') throw new Error('Missing translation');
    return parsed;
  } catch {
    const translationField = unfenced.match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (translationField) {
      const translation = translationField[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
      return {
        translation,
        script: 'simplified',
        segments: [{ original: originalText, translated: translation }],
      };
    }
    throw new Error('Không đọc được phản hồi OCR/dịch từ AI, vui lòng thử lại');
  }
}

export function normalizeVisualRegions(regions: ParsedVisionTranslation['visualRegions']) {
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

    const orientation: 'horizontal' | 'vertical' =
      region.orientation === 'vertical' || y1 - y0 > (x1 - x0) * 1.35
        ? 'vertical'
        : 'horizontal';

    return [{
      original: region.original.trim(),
      translated: region.translated.trim(),
      orientation,
      bbox: { x0, y0, x1, y1 },
    }];
  });

  return normalized.length ? normalized.slice(0, 8) : undefined;
}

export function createVisionResponse(parsed: ParsedVisionTranslation, provider: string) {
  const originalText = parsed.correctedText?.trim()
    || parsed.segments?.map((segment) => segment.original).filter(Boolean).join('\n')
    || '';
  return {
    translation: parsed.translation,
    correctedText: originalText,
    detectedScript: parsed.script || 'simplified',
    segments: parsed.segments?.length
      ? parsed.segments
      : [{ original: originalText, translated: parsed.translation }],
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
    overlayRegions: normalizeVisualRegions(parsed.visualRegions),
    provider,
  };
}
