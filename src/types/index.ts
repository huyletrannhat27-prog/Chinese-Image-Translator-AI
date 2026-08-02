// Toạ độ 1 đoạn văn (paragraph, gộp nhiều dòng liền kề) trên ảnh, theo pixel
// của ảnh đã tiền xử lý ở OCR - dùng để overlay bản dịch.
export interface OCRRegion {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  lineCount: number;
  orientation?: 'horizontal' | 'vertical';
}

// Translation result type
export interface TranslationResult {
  id: string;
  originalText: string;
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  confidence: number;
  segments: Array<{
    original: string;
    translated: string;
  }>;
  processingTime: number;
  createdAt: Date;
  // Dữ liệu overlay: bản dịch từng đoạn khớp vị trí (bbox) chữ gốc trên ảnh.
  // Optional vì item cũ trong history hoặc bản dịch mock có thể không có.
  regions?: OCRRegion[];
  translatedRegions?: string[];
  translatedLines?: string[];
  imageWidth?: number;
  imageHeight?: number;
  accuracy?: AccuracyReport;
  verificationWarning?: string;
}

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

interface AccuracyReport {
  ocr: OcrAccuracyReport;
  translation: TranslationAccuracyReport;
}

// OCR result type
export interface OCRResult {
  text: string;
  confidence: number;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  language: string;
  wordBoxes?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  regions?: OCRRegion[];
  imageWidth?: number;
  imageHeight?: number;
}
