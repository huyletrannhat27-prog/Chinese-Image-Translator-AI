import { GoogleGenerativeAI } from '@google/generative-ai';

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
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async translate(
    text: string,
    target: string = 'vi',
    source: string = 'zh'
  ): Promise<TranslationResult> {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        topP: 0.95,
        topK: 40,
      },
    });

    const prompt = this.buildPrompt(text, target, source);

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      // Parse JSON response
      return this.parseResponse(content, text);
    } catch (error) {
      console.error('Gemini translation error:', error);
      throw new Error('Translation failed');
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
      'ja': 'Tiếng Nhật',
      'ko': 'Tiếng Hàn',
    };
    return map[code] || code;
  }

  private parseResponse(content: string, originalText: string): TranslationResult {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          translation: parsed.translation || content,
          detectedScript: parsed.script || 'simplified',
          segments: parsed.segments || [{ original: originalText, translated: parsed.translation || content }],
          confidence: parsed.confidence || 0.9,
        };
      }
    } catch (e) {
      console.warn('Failed to parse Gemini response, using raw text');
    }

    // Fallback: return raw response
    return {
      translation: content,
      detectedScript: 'simplified',
      segments: [{ original: originalText, translated: content }],
      confidence: 0.8,
    };
  }
}