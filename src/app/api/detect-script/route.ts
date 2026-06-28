import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Không có văn bản' },
        { status: 400 }
      );
    }

    const script = detectChineseScript(text);

    return NextResponse.json({
      script,
      confidence: 0.95,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Phát hiện script thất bại' },
      { status: 500 }
    );
  }
}

function detectChineseScript(text: string): 'simplified' | 'traditional' | 'mixed' {
  if (!text || text.trim().length === 0) return 'simplified';

  // Common simplified vs traditional characters
  const simplifiedSet = new Set([
    '学', '国', '开', '关', '门', '问', '对', '说', '话', '书', '写', '爱', '亲', '边', '这',
    '还', '过', '来', '时', '间', '长', '马', '鸟', '鱼', '龙', '风', '电', '东', '南', '西',
    '北', '上', '下', '左', '右', '前', '后', '内', '外', '大', '小', '多', '少', '高', '低',
    '见', '贝', '车', '红', '绿', '蓝', '黄', '白', '黑', '金', '银', '铜', '铁', '钢', '铝',
    '锌', '锡', '铅', '汞', '银', '铜', '铁', '钢', '铝', '锌', '锡', '铅', '汞'
  ]);

  const traditionalSet = new Set([
    '學', '國', '開', '關', '門', '問', '對', '說', '話', '書', '寫', '愛', '親', '邊', '這',
    '還', '過', '來', '時', '間', '長', '馬', '鳥', '魚', '龍', '風', '電', '東', '南', '西',
    '北', '上', '下', '左', '右', '前', '後', '內', '外', '大', '小', '多', '少', '高', '低',
    '見', '貝', '車', '紅', '綠', '藍', '黃', '白', '黑', '金', '銀', '銅', '鐵', '鋼', '鋁',
    '鋅', '錫', '鉛', '汞', '銀', '銅', '鐵', '鋼', '鋁', '鋅', '錫', '鉛', '汞'
  ]);

  let simplifiedCount = 0;
  let traditionalCount = 0;

  for (const char of text) {
    if (simplifiedSet.has(char)) simplifiedCount++;
    if (traditionalSet.has(char)) traditionalCount++;
  }

  const total = simplifiedCount + traditionalCount;
  if (total === 0) return 'simplified';

  const ratio = simplifiedCount / total;
  if (ratio > 0.7) return 'simplified';
  if (ratio < 0.3) return 'traditional';
  return 'mixed';
}