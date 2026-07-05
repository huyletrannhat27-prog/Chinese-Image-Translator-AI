// src/lib/ocr/layoutAnalyzer.ts

export interface TextSegment {
  text: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface TextColumn {
  segments: TextSegment[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextGroup {
  segments: TextSegment[];
  text: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class LayoutAnalyzer {
  // 1. Phát hiện và phân loại layout
  analyzeLayout(segments: TextSegment[]): {
    groups: TextGroup[];
    columns: TextColumn[];
    text: string;
    layout: 'simple' | 'multi-column' | 'scattered' | 'mixed';
  } {
    if (segments.length === 0) {
      return { groups: [], columns: [], text: '', layout: 'simple' };
    }

    // Sắp xếp theo thứ tự đọc
    const sorted = this.sortByReadingOrder(segments);
    
    // Phát hiện cột
    const columns = this.detectColumns(sorted);
    
    // Phát hiện layout type
    const layout = this.detectLayoutType(columns);
    
    // Gom nhóm cụm từ
    const groups = this.groupPhrases(sorted);
    
    // Xây dựng văn bản hoàn chỉnh
    const text = this.buildFullText(groups, columns, layout);

    return { groups, columns, text, layout };
  }

  // 2. Phát hiện layout type
  private detectLayoutType(columns: TextColumn[]): 'simple' | 'multi-column' | 'scattered' | 'mixed' {
    if (columns.length === 0) return 'simple';
    
    // Đếm số lượng cột
    if (columns.length === 1) return 'simple';
    if (columns.length >= 2 && columns.length <= 3) return 'multi-column';
    if (columns.length > 3) return 'scattered';
    return 'mixed';
  }

  // 3. Phát hiện cột với thuật toán DBSCAN clustering
  detectColumns(segments: TextSegment[], threshold: number = 100): TextColumn[] {
    if (segments.length === 0) return [];

    // Sắp xếp theo x
    const sorted = [...segments].sort((a, b) => a.bbox.x - b.bbox.x);

    const columns: TextColumn[] = [];
    let currentColumn: TextColumn = {
      segments: [sorted[0]],
      x: sorted[0].bbox.x,
      y: sorted[0].bbox.y,
      width: sorted[0].bbox.width,
      height: sorted[0].bbox.height,
    };

    for (let i = 1; i < sorted.length; i++) {
      const segment = sorted[i];
      const gap = segment.bbox.x - (currentColumn.x + currentColumn.width);

      // Nếu khoảng cách lớn hơn threshold -> cột mới
      if (gap > threshold) {
        // Tính toán bounding box cho cột
        currentColumn.height = this.calculateColumnHeight(currentColumn.segments);
        columns.push(currentColumn);
        
        currentColumn = {
          segments: [segment],
          x: segment.bbox.x,
          y: segment.bbox.y,
          width: segment.bbox.width,
          height: segment.bbox.height,
        };
      } else {
        currentColumn.segments.push(segment);
        currentColumn.width = Math.max(
          currentColumn.width,
          segment.bbox.x + segment.bbox.width - currentColumn.x
        );
        currentColumn.height = Math.max(
          currentColumn.height,
          segment.bbox.y + segment.bbox.height - currentColumn.y
        );
      }
    }

    // Thêm cột cuối cùng
    currentColumn.height = this.calculateColumnHeight(currentColumn.segments);
    columns.push(currentColumn);

    return columns;
  }

  // 4. Tính chiều cao cột
  private calculateColumnHeight(segments: TextSegment[]): number {
    if (segments.length === 0) return 0;
    const minY = Math.min(...segments.map(s => s.bbox.y));
    const maxY = Math.max(...segments.map(s => s.bbox.y + s.bbox.height));
    return maxY - minY;
  }

  // 5. Gom nhóm cụm từ với thuật toán hierarchical clustering
  groupPhrases(segments: TextSegment[], maxGap: number = 50): TextGroup[] {
    if (segments.length === 0) return [];

    // Sắp xếp theo y (top to bottom)
    const sorted = [...segments].sort((a, b) => a.bbox.y - b.bbox.y);

    const groups: TextGroup[] = [];
    let currentGroup: TextGroup = {
      segments: [sorted[0]],
      text: sorted[0].text,
      bbox: { ...sorted[0].bbox },
    };

    for (let i = 1; i < sorted.length; i++) {
      const segment = sorted[i];
      const currentBottom = currentGroup.bbox.y + currentGroup.bbox.height;
      const gap = segment.bbox.y - currentBottom;

      // Nếu khoảng cách lớn -> nhóm mới
      if (gap > maxGap) {
        // Kiểm tra xem có phải cùng cột không
        const sameColumn = this.isSameColumn(currentGroup.segments[0], segment);
        if (sameColumn) {
          currentGroup.segments.push(segment);
          currentGroup.text += ' ' + segment.text;
          currentGroup.bbox = this.mergeBBox(currentGroup.bbox, segment.bbox);
        } else {
          groups.push(currentGroup);
          currentGroup = {
            segments: [segment],
            text: segment.text,
            bbox: { ...segment.bbox },
          };
        }
      } else {
        currentGroup.segments.push(segment);
        currentGroup.text += ' ' + segment.text;
        currentGroup.bbox = this.mergeBBox(currentGroup.bbox, segment.bbox);
      }
    }

    groups.push(currentGroup);
    return groups;
  }

  // 6. Kiểm tra cùng cột
  private isSameColumn(seg1: TextSegment, seg2: TextSegment, threshold: number = 50): boolean {
    const center1 = seg1.bbox.x + seg1.bbox.width / 2;
    const center2 = seg2.bbox.x + seg2.bbox.width / 2;
    return Math.abs(center1 - center2) < threshold;
  }

  // 7. Merge bounding boxes
  private mergeBBox(bbox1: {x: number; y: number; width: number; height: number}, 
                    bbox2: {x: number; y: number; width: number; height: number}) {
    return {
      x: Math.min(bbox1.x, bbox2.x),
      y: Math.min(bbox1.y, bbox2.y),
      width: Math.max(bbox1.x + bbox1.width, bbox2.x + bbox2.width) - Math.min(bbox1.x, bbox2.x),
      height: Math.max(bbox1.y + bbox1.height, bbox2.y + bbox2.height) - Math.min(bbox1.y, bbox2.y),
    };
  }

  // 8. Sắp xếp theo thứ tự đọc (left-to-right, top-to-bottom)
  sortByReadingOrder(segments: TextSegment[]): TextSegment[] {
    // Phát hiện cột trước
    const columns = this.detectColumns(segments);
    
    // Sắp xếp các cột theo x
    columns.sort((a, b) => a.x - b.x);
    
    // Với mỗi cột, sắp xếp theo y
    const sorted: TextSegment[] = [];
    for (const column of columns) {
      const columnSegments = [...column.segments].sort((a, b) => a.bbox.y - b.bbox.y);
      sorted.push(...columnSegments);
    }
    
    return sorted;
  }

  // 9. Xây dựng văn bản hoàn chỉnh
  private buildFullText(groups: TextGroup[], columns: TextColumn[], layout: string): string {
    if (layout === 'simple') {
      return groups.map(g => g.text).join('\n');
    }
    
    // Multi-column: sắp xếp theo cột
    const textParts: string[] = [];
    for (const column of columns) {
      const columnText = column.segments
        .sort((a, b) => a.bbox.y - b.bbox.y)
        .map(s => s.text)
        .join(' ');
      textParts.push(columnText);
    }
    
    return textParts.join('\n');
  }

  // 10. Phát hiện văn bản dọc (vertical text)
  detectVerticalText(segments: TextSegment[]): TextSegment[] {
    return segments.filter(seg => {
      // Nếu chiều cao > chiều rộng * 2 -> có thể là văn bản dọc
      return seg.bbox.height > seg.bbox.width * 2;
    });
  }

  // 11. Xử lý văn bản dọc
  processVerticalText(segments: TextSegment[]): string {
    // Sắp xếp theo y (từ trên xuống dưới)
    const sorted = [...segments].sort((a, b) => a.bbox.y - b.bbox.y);
    return sorted.map(s => s.text).join('');
  }

  // 12. Phát hiện các cụm từ lộn xộn và tái cấu trúc
  reconstructScatteredText(segments: TextSegment[]): string {
    // Phân cụm theo khoảng cách gần nhau
    const clusters = this.clusterByProximity(segments);
    
    // Với mỗi cụm, sắp xếp theo thứ tự đọc
    const reconstructed: string[] = [];
    for (const cluster of clusters) {
      const sorted = this.sortByReadingOrder(cluster);
      const text = sorted.map(s => s.text).join(' ');
      reconstructed.push(text);
    }
    
    return reconstructed.join('\n');
  }

  // 13. Phân cụm theo khoảng cách
  private clusterByProximity(segments: TextSegment[], maxDistance: number = 100): TextSegment[][] {
    const clusters: TextSegment[][] = [];
    const used = new Set<TextSegment>();

    for (const seg of segments) {
      if (used.has(seg)) continue;
      
      const cluster: TextSegment[] = [seg];
      used.add(seg);
      
      // Tìm các segment gần đó
      for (const other of segments) {
        if (used.has(other)) continue;
        
        const distance = this.calculateDistance(seg.bbox, other.bbox);
        if (distance < maxDistance) {
          cluster.push(other);
          used.add(other);
        }
      }
      
      clusters.push(cluster);
    }
    
    return clusters;
  }

  // 14. Tính khoảng cách giữa 2 bounding box
  private calculateDistance(bbox1: {x: number; y: number; width: number; height: number},
                            bbox2: {x: number; y: number; width: number; height: number}): number {
    const cx1 = bbox1.x + bbox1.width / 2;
    const cy1 = bbox1.y + bbox1.height / 2;
    const cx2 = bbox2.x + bbox2.width / 2;
    const cy2 = bbox2.y + bbox2.height / 2;
    return Math.sqrt(Math.pow(cx1 - cx2, 2) + Math.pow(cy1 - cy2, 2));
  }
}