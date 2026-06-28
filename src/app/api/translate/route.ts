import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Tăng timeout cho API route
export const maxDuration = 60;

// Khởi tạo Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, target = 'vi', source = 'zh' } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Không có văn bản để dịch' },
        { status: 400 }
      );
    }

    // Nếu không có Gemini API key, dùng mock
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured, using mock translation');
      return NextResponse.json({
        translation: `[Mock] ${text}`,
        detectedScript: 'simplified',
        segments: [{ original: text, translated: `[Mock] ${text}` }],
      });
    }

    // Prompt engineering
    const prompt = buildTranslationPrompt(text, target);

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        topP: 0.95,
        topK: 40,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    // Parse JSON response
    let parsed;
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try to parse entire response
        parsed = JSON.parse(content);
      }
    } catch (parseError) {
      console.warn('Failed to parse Gemini response, using raw text:', content);
      parsed = {
        translation: content,
        script: 'simplified',
        segments: [{ original: text, translated: content }],
      };
    }

    return NextResponse.json({
      translation: parsed.translation || content,
      detectedScript: parsed.script || 'simplified',
      segments: parsed.segments || [{ original: text, translated: parsed.translation || content }],
      confidence: parsed.confidence || 0.9,
      provider: 'gemini',
    });

  } catch (error) {
    console.error('Translation Error:', error);
    return NextResponse.json(
      { error: 'Lỗi dịch thuật: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

// Build translation prompt
function buildTranslationPrompt(text: string, target: string): string {
  return `Bạn là một dịch giả chuyên nghiệp với 10 năm kinh nghiệm dịch tiếng Trung - Việt.

QUY TẮC:
1. Dịch chính xác, giữ nguyên ý nghĩa và ngữ cảnh
2. Thành ngữ: tìm thành ngữ tương đương trong tiếng Việt
3. Văn phong: tự nhiên, không máy móc
4. Phân biệt: biết cách tách các cụm từ khi văn bản lộn xộn
5. Chữ viết tay: đoán chữ nếu OCR sai

XỬ LÝ VĂN BẢN LỘN XỘN:
- Nếu văn bản có nhiều dòng lộn xộn, hãy sắp xếp theo logic
- Phát hiện các cụm từ liên quan và nhóm lại
- Bỏ qua các từ/cụm từ không liên quan

ĐẦU RA JSON:
{
  "translation": "Bản dịch hoàn chỉnh sang tiếng Việt",
  "script": "simplified | traditional | mixed",
  "segments": [
    {"original": "câu gốc", "translated": "câu dịch"}
  ],
  "confidence": 0.95,
  "notes": "Ghi chú thêm (nếu có)"
}

VĂN BẢN CẦN DỊCH:
${text}

NGÔN NGỮ ĐÍCH: ${target === 'vi' ? 'Tiếng Việt' : target === 'en' ? 'Tiếng Anh' : target}`;
}