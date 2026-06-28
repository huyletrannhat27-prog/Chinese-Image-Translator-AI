import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

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

    // Preprocess
    try {
      buffer = await sharp(buffer)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();
    } catch (e) {
      console.warn('Preprocess failed, using original');
    }

    // OCR with Tesseract
    const worker = await createWorker('chi_sim', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    let text = data.text?.trim() || '';

    // If no text, try with traditional
    if (text.length === 0) {
      const worker2 = await createWorker('chi_tra', 1);
      const { data: data2 } = await worker2.recognize(buffer);
      await worker2.terminate();
      text = data2.text?.trim() || '';
    }

    return NextResponse.json({
      text,
      confidence: data.confidence || 0.8,
      detectedScript: detectChineseScript(text),
      language: text.length > 0 ? 'chi_sim' : 'unknown',
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Lỗi OCR: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    );
  }
}

function detectChineseScript(text: string): 'simplified' | 'traditional' | 'mixed' {
  if (!text) return 'simplified';
  const simplified = ['学', '国', '开', '关', '门', '问', '对', '说', '话', '书', '写'];
  const traditional = ['學', '國', '開', '關', '門', '問', '對', '說', '話', '書', '寫'];
  let s = 0,
    t = 0;
  for (const char of text) {
    if (simplified.includes(char)) s++;
    if (traditional.includes(char)) t++;
  }
  if (s > t * 2) return 'simplified';
  if (t > s * 2) return 'traditional';
  return s > 0 && t > 0 ? 'mixed' : 'simplified';
}