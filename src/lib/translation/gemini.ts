import { GoogleGenAI } from '@google/genai';

export interface TranslationResult {
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  segments: Array<{
    original: string;
    translated: string;
  }>;
  confidence: number;
}

export class GeminiTranslator {
  private genAI: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-3.5-flash') {
    this.genAI = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async translate(
    text: string,
    target: string = 'vi',
    source: string = 'zh'
  ): Promise<TranslationResult> {
    const prompt = this.buildPrompt(text, target, source);

    try {
      const response = await this.genAI.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
        temperature: 0.3,
        maxOutputTokens: 6144,
        topP: 0.95,
        topK: 40,
        responseMimeType: 'application/json',
        },
      },
      );
      const content = response.text || '';

      // Parse JSON response
      return this.parseResponse(content, text);
    } catch (error) {
      console.error('Gemini translation error:', error);
      // Giữ nguyên message cụ thể từ parseResponse (vd. lỗi parse JSON) thay
      // vì luôn ghi đè bằng thông báo chung chung, để dễ debug hơn.
      throw error instanceof Error ? error : new Error('Translation failed');
    }
  }

  private buildPrompt(text: string, target: string, source: string): string {
    const targetLang = this.getLanguageName(target);
    const sourceLang = this.getLanguageName(source);

    return `Bạn là một dịch giả chuyên nghiệp với 10 năm kinh nghiệm dịch ${sourceLang} - ${targetLang}.

QUY TẮC DỊCH:
1. Dịch chính xác, giữ nguyên ý nghĩa và ngữ cảnh
2. Thành ngữ: tìm thành ngữ tương đương trong ${targetLang}
3. Văn phong: tự nhiên, không máy móc
4. Phân biệt: biết cách tách các cụm từ khi văn bản lộn xộn
5. Chữ viết tay: đoán chữ nếu OCR sai

XỬ LÝ VĂN BẢN LỘN XỘN:
- Nếu văn bản có nhiều dòng lộn xộn, hãy sắp xếp theo logic
- Phát hiện các cụm từ liên quan và nhóm lại
- Bỏ qua các từ/cụm từ không liên quan

ĐẦU RA JSON:
{
  "translation": "Bản dịch hoàn chỉnh sang ${targetLang}",
  "script": "simplified | traditional | mixed",
  "segments": [
    {"original": "câu gốc", "translated": "câu dịch"}
  ],
  "confidence": 0.95
}

VĂN BẢN CẦN DỊCH (${sourceLang}):
${text}

NGÔN NGỮ ĐÍCH: ${targetLang}`;
  }

  private getLanguageName(code: string): string {
    const map: Record<string, string> = {
      'vi': 'Tiếng Việt',
      'en': 'Tiếng Anh',
      'zh': 'Tiếng Trung',
      // Dùng khi cần chỉ định rõ biến thể chữ Trung (vd. bước back-translation
      // trong accuracy.ts cần dịch ngược ĐÚNG biến thể gốc để so sánh công
      // bằng - xem evaluateTranslationAccuracy).
      'zh-Hant': 'Tiếng Trung Phồn thể (Traditional Chinese)',
      'zh-Hans': 'Tiếng Trung Giản thể (Simplified Chinese)',
      'ja': 'Tiếng Nhật',
      'ko': 'Tiếng Hàn',
    };
    return map[code] || code;
  }

  // Parse phản hồi Gemini thành TranslationResult. Phải chịu được 2 kiểu lỗi
  // thường gặp (giống parseTranslationResponse trong
  // src/app/api/translate/route.ts): (1) model bọc JSON trong khối markdown
  // ```json ... ```, (2) JSON bị cắt cụt giữa chừng do vượt maxOutputTokens.
  // Không bao giờ để lọt JSON thô/cắt cụt ra ngoài làm "translation".
  private parseResponse(content: string, originalText: string): TranslationResult {
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const unfenced = fenceMatch ? fenceMatch[1] : content;

    try {
      const jsonMatch = unfenced.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          translation: parsed.translation || content,
          detectedScript: parsed.script || 'simplified',
          segments: parsed.segments || [{ original: originalText, translated: parsed.translation || content }],
          confidence: parsed.confidence || 0.9,
        };
      }
    } catch {
      console.warn('Failed to parse Gemini response as JSON, trying partial recovery');
    }

    // JSON bị cắt cụt (thiếu dấu đóng) - cố lấy riêng field "translation" bằng
    // regex thay vì trả nguyên JSON thô/cắt cụt làm bản dịch.
    const translationField = unfenced.match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (translationField) {
      const translation = translationField[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      return {
        translation,
        detectedScript: 'simplified',
        segments: [{ original: originalText, translated: translation }],
        confidence: 0.7,
      };
    }

    // Không phục hồi được gì đáng tin - báo lỗi thay vì trả rác cho người
    // dùng (rác ở đây còn làm hỏng luôn bước back-translation ở accuracy.ts).
    throw new Error('Không đọc được phản hồi dịch từ Gemini, vui lòng thử lại');
  }
}
