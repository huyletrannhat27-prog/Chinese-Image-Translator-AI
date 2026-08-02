import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { OCRResult } from '@/types';

// Cho phép override đường dẫn python (vd. venv riêng) qua .env, mặc định
// dùng python3 có sẵn trên PATH của server.
const PYTHON_BIN = process.env.PADDLE_OCR_PYTHON_BIN || 'python3';
const SCRIPT_PATH = join(process.cwd(), 'scripts', 'paddle_ocr.py');
// Mỗi lần gọi runPaddleOcr() sẽ spawn 1 tiến trình Python MỚI (import
// paddle/paddleocr từ đầu, dù model đã cache trên đĩa) - trên Windows/CPU
// việc này có thể mất hơn 30s, nên để timeout rộng rãi hơn hẳn thời gian
// inference thực tế để tránh bị huỷ giữa chừng.
const OCR_TIMEOUT_MS = 90_000;

export class PaddleOCRError extends Error {}

/**
 * Chạy PaddleOCR (self-host, xem _docs/04_ocr_tools.md mục PaddleOCR) trên
 * một buffer ảnh ĐÃ CHUẨN HOÁ (rotate/resize/nén JPEG ở route gọi hàm này,
 * cùng cách làm với vision.ts) và trả về kết quả theo đúng type OCRResult.
 *
 * PaddleOCR là mô hình Python, chưa có binding Node ổn định nên gọi qua
 * child_process thay vì import trực tiếp vào tiến trình Next.js.
 */
export async function runPaddleOcr(
  imageBuffer: Buffer,
  options: { lang?: string } = {}
): Promise<OCRResult> {
  const tempPath = join(tmpdir(), `paddle-ocr-${randomUUID()}.jpg`);
  await writeFile(tempPath, imageBuffer);

  try {
    const stdout = await runPythonScript(tempPath, options.lang);
    return parsePaddleOutput(stdout);
  } finally {
    // Luôn dọn file tạm dù thành công hay lỗi.
    await unlink(tempPath).catch(() => {});
  }
}

function runPythonScript(imagePath: string, lang = 'ch'): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [SCRIPT_PATH, imagePath, '--lang', lang], {
      // Ép UTF-8 ở tầng environment luôn, phòng khi sys.stdout.reconfigure()
      // trong script không đủ (vd. Python cũ hơn 3.7) - xem ghi chú trong
      // scripts/paddle_ocr.py.
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new PaddleOCRError('PaddleOCR quá thời gian chờ (timeout)'));
    }, OCR_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new PaddleOCRError(
          `Không chạy được PaddleOCR (đã cài python3 + scripts/requirements-ocr.txt chưa?): ${err.message}`
        )
      );
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new PaddleOCRError(stderr.trim() || `PaddleOCR thoát với mã lỗi ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function parsePaddleOutput(stdout: string): OCRResult {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new PaddleOCRError('PaddleOCR không trả về dữ liệu nào');
  }

  let parsed: {
    error?: string;
    text?: string;
    confidence?: number;
    detectedScript?: string;
    language?: string;
    wordBoxes?: OCRResult['wordBoxes'];
    imageWidth?: number;
    imageHeight?: number;
  };

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new PaddleOCRError('Không đọc được JSON trả về từ PaddleOCR');
  }

  if (parsed.error) {
    throw new PaddleOCRError(parsed.error);
  }

  return {
    text: String(parsed.text || ''),
    confidence: Number(parsed.confidence) || 0,
    detectedScript:
      parsed.detectedScript === 'traditional' || parsed.detectedScript === 'mixed'
        ? parsed.detectedScript
        : 'simplified',
    language: parsed.language || 'zh',
    wordBoxes: Array.isArray(parsed.wordBoxes) ? parsed.wordBoxes : [],
    imageWidth: parsed.imageWidth,
    imageHeight: parsed.imageHeight,
  };
}
