import type { TranslationResult } from '@/types';

const STORAGE_KEY = 'translation_history';
const MAX_HISTORY = 1000;

type StoredHistoryItem = Omit<
  TranslationResult,
  'createdAt' | 'regions' | 'translatedRegions' | 'imageWidth' | 'imageHeight'
> & {
  createdAt: string;
};

export class HistoryStorage {
  static save(history: TranslationResult[]): void {
    if (typeof window === 'undefined') return;
    const limited = history.slice(0, MAX_HISTORY);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.compressHistory(limited)));
    } catch (error) {
      console.error('Failed to save history:', error);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(this.compressHistory(limited.slice(0, 500)))
        );
      } catch (reducedError) {
        console.error('Failed to save reduced history:', reducedError);
      }
    }
  }

  private static compressHistory(history: TranslationResult[]): StoredHistoryItem[] {
    return history.map((item) => ({
      id: item.id,
      originalText: this.truncateText(item.originalText, 500),
      translation: this.truncateText(item.translation, 500),
      detectedScript: item.detectedScript,
      confidence: item.confidence,
      segments: item.segments.slice(0, 20),
      processingTime: item.processingTime,
      createdAt: item.createdAt.toISOString(),
      accuracy: item.accuracy,
      verificationWarning: item.verificationWarning,
    }));
  }

  private static truncateText(text: string, maxLength: number): string {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
  }

  static load(): TranslationResult[] {
    if (typeof window === 'undefined') return [];

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      return parsed.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const item = value as Partial<StoredHistoryItem>;
        if (
          typeof item.id !== 'string'
          || typeof item.originalText !== 'string'
          || typeof item.translation !== 'string'
          || typeof item.createdAt !== 'string'
        ) {
          return [];
        }

        const detectedScript =
          item.detectedScript === 'traditional' || item.detectedScript === 'mixed'
            ? item.detectedScript
            : 'simplified';
        const segments = Array.isArray(item.segments)
          ? item.segments.filter(
              (segment) =>
                segment
                && typeof segment.original === 'string'
                && typeof segment.translated === 'string'
            )
          : [];

        return [{
          id: item.id,
          originalText: item.originalText,
          translation: item.translation,
          detectedScript,
          confidence: Number.isFinite(item.confidence) ? Number(item.confidence) : 0,
          segments,
          processingTime: Number.isFinite(item.processingTime) ? Number(item.processingTime) : 0,
          createdAt: new Date(item.createdAt),
          accuracy: item.accuracy,
          verificationWarning: item.verificationWarning,
        } satisfies TranslationResult];
      });
    } catch (error) {
      console.error('Failed to load history:', error);
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  static addItem(item: TranslationResult): TranslationResult[] {
    const history = this.load();
    if (!history.some((entry) => entry.id === item.id)) history.unshift(item);
    this.save(history);
    return history;
  }

  static removeItem(id: string): TranslationResult[] {
    const filtered = this.load().filter((item) => item.id !== id);
    this.save(filtered);
    return filtered;
  }

  static clear(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }

  static exportJSON(): string {
    return JSON.stringify(this.load(), null, 2);
  }

  static exportCSV(): string {
    const history = this.load();
    if (history.length === 0) return '';
    const headers = ['ID', 'Original', 'Translation', 'Script', 'Confidence', 'Created At'];
    const rows = history.map((item) => [
      item.id,
      `"${item.originalText.replace(/"/g, '""')}"`,
      `"${item.translation.replace(/"/g, '""')}"`,
      item.detectedScript,
      item.confidence,
      item.createdAt.toISOString(),
    ]);
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  static getStats() {
    const history = this.load();
    if (history.length === 0) {
      return { total: 0, avgConfidence: 0, mostCommonScript: 'simplified', oldest: null, newest: null };
    }

    const avgConfidence = history.reduce((sum, item) => sum + item.confidence, 0) / history.length;
    const scriptCount = history.reduce<Record<string, number>>((counts, item) => {
      counts[item.detectedScript] = (counts[item.detectedScript] || 0) + 1;
      return counts;
    }, {});
    const mostCommonScript = Object.entries(scriptCount).sort((a, b) => b[1] - a[1])[0]?.[0]
      || 'simplified';
    const sorted = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      total: history.length,
      avgConfidence,
      mostCommonScript,
      oldest: sorted[0] || null,
      newest: sorted.at(-1) || null,
    };
  }

  static search(query: string): TranslationResult[] {
    const normalizedQuery = query.toLowerCase();
    return this.load().filter(
      (item) =>
        item.originalText.toLowerCase().includes(normalizedQuery)
        || item.translation.toLowerCase().includes(normalizedQuery)
    );
  }
}
