import { GoogleGenAI } from '@google/genai';

export interface TranslationResult {
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  segments: Array<{
    original: string;
    translated: string;
  }>;
  translatedLines?: string[];
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
    source: string = 'zh',
    lines?: string[]
  ): Promise<TranslationResult> {
    const prompt = this.buildPrompt(text, target, source, lines);

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
    } catch (error: any) {
      console.error('Gemini translation error:', error);

      const message = (error && (error.message || String(error))) || '';
      const isAuthError = /401|403|unauthorized|invalid authentication|api key/i.test(message);

      if (isAuthError) {
        // Nếu lỗi xác thực, không dùng fallback — cần user sửa API key
        throw error instanceof Error ? error : new Error('Invalid Gemini API key');
      }

      // Với mọi lỗi khác (bao gồm parse lỗi), thử fallback sang LibreTranslate
      console.warn('Gemini failed (not auth). Attempting LibreTranslate fallback.');
      try {
        return await this.libreTranslate(text, target, source, lines);
      } catch (ltErr) {
        console.error('LibreTranslate fallback also failed:', ltErr);
        // Nếu fallback cũng fail thì trả lại lỗi ban đầu để dễ debug
        throw error instanceof Error ? error : new Error('Translation failed');
      }
    }
  }

  private buildPrompt(text: string, target: string, source: string, lines?: string[]): string {
    const targetLang = this.getLanguageName(target);
    const sourceLang = this.getLanguageName(source);
    const lineInstruction = lines?.length
      ? `\nDanh sách dòng OCR theo đúng thứ tự (bắt buộc trả translatedLines cùng ${lines.length} phần tử):\n${lines
          .map((line, index) => `${index + 1}. ${line}`)
          .join('\n')}`
      : '';

    return `Bạn là một dịch giả chuyên nghiệp với 10 năm kinh nghiệm dịch ${sourceLang} sang ${targetLang}.

QUY TẮC DỊCH:
1. Dịch đúng và đầy đủ, không tóm tắt.
2. Giữ nguyên ý nghĩa, danh từ riêng, số, đơn vị và ngữ cảnh.
3. Văn phong tự nhiên, tránh dịch máy móc.
4. Nếu văn bản lộn xộn, hãy nhóm các cụm liên quan và dịch theo logic.
5. KHÔNG cung cấp lời giải thích, chỉ trả kết quả dịch.

CHỈ TRẢ JSON HỢP LỆ VỚI CẤU TRÚC:
{
  "translation": "bản dịch hoàn chỉnh",
  "script": "simplified | traditional | mixed",
  "segments": [{"original": "câu gốc", "translated": "câu dịch"}],
  "translatedLines": ["bản dịch dòng 1", "bản dịch dòng 2"],
  "confidence": 0.95
}

VĂN BẢN CẦN DỊCH (${sourceLang}):
${text}${lineInstruction}

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
          translatedLines: Array.isArray(parsed.translatedLines)
            ? parsed.translatedLines.filter((line: unknown): line is string => typeof line === 'string')
            : undefined,
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

  // Fallback: sử dụng LibreTranslate (public instance) nếu Gemini lỗi quota.
  private async libreTranslate(
    text: string,
    target: string,
    source: string,
    lines?: string[]
  ): Promise<TranslationResult> {
    const endpoint = process.env.LIBRETRANSLATE_ENDPOINT || 'https://libretranslate.com/translate';

    // Nếu caller yêu cầu translatedLines, dịch từng dòng để trả mảng tương ứng.
    let translatedLines: string[] | undefined;
    if (lines && lines.length) {
      const promises = lines.map(async (ln) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: ln, source, target, format: 'text' }),
        });
        if (!res.ok) {
          throw new Error(`LibreTranslate failed: ${res.status} ${res.statusText}`);
        }
        const j = await res.json();
        return typeof j.translatedText === 'string' ? j.translatedText : String(j);
      });
      translatedLines = await Promise.all(promises);
    }

    // Dịch toàn văn (fallback translation) để trả field `translation` và `segments`.
    const resAll = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text' }),
    });
    if (!resAll.ok) {
      throw new Error(`LibreTranslate failed: ${resAll.status} ${resAll.statusText}`);
    }
    const jAll = await resAll.json();
    const translated = typeof jAll.translatedText === 'string' ? jAll.translatedText : String(jAll);

    return {
      translation: translated,
      detectedScript: 'mixed',
      segments: [{ original: text, translated }],
      translatedLines,
      confidence: 0.6, // lower than Gemini but usable
    };
  }
}
