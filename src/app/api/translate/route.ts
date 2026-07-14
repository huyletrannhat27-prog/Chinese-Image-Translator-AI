import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Tăng timeout cho API route
export const maxDuration = 60;

// Khởi tạo Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, target = 'vi', source = 'zh', lines } = body as {
      text: string;
      target?: string;
      source?: string;
      lines?: string[];
    };

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Không có văn bản để dịch' },
        { status: 400 }
      );
    }

    // Nếu không có Gemini API key, dùng mock
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured, using mock translation');
      return NextResponse.json({
        translation: `[Mock] ${text}`,
        detectedScript: 'simplified',
        segments: [{ original: text, translated: `[Mock] ${text}` }],
        translatedLines: lines && lines.length > 0 ? lines.map((l) => `[Mock] ${l}`) : undefined,
      });
    }

    // Prompt engineering
    const prompt = buildTranslationPrompt(text, target, lines);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        // 1024 quá thấp cho gemini-2.5-flash: model "thinking" tiêu tốn một phần
        // token trước khi trả JSON, dễ bị cắt cụt giữa chừng khi văn bản dài/lộn
        // xộn (nhiều segments) - tăng lên để tránh JSON bị hỏng do cắt cụt.
        maxOutputTokens: 6144,
        topP: 0.95,
        topK: 40,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    const parsed = parseTranslationResponse(content, text);

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
    });

  } catch (error) {
    console.error('Translation Error:', error);
    return NextResponse.json(
      { error: 'Lỗi dịch thuật: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
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

// Build translation prompt
function buildTranslationPrompt(text: string, target: string, lines?: string[]): string {
  const lineInstruction =
    lines && lines.length > 0
      ? `

DỊCH THEO TỪNG DÒNG (để hiển thị đè lên đúng vị trí trên ảnh):
Văn bản trên được OCR thành ${lines.length} dòng, đánh số dưới đây theo đúng thứ tự xuất hiện trên ảnh:
${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Dịch TỪNG DÒNG một sang tiếng Việt, giữ NGUYÊN số lượng và thứ tự dòng - TUYỆT ĐỐI không gộp nhiều dòng thành 1, không tách 1 dòng thành nhiều dòng. Nếu 1 dòng chỉ toàn rác/vô nghĩa do lỗi OCR thì dịch dòng đó thành chuỗi rỗng "". Thêm field "translatedLines" vào JSON đầu ra: mảng đúng ${lines.length} chuỗi theo thứ tự trên.`
      : '';

  return `Bạn là một dịch giả chuyên nghiệp với 10 năm kinh nghiệm dịch tiếng Trung - Việt.

QUY TẮC:
1. Dịch theo NGHĨA TỔNG THỂ của câu/đoạn - đọc hiểu ngữ cảnh trước, sau đó diễn đạt lại tự nhiên bằng tiếng Việt. TUYỆT ĐỐI không dịch máy móc từng chữ/từng từ một.
2. Thành ngữ, tục ngữ: dịch theo nghĩa bóng, ưu tiên thành ngữ tương đương trong tiếng Việt thay vì dịch nghĩa đen.
3. Văn phong: tự nhiên như người bản xứ viết, không lộ dấu vết dịch máy.
4. Chữ viết tay hoặc nghi ngờ OCR nhận sai: dựa vào ngữ cảnh xung quanh để đoán đúng chữ trước khi dịch.

XỬ LÝ VĂN BẢN THỰC TẾ TỪ ẢNH CHỤP (thường không sạch như văn bản đánh máy):
- Ảnh có thể chứa NHIỀU đoạn văn bản không liên quan nhau (nhiều biển hiệu, nhiều dòng rời rạc trong cùng 1 khung hình) - hãy dịch riêng từng đoạn theo đúng ý của nó, không cố ghép chúng thành 1 câu duy nhất.
- Ảnh có thể xen lẫn NHIỀU NGÔN NGỮ khác nhau (tiếng Trung lẫn tiếng Anh, số, ký hiệu...) - CHỈ VÌ có ngôn ngữ khác xen vào KHÔNG có nghĩa là từ chối dịch. Vẫn dịch phần tiếng Trung sang tiếng Việt bình thường, phần tiếng Anh/số có thể giữ nguyên hoặc dịch tuỳ ngữ cảnh.
- LOẠI BỎ hoàn toàn các ký tự/chuỗi vô nghĩa do lỗi nhận diện OCR (không tạo thành từ hay cụm từ có nghĩa trong bất kỳ ngôn ngữ nào, ví dụ ký tự lạ, chữ bị vỡ nét, ký hiệu rời rạc) - không đưa chúng vào bản dịch, không cố "đoán nghĩa" cho phần rác nhiễu này.
- Chỉ khi TOÀN BỘ văn bản đều là rác/vô nghĩa (không còn phần nào dịch được) mới trả "translation" rỗng.

ĐẦU RA JSON:
{
  "translation": "Bản dịch hoàn chỉnh sang tiếng Việt",
  "script": "simplified | traditional | mixed",
  "segments": [
    {"original": "câu gốc", "translated": "câu dịch"}
  ],
  "confidence": 0.95,
  "notes": "Ghi chú thêm (nếu có)"${lines && lines.length > 0 ? ',\n  "translatedLines": ["dòng 1 đã dịch", "dòng 2 đã dịch", "... (đúng ' + lines.length + ' phần tử)"]' : ''}
}

VĂN BẢN CẦN DỊCH:
${text}
${lineInstruction}

NGÔN NGỮ ĐÍCH: ${target === 'vi' ? 'Tiếng Việt' : target === 'en' ? 'Tiếng Anh' : target}`;
}