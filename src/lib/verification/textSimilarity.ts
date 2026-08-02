/**
 * Chỉ giữ lại các ký tự chữ Hán (CJK Unified Ideographs), bỏ hết chữ Latin,
 * số, dấu câu, khoảng trắng.
 *
 * Dùng trước khi so sánh back-translation (accuracy.ts): nhiều ảnh (bìa
 * sách, banner...) trộn cả chữ Trung và chữ Latin (tên tác giả tiếng Anh,
 * mã sản phẩm, watermark...). Khi dịch ngược, phần Latin đó tự nhiên được
 * dịch/diễn đạt lại thành tiếng Trung khác với bản gốc (vì bản gốc phần đó
 * còn không phải chữ Trung) - so sánh y nguyên cả đoạn sẽ đánh giá sai lệch,
 * hạ điểm similarity dù bản dịch chữ Trung thực tế rất chính xác. Giữ lại
 * riêng phần chữ Hán giúp so sánh đúng vào phần thực sự cần kiểm tra.
 */
export function extractHanCharacters(text: string): string {
  const matches = text.match(/[\u4e00-\u9fff]/g);
  return matches ? matches.join('') : '';
}

/**
 * Độ tương đồng văn bản theo hệ số Dice trên bigram ký tự (character bigram).
 * Không cần thư viện ngoài hay tách từ (word segmentation) - phù hợp với
 * tiếng Trung vì chữ Trung không có khoảng trắng ngăn từ như tiếng Việt/Anh.
 *
 * Trả về giá trị trong khoảng [0, 1], càng gần 1 càng giống nhau.
 * Dùng để so sánh text OCR gốc với bản dịch ngược (back-translation) -
 * xem _docs/08_accuracy_verification.md.
 */
export function bigramDiceSimilarity(a: string, b: string): number {
  const normalized = (s: string) => s.replace(/\s+/g, '').trim();
  const normA = normalized(a);
  const normB = normalized(b);

  if (!normA && !normB) return 1;
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const bigrams = toBigramCounts(normA);
  const bigramsOther = toBigramCounts(normB);

  let intersection = 0;
  for (const [pair, count] of bigrams) {
    const otherCount = bigramsOther.get(pair);
    if (otherCount) intersection += Math.min(count, otherCount);
  }

  const totalA = sumCounts(bigrams);
  const totalB = sumCounts(bigramsOther);
  if (totalA + totalB === 0) return 0;

  return (2 * intersection) / (totalA + totalB);
}

function toBigramCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();

  // Chuỗi 1 ký tự thì không tạo được bigram - dùng chính ký tự đó để tránh
  // trả về similarity = 0 một cách không công bằng với văn bản rất ngắn.
  if (text.length < 2) {
    counts.set(text, 1);
    return counts;
  }

  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) || 0) + 1);
  }
  return counts;
}

function sumCounts(counts: Map<string, number>): number {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}
