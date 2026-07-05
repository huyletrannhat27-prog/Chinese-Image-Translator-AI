import { NextRequest, NextResponse } from 'next/server';
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

    // OCR (thử cả giản thể + phồn thể cùng lúc)
    const result = await performOCR(buffer, { language: 'chi_sim+chi_tra' });

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
      language: 'chi_sim+chi_tra',
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
