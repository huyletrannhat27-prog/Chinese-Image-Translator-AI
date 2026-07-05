// src/lib/ocr/tesseract.ts

import { createWorker as createTesseractWorker, PSM } from 'tesseract.js';
import type { OCRResult } from '@/types';

// Version detection và auto-upgrade
export class TesseractManager {
  private static instance: TesseractManager;
  private currentVersion: string = '4.1.1';
  private latestVersion: string | null = null;
  private isUpdating: boolean = false;

  static getInstance(): TesseractManager {
    if (!TesseractManager.instance) {
      TesseractManager.instance = new TesseractManager();
    }
    return TesseractManager.instance;
  }

  // Kiểm tra phiên bản mới nhất
  async checkForUpdates(): Promise<boolean> {
    try {
      const response = await fetch('https://registry.npmjs.org/tesseract.js/latest');
      const data = await response.json();
      this.latestVersion = data.version;
      
      const isNewer = this.latestVersion !== null && this.compareVersions(this.latestVersion, this.currentVersion) > 0;
      if (isNewer) {
        console.log(`🔄 New Tesseract.js version available: ${this.latestVersion}`);
      }
      return isNewer;
    } catch (error) {
      console.warn('Failed to check Tesseract.js version:', error);
      return false;
    }
  }

  // So sánh phiên bản
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) return p1 - p2;
    }
    return 0;
  }

  // Tự động cập nhật Tesseract (không cần cài lại app)
  async autoUpdate(): Promise<boolean> {
    if (this.isUpdating) return false;
    this.isUpdating = true;

    try {
      // Kiểm tra version mới
      const hasUpdate = await this.checkForUpdates();
      if (!hasUpdate || !this.latestVersion) {
        this.isUpdating = false;
        return false;
      }

      console.log(`🔄 Updating Tesseract.js to ${this.latestVersion}...`);

      // Load script mới từ CDN
      const scriptUrl = `https://cdn.jsdelivr.net/npm/tesseract.js@${this.latestVersion}/dist/tesseract.min.js`;
      
      const response = await fetch(scriptUrl);
      const scriptContent = await response.text();

      // Cache script mới vào localStorage
      localStorage.setItem('tesseract_script_version', this.latestVersion);
      localStorage.setItem('tesseract_script_content', scriptContent);

      // Update current version
      this.currentVersion = this.latestVersion;
      
      console.log(`✅ Tesseract.js updated to ${this.latestVersion}`);
      this.isUpdating = false;
      
      // Reload worker với version mới
      return true;
    } catch (error) {
      console.error('Failed to update Tesseract.js:', error);
      this.isUpdating = false;
      return false;
    }
  }

  // Tạo worker với version phù hợp
  async createWorker(language: string = 'chi_sim', options?: Record<string, unknown>) {
    // Kiểm tra cache
    const cachedVersion = typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage.getItem('tesseract_script_version') : null;
    const cachedScript = typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage.getItem('tesseract_script_content') : null;

    // Nếu có cache và version khác, sử dụng cache
    if (cachedVersion && cachedScript && cachedVersion !== this.currentVersion) {
      try {
        // Load từ cache
        eval(cachedScript);
        this.currentVersion = cachedVersion;
        console.log(`📦 Using cached Tesseract.js ${cachedVersion}`);
      } catch (e) {
        console.warn('Failed to load cached Tesseract, using default');
      }
    }

    // Tạo worker với phiên bản hiện tại
    return createTesseractWorker({
      ...options,
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📝 OCR: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
  }

  // Kiểm tra và upgrade nếu cần
  async ensureLatestVersion(): Promise<void> {
    const hasUpdate = await this.checkForUpdates();
    if (hasUpdate) {
      await this.autoUpdate();
    }
  }
}

// Export OCR function với version management
export async function performOCR(
  imageData: string | Buffer,
  options?: {
    language?: 'chi_sim' | 'chi_tra' | 'chi_sim+chi_tra';
    psm?: PSM;
    useLatest?: boolean;
  }
): Promise<OCRResult> {
  const manager = TesseractManager.getInstance();

  // Kiểm tra và cập nhật nếu cần
  if (options?.useLatest) {
    await manager.ensureLatestVersion();
  }

  const language = options?.language || 'chi_sim+chi_tra';
  const psm = options?.psm || PSM.AUTO;

  const worker = await manager.createWorker(language, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        console.log(`📝 OCR: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  try {
    await worker.loadLanguage(language);
    await worker.initialize(language);
    await worker.setParameters({ tessedit_pageseg_mode: psm });

    const result = await worker.recognize(imageData);
    await worker.terminate();

    // Parse result
    const wordBoxes = result.data.words?.map((word) => ({
      text: word.text || '',
      confidence: word.confidence || 0,
      bbox: {
        x0: word.bbox?.x0 || 0,
        y0: word.bbox?.y0 || 0,
        x1: word.bbox?.x1 || 0,
        y1: word.bbox?.y1 || 0,
      },
    })) || [];

    const detectedScript = detectChineseScript(result.data.text || '');

    return {
      text: result.data.text || '',
      confidence: result.data.confidence || 0,
      detectedScript,
      language,
      wordBoxes,
    };
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

// Helper: detect Chinese script
function detectChineseScript(text: string): 'simplified' | 'traditional' | 'mixed' {
  if (!text || text.trim().length === 0) return 'simplified';

  const simplified = ['学', '国', '开', '关', '门', '问', '对', '说', '话', '书', '写'];
  const traditional = ['學', '國', '開', '關', '門', '問', '對', '說', '話', '書', '寫'];
  
  let s = 0,
    t = 0;
  for (const char of text) {
    if (simplified.includes(char)) s++;
    if (traditional.includes(char)) t++;
  }
  
  if (s > t * 2) return 'simplified';
  if (t > s * 2) return 'traditional';
  return s > 0 && t > 0 ? 'mixed' : 'simplified';
}