import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { PSM } from 'tesseract.js';
import { preprocessImage } from '@/lib/ocr/preprocessor';
import { performOCR } from '@/lib/ocr/tesseract';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Không tìm thấy ảnh' },
        { status: 400 }
      );
    }

    // Convert to buffer
    const bytes = await imageFile.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // Preprocess (resize, grayscale, normalize, denoise, sharpen)
    try {
      buffer = Buffer.from(await preprocessImage(buffer));
    } catch (e) {
      console.warn('Preprocess failed, using original image:', e);
    }

    const invertedBuffer = await sharp(buffer).negate().toBuffer().catch(() => null);

    // Ảnh chụp thực tế (biển hiệu giữa nền phức tạp, ảnh chỉ tối cục bộ 1 vùng...)
    // dễ khiến OCR ra rỗng nếu chỉ thử đúng 1 kiểu. Thử lần lượt vài tổ hợp
    // PSM (chế độ phân tích bố cục) + màu (thường/đảo) cho tới khi ra được chữ:
    // - SPARSE_TEXT: tìm chữ rải rác bất kỳ đâu, hợp với ảnh chụp biển hiệu/vật thể
    // - AUTO: giả định bố cục kiểu trang tài liệu, hợp với ảnh chụp văn bản rõ ràng
    const attempts: Array<{ buffer: Buffer; psm: PSM }> = [
      { buffer, psm: PSM.SPARSE_TEXT },
      ...(invertedBuffer ? [{ buffer: invertedBuffer, psm: PSM.SPARSE_TEXT }] : []),
      { buffer, psm: PSM.AUTO },
      ...(invertedBuffer ? [{ buffer: invertedBuffer, psm: PSM.AUTO }] : []),
    ];

    let result = await performOCR(attempts[0].buffer, {
      language: 'chi_sim+chi_tra+eng',
      psm: attempts[0].psm,
    });

    for (let i = 1; i < attempts.length && (!result.text || result.text.trim().length === 0); i++) {
      try {
        result = await performOCR(attempts[i].buffer, {
          language: 'chi_sim+chi_tra+eng',
          psm: attempts[i].psm,
        });
      } catch (e) {
        console.warn(`OCR attempt ${i} failed:`, e);
      }
    }

    if (!result.text || result.text.trim().length === 0) {
      return NextResponse.json({
        text: '',
        confidence: 0,
        detectedScript: 'simplified',
        language: 'unknown',
      });
    }

    return NextResponse.json({
      text: result.text.trim(),
      confidence: result.confidence / 100,
      detectedScript: result.detectedScript,
      language: 'chi_sim+chi_tra+eng',
      wordBoxes: result.wordBoxes,
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Lỗi OCR: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
