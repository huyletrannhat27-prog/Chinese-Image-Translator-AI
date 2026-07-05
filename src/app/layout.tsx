'use client';

import { Inter } from 'next/font/google';
import { useEffect, useState } from 'react';
import './globals.css';
import { VersionManager } from '@/lib/ocr/versionManager';
import { OfflineIndicator } from '@/components/OfflineIndicator';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  // 1. Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }, []);

  // 2. Kiểm tra online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 App is online');
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      console.log('🔴 App is offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3. Kiểm tra và tự động cập nhật Tesseract.js
  useEffect(() => {
    const checkTesseractUpdate = async () => {
      try {
        const info = VersionManager.getVersionInfo();
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        // Kiểm tra mỗi 7 ngày hoặc nếu chưa có thông tin
        if (!info || (now - info.lastCheck) > SEVEN_DAYS) {
          const result = await VersionManager.checkAndUpdate();
          
          if (result.hasUpdate) {
            console.log('🔄 Tesseract.js update available:', result);
            
            // Nếu là update nhỏ (patch) -> tự động update
            if (result.updateType === 'patch') {
              const success = await VersionManager.updateToVersion(result.latestVersion);
              if (success) {
                console.log(`✅ Auto-updated Tesseract.js to v${result.latestVersion}`);
              }
            } else {
              // Major/Minor -> hiển thị thông báo cho user
              const message = VersionManager.showUpdateNotification(result.updateType);
              setUpdateMessage(message);
              setUpdateAvailable(true);
              console.log(message);
            }
          }
        }
      } catch (error) {
        console.warn('Tesseract update check failed:', error);
      }
    };

    checkTesseractUpdate();
  }, []);

  // 4. Handle update manually
  const handleManualUpdate = async () => {
    try {
      const result = await VersionManager.checkAndUpdate();
      if (result.hasUpdate) {
        const success = await VersionManager.updateToVersion(result.latestVersion);
        if (success) {
          setUpdateAvailable(false);
          setUpdateMessage('');
          alert(`✅ Đã cập nhật Tesseract.js thành công lên v${result.latestVersion}!`);
          // Reload để áp dụng
          window.location.reload();
        } else {
          alert('❌ Cập nhật thất bại. Vui lòng thử lại sau.');
        }
      }
    } catch (error) {
      console.error('Manual update failed:', error);
      alert('❌ Cập nhật thất bại. Vui lòng thử lại sau.');
    }
  };

  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="description" content="AI-powered Chinese image translator with OCR and LLM" />
        <title>Chinese Image Translator AI</title>
      </head>
      <body className={inter.className}>
        {/* Offline indicator */}
        <OfflineIndicator />

        {/* Update notification */}
        {updateAvailable && (
          <div className="fixed top-12 left-0 right-0 z-50 bg-blue-500 text-white px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-3 shadow-lg">
            <span>{updateMessage}</span>
            <button
              onClick={handleManualUpdate}
              className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-50 transition"
            >
              Cập nhật ngay
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="text-white/70 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          {children}
        </main>

        {/* Footer info */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-slate-700 px-4 py-1.5 text-xs text-gray-400 flex justify-between items-center">
          <span>🀄 Chinese Image Translator AI v1.0</span>
          <div className="flex items-center gap-3">
            <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
            <span>|</span>
            <span>📦 Tesseract v{VersionManager.getCurrentVersion()}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}