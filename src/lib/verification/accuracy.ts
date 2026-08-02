import type { OCRResult } from '@/types';
import { GeminiTranslator } from '@/lib/translation/gemini';
import { bigramDiceSimilarity, extractHanCharacters } from './textSimilarity';

// Vùng OCR có confidence thấp hơn ngưỡng này bị gắn cờ để người dùng xem lại.
export const OCR_LOW_CONFIDENCE_THRESHOLD = 0.7;
// Similarity back-translation thấp hơn ngưỡng này -> nghi ngờ bản dịch lệch nghĩa.
export const TRANSLATION_LOW_SIMILARITY_THRESHOLD = 0.55;

export interface OcrAccuracyReport {
  averageConfidence: number;
  totalBoxes: number;
  lowConfidenceBoxes: Array<{ text: string; confidence: number }>;
  reliable: boolean;
}

export interface TranslationAccuracyReport {
  method: 'back-translation';
  backTranslatedText: string;
  similarityScore: number;
  reliable: boolean;
}

export interface AccuracyReport {
  ocr: OcrAccuracyReport;
  translation: TranslationAccuracyReport;
}

/**
 * Đánh giá độ chính xác OCR dựa trên confidence mà PaddleOCR tự tính cho
 * từng vùng chữ khi nhận dạng (xem _docs/04_ocr_tools.md, mục PaddleOCR).
 * Không cần gọi thêm công cụ ngoài cho bước này - ta chỉ tổng hợp lại và
 * gắn cờ (flag) các vùng dưới ngưỡng, để người dùng biết chỗ nào nên đối
 * chiếu lại ảnh gốc thay vì tin tuyệt đối vào text nhận dạng được.
 */
export function evaluateOcrAccuracy(
  ocr: Pick<OCRResult, 'confidence' | 'wordBoxes'>,
  threshold: number = OCR_LOW_CONFIDENCE_THRESHOLD
): OcrAccuracyReport {
  const boxes = ocr.wordBoxes || [];
  const lowConfidenceBoxes = boxes
    .filter((box) => box.confidence < threshold)
    .map((box) => ({ text: box.text, confidence: box.confidence }));

  return {
    averageConfidence: Number((ocr.confidence || 0).toFixed(4)),
    totalBoxes: boxes.length,
    lowConfidenceBoxes,
    reliable: ocr.confidence >= threshold && lowConfidenceBoxes.length === 0,
  };
}

/**
 * Đánh giá độ chính xác bản dịch bằng kỹ thuật "back-translation" (dịch
 * vòng): dịch ngược translatedText về lại tiếng Trung bằng Gemini, rồi so
 * sánh với text OCR gốc bằng độ tương đồng bigram (textSimilarity.ts).
 *
 * QUAN TRỌNG: dịch ngược phải chỉ định ĐÚNG biến thể chữ Trung (giản thể
 * hay phồn thể) khớp với văn bản OCR gốc (`originalScript`). Nếu không,
 * một bản dịch hoàn toàn đúng vẫn có thể bị tính similarity thấp một cách
 * bất công chỉ vì Gemini trả về giản thể trong khi ảnh gốc là phồn thể (hay
 * ngược lại) - 2 biến thể viết khác ký tự dù cùng nghĩa/cách đọc, nên so
 * bigram ký tự trực tiếp sẽ lệch nếu không cùng biến thể.
 *
 * Đây là cách ước lượng chất lượng dịch phổ biến khi KHÔNG có bản dịch mẫu
 * (reference) để so trực tiếp - similarity càng cao, bản dịch càng có khả
 * năng giữ đúng nghĩa gốc. Đây KHÔNG phải thước đo tuyệt đối: một bản dịch
 * tốt vẫn có thể diễn đạt lại (paraphrase) nên similarity thấp không chắc
 * chắn là dịch sai - chỉ nên dùng làm tín hiệu để con người xem lại, không
 * dùng để tự động từ chối kết quả.
 */
export async function evaluateTranslationAccuracy(
  originalOcrText: string,
  translatedText: string,
  translator: GeminiTranslator,
  originalScript: 'simplified' | 'traditional' | 'mixed' = 'simplified',
  threshold: number = TRANSLATION_LOW_SIMILARITY_THRESHOLD
): Promise<TranslationAccuracyReport> {
  // 'mixed' không có 1 biến thể rõ ràng để nhắm tới - dùng 'zh' chung chung,
  // để Gemini tự quyết (giữ hành vi cũ cho trường hợp này).
  const backTranslationTarget =
    originalScript === 'traditional' ? 'zh-Hant' : originalScript === 'simplified' ? 'zh-Hans' : 'zh';

  const backTranslation = await translator.translate(translatedText, backTranslationTarget, 'vi');

  // Chỉ so sánh phần chữ Hán - xem ghi chú trong extractHanCharacters():
  // ảnh gốc thường trộn chữ Trung + chữ Latin (tên tác giả, watermark...),
  // và phần Latin đó tự nhiên bị diễn đạt lại khác đi khi dịch ngược, làm
  // giảm similarity một cách bất công dù phần chữ Trung dịch rất chính xác.
  const similarityScore = bigramDiceSimilarity(
    extractHanCharacters(originalOcrText),
    extractHanCharacters(backTranslation.translation)
  );

  return {
    method: 'back-translation',
    backTranslatedText: backTranslation.translation,
    similarityScore: Number(similarityScore.toFixed(4)),
    reliable: similarityScore >= threshold,
  };
}
