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