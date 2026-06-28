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
}

// Translation request type
export interface TranslateRequest {
  text: string;
  target: string;
  source?: string;
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
}

// History store type
export interface HistoryStore {
  history: TranslationResult[];
  addHistory: (item: TranslationResult) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  loadHistory: () => void;
}