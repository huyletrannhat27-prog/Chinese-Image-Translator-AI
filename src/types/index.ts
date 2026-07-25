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
  imageWidth?: number;
  imageHeight?: number;
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

// Translation request type
export interface TranslateRequest {
  text: string;
  target: string;
  source?: string;
  provider?: 'gemini' | 'openai' | 'claude';
}

// Translation response type
export interface TranslateResponse {
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  segments: Array<{
    original: string;
    translated: string;
  }>;
  confidence: number;
  provider: string;
  processingTime: number;
  // true nếu kết quả được trả từ cache Phase 4 (không gọi lại AI provider).
  cached?: boolean;
}

// History store type
export interface HistoryStore {
  history: TranslationResult[];
  addHistory: (item: TranslationResult) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  loadHistory: () => void;
}

// User settings type
export interface UserSettings {
  targetLanguage: 'vi' | 'en' | 'ja' | 'ko' | 'zh';
  sourceLanguage: 'zh' | 'ja' | 'ko' | 'en';
  ocrLanguage: 'chi_sim' | 'chi_tra' | 'chi_sim+chi_tra';
  provider: 'gemini' | 'openai' | 'claude';
  autoProcess: boolean;
  saveHistory: boolean;
  compressionQuality: number; // 0-100
}

// Image processing options
export interface ImageProcessOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  grayscale?: boolean;
  sharpen?: boolean;
  denoise?: boolean;
}
