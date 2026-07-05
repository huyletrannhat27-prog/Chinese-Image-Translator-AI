// src/components/TesseractVersion.tsx

'use client';

import { useState, useEffect } from 'react';
import { TesseractManager } from '@/lib/ocr/tesseract';

export function TesseractVersion() {
  const [version, setVersion] = useState('4.1.1');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    checkVersion();
  }, []);

  const checkVersion = async () => {
    const manager = TesseractManager.getInstance();
    const hasUpdate = await manager.checkForUpdates();
    setUpdateAvailable(hasUpdate);
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    const manager = TesseractManager.getInstance();
    const success = await manager.autoUpdate();
    setIsUpdating(false);
    
    if (success) {
      setUpdateAvailable(false);
      alert('✅ Đã cập nhật Tesseract.js thành công!');
      // Reload để áp dụng
      window.location.reload();
    } else {
      alert('❌ Cập nhật thất bại. Vui lòng thử lại sau.');
    }
  };

  return (
    <div className="text-xs text-gray-400 flex items-center gap-2">
      <span>📦 Tesseract v{version}</span>
      {updateAvailable && (
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition disabled:opacity-50"
        >
          {isUpdating ? 'Đang cập nhật...' : '🔄 Cập nhật'}
        </button>
      )}
    </div>
  );
}