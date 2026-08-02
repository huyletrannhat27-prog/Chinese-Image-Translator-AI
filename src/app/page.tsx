'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Aperture,
  Upload,
  History,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Zap,
  X,
  Check,
  Smartphone,
} from 'lucide-react';
import { TranslationResult } from '@/types';
import { HistoryStorage } from '@/lib/history/storage';
import { recognizeChinese } from '@/lib/ocr/tesseract';

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được kích thước ảnh'));
    };
    img.src = url;
  });
}

export default function Home() {
  // States
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<TranslationResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  }, []);

  // Đo kích thước thực tế của ảnh preview đang render (để quy đổi bbox pixel
  // của ảnh gốc sang vị trí % chính xác cho overlay bản dịch).
  const updateOverlaySize = () => {
    if (previewImgRef.current) {
      setOverlaySize({
        width: previewImgRef.current.clientWidth,
        height: previewImgRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateOverlaySize);
    return () => window.removeEventListener('resize', updateOverlaySize);
  }, []);

  // Ảnh base64 có thể load gần như tức thì (đã ở cache) khiến sự kiện
  // `onLoad` của <img> bắn ra trước khi ref kịp gắn - đo lại 1 lần nữa mỗi
  // khi có kết quả mới để chắc chắn overlay luôn có kích thước đúng.
  useEffect(() => {
    if (result) updateOverlaySize();
  }, [result]);

  // Load history on mount
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHistory(HistoryStorage.load()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Gắn stream sau khi cameraActive làm phần tử <video> xuất hiện trong DOM.
  // Code cũ gắn stream trước khi render <video>, khiến ref luôn null.
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch((err) => {
      console.error('Camera playback error:', err);
      setError('Đã mở camera nhưng không phát được hình ảnh. Vui lòng thử lại.');
    });
  }, [cameraActive]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Start camera
  const startCamera = async () => {
    // Some Android WebViews do not expose getUserMedia even though the device
    // has a camera. Fall back to the native file chooser, which can open the
    // camera through the `capture` hint on the input below.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fallbackCameraInputRef.current?.click();
      return;
    }
    try {
      setError(null);
      setCameraReady(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = mediaStream;
      setCameraActive(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Quyền camera đang bị chặn. Hãy cho phép Camera trong cài đặt trình duyệt rồi thử lại.'
          : 'Không thể mở camera trực tiếp. Bạn vẫn có thể dùng nút chụp ảnh dự phòng hoặc chọn ảnh trong thư viện.'
      );
      console.error('Camera error:', err);
    }
  };

  // Stop camera
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setIsCapturing(false);
    setCameraActive(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      if (!cameraReady || !video.videoWidth || !video.videoHeight) {
        setError('Camera chưa sẵn sàng, vui lòng đợi một chút rồi chụp lại.');
        return;
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        setIsCapturing(true);
        setError(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) {
            setIsCapturing(false);
            setError('Không thể tạo ảnh chụp. Vui lòng thử lại.');
            return;
          }

          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const reader = new FileReader();
          reader.onload = (event) => setImage(event.target?.result as string);
          reader.readAsDataURL(file);

          // Dừng camera ngay sau khi đã lấy được frame, rồi xử lý ảnh vừa chụp.
          stopCamera();
          void processImage(file);
        }, 'image/jpeg', 0.95);
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
        processImage(file);
      };
      reader.readAsDataURL(file);
      e.currentTarget.value = '';
    }
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress(10);
    const startedAt = Date.now();

    try {
      setProgress(15);
      const ocrResult = await recognizeChinese(file, (ocrProgress) => {
        setProgress(15 + Math.round(ocrProgress * 0.45));
      });
      if (!ocrResult.text.trim()) throw new Error('Không nhận diện được chữ trong ảnh');

      const verificationFormData = new FormData();
      verificationFormData.append('target', 'vi');
      verificationFormData.append('ocr', JSON.stringify({
        ...ocrResult,
        wordBoxes: ocrResult.regions?.map((region) => ({
          text: region.text,
          confidence: region.confidence,
          bbox: region.bbox,
        })),
      }));

      setProgress(65);
      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        body: verificationFormData,
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Không thể kiểm chứng OCR và bản dịch');
      }

      setProgress(90);
      const translation = verifyData.translation;
      const ocrRegions = ocrResult.regions;
      const translatedRegions =
        ocrRegions && translation.segments?.length === ocrRegions.length
          ? translation.segments.map((segment: { translated: string }) => segment.translated)
          : undefined;
      const imageDimensions = await getImageDimensions(file);
      const resultData: TranslationResult = {
        id: `trans_${Date.now()}`,
        originalText: ocrResult.text,
        translation: translation.translation,
        detectedScript: ocrResult.detectedScript,
        confidence: verifyData.accuracy.ocr.averageConfidence,
        segments: translation.segments || [
          { original: ocrResult.text, translated: translation.translation },
        ],
        processingTime: Date.now() - startedAt,
        createdAt: new Date(),
        regions: translatedRegions ? ocrRegions : undefined,
        translatedRegions,
        imageWidth: imageDimensions.width,
        imageHeight: imageDimensions.height,
        accuracy: verifyData.accuracy,
      };

      setResult(resultData);
      setProgress(100);

      // Save to history
      const updatedHistory = HistoryStorage.addItem(resultData);
      setHistory(updatedHistory);

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
      setCopiedText(text);
      window.setTimeout(() => setCopiedText(null), 1600);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    const prompt = installPrompt as Event & { prompt: () => Promise<void> };
    await prompt.prompt();
    setInstallPrompt(null);
  };

  // Clear history
  const clearHistory = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử?')) {
      HistoryStorage.clear();
      setHistory([]);
    }
  };

  // Delete single history item
  const deleteHistoryItem = (id: string) => {
    const updated = HistoryStorage.removeItem(id);
    setHistory(updated);
  };

  // Reset all
  const resetAll = () => {
    setImage(null);
    setResult(null);
    setError(null);
    stopCamera();
  };

  return (
    <div className="app-shell mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
        <div className="flex items-center gap-3">
          <div className="logo-mark">译</div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-950 sm:text-lg">
              Hanzi Lens
            </h1>
            <p className="text-xs font-medium text-slate-500">Dịch ảnh Trung → Việt bằng AI</p>
          </div>
        </div>
        <div className="flex gap-2">
          {installPrompt && (
            <button onClick={installApp} className="icon-button" title="Cài ứng dụng" aria-label="Cài ứng dụng">
              <Smartphone size={19} />
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="icon-button relative"
            aria-label="Mở lịch sử"
          >
            <History size={19} />
            {history.length > 0 && <span className="history-count">{Math.min(history.length, 99)}</span>}
          </button>
          {result && (
            <button
              onClick={resetAll}
              className="icon-button"
              aria-label="Dịch ảnh mới"
            >
              <RefreshCw size={19} />
            </button>
          )}
        </div>
      </header>

      {!image && !isProcessing && (
        <section className="mb-7 pt-5 text-center sm:pt-8">
          <div className="eyebrow"><Sparkles size={14} /> Nhanh · Chính xác · Riêng tư</div>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Hiểu mọi dòng chữ Trung<br className="hidden sm:block" /> chỉ với <span className="gradient-text">một tấm ảnh</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Chụp menu, biển báo hoặc tài liệu. AI tự nhận diện chữ Giản thể, Phồn thể và dịch sang tiếng Việt tự nhiên.
          </p>
        </section>
      )}

      {/* Camera / Upload */}
      {!image && !isProcessing && (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="surface-card flex flex-col gap-2 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Tesseract OCR + Gemini dịch thuật</p>
              <p className="text-xs text-slate-500">Tesseract đọc chữ Trung, Gemini dịch sang tiếng Việt</p>
            </div>
            <span className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
              Gemini API
            </span>
          </div>
          {/* Camera */}
          <div className="camera-card relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-slate-950 sm:aspect-[16/9]">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => setCameraReady(true)}
                  onCanPlay={() => setCameraReady(true)}
                  onPlaying={() => setCameraReady(true)}
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
                  <span className="rounded-full bg-slate-950/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                    Căn chữ vào khung rồi bấm Chụp ảnh
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-12">
                  <button
                    onClick={capturePhoto}
                    disabled={!cameraReady || isCapturing}
                    aria-label="Chụp ảnh"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-indigo-700 shadow-xl transition hover:scale-105 disabled:cursor-wait disabled:opacity-60"
                  >
                    <Aperture size={22} />
                    {isCapturing ? 'Đang chụp...' : cameraReady ? 'Chụp ảnh' : 'Đang mở camera...'}
                  </button>
                  <button
                    onClick={stopCamera}
                    disabled={isCapturing}
                    className="min-h-12 rounded-full border border-white/40 bg-slate-950/65 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md disabled:opacity-50"
                  >
                    Đóng
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="camera-empty flex h-full w-full flex-col items-center justify-center px-8 text-center">
                  <div className="camera-icon"><Camera size={30} /></div>
                  <p className="mt-4 text-lg font-bold text-slate-900">Đưa văn bản vào khung hình</p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Ảnh rõ nét, đủ sáng sẽ cho kết quả chính xác nhất</p>
                </div>
                <div className="absolute inset-x-0 bottom-6 flex justify-center">
                  <button
                    onClick={startCamera}
                    className="primary-button"
                  >
                    <Camera size={20} />
                    Mở camera
                  </button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Upload */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">hoặc</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <button
              onClick={() => fallbackCameraInputRef.current?.click()}
              className="secondary-button w-full sm:w-auto"
            >
              <Camera size={20} />
              Chụp ảnh dự phòng
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="secondary-button w-full sm:w-auto"
            >
              <Upload size={20} />
              Chọn ảnh trong thư viện
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              ref={fallbackCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 sm:gap-4">
            <div className="trust-item"><Zap size={17} /><span>Xử lý nhanh</span></div>
            <div className="trust-item"><ShieldCheck size={17} /><span>Không lưu ảnh</span></div>
            <div className="trust-item"><Sparkles size={17} /><span>Dịch bằng AI</span></div>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div className="mx-auto max-w-3xl space-y-4 pt-8">
          <div className="surface-card rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {progress < 50 ? 'Đang đọc văn bản...' : progress < 80 ? 'AI đang dịch...' : 'Sắp hoàn tất...'}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">Vui lòng giữ ứng dụng đang mở · {Math.round(progress)}%</p>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="progress-fill h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <p className="font-bold">Không thể xử lý ảnh</p>
          <p className="mt-1 text-sm">{error}</p>
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
        <div className="mx-auto mt-4 max-w-4xl space-y-4 animate-fadeIn">
          <div className="flex items-end justify-between pb-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Kết quả bản dịch</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Ảnh của bạn đã sẵn sàng</h2>
            </div>
            <button onClick={resetAll} className="secondary-button hidden sm:flex">
              <RefreshCw size={17} /> Ảnh mới
            </button>
          </div>
          {/* Preview + overlay bản dịch đè lên đúng vị trí chữ gốc */}
          {image && (
            <div className="surface-card flex justify-center overflow-visible rounded-[1.5rem] p-2">
              <div className="relative inline-block max-w-full overflow-hidden rounded-[1.1rem]">
                {/* eslint-disable-next-line @next/next/no-img-element -- local base64 preview, not a remote asset to optimize */}
                <img
                  ref={previewImgRef}
                  src={image}
                  alt="Uploaded"
                  onLoad={updateOverlaySize}
                  className="max-h-[60vh] w-auto max-w-full"
                />
                {overlaySize && result.regions && result.translatedRegions &&
                  result.imageWidth && result.imageHeight &&
                  result.regions.length === result.translatedRegions.length &&
                  result.regions.map((region, idx) => {
                    const translated = result.translatedRegions![idx];
                    if (!translated || !translated.trim()) return null;

                    const scaleX = overlaySize.width / result.imageWidth!;
                    const scaleY = overlaySize.height / result.imageHeight!;
                    const left = region.bbox.x0 * scaleX;
                    const top = region.bbox.y0 * scaleY;
                    const width = (region.bbox.x1 - region.bbox.x0) * scaleX;
                    const height = (region.bbox.y1 - region.bbox.y0) * scaleY;

                    const isVertical = region.orientation === 'vertical';
                    // Dùng đúng bbox chữ gốc, tuyệt đối không nới ô sang vùng kế
                    // bên. Cỡ chữ co theo diện tích và độ dài bản dịch để vừa ô.
                    const lineHeightFactor = 1.05;
                    const usableWidth = Math.max(width - 2, 1);
                    const usableHeight = Math.max(height - 2, 1);
                    const areaFontSize = Math.sqrt(
                      (usableWidth * usableHeight) / Math.max(translated.length * 0.62, 1)
                    );
                    const directionLimit = isVertical
                      ? usableWidth * 0.72
                      : usableHeight / lineHeightFactor;
                    const fontSize = Math.max(4, Math.min(13, areaFontSize, directionLimit));

                    return (
                      <div
                        key={idx}
                        title={region.text}
                        className="absolute flex items-center justify-center text-center bg-white/90 dark:bg-slate-900/90 text-gray-900 dark:text-white ring-1 ring-blue-500/25 overflow-hidden px-px"
                        style={{
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${width}px`,
                          height: `${height}px`,
                          fontSize: `${fontSize}px`,
                          lineHeight: lineHeightFactor,
                          writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
                          textOrientation: isVertical ? 'mixed' : undefined,
                          zIndex: 1,
                        }}
                      >
                        <span className="whitespace-pre-wrap break-words">{translated}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Accuracy verification */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-card rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">Độ tin cậy OCR</span>
                <span className="text-sm font-bold text-emerald-600">
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.round(result.confidence * 100)}%` }}
                />
              </div>
            </div>
            {result.accuracy && (
              <div className="surface-card rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-500">Độ tương đồng bản dịch</span>
                  <span className={`text-sm font-bold ${result.accuracy.translation.reliable ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {Math.round(result.accuracy.translation.similarityScore * 100)}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Ước lượng bằng dịch vòng; nên đối chiếu khi điểm thấp.</p>
              </div>
            )}
          </div>
          {result.verificationWarning && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {result.verificationWarning}
            </p>
          )}

          {/* Script detection */}
          <div className="flex items-center gap-2 px-1">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              {result.detectedScript === 'simplified' ? '简体 Giản thể' :
               result.detectedScript === 'traditional' ? '繁體 Phồn thể' : 'Hỗn hợp'}
            </span>
            <span className="text-xs text-gray-400">
              {result.processingTime}ms
            </span>
          </div>

          {/* Original text */}
          <div className="surface-card rounded-[1.35rem] p-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-700">Văn bản gốc</h3>
              <button
                onClick={() => copyText(result.originalText)}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                <Copy size={16} className="text-gray-500" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-lg leading-8 text-slate-900">
              {result.originalText}
            </p>
          </div>

          {/* Translation */}
          <div className="translation-card rounded-[1.35rem] p-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-emerald-800">Bản dịch tiếng Việt</h3>
              <button
                onClick={() => copyText(result.translation)}
                className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-800/30 transition"
              >
                <Copy size={16} className="text-green-600 dark:text-green-400" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-lg font-medium leading-8 text-slate-900">
              {result.translation}
            </p>
          </div>

          {/* Segments */}
          {result.segments.length > 1 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Phân đoạn</h3>
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
          <div className="flex flex-col gap-3 sm:flex-row">
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
              className="secondary-button flex-1"
            >
              <Download size={18} />
              Tải xuống
            </button>
            <button
              onClick={resetAll}
              className="primary-button flex-1"
            >
              <RefreshCw size={18} />
              Dịch tiếp
            </button>
          </div>
        </div>
      )}

      {/* History sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-[#fbfcff] shadow-2xl animate-slideIn" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 p-5 backdrop-blur-xl">
              <div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Đã lưu</p><h2 className="text-xl font-black text-slate-950">Lịch sử dịch</h2></div>
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
                  <X size={19} />
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
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {copiedText && (
        <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
          <Check size={16} className="text-emerald-400" /> Đã sao chép
        </div>
      )}
    </div>
  );
}
