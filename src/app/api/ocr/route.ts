import { NextRequest, NextResponse } from 'next/server';
import { preprocessImage } from '@/lib/ocr/preprocessor';
import { performOCR } from '@/lib/ocr/tesseract';
import { LayoutAnalyzer } from '@/lib/ocr/layoutAnalyzer';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image');
    const analyzeLayout = formData.get('analyzeLayout') === 'true';

    if (!imageFile || typeof imageFile === 'string' || !('arrayBuffer' in imageFile)) {
      return NextResponse.json({ error: 'Không tìm thấy ảnh' }, { status: 400 });
    }

    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const processedBuffer = await preprocessImage(buffer, {
      maxWidth: 1400,
      maxHeight: 1400,
      grayscale: true,
      normalize: true,
      sharpen: true,
    });

    const ocrResult = await performOCR(processedBuffer, { language: 'chi_sim+chi_tra' });

    let layoutInfo = null;
    if (analyzeLayout && (ocrResult.wordBoxes?.length ?? 0) > 0) {
      const analyzer = new LayoutAnalyzer();
      const segments = (ocrResult.wordBoxes ?? []).map((word) => ({
        text: word.text,
        bbox: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0,
        },
        confidence: word.confidence,
      }));

      const analysis = analyzer.analyzeLayout(segments);
      if (analysis.layout !== 'simple') {
        ocrResult.text = analysis.text;
        layoutInfo = {
          layout: analysis.layout,
          columns: analysis.columns.length,
          groups: analysis.groups.length,
        };
      }
    }

    return NextResponse.json({
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      detectedScript: ocrResult.detectedScript,
      layout: layoutInfo,
      wordBoxes: ocrResult.wordBoxes ?? [],
    });
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { error: 'Lỗi OCR: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    );
  }
}