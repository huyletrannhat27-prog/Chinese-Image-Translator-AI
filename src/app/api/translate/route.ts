import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Part } from '@google/genai';

// Tăng timeout cho API route
export const maxDuration = 60;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type TranslationInput = {
  text: string;
  target: string;
  source: string;
  lines?: string[];
  image?: {
    data: string;
    mimeType: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const { text, target, lines, image } = await readTranslationInput(req);

    if ((!text || text.trim().length === 0) && !image) {
      return NextResponse.json(
        { error: 'Không có văn bản hoặc hình ảnh để dịch' },
        { status: 400 }
      );
    }

    const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
    if (!isGeminiApiKey(apiKey)) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY chưa hợp lệ. Hãy tạo Standard API key hoặc Authorization API key tại Google AI Studio, dán vào file .env rồi khởi động lại server.',
          code: 'INVALID_GEMINI_API_KEY',
        },
        { status: 503 }
      );
    }

    // Prompt engineering
    const ocrText = text.trim() || '[OCR không đọc được chữ; hãy nhận diện trực tiếp từ ảnh]';
    const prompt = buildTranslationPrompt(ocrText, target, lines, Boolean(image));

    const ai = new GoogleGenAI({ apiKey });
    const contents: string | Part[] = image
      ? [
          { text: prompt },
          {
            inlineData: {
              data: image.data,
              mimeType: image.mimeType,
            },
          },
        ]
      : prompt;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        temperature: 0.3,
        // 1024 quá thấp cho gemini-2.5-flash: model "thinking" tiêu tốn một phần
        // token trước khi trả JSON, dễ bị cắt cụt giữa chừng khi văn bản dài/lộn
        // xộn (nhiều segments) - tăng lên để tránh JSON bị hỏng do cắt cụt.
        maxOutputTokens: 6144,
        topP: 0.95,
        topK: 40,
        responseMimeType: 'application/json',
      },
    });
    const content = response.text || '';

    const parsed = parseTranslationResponse(content, ocrText);

    // Chỉ tin translatedLines nếu đúng số dòng đầu vào - model đôi khi gộp/tách
    // dòng dù được dặn không làm vậy; sai số dòng thì bỏ, để client tự fallback
    // về hiển thị không overlay thay vì overlay lệch vị trí.
    const translatedLines =
      lines && parsed.translatedLines && parsed.translatedLines.length === lines.length
        ? parsed.translatedLines
        : undefined;

    return NextResponse.json({
      translation: parsed.translation || content,
      detectedScript: parsed.script || 'simplified',
      segments: parsed.segments || [{ original: text, translated: parsed.translation || content }],
      confidence: parsed.confidence || 0.9,
      provider: 'gemini',
      translatedLines,
      correctedText: parsed.correctedText,
      overlayRegions: normalizeVisualRegions(parsed.visualRegions),
    });

  } catch (error) {
    console.error('Translation Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isAuthError =
      /401|unauthorized|invalid authentication|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(message);

    return NextResponse.json(
      {
        error: isAuthError
          ? 'Gemini từ chối credential. GEMINI_API_KEY phải là Standard API key hoặc Authorization API key tạo từ Google AI Studio, không phải OAuth access token hoặc Client ID.'
          : `Lỗi dịch thuật: ${message}`,
        code: isAuthError ? 'INVALID_GEMINI_API_KEY' : 'TRANSLATION_FAILED',
      },
      { status: isAuthError ? 503 : 500 }
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
      try {
        const parsed = JSON.parse(linesValue);
        if (Array.isArray(parsed)) {
          lines = parsed.filter((line): line is string => typeof line === 'string');
        }
      } catch {
        throw new Error('Danh sách vùng OCR không hợp lệ');
      }
    }

    let image: TranslationInput['image'];
    if (imageValue && typeof imageValue !== 'string') {
      if (imageValue.size > MAX_IMAGE_SIZE) {
        throw new Error('Ảnh vượt quá giới hạn 10MB');
      }
      if (!imageValue.type.startsWith('image/')) {
        throw new Error('File gửi lên không phải ảnh');
      }
      image = {
        data: Buffer.from(await imageValue.arrayBuffer()).toString('base64'),
        mimeType: imageValue.type || 'image/jpeg',
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

function normalizeApiKey(value: string | undefined): string {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function isGeminiApiKey(value: string): boolean {
  if (value.length < 20 || /\s/.test(value)) return false;
  if (/^(aa|your_)/i.test(value)) return false;
  if (/^ya29\./.test(value)) return false;
  if (/\.apps\.googleusercontent\.com$/.test(value)) return false;
  return true;
}

// Parse phản hồi của Gemini thành { translation, script, segments, confidence }.
// Phải chịu được 2 kiểu lỗi thường gặp: (1) model bọc JSON trong khối markdown
// ```json ... ```, (2) JSON bị cắt cụt giữa chừng do vượt maxOutputTokens.
// Không bao giờ để lọt text/markdown thô ra ngoài cho người dùng thấy.
function parseTranslationResponse(
  content: string,
  originalText: string
): {
  translation: string;
  script?: string;
  segments?: Array<{ original: string; translated: string }>;
  confidence?: number;
  translatedLines?: string[];
  correctedText?: string;
  visualRegions?: Array<{
    original?: string;
    translated?: string;
    bbox?: number[];
    orientation?: 'horizontal' | 'vertical';
  }>;
} {
  // Bóc khối markdown ```json ... ``` hoặc ``` ... ``` nếu có
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const unfenced = fenceMatch ? fenceMatch[1] : content;

  try {
    const jsonMatch = unfenced.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : unfenced);
  } catch (parseError) {
    console.warn('Failed to parse Gemini response as JSON, trying partial recovery:', content);
  }

  // JSON bị cắt cụt (thiếu dấu đóng) - cố lấy riêng field "translation" bằng regex
  // thay vì hiện nguyên JSON thô ra cho người dùng.
  const translationField = unfenced.match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (translationField) {
    return {
      translation: translationField[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
      script: 'simplified',
      segments: [{ original: originalText, translated: translationField[1] }],
    };
  }

  // Không phục hồi được gì - báo lỗi thay vì hiện rác cho người dùng
  throw new Error('Không đọc được phản hồi dịch từ Gemini, vui lòng thử lại');
}

function normalizeVisualRegions(
  regions: ReturnType<typeof parseTranslationResponse>['visualRegions']
): Array<{
  original: string;
  translated: string;
  orientation: 'horizontal' | 'vertical';
  bbox: { x0: number; y0: number; x1: number; y1: number };
}> | undefined {
  if (!Array.isArray(regions)) return undefined;

  const normalized = regions.flatMap((region) => {
    if (!region || typeof region.original !== 'string' || typeof region.translated !== 'string') {
      return [];
    }
    if (!Array.isArray(region.bbox) || region.bbox.length !== 4) return [];

    // Gemini dùng thứ tự [yMin, xMin, yMax, xMax], thang 0..1000.
    const [rawY0, rawX0, rawY1, rawX1] = region.bbox.map(Number);
    if (![rawY0, rawX0, rawY1, rawX1].every(Number.isFinite)) return [];
    const x0 = Math.max(0, Math.min(1000, rawX0));
    const y0 = Math.max(0, Math.min(1000, rawY0));
    const x1 = Math.max(0, Math.min(1000, rawX1));
    const y1 = Math.max(0, Math.min(1000, rawY1));
    if (x1 <= x0 || y1 <= y0 || !region.translated.trim()) return [];

    const orientation: 'horizontal' | 'vertical' =
      region.orientation === 'vertical' || (y1 - y0) > (x1 - x0) * 1.35
        ? 'vertical'
        : 'horizontal';

    return [{
      original: region.original.trim(),
      translated: region.translated.trim(),
      orientation,
      bbox: { x0, y0, x1, y1 },
    }];
  });

  return normalized.length > 0 ? normalized.slice(0, 8) : undefined;
}

// Build translation prompt
function buildTranslationPrompt(
  text: string,
  target: string,
  lines?: string[],
  hasImage = false
): string {
  const lineInstruction =
    lines && lines.length > 0
      ? `

DỮ LIỆU CÁC VÙNG OCR THAM KHẢO:
Văn bản trên được OCR thành ${lines.length} dòng, đánh số dưới đây theo đúng thứ tự xuất hiện trên ảnh:
${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Chỉ tạo "translatedLines" để tương thích dự phòng: mảng đúng ${lines.length} chuỗi theo thứ tự trên. Bản dịch chính phải dựa trên ngữ nghĩa toàn ảnh, không dịch máy móc từng mẩu OCR.`
      : '';

  const visualInstruction = hasImage
    ? `

ĐỊNH VỊ BẢN DỊCH TRÊN ẢNH:
- Nhìn trực tiếp toàn bộ ảnh để nhận diện cả chữ dọc, chữ cách điệu và phần OCR bỏ sót.
- Gom các dòng/cột liên quan thành tối đa 8 KHỐI NGỮ NGHĨA lớn. Không tạo một khối cho từng chữ hoặc từ rời. Mỗi khối phải là một cụm/câu hoàn chỉnh, dịch theo nghĩa toàn cụm.
- Với văn bản cổ, thơ, thành ngữ hoặc câu đối: xác định đúng thứ tự đọc và dịch trọn ý cả câu/đoạn trước khi chia khối.
- Trả "visualRegions"; mỗi phần tử gồm original, translated đầy đủ, orientation (horizontal|vertical) và bbox=[yMin,xMin,yMax,xMax] theo thang 0..1000 của TOÀN BỘ ảnh.
- Bbox phải ôm SÁT vùng chữ gốc, không nới rộng để chứa bản dịch và không được chồng lấn bbox của khối khác.
- Nếu nhiều cụm chữ nằm sát nhau nhưng khác ý, giữ bbox riêng theo đúng vùng chữ thực tế. "correctedText" là toàn bộ nguyên văn đã sửa theo ảnh, theo đúng thứ tự đọc.`
    : '';

  return `Bạn là chuyên gia dịch Trung - Việt và phân tích nội dung trên hình ảnh thực tế.

Bạn được cung cấp ảnh gốc (nếu có) và văn bản OCR tham khảo. Hãy NHÌN TRỰC TIẾP ảnh để đối chiếu, sửa chữ OCR sai và hiểu bố cục. Không được mặc định OCR là chính xác.

QUY TẮC:
1. Dịch theo NGHĨA TỔNG THỂ của câu/đoạn - đọc hiểu ngữ cảnh trước, sau đó diễn đạt lại tự nhiên bằng tiếng Việt. TUYỆT ĐỐI không dịch máy móc từng chữ/từng từ một.
2. Thành ngữ, tục ngữ: dịch theo nghĩa bóng, ưu tiên thành ngữ tương đương trong tiếng Việt thay vì dịch nghĩa đen.
3. Văn phong: tự nhiên như người bản xứ viết, không lộ dấu vết dịch máy.
4. Chữ viết tay hoặc nghi ngờ OCR nhận sai: dựa vào ngữ cảnh xung quanh để đoán đúng chữ trước khi dịch.
5. Không bịa nội dung bị che, quá mờ hoặc không đọc được. Đánh dấu phần đó là "[không rõ]" và giảm confidence.

NGỮ CẢNH BAO BÌ/SẢN PHẨM:
- Nhận diện riêng tên thương hiệu, tên sản phẩm, chủng loại, công dụng, thành phần, hướng dẫn sử dụng, liều lượng, cảnh báo, hạn dùng, xuất xứ, khối lượng và đơn vị.
- Tên thương hiệu/tên riêng: giữ nguyên hoặc phiên âm khi phù hợp; không dịch thành từ phổ thông làm sai thương hiệu.
- Thuật ngữ thực phẩm, mỹ phẩm, dược phẩm và cảnh báo an toàn phải sát nghĩa; không tự thêm công dụng hay khẳng định y tế không có trên ảnh.
- Giữ nguyên con số, mã sản phẩm, tỷ lệ %, đơn vị đo và cấu trúc danh sách. Dùng cách gọi tự nhiên, quen thuộc trên nhãn hàng tiếng Việt.

XỬ LÝ VĂN BẢN THỰC TẾ TỪ ẢNH CHỤP (thường không sạch như văn bản đánh máy):
- Ảnh có thể chứa NHIỀU đoạn văn bản không liên quan nhau (nhiều biển hiệu, nhiều dòng rời rạc trong cùng 1 khung hình) - hãy dịch riêng từng đoạn theo đúng ý của nó, không cố ghép chúng thành 1 câu duy nhất.
- Ảnh có thể xen lẫn NHIỀU NGÔN NGỮ khác nhau (tiếng Trung lẫn tiếng Anh, số, ký hiệu...) - CHỈ VÌ có ngôn ngữ khác xen vào KHÔNG có nghĩa là từ chối dịch. Vẫn dịch phần tiếng Trung sang tiếng Việt bình thường, phần tiếng Anh/số có thể giữ nguyên hoặc dịch tuỳ ngữ cảnh.
- LOẠI BỎ hoàn toàn các ký tự/chuỗi vô nghĩa do lỗi nhận diện OCR (không tạo thành từ hay cụm từ có nghĩa trong bất kỳ ngôn ngữ nào, ví dụ ký tự lạ, chữ bị vỡ nét, ký hiệu rời rạc) - không đưa chúng vào bản dịch, không cố "đoán nghĩa" cho phần rác nhiễu này.
- Chỉ khi TOÀN BỘ văn bản đều là rác/vô nghĩa (không còn phần nào dịch được) mới trả "translation" rỗng.

ĐẦU RA JSON:
{
  "translation": "Bản dịch hoàn chỉnh sang tiếng Việt",
  "correctedText": "Toàn bộ nguyên văn đã nhận diện và sửa theo ảnh",
  "script": "simplified | traditional | mixed",
  "segments": [
    {"original": "câu gốc", "translated": "câu dịch"}
  ],
  "confidence": 0.95,
  "notes": "Ghi chú thêm (nếu có)"${lines && lines.length > 0 ? ',\n  "translatedLines": ["dòng 1 đã dịch", "dòng 2 đã dịch", "... (đúng ' + lines.length + ' phần tử)"]' : ''}${hasImage ? ',\n  "visualRegions": [{"original":"nguyên văn khối", "translated":"bản dịch đủ ý", "orientation":"horizontal", "bbox":[100,200,400,700]}]' : ''}
}

VĂN BẢN OCR THAM KHẢO (hãy sửa theo ảnh nếu OCR sai):
${text}
${lineInstruction}
${visualInstruction}

NGÔN NGỮ ĐÍCH: ${target === 'vi' ? 'Tiếng Việt' : target === 'en' ? 'Tiếng Anh' : target}`;
}
