'use client';

import { useState, useCallback } from 'react';
import { performOCR, OCRResult } from '@/lib/ocr/tesseract';

interface UseOCROptions {
  language?: 'chi_sim' | 'chi_tra' | 'chi_sim+chi_tra';
}

export function useOCR(options: UseOCROptions = {}) {
  const { language = 'chi_sim+chi_tra' } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (
    base64Image: string
  ): Promise<OCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(10);

    try {
      setProgress(40);
      
      // Gọi trực tiếp lõi Tesseract chạy trên trình duyệt (Client-side)
      const ocrResult = await performOCR(base64Image, { language });

      setProgress(80);

      setResult(ocrResult);
      setProgress(100);
      return ocrResult;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi trong quá trình phân tích ảnh (OCR)';
      setError(message);
      setResult(null);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [language]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(0);
    setIsProcessing(false);
  }, []);

  return {
    isProcessing,
    progress,
    result,
    error,
    processImage,
    reset,
  };
}