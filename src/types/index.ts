// Toạ độ một vùng chữ do PaddleOCR phát hiện, quy đổi sang pixel ảnh gốc
// để overlay bản dịch.
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
  provider: 'gemini';
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
