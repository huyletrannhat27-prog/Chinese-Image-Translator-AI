import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { OCRResult } from '@/types';

// Cho phép override đường dẫn python (vd. venv riêng) qua .env, mặc định
// dùng python3 có sẵn trên PATH của server.
const PYTHON_BIN_CANDIDATES = process.env.PADDLE_OCR_PYTHON_BIN
  ? [process.env.PADDLE_OCR_PYTHON_BIN]
  : process.platform === 'win32'
  ? ['python', 'python3']
  : ['python3', 'python'];
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
  const tempPath = join(
    /* turbopackIgnore: true */ tmpdir(),
    `paddle-ocr-${randomUUID()}.jpg`
  );
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
  let lastError: Error | null = null;

  return new Promise(async (resolve, reject) => {
    for (const pythonBin of PYTHON_BIN_CANDIDATES) {
      try {
        const result = await runPythonBin(pythonBin, imagePath, lang);
        resolve(result);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    reject(
      new PaddleOCRError(
        lastError?.message ||
          'Không chạy được PaddleOCR. Kiểm tra python và scripts/requirements-ocr.txt.'
      )
    );
  });
}

function runPythonBin(pythonBin: string, imagePath: string, lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [SCRIPT_PATH, imagePath, '--lang', lang], {
      cwd: process.cwd(),
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
      reject(err instanceof Error ? err : new Error(String(err)));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve(stdout);
        return;
      }

      const stderrTrim = stderr.trim();
      const jsonMatch = stderrTrim.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.error) {
            reject(new PaddleOCRError(String(parsed.error)));
            return;
          }
        } catch {
          // ignore parse error and continue
        }
      }

      reject(new PaddleOCRError(stderrTrim || `PaddleOCR thoát với mã lỗi ${code}`));
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
    regions?: OCRResult['regions'];
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
    regions: Array.isArray(parsed.regions) ? parsed.regions : undefined,
    imageWidth: parsed.imageWidth,
    imageHeight: parsed.imageHeight,
  };
}
