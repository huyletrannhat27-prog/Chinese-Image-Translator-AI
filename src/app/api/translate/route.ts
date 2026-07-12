import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// Từ điển Trung - Việt (MỞ RỘNG CHO VĂN BẢN PHẬT GIÁO)
const DICT: Record<string, string> = {
  // Phật giáo - quan trọng
  '如本法師': 'Như Bản Pháp Sư',
  '出三界': 'Ra Tam Giới',
  '之苦門': 'Cửa Khổ',
  '入無為': 'Vào Vô Vi',
  '之勝路': 'Đường Thắng',
  '者即是佛心': 'Tức Là Phật Tâm',
  '其餘善': 'Còn Lại Thiện',
  '不得為喻': 'Không Thể Làm Ví',
  '能成佛': 'Có Thể Thành Phật',
  '終無是處': 'Rốt Cuộc Không Đúng',
  '伏見經云': 'Kinh Nói',
  '發菩提心': 'Phát Bồ Đề Tâm',
  '欲得佛': 'Muốn Được Phật',
  '必發過菩提心': 'Phải Phát Bồ Đề Tâm',
  '不發菩提心': 'Không Phát Bồ Đề Tâm',
  '意思': 'Ý Nghĩa',
  '菩提心是覺悟之心': 'Bồ Đề Tâm Là Tâm Giác Ngộ',
  '佛弟子若欲成': 'Phật Tử Nếu Muốn Thành',
  '發菩提心就是發成佛之心': 'Phát Bồ Đề Tâm Là Phát Tâm Thành Phật',
  '菩提是覺悟的': 'Bồ Đề Là Giác Ngộ',
  
  // Phật giáo từng từ
  '佛': 'Phật',
  '法': 'Pháp',
  '僧': 'Tăng',
  '菩提': 'Bồ Đề',
  '觉悟': 'Giác Ngộ',
  '如来': 'Như Lai',
  '菩萨': 'Bồ Tát',
  '经文': 'Kinh Văn',
  '禅': 'Thiền',
  '心': 'Tâm',
  '无': 'Vô',
  '空': 'Không',
  '色': 'Sắc',
  '相': 'Tướng',
  '行': 'Hành',
  '识': 'Thức',
  '念': 'Niệm',
  '定': 'Định',
  '慧': 'Tuệ',
  '戒': 'Giới',
  '界': 'Giới',
  '苦': 'Khổ',
  '道': 'Đạo',
  '果': 'Quả',
  '因': 'Nhân',
  '缘': 'Duyên',
  '生': 'Sinh',
  '死': 'Tử',
  '灭': 'Diệt',
  
  // Cơ bản
  '中': 'Trung',
  '国': 'Quốc',
  '人': 'Nhân',
  '民': 'Dân',
  '天': 'Thiên',
  '地': 'Địa',
  '日': 'Nhật',
  '月': 'Nguyệt',
  '明': 'Minh',
  '是': 'Là',
  '能': 'Có Thể',
  '得': 'Được',
  '成': 'Thành',
  '发': 'Phát',
  '若': 'Như',
  '提': 'Đề',
  '子': 'Tử',
  '弟': 'Đệ',
  '师': 'Sư',
  '如': 'Như',
  '本': 'Bản',
  '为': 'Vì',
  '喻': 'Ví Dụ',
  '出': 'Ra',
  '入': 'Vào',
  '之': 'Của',
  '者': 'Người',
  '即': 'Tức',
  '餘': 'Còn',
  '善': 'Thiện',
  '終': 'Rốt',
  '處': 'Chỗ',
  '伏': 'Phục',
  '見': 'Thấy',
  '經': 'Kinh',
  '云': 'Nói',
  '欲': 'Muốn',
  '過': 'Qua',
  '義': 'Nghĩa',
  '覺': 'Giác',
  '悟': 'Ngộ',
  '弟': 'Đệ',
  '若': 'Nếu',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, target = 'vi' } = body;

    console.log('📝 Nhận yêu cầu dịch:', { text: text?.substring(0, 50), target });

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Không có văn bản để dịch' },
        { status: 400 }
      );
    }

    // DỊCH TỪ ĐIỂN - Ưu tiên cụm từ dài trước
    let translated = text;
    const sortedKeys = Object.keys(DICT).sort((a, b) => b.length - a.length);
    
    for (const zh of sortedKeys) {
      const vi = DICT[zh];
      translated = translated.replace(new RegExp(zh, 'g'), vi);
    }

    // Xóa ký tự thừa
    translated = translated.replace(/[,\n]/g, ' ').replace(/\s+/g, ' ').trim();

    // Nếu không có từ nào được dịch
    if (translated === text || translated.trim().length === 0) {
      translated = `[Chưa dịch được] ${text}`;
    }

    console.log('✅ Kết quả dịch:', translated);

    return NextResponse.json({
      translation: translated,
      detectedScript: detectChineseScript(text),
      segments: [{ original: text, translated: translated }],
      confidence: 0.6,
      provider: 'dictionary',
    });

  } catch (error) {
    console.error('❌ Translation Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        translation: text || '',
        detectedScript: 'simplified',
        segments: [{ original: text || '', translated: text || '' }],
        confidence: 0,
        provider: 'error',
      },
      { status: 500 }
    );
  }
}

function detectChineseScript(text: string): 'simplified' | 'traditional' | 'mixed' {
  if (!text) return 'simplified';
  const simplified = ['学', '国', '开'];
  const traditional = ['學', '國', '開'];
  let s = 0, t = 0;
  for (const char of text) {
    if (simplified.includes(char)) s++;
    if (traditional.includes(char)) t++;
  }
  if (s > t * 2) return 'simplified';
  if (t > s * 2) return 'traditional';
  return s > 0 && t > 0 ? 'mixed' : 'simplified';
}