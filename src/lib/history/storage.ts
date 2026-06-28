import { TranslationResult } from '@/types';

const STORAGE_KEY = 'translation_history';
const MAX_HISTORY = 15000;

export class HistoryStorage {
  // Load history from localStorage
  static load(): TranslationResult[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        }));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    return [];
  }

  // Save history to localStorage
  static save(history: TranslationResult[]): void {
    try {
      // Limit history size
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  // Add item to history
  static addItem(item: TranslationResult): TranslationResult[] {
    const history = this.load();
    history.unshift(item); // Add to beginning
    this.save(history);
    return history;
  }

  // Remove item from history
  static removeItem(id: string): TranslationResult[] {
    const history = this.load();
    const filtered = history.filter(item => item.id !== id);
    this.save(filtered);
    return filtered;
  }

  // Clear all history
  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Export history as JSON
  static exportJSON(): string {
    const history = this.load();
    return JSON.stringify(history, null, 2);
  }

  // Export history as CSV
  static exportCSV(): string {
    const history = this.load();
    if (history.length === 0) return '';

    const headers = ['ID', 'Original', 'Translation', 'Script', 'Confidence', 'Created At'];
    const rows = history.map(item => [
      item.id,
      `"${item.originalText.replace(/"/g, '""')}"`,
      `"${item.translation.replace(/"/g, '""')}"`,
      item.detectedScript,
      item.confidence,
      item.createdAt.toISOString(),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  // Import history from JSON
  static importJSON(json: string): TranslationResult[] {
    try {
      const data = JSON.parse(json);
      const history = data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
      this.save(history);
      return history;
    } catch (e) {
      console.error('Failed to import history:', e);
      return [];
    }
  }

  // Get history size
  static getSize(): number {
    const history = this.load();
    return history.length;
  }

  // Search history
  static search(query: string): TranslationResult[] {
    const history = this.load();
    const lowerQuery = query.toLowerCase();
    return history.filter(item =>
      item.originalText.toLowerCase().includes(lowerQuery) ||
      item.translation.toLowerCase().includes(lowerQuery)
    );
  }

  // Get statistics
  static getStats(): {
    total: number;
    avgConfidence: number;
    mostCommonScript: 'simplified' | 'traditional' | 'mixed';
    oldest: TranslationResult | null;
    newest: TranslationResult | null;
  } {
    const history = this.load();
    if (history.length === 0) {
      return {
        total: 0,
        avgConfidence: 0,
        mostCommonScript: 'simplified',
        oldest: null,
        newest: null,
      };
    }

    const avgConfidence = history.reduce((sum, item) => sum + item.confidence, 0) / history.length;

    const scriptCount = history.reduce((acc, item) => {
      acc[item.detectedScript] = (acc[item.detectedScript] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonScript = Object.entries(scriptCount).sort((a, b) => b[1] - a[1])[0]?.[0] as 'simplified' | 'traditional' | 'mixed' || 'simplified';

    // Sort by date
    const sorted = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      total: history.length,
      avgConfidence,
      mostCommonScript,
      oldest: sorted[0] || null,
      newest: sorted[sorted.length - 1] || null,
    };
  }
}