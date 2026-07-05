// src/lib/ocr/versionManager.ts

export class VersionManager {
  private static readonly STORAGE_KEY = 'tesseract_version_info';
  private static readonly UPDATE_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

  static getCurrentVersion(): string {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return '4.1.1';
    }
    return localStorage.getItem('tesseract_version') || '4.1.1';
  }

  static async checkAndUpdate(): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    updateType: 'major' | 'minor' | 'patch' | 'none';
  }> {
    const currentVersion = this.getCurrentVersion();
    let latestVersion = currentVersion;
    let updateType: 'major' | 'minor' | 'patch' | 'none' = 'none';

    try {
      // Kiểm tra từ CDN
      const response = await fetch('https://registry.npmjs.org/tesseract.js/latest', {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });
      
      if (response.ok) {
        const data = await response.json();
        latestVersion = data.version || currentVersion;
        updateType = this.getUpdateType(currentVersion, latestVersion);
      }
    } catch (e) {
      console.warn('Failed to fetch latest version, using current:', e);
    }

    const hasUpdate = updateType !== 'none';

    // Lưu thông tin
    this.saveVersionInfo({
      currentVersion,
      latestVersion,
      updateType,
      lastCheck: Date.now(),
    });

    return { hasUpdate, currentVersion, latestVersion, updateType };
  }

  static getUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' | 'none' {
    try {
      const [cMajor, cMinor, cPatch] = current.split('.').map(Number);
      const [lMajor, lMinor, lPatch] = latest.split('.').map(Number);

      if (lMajor > cMajor) return 'major';
      if (lMinor > cMinor) return 'minor';
      if (lPatch > cPatch) return 'patch';
    } catch (e) {
      console.warn('Version comparison failed:', e);
    }
    return 'none';
  }

  static saveVersionInfo(info: any) {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(info));
      }
    } catch (e) {
      console.warn('Failed to save version info:', e);
    }
  }

  static getVersionInfo() {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return null;
      }
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static async updateToVersion(version: string): Promise<boolean> {
    try {
      // Tải script từ CDN
      const scriptUrl = `https://cdn.jsdelivr.net/npm/tesseract.js@${version}/dist/tesseract.min.js`;
      const response = await fetch(scriptUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const scriptContent = await response.text();

      // Lưu vào localStorage
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('tesseract_script_version', version);
        localStorage.setItem('tesseract_script_content', scriptContent);
        localStorage.setItem('tesseract_version', version);
      }

      console.log(`✅ Updated Tesseract.js to v${version}`);
      return true;
    } catch (error) {
      console.error('Failed to update Tesseract:', error);
      return false;
    }
  }

  static showUpdateNotification(updateType: string): string {
    const messages: Record<string, string> = {
      major: '📢 Bản cập nhật lớn của Tesseract.js đã có! Cải thiện độ chính xác và tính năng mới. Vui lòng cập nhật.',
      minor: '🔄 Đã có bản cập nhật Tesseract.js. Cải thiện độ chính xác và hiệu suất đáng kể.',
      patch: '🔧 Đã có bản vá Tesseract.js. Sửa lỗi nhỏ và cải thiện ổn định.',
    };

    return messages[updateType] || '🔄 Đã có bản cập nhật mới của Tesseract.js.';
  }

  // Kiểm tra xem có cần check update không
  static shouldCheckUpdate(): boolean {
    const info = this.getVersionInfo();
    if (!info) return true;
    
    const now = Date.now();
    const lastCheck = info.lastCheck || 0;
    return (now - lastCheck) > this.UPDATE_CHECK_INTERVAL;
  }
}