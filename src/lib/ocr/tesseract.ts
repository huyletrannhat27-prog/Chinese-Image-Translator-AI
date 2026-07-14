import { createWorker, PSM } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  wordBoxes: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  // Toạ độ theo từng ĐOẠN VĂN (paragraph, gộp các dòng liền kề của cùng 1 ý),
  // không phải từng dòng lẻ - dùng để overlay bản dịch đè lên đúng vùng chữ
  // gốc trên ảnh. Gộp theo đoạn thay vì dòng vì bản dịch tiếng Việt thường dài
  // hơn nhiều so với tiếng Trung gốc; nếu bám sát bbox từng dòng lẻ (vốn rất
  // mảnh) thì các ô dịch chồng lấn lên nhau. Gộp theo đoạn cũng giúp dịch trọn
  // nghĩa câu thay vì cắt vụn theo từng dòng OCR.
  regions: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    // Số dòng OCR gốc đã gộp vào đoạn này - dùng để nhận biết việc gộp đoạn
    // có thất bại hay không (vd toàn 1) và để ước lượng cỡ chữ overlay.
    lineCount: number;
  }>;
}

export async function performOCR(
  imageData: string | Buffer,
  options?: {
    // Cho phép ghép thêm ngôn ngữ khác (vd 'chi_sim+chi_tra+eng') để đọc được
    // ảnh có xen lẫn tiếng Anh/số thay vì ép tất cả về chữ Hán và ra rác.
    language?: string;
    psm?: PSM;
    // Từ có độ tin cậy dưới ngưỡng này bị coi là nhiễu OCR (vết bẩn, hạt ảnh...)
    // và bị loại khỏi văn bản trước khi đưa qua dịch.
    minWordConfidence?: number;
  }
): Promise<OCRResult> {
  const language = options?.language || 'chi_sim+chi_tra+eng';
  const psm = options?.psm || PSM.AUTO;
  const minWordConfidence = options?.minWordConfidence ?? 35;

  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: psm,
  });

  // tesseract.js mặc định KHÔNG trả về `blocks` (toạ độ + độ tin cậy từng từ)
  // trừ khi yêu cầu rõ ở tham số output thứ 3 - thiếu nó thì không lọc nhiễu được.
  const result = await worker.recognize(imageData, {}, { blocks: true });
  await worker.terminate();

  // Duyệt cấu trúc lồng nhau blocks -> paragraphs -> lines -> words, đồng thời
  // dựng lại văn bản "sạch" bằng cách bỏ các từ có độ tin cậy quá thấp (nhiễu).
  const wordBoxes: OCRResult['wordBoxes'] = [];
  const regions: OCRResult['regions'] = [];
  const cleanLines: string[] = [];

  for (const block of result.data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      // Từ giữ lại (đủ tin cậy) của CẢ đoạn văn, gộp từ mọi dòng bên trong -
      // dùng để tính bbox bao trọn đoạn thay vì bbox mảnh của từng dòng lẻ.
      const paragraphKeptWords: Array<{
        text: string;
        confidence: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }> = [];
      const paragraphLineTexts: string[] = [];

      for (const line of paragraph.lines || []) {
        const lineWords = (line.words || []).filter((w) => (w.text || '').trim().length > 0);

        for (const word of lineWords) {
          wordBoxes.push({
            text: word.text || '',
            confidence: word.confidence || 0,
            bbox: {
              x0: word.bbox?.x0 || 0,
              y0: word.bbox?.y0 || 0,
              x1: word.bbox?.x1 || 0,
              y1: word.bbox?.y1 || 0,
            },
          });
        }

        const keptWords = lineWords.filter((w) => (w.confidence || 0) >= minWordConfidence && w.bbox);
        if (keptWords.length > 0) {
          cleanLines.push(joinWords(keptWords));
          paragraphLineTexts.push(joinWords(keptWords));
          for (const w of keptWords) {
            paragraphKeptWords.push({ text: w.text || '', confidence: w.confidence || 0, bbox: w.bbox! });
          }
        }
      }

      if (paragraphKeptWords.length > 0) {
        regions.push({
          text: paragraphLineTexts.join(' '),
          confidence:
            paragraphKeptWords.reduce((sum, w) => sum + w.confidence, 0) / paragraphKeptWords.length,
          lineCount: paragraphLineTexts.length,
          bbox: {
            x0: Math.min(...paragraphKeptWords.map((w) => w.bbox.x0)),
            y0: Math.min(...paragraphKeptWords.map((w) => w.bbox.y0)),
            x1: Math.max(...paragraphKeptWords.map((w) => w.bbox.x1)),
            y1: Math.max(...paragraphKeptWords.map((w) => w.bbox.y1)),
          },
        });
      }
    }
  }

  // Nếu lọc quá tay khiến mất hết chữ, dùng lại text gốc của Tesseract để tránh
  // báo nhầm "không tìm thấy văn bản" cho ảnh chỉ đơn giản là chất lượng thấp.
  const cleanedText = cleanLines.length > 0 ? cleanLines.join('\n') : (result.data.text || '').trim();

  // Detect script
  const detectedScript = detectChineseScript(cleanedText);

  return {
    text: cleanedText,
    confidence: result.data.confidence || 0,
    detectedScript,
    wordBoxes,
    regions,
  };
}

// Ghép các từ trong 1 dòng lại: thêm khoảng trắng quanh từ có chữ La-tinh/số
// (tiếng Anh cần dấu cách), còn chữ Hán thì ghép liền như quy ước gốc.
function joinWords(words: Array<{ text: string }>): string {
  let out = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i].text;
    if (i > 0 && (/[A-Za-z0-9]/.test(words[i - 1].text) || /[A-Za-z0-9]/.test(w))) {
      out += ' ';
    }
    out += w;
  }
  return out;
}

// Detect Chinese script
function detectChineseScript(text: string): 'simplified' | 'traditional' | 'mixed' {
  if (!text || text.trim().length === 0) return 'simplified';

  // Common simplified vs traditional characters
  const simplifiedSet = new Set([
    '学', '国', '开', '关', '门', '问', '对', '说', '话', '书', '写', '爱', '亲', '边', '这', 
    '还', '过', '来', '时', '间', '长', '马', '鸟', '鱼', '龙', '风', '电', '东', '南', '西',
    '北', '上', '下', '左', '右', '前', '后', '内', '外', '大', '小', '多', '少', '高', '低'
  ]);
  
  const traditionalSet = new Set([
    '學', '國', '開', '關', '門', '問', '對', '說', '話', '書', '寫', '愛', '親', '邊', '這',
    '還', '過', '來', '時', '間', '長', '馬', '鳥', '魚', '龍', '風', '電', '東', '南', '西',
    '北', '上', '下', '左', '右', '前', '後', '內', '外', '大', '小', '多', '少', '高', '低'
  ]);

  let simplifiedCount = 0;
  let traditionalCount = 0;

  for (const char of text) {
    if (simplifiedSet.has(char)) simplifiedCount++;
    if (traditionalSet.has(char)) traditionalCount++;
  }

  const total = simplifiedCount + traditionalCount;
  if (total === 0) return 'simplified';

  const ratio = simplifiedCount / total;
  if (ratio > 0.7) return 'simplified';
  if (ratio < 0.3) return 'traditional';
  return 'mixed';
}