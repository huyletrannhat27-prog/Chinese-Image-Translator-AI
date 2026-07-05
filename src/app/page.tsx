// src/app/page.tsx - Thêm vào đầu file

import { OfflineIndicator } from '@/components/OfflineIndicator';
import { TesseractVersion } from '@/components/TesseractVersion';

export default function Home() {
  // ... existing code ...

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* Header với version */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🀄 Dịch Ảnh Trung - Việt
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            Chụp ảnh → OCR → Dịch ngay
            <TesseractVersion />
          </p>
        </div>
        {/* ... rest of header ... */}
      </div>

      {/* ... rest of component ... */}
    </div>
  );
}