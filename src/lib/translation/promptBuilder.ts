export interface PromptContext {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  isHandwritten?: boolean;
  hasComplexLayout?: boolean;
}

export class PromptBuilder {
  private static readonly SYSTEM_PROMPT = `Bạn là một dịch giả chuyên nghiệp với 10 năm kinh nghiệm.

QUY TẮC DỊCH:
1. Dịch chính xác, giữ nguyên ý nghĩa và ngữ cảnh
2. Thành ngữ: tìm thành ngữ tương đương trong ngôn ngữ đích
3. Văn phong: tự nhiên, không máy móc
4. Phân biệt: biết cách tách các cụm từ khi văn bản lộn xộn
5. Chữ viết tay: đoán chữ nếu OCR sai

XỬ LÝ VĂN BẢN LỘN XỘN:
- Nếu văn bản có nhiều dòng lộn xộn, hãy sắp xếp theo logic
- Phát hiện các cụm từ liên quan và nhóm lại
- Bỏ qua các từ/cụm từ không liên quan`;

  private static readonly OUTPUT_FORMAT = `
ĐẦU RA JSON:
{
  "translation": "Bản dịch hoàn chỉnh",
  "script": "simplified | traditional | mixed",
  "segments": [
    {"original": "câu gốc", "translated": "câu dịch"}
  ],
  "confidence": 0.95,
  "notes": "Ghi chú thêm (nếu có)"
}`;

  static build(context: PromptContext): string {
    const { text, sourceLanguage, targetLanguage, isHandwritten, hasComplexLayout } = context;

    let prompt = this.SYSTEM_PROMPT;

    // Add context-specific instructions
    if (isHandwritten) {
      prompt += '\n\nLƯU Ý: Văn bản được viết tay. Hãy đoán chữ nếu OCR không chính xác.';
    }

    if (hasComplexLayout) {
      prompt += '\n\nLƯU Ý: Văn bản có layout phức tạp. Hãy phân tích và sắp xếp lại theo logic.';
    }

    prompt += '\n\n' + this.OUTPUT_FORMAT;
    prompt += `\n\nVĂN BẢN CẦN DỊCH (${sourceLanguage}):\n${text}`;
    prompt += `\n\nNGÔN NGỮ ĐÍCH: ${targetLanguage}`;

    return prompt;
  }

  static buildBatch(texts: string[], targetLanguage: string): string {
    let prompt = this.SYSTEM_PROMPT;
    prompt += '\n\nBạn sẽ dịch nhiều đoạn văn bản cùng lúc.';
    prompt += '\n\n' + this.OUTPUT_FORMAT;

    prompt += '\n\nVĂN BẢN CẦN DỊCH:';
    texts.forEach((text, index) => {
      prompt += `\n\n[${index + 1}]:\n${text}`;
    });

    prompt += `\n\nNGÔN NGỮ ĐÍCH: ${targetLanguage}`;
    return prompt;
  }

  static buildWithContext(text: string, context: string, targetLanguage: string): string {
    let prompt = this.SYSTEM_PROMPT;
    prompt += `\n\nNGỮ CẢNH: ${context}`;
    prompt += '\n\nDịch văn bản sau với ngữ cảnh trên.';
    prompt += '\n\n' + this.OUTPUT_FORMAT;
    prompt += `\n\nVĂN BẢN CẦN DỊCH:\n${text}`;
    prompt += `\n\nNGÔN NGỮ ĐÍCH: ${targetLanguage}`;
    return prompt;
  }
}