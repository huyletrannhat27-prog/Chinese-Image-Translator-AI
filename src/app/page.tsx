'use client';

import { useState, ChangeEvent } from 'react';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { TesseractVersion } from '@/components/TesseractVersion';

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
    setOcrText('');
    setTranslatedText('');
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      setError('Vui lòng chọn ảnh trước');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('analyzeLayout', 'true');

      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const ocrData = await ocrRes.json();
      if (!ocrRes.ok) throw new Error(ocrData.error || 'OCR thất bại');

      setOcrText(ocrData.text || '');

      const translateRes = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ocrData.text || '',
          target: 'vi',
          source: 'zh',
        }),
      });

      const translateData = await translateRes.json();
      if (!translateRes.ok) throw new Error(translateData.error || 'Dịch thất bại');

      setTranslatedText(translateData.translation || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🀄 Dịch ảnh Trung - Việt</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              Chọn ảnh → OCR → Dịch ngay
              <TesseractVersion />
            </p>
          </div>
          <OfflineIndicator />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Chọn ảnh cần dịch
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
            />

            {imagePreview ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                <img src={imagePreview} alt="Preview" className="h-auto w-full object-contain" />
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                Chưa có ảnh. Hãy chọn ảnh để bắt đầu.
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={isProcessing || !selectedFile}
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isProcessing ? 'Đang xử lý...' : 'Bắt đầu dịch'}
            </button>

            {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Văn bản OCR</h2>
              <pre className="min-h-[140px] whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                {ocrText || 'Chưa có kết quả OCR'}
              </pre>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Bản dịch</h2>
              <pre className="min-h-[140px] whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                {translatedText || 'Chưa có bản dịch'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}