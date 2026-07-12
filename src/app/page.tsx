'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  History, Copy, Download, RefreshCw, Sparkles, 
  ImageIcon, Upload, CheckCircle, XCircle, 
  Clock, ArrowRight, Zap, ShieldCheck, 
  ChevronRight, Plus, Camera
} from 'lucide-react';

interface TranslationResult {
  id: string;
  originalText: string;
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  confidence: number;
  createdAt: Date;
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [history, setHistory] = useState<TranslationResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('translation_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHistory(parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        })));
      } catch (e) {
        console.error('Lỗi tải lịch sử:', e);
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng upload file ảnh');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Dung lượng ảnh tối đa 10MB');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
      processImage(file);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      setProgress(30);
      const formData = new FormData();
      formData.append('image', file);

      const ocrResponse = await fetch('/api/ocr', { method: 'POST', body: formData });
      if (!ocrResponse.ok) throw new Error('OCR thất bại');

      const ocrData = await ocrResponse.json();
      setProgress(60);

      if (!ocrData.text?.trim()) throw new Error('Không tìm thấy văn bản tiếng Trung');

      setProgress(70);
      const translateResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ocrData.text, target: 'vi' }),
      });

      if (!translateResponse.ok) throw new Error('Dịch thuật thất bại');

      const translateData = await translateResponse.json();
      setProgress(90);

      const resultData: TranslationResult = {
        id: `trans_${Date.now()}`,
        originalText: ocrData.text,
        translation: translateData.translation || ocrData.text,
        detectedScript: translateData.detectedScript || 'simplified',
        confidence: ocrData.confidence || 0.85,
        createdAt: new Date(),
      };

      setResult(resultData);
      setProgress(100);
      const updatedHistory = [resultData, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('translation_history', JSON.stringify(updatedHistory));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Đã sao chép vào clipboard');
    } catch (err) {
      showToast('Sao chép thất bại');
    }
  };

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1e293b] text-white px-5 py-3 rounded-xl shadow-2xl z-50 text-sm font-medium';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const getScriptLabel = (script: string) => {
    return script === 'simplified' ? '简体' : script === 'traditional' ? '繁體' : '混';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* Header - Tối giản */}
      <header className="bg-white/80 dark:bg-[#1e293b]/80 backdrop-blur-xl border-b border-[#e2e8f0] dark:border-[#334155] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">中</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#0f172a] dark:text-[#f8fafc] tracking-tight">
                Dịch Ảnh
              </h1>
              <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium tracking-wider uppercase">
                Trung → Việt
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/history"
              className="relative p-2 rounded-xl hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-all duration-200"
            >
              <History size={18} className="text-[#64748b] dark:text-[#94a3b8]" />
              {history.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-blue-600 dark:bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {history.length > 99 ? '99+' : history.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Upload Zone - Tối giản */}
        {!image && !isProcessing && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`
                relative rounded-2xl p-12 text-center cursor-pointer
                transition-all duration-300
                ${isDragging 
                  ? 'border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' 
                  : 'border-2 border-dashed border-[#e2e8f0] dark:border-[#334155] hover:border-blue-400 dark:hover:border-blue-500'
                }
                bg-white dark:bg-[#1e293b] hover:shadow-md transition-shadow
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                  <Upload size={28} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1">
                  Tải ảnh lên
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                  Kéo thả hoặc <span className="text-blue-600 dark:text-blue-400 font-medium">chọn file</span>
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {['JPEG', 'PNG', 'WEBP', '≤ 10MB'].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-[#f1f5f9] dark:bg-[#334155] text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick features - Grid đẹp */}
            <div className="grid grid-cols-4 gap-3 mt-6">
              {[
                { icon: '📷', label: 'Chụp màn hình' },
                { icon: '📄', label: 'Văn bản in' },
                { icon: '✍️', label: 'Chữ viết tay' },
                { icon: '🌏', label: 'Giản/Phồn thể' },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.05 + 0.2 }}
                  className="flex flex-col items-center p-3 rounded-xl bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                >
                  <span className="text-xl mb-1">{item.icon}</span>
                  <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Processing & Result */}
        <AnimatePresence mode="wait">
          {image && (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="space-y-6"
            >
              {/* Image Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155]">
                <img src={image} alt="Uploaded" className="w-full max-h-[320px] object-contain" />
                {!isProcessing && !result && (
                  <button
                    onClick={resetAll}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>

              {/* Processing */}
              {isProcessing && (
                <motion.div
                  initial={{ scale: 0.97, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#334155]"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full border-4 border-blue-100 dark:border-blue-900/30">
                        <div className="w-full h-full rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(progress)}%
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#0f172a] dark:text-[#f8fafc] text-sm">
                        {progress < 30 && '🔍 Đang nhận diện...'}
                        {progress >= 30 && progress < 60 && '📝 Đang xử lý OCR...'}
                        {progress >= 60 && progress < 80 && '🌍 Đang dịch...'}
                        {progress >= 80 && progress < 100 && '✨ Hoàn tất...'}
                        {progress >= 100 && '✅ Xong!'}
                      </p>
                      <div className="w-full h-1.5 bg-[#f1f5f9] dark:bg-[#334155] rounded-full mt-2 overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Result - Clean & Minimal */}
              {result && !isProcessing && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="space-y-4"
                >
                  {/* Original */}
                  <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#334155]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">Văn bản gốc</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium">
                          {getScriptLabel(result.detectedScript)}
                        </span>
                      </div>
                      <button
                        onClick={() => copyText(result.originalText)}
                        className="p-1.5 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition"
                      >
                        <Copy size={14} className="text-[#64748b] dark:text-[#94a3b8]" />
                      </button>
                    </div>
                    <p className="text-[#0f172a] dark:text-[#f8fafc] text-base leading-relaxed">
                      {result.originalText}
                    </p>
                  </div>

                  {/* Translation - Highlight */}
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-5 border border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Bản dịch</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                          {Math.round(result.confidence * 100)}%
                        </span>
                      </div>
                      <button
                        onClick={() => copyText(result.translation)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                      >
                        <Copy size={14} className="text-blue-600 dark:text-blue-400" />
                      </button>
                    </div>
                    <p className="text-[#0f172a] dark:text-[#f8fafc] text-base leading-relaxed">
                      {result.translation}
                    </p>
                  </div>

                  {/* Actions - Clean */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-[#94a3b8] dark:text-[#64748b]">
                      {result.createdAt.toLocaleString('vi-VN')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const content = `${result.originalText}\n\n${result.translation}`;
                          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `dich_${Date.now()}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#f1f5f9] dark:bg-[#334155] text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#475569] transition text-sm font-medium flex items-center gap-1.5"
                      >
                        <Download size={14} />
                        Tải xuống
                      </button>
                      <button
                        onClick={resetAll}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium flex items-center gap-1.5"
                      >
                        <RefreshCw size={14} />
                        Dịch tiếp
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ scale: 0.97, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-5 border border-red-200 dark:border-red-800/30"
                >
                  <div className="flex items-start gap-3">
                    <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-red-700 dark:text-red-300 text-sm">{error}</p>
                      {error.includes('GEMINI_API_KEY') && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20 p-3 rounded-xl">
                          💡 Thêm GEMINI_API_KEY vào file .env
                        </p>
                      )}
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer - Minimal */}
      <footer className="text-center py-6 text-xs text-[#94a3b8] dark:text-[#64748b] border-t border-[#e2e8f0] dark:border-[#334155] mt-8">
        <p>🀄 Dịch Ảnh · Nhận diện chữ Trung với Tesseract.js</p>
      </footer>
    </div>
  );
}