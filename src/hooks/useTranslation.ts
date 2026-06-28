import { useState, useCallback } from 'react';
import { TranslationResult } from '@/types';

interface UseTranslationOptions {
  targetLanguage?: 'vi' | 'en' | 'ja' | 'ko';
  sourceLanguage?: string;
  provider?: 'gemini' | 'openai';
}

export function useTranslation(options: UseTranslationOptions = {}) {
  const {
    targetLanguage = 'vi',
    sourceLanguage = 'zh',
    provider = 'gemini',
  } = options;

  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const translate = useCallback(async (
    text: string,
    target: string = targetLanguage,
    source: string = sourceLanguage
  ): Promise<TranslationResult | null> => {
    if (!text || text.trim().length === 0) {
      setError('Không có văn bản để dịch');
      return null;
    }

    setIsTranslating(true);
    setError(null);
    setProgress(20);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          target,
          source,
          provider,
        }),
      });

      setProgress(60);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Dịch thuật thất bại');
      }

      const data = await response.json();
      setProgress(100);

      const translationResult: TranslationResult = {
        id: `trans_${Date.now()}`,
        originalText: text,
        translation: data.translation || text,
        detectedScript: data.detectedScript || 'simplified',
        segments: data.segments || [{ original: text, translated: data.translation || text }],
        confidence: data.confidence || 0.9,
        processingTime: data.processingTime || 0,
        createdAt: new Date(),
      };

      setResult(translationResult);
      return translationResult;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dịch thuật thất bại';
      setError(message);
      setResult(null);
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [targetLanguage, sourceLanguage, provider]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(0);
    setIsTranslating(false);
  }, []);

  return {
    isTranslating,
    progress,
    result,
    error,
    translate,
    reset,
  };
}