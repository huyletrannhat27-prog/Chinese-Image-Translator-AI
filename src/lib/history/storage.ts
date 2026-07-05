// src/lib/history/storage.ts

import type { TranslationResult } from '@/types';

const STORAGE_KEY = 'translation_history';
const MAX_HISTORY = 1000; // Giới hạn 1000 entries
const COMPRESSION_QUALITY = 70; // Nén ảnh

export class HistoryStorage {
  // Lưu với giới hạn 1000
  static save(history: TranslationResult[]): void {
    try {
      // Giới hạn số lượng
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      
      // Nén dữ liệu trước khi lưu
      const compressed = this.compressHistory(history);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compressed));
    } catch (e) {
      console.error('Failed to save history:', e);
      // Nếu lỗi, thử lưu với ít hơn
      if (history.length > 500) {
        try {
          const reduced = history.slice(0, 500);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
        } catch (e2) {
          console.error('Even reduced save failed:', e2);
        }
      }
    }
  }

  // Nén dữ liệu lịch sử
  private static compressHistory(history: TranslationResult[]): any[] {
    return history.map(item => ({
      id: item.id,
      originalText: this.truncateText(item.originalText, 500),
      translation: this.truncateText(item.translation, 500),
      detectedScript: item.detectedScript,
      confidence: item.confidence,
      segments: item.segments?.slice(0, 20), // Giới hạn segments
      processingTime: item.processingTime,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  // Cắt text nếu quá dài
  private static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  // Load với xử lý lỗi
  static load(): TranslationResult[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        
        return parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          // Đảm bảo segments luôn là array
          segments: Array.isArray(item.segments) ? item.segments : [],
        }));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
      // Nếu lỗi, thử xóa và bắt đầu lại
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e2) {
        console.error('Failed to clear corrupted history:', e2);
      }
    }
    return [];
  }

  // Thêm item với giới hạn
  static addItem(item: TranslationResult): TranslationResult[] {
    const history = this.load();
    // Kiểm tra trùng lặp
    const exists = history.some(h => h.id === item.id);
    if (!exists) {
      history.unshift(item);
    }
    this.save(history);
    return history;
  }

  // Xóa item
  static removeItem(id: string): TranslationResult[] {
    const history = this.load();
    const filtered = history.filter(item => item.id !== id);
    this.save(filtered);
    return filtered;
  }

  // Clear all
  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Export JSON
  static exportJSON(): string {
    const history = this.load();
    return JSON.stringify(history, null, 2);
  }

  // Export CSV
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

  // Get stats
  static getStats(): {
    total: number;
    avgConfidence: number;
    mostCommonScript: string;
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

    const mostCommonScript = (Object.entries(scriptCount) as Array<[string, number]>)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'simplified';

    const sorted = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      total: history.length,
      avgConfidence,
      mostCommonScript,
      oldest: sorted[0] || null,
      newest: sorted[sorted.length - 1] || null,
    };
  }

  // Tìm kiếm trong lịch sử
  static search(query: string): TranslationResult[] {
    const history = this.load();
    const lowerQuery = query.toLowerCase();
    return history.filter(item =>
      item.originalText.toLowerCase().includes(lowerQuery) ||
      item.translation.toLowerCase().includes(lowerQuery)
    );
  }
}