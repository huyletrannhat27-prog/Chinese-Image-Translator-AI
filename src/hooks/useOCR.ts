import { useState, useCallback } from 'react';
import { performOCR, OCRResult } from '@/lib/ocr/tesseract';
import { preprocessImage } from '@/lib/ocr/preprocessor';
import { LayoutAnalyzer } from '@/lib/ocr/layoutAnalyzer';

interface UseOCROptions {
  language?: 'chi_sim' | 'chi_tra' | 'chi_sim+chi_tra';
  autoPreprocess?: boolean;
  analyzeLayout?: boolean;
}

export function useOCR(options: UseOCROptions = {}) {
  const {
    language = 'chi_sim+chi_tra',
    autoPreprocess = true,
    analyzeLayout = true,
  } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (
    imageData: string | File | Buffer
  ): Promise<OCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(10);

    try {
      let buffer: Buffer;

      // Convert input to Buffer
      if (imageData instanceof File) {
        const bytes = await imageData.arrayBuffer();
        buffer = Buffer.from(bytes);
      } else if (typeof imageData === 'string') {
        // Base64 string
        const base64 = imageData.split(',')[1] || imageData;
        buffer = Buffer.from(base64, 'base64');
      } else {
        buffer = imageData;
      }

      setProgress(30);

      // Preprocess image
      let processedBuffer = buffer;
      if (autoPreprocess) {
        processedBuffer = await preprocessImage(buffer, {
          maxWidth: 2000,
          maxHeight: 2000,
          grayscale: true,
          normalize: true,
          sharpen: true,
        });
      }

      setProgress(50);

      // Perform OCR
      const ocrResult = await performOCR(processedBuffer, { language });

      setProgress(80);

      // Analyze layout
      if (analyzeLayout && ocrResult.wordBoxes.length > 0) {
        const analyzer = new LayoutAnalyzer();
        const segments = ocrResult.wordBoxes.map(word => ({
          text: word.text,
          bbox: {
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
          },
          confidence: word.confidence,
        }));

        const layout = analyzer.analyzeLayout(segments);
        ocrResult.text = layout.text;
      }

      setResult(ocrResult);
      setProgress(100);
      return ocrResult;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR thất bại';
      setError(message);
      setResult(null);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [language, autoPreprocess, analyzeLayout]);

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