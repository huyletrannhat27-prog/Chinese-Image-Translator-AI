export interface TextSegment {
  text: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface TextColumn {
  segments: TextSegment[];
  x: number;
  width: number;
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
  // Detect text columns based on horizontal position
  detectColumns(segments: TextSegment[], threshold: number = 100): TextColumn[] {
    if (segments.length === 0) return [];

    // Sort by x position
    const sorted = [...segments].sort((a, b) => a.bbox.x - b.bbox.x);

    const columns: TextColumn[] = [];
    let currentColumn: TextColumn = {
      segments: [sorted[0]],
      x: sorted[0].bbox.x,
      width: sorted[0].bbox.width,
    };

    for (let i = 1; i < sorted.length; i++) {
      const segment = sorted[i];
      const gap = segment.bbox.x - (currentColumn.x + currentColumn.width);

      if (gap > threshold) {
        // New column
        columns.push(currentColumn);
        currentColumn = {
          segments: [segment],
          x: segment.bbox.x,
          width: segment.bbox.width,
        };
      } else {
        currentColumn.segments.push(segment);
        currentColumn.width = Math.max(
          currentColumn.width,
          segment.bbox.x + segment.bbox.width - currentColumn.x
        );
      }
    }

    columns.push(currentColumn);
    return columns;
  }

  // Group text segments into phrases
  groupPhrases(segments: TextSegment[], maxGap: number = 50): TextGroup[] {
    if (segments.length === 0) return [];

    // Sort by y position (top to bottom)
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

      if (gap > maxGap) {
        // New group
        groups.push(currentGroup);
        currentGroup = {
          segments: [segment],
          text: segment.text,
          bbox: { ...segment.bbox },
        };
      } else {
        currentGroup.segments.push(segment);
        currentGroup.text += ' ' + segment.text;
        currentGroup.bbox = {
          x: Math.min(currentGroup.bbox.x, segment.bbox.x),
          y: Math.min(currentGroup.bbox.y, segment.bbox.y),
          width: Math.max(
            currentGroup.bbox.x + currentGroup.bbox.width,
            segment.bbox.x + segment.bbox.width
          ) - Math.min(currentGroup.bbox.x, segment.bbox.x),
          height: Math.max(
            currentGroup.bbox.y + currentGroup.bbox.height,
            segment.bbox.y + segment.bbox.height
          ) - Math.min(currentGroup.bbox.y, segment.bbox.y),
        };
      }
    }

    groups.push(currentGroup);
    return groups;
  }

  // Sort text segments in reading order
  sortByReadingOrder(segments: TextSegment[]): TextSegment[] {
    // Detect columns first
    const columns = this.detectColumns(segments);

    // For each column, sort by y position
    const sortedSegments: TextSegment[] = [];
    for (const column of columns) {
      const sorted = [...column.segments].sort((a, b) => a.bbox.y - b.bbox.y);
      sortedSegments.push(...sorted);
    }

    return sortedSegments;
  }

  // Analyze layout and extract structured text
  analyzeLayout(segments: TextSegment[]): {
    groups: TextGroup[];
    columns: TextColumn[];
    text: string;
  } {
    const sorted = this.sortByReadingOrder(segments);
    const columns = this.detectColumns(sorted);
    const groups = this.groupPhrases(sorted);

    // Build full text
    const text = groups.map((g) => g.text).join('\n');

    return { groups, columns, text };
  }
}