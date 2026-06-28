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
}

export async function performOCR(
  imageData: string | Buffer,
  options?: {
    language?: 'chi_sim' | 'chi_tra' | 'chi_sim+chi_tra';
    psm?: PSM;
  }
): Promise<OCRResult> {
  const language = options?.language || 'chi_sim+chi_tra';
  const psm = options?.psm || PSM.AUTO;

  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: '中文字符abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.!?;:()[]{}',
  });

  const result = await worker.recognize(imageData);
  await worker.terminate();

  // Parse word boxes
  const wordBoxes = result.data.words?.map((word) => ({
    text: word.text || '',
    confidence: word.confidence || 0,
    bbox: {
      x0: word.bbox?.x0 || 0,
      y0: word.bbox?.y0 || 0,
      x1: word.bbox?.x1 || 0,
      y1: word.bbox?.y1 || 0,
    },
  })) || [];

  // Detect script
  const detectedScript = detectChineseScript(result.data.text || '');

  return {
    text: result.data.text || '',
    confidence: result.data.confidence || 0,
    detectedScript,
    wordBoxes,
  };
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