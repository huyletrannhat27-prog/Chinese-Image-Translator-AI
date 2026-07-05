import { NextRequest, NextResponse } from 'next/server';
import { preprocessImage } from '@/lib/ocr/preprocessor';
import { performOCR } from '@/lib/ocr/tesseract';

// Endpoint OCR "trực tiếp" chỉ dùng chi_sim, hữu ích khi muốn ép nhận diện giản thể.
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

    const bytes = await imageFile.arrayBuffer();
    let buffer = Buffer.from(bytes);

    try {
      buffer = Buffer.from(await preprocessImage(buffer));
    } catch (e) {
      console.warn('Preprocess failed, using original image:', e);
    }

    let result = await performOCR(buffer, { language: 'chi_sim' });

    // Nếu không ra chữ nào, thử lại với phồn thể
    if (!result.text || result.text.trim().length === 0) {
      result = await performOCR(buffer, { language: 'chi_tra' });
    }

    return NextResponse.json({
      text: result.text.trim(),
      confidence: result.confidence / 100,
      detectedScript: result.detectedScript,
      language: result.text.length > 0 ? 'chi_sim' : 'unknown',
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Lỗi OCR: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    );
  }
}
