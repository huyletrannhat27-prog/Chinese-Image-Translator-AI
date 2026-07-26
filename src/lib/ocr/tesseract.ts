import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { OCRRegion, OCRResult } from '@/types';

let workerPromise: Promise<Worker> | null = null;

function getWorker(onProgress?: (progress: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('chi_sim+chi_tra+eng', 1, {
      langPath: '/tessdata',
      gzip: false,
      logger: (message) => {
        if (message.status === 'recognizing text') {
          onProgress?.(Math.round(message.progress * 100));
        }
      },
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
      });
      return worker;
    });
  }
  return workerPromise;
}

function detectScript(text: string): OCRResult['detectedScript'] {
  const traditional = /[臺灣體學國語門車馬東樂書畫]/g;
  const simplified = /[台湾体学国语门车马东乐书画]/g;
  const traditionalCount = (text.match(traditional) || []).length;
  const simplifiedCount = (text.match(simplified) || []).length;
  if (traditionalCount && simplifiedCount) return 'mixed';
  return traditionalCount > simplifiedCount ? 'traditional' : 'simplified';
}

export async function recognizeChinese(
  image: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const worker = await getWorker(onProgress);
  const result = await worker.recognize(
    image,
    {},
    { text: true, blocks: true }
  );
  const page = result.data;
  const regions: OCRRegion[] = [];

  for (const block of page.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const text = line.text.trim();
        if (!text) continue;
        regions.push({
          text,
          confidence: Math.max(0, Math.min(1, line.confidence / 100)),
          bbox: line.bbox,
          lineCount: 1,
          orientation: line.bbox.y1 - line.bbox.y0 > (line.bbox.x1 - line.bbox.x0) * 1.35
            ? 'vertical'
            : 'horizontal',
        });
      }
    }
  }

  return {
    text: page.text.trim(),
    confidence: Math.max(0, Math.min(1, page.confidence / 100)),
    detectedScript: detectScript(page.text),
    language: 'chi_sim+chi_tra+eng',
    regions,
  };
}
