import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

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

    console.log('📸 Bắt đầu xử lý OCR cho ảnh:', imageFile.name);

    // Chuyển đổi sang buffer
    const bytes = await imageFile.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // TIỀN XỬ LÝ ẢNH - QUAN TRỌNG!
    console.log('🔄 Đang tiền xử lý ảnh...');
    try {
      buffer = await sharp(buffer)
        .resize(1200, 1200, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .grayscale()        // Chuyển đen trắng
        .normalize()        // Cân bằng sáng
        .sharpen(2)         // Làm sắc nét
        .threshold(170)     // Tăng độ tương phản
        .toBuffer();
      console.log('✅ Tiền xử lý ảnh thành công');
    } catch (e) {
      console.warn('⚠️ Tiền xử lý thất bại, dùng ảnh gốc');
    }

    // TẠO WORKER VỚI ĐÚNG NGÔN NGỮ
    console.log('🔍 Đang chạy OCR với Tesseract.js...');
    
    // Tạo worker với ngôn ngữ Trung Quốc Giản thể
    const worker = await createWorker('chi_sim', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📝 OCR: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Cấu hình Tesseract
    await worker.setParameters({
      tessedit_pageseg_mode: '6',      // Auto segmentation
      tessedit_ocr_engine_mode: '3',   // LSTM + Legacy
      tessedit_char_whitelist: '中文字符abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789，。！？；：、（）',
    });

    // Chạy OCR
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    let text = data.text?.trim() || '';
    console.log(`📝 OCR hoàn tất, tìm thấy ${text.length} ký tự`);

    // Nếu kết quả quá ít hoặc toàn ký tự lạ, thử với chi_tra
    if (text.length < 20 || text.match(/[a-zA-Z]/g)?.length || 0 > text.length * 0.5) {
      console.log('🔄 Kết quả không tốt, thử với chi_tra (Phồn thể)...');
      const worker2 = await createWorker('chi_tra', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`📝 OCR (Phồn): ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      
      await worker2.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_ocr_engine_mode: '3',
      });
      
      const { data: data2 } = await worker2.recognize(buffer);
      await worker2.terminate();
      
      const text2 = data2.text?.trim() || '';
      if (text2.length > text.length) {
        text = text2;
        console.log(`✅ Dùng kết quả Phồn thể: ${text.length} ký tự`);
      }
    }

    // Nếu vẫn không có kết quả tốt, thử với cả 2
    if (text.length < 20) {
      console.log('🔄 Thử với cả Giản thể + Phồn thể...');
      const worker3 = await createWorker('chi_sim+chi_tra', 1);
      const { data: data3 } = await worker3.recognize(buffer);
      await worker3.terminate();
      
      const text3 = data3.text?.trim() || '';
      if (text3.length > text.length) {
        text = text3;
        console.log(`✅ Dùng kết quả kết hợp: ${text.length} ký tự`);
      }
    }

    // Nếu vẫn không có kết quả
    if (text.length === 0) {
      text = 'Không tìm thấy văn bản tiếng Trung trong ảnh. Vui lòng kiểm tra lại ảnh.';
    }

    // Phát hiện script
    const detectedScript = detectChineseScript(text);

    return NextResponse.json({
      text: text,
      confidence: data.confidence || 0.7,
      detectedScript: detectedScript,
      language: text.length > 20 ? 'chi_sim' : 'unknown',
    });

  } catch (error) {
    console.error('❌ OCR Error:', error);
    return NextResponse.json(
      { error: 'Lỗi xử lý OCR: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

function detectChineseScript(text: string): 'simplified' | 'traditional' | 'mixed' {
  if (!text || text.trim().length === 0) return 'simplified';

  const simplifiedChars = ['学', '国', '开', '关', '门', '问', '对', '说', '话', '书', '写', '爱', '亲', '边', '这', '还', '过', '来', '时', '间'];
  const traditionalChars = ['學', '國', '開', '關', '門', '問', '對', '說', '話', '書', '寫', '愛', '親', '邊', '這', '還', '過', '來', '時', '間'];

  let simplifiedCount = 0;
  let traditionalCount = 0;

  for (const char of text) {
    if (simplifiedChars.includes(char)) simplifiedCount++;
    if (traditionalChars.includes(char)) traditionalCount++;
  }

  if (simplifiedCount > traditionalCount * 2) return 'simplified';
  if (traditionalCount > simplifiedCount * 2) return 'traditional';
  if (simplifiedCount > 0 && traditionalCount > 0) return 'mixed';
  return 'simplified';
}