'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Camera, Upload, History, Copy, Download, Trash2, RefreshCw } from 'lucide-react';

// Types
interface TranslationResult {
  id: string;
  originalText: string;
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  confidence: number;
  segments: Array<{ original: string; translated: string }>;
  processingTime: number;
  createdAt: Date;
}

export default function Home() {
  // States
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<TranslationResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Load history from localStorage on mount
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
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('translation_history', JSON.stringify(history));
    }
  }, [history]);

  // Start camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setError('Không thể mở camera. Vui lòng kiểm tra quyền truy cập.');
      console.error('Camera error:', err);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setImage(dataUrl);
        
        // Convert dataUrl to File
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setImageFile(file);
            stopCamera();
            processImage(file);
          });
      }
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Vui lòng upload file ảnh');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Dung lượng ảnh tối đa 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setImageFile(file);
        processImage(file);
      };
      reader.readAsDataURL(file);
    }
  };

  // Process image: OCR + Translation
  const processImage = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress(10);

    try {
      // Step 1: OCR
      setProgress(30);
      const formData = new FormData();
      formData.append('image', file);

      const ocrResponse = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!ocrResponse.ok) {
        const errorData = await ocrResponse.json();
        throw new Error(errorData.error || 'OCR failed');
      }

      const ocrData = await ocrResponse.json();
      setProgress(60);

      if (!ocrData.text || ocrData.text.trim().length === 0) {
        throw new Error('Không tìm thấy văn bản tiếng Trung trong ảnh');
      }

      // Step 2: Translation
      setProgress(70);
      const translateResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ocrData.text,
          target: 'vi',
        }),
      });

      if (!translateResponse.ok) {
        const errorData = await translateResponse.json();
        throw new Error(errorData.error || 'Translation failed');
      }

      const translateData = await translateResponse.json();
      setProgress(90);

      // Build result
      const resultData: TranslationResult = {
        id: `trans_${Date.now()}`,
        originalText: ocrData.text,
        translation: translateData.translation,
        detectedScript: translateData.detectedScript || 'simplified',
        confidence: ocrData.confidence || 0.85,
        segments: translateData.segments || [{ original: ocrData.text, translated: translateData.translation }],
        processingTime: Date.now() - Date.now() + 2000,
        createdAt: new Date(),
      };

      setResult(resultData);
      setProgress(100);

      // Save to history
      setHistory(prev => [resultData, ...prev]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xử lý');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Copy text to clipboard
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show success feedback
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Clear history
  const clearHistory = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử?')) {
      setHistory([]);
      localStorage.removeItem('translation_history');
    }
  };

  // Delete single history item
  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // Reset all
  const resetAll = () => {
    setImage(null);
    setImageFile(null);
    setResult(null);
    setError(null);
    stopCamera();
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🀄 Dịch Ảnh Trung - Việt
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Chụp ảnh → OCR → Dịch ngay
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
          >
            <History size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          {result && (
            <button
              onClick={resetAll}
              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
            >
              <RefreshCw size={20} className="text-gray-700 dark:text-gray-300" />
            </button>
          )}
        </div>
      </div>

      {/* Camera / Upload */}
      {!image && !isProcessing && (
        <div className="space-y-4">
          {/* Camera */}
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                  <button
                    onClick={capturePhoto}
                    className="p-4 rounded-full bg-white/20 backdrop-blur-md border-2 border-white hover:bg-white/30 transition"
                  >
                    <div className="w-12 h-12 rounded-full border-4 border-white" />
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-lg bg-red-500/80 backdrop-blur-md text-white text-sm"
                  >
                    Đóng
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
                  <Camera size={64} className="text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-center">
                    Mở camera để chụp ảnh<br />
                    <span className="text-sm">hoặc upload ảnh từ máy</span>
                  </p>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                  <button
                    onClick={startCamera}
                    className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <Camera size={20} />
                    Mở Camera
                  </button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Upload */}
          <div className="flex justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 transition flex items-center gap-2 text-gray-600 dark:text-gray-300"
            >
              <Upload size={20} />
              Chọn ảnh từ máy
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {progress < 50 ? 'Đang OCR...' : progress < 80 ? 'Đang dịch...' : 'Hoàn tất...'}
                </p>
                <p className="text-sm text-gray-500">{Math.round(progress)}%</p>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
          <p className="font-medium">⚠️ Lỗi</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Result */}
      {result && !isProcessing && (
        <div className="mt-4 space-y-4 animate-fadeIn">
          {/* Preview */}
          {image && (
            <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700">
              <img src={image} alt="Uploaded" className="w-full max-h-64 object-contain" />
            </div>
          )}

          {/* Confidence */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Độ chính xác:</span>
            <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${Math.round(result.confidence * 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {Math.round(result.confidence * 100)}%
            </span>
          </div>

          {/* Script detection */}
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {result.detectedScript === 'simplified' ? '简体 Giản thể' :
               result.detectedScript === 'traditional' ? '繁體 Phồn thể' : 'Hỗn hợp'}
            </span>
            <span className="text-xs text-gray-400">
              {result.processingTime}ms
            </span>
          </div>

          {/* Original text */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">📝 Văn bản gốc</h3>
              <button
                onClick={() => copyText(result.originalText)}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                <Copy size={16} className="text-gray-500" />
              </button>
            </div>
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap text-lg">
              {result.originalText}
            </p>
          </div>

          {/* Translation */}
          <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-green-700 dark:text-green-300">🌍 Bản dịch (Tiếng Việt)</h3>
              <button
                onClick={() => copyText(result.translation)}
                className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-800/30 transition"
              >
                <Copy size={16} className="text-green-600 dark:text-green-400" />
              </button>
            </div>
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap text-lg">
              {result.translation}
            </p>
          </div>

          {/* Segments */}
          {result.segments.length > 1 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">📖 Phân đoạn</h3>
              <div className="space-y-2">
                {result.segments.map((seg, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
                      <span className="text-gray-900 dark:text-white">{seg.original}</span>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <span className="text-gray-900 dark:text-white">{seg.translated}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Download as text file
                const content = `Văn bản gốc:\n${result.originalText}\n\nBản dịch:\n${result.translation}\n\n---\nDịch bởi Chinese Image Translator AI\n${new Date().toLocaleString()}`;
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dich_${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Tải xuống
            </button>
            <button
              onClick={resetAll}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Dịch tiếp
            </button>
          </div>
        </div>
      )}

      {/* History sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto animate-slideIn">
            <div className="sticky top-0 bg-white dark:bg-slate-900 p-4 border-b dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-bold">📋 Lịch sử dịch</h2>
              <div className="flex gap-2">
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <History size={48} className="mx-auto mb-3 opacity-50" />
                  <p>Chưa có lịch sử dịch</p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition cursor-pointer"
                    onClick={() => {
                      setResult(item);
                      setShowHistory(false);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {item.originalText.slice(0, 50)}...
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400 truncate">
                          {item.translation.slice(0, 50)}...
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        className="p-1 hover:bg-red-100 dark:hover: