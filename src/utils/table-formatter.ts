/**
 * Markdown Table Formatter and Navigation Utility
 */

export type TablePipeAlignment = 'aligned' | 'compact';

/**
 * Calculate visual display width of a string considering East Asian Width and Unicode code points.
 * Full-width characters (Hiragana, Katakana, CJK Ideographs, full-width punctuation/ascii,
 * emojis and SIP/TIP ideographs) count as 2 width units, whereas standard ASCII and half-width count as 1.
 */
export function calculateStringWidth(str: string): number {
  let width = 0;
  let i = 0;
  while (i < str.length) {
    const codePoint = str.codePointAt(i);
    if (codePoint === undefined) {
      break;
    }

    // Advance index by 2 if surrogate pair (codePoint >= 0x10000), else 1
    const charLen = codePoint >= 0x10000 ? 2 : 1;
    i += charLen;

    // Zero-width characters (combining marks, zero-width spaces, variation selectors)
    if (
      codePoint === 0x200b || // Zero-width space
      codePoint === 0x200c || // Zero-width non-joiner
      codePoint === 0x200d || // Zero-width joiner
      codePoint === 0xfeff || // BOM / Zero-width no-break space
      (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || // Variation Selectors 1-16
      (codePoint >= 0xe0100 && codePoint <= 0xe01ef) // Variation Selectors Supplement
    ) {
      continue;
    }

    // Full-width ranges:
    // - East Asian Wide & Fullwidth (CJK Radicals, Ideographs, Hangul, Fullwidth ASCII, etc.)
    // - Supplementary Ideographic Planes (U+20000 - U+3FFFF)
    // - Common Emoji ranges (U+1F300 - U+1F9FF, U+2600 - U+27BF, etc.)
    if (
      (codePoint >= 0x1100 && codePoint <= 0x115f) ||
      (codePoint >= 0x231a && codePoint <= 0x231b) ||
      (codePoint >= 0x23e9 && codePoint <= 0x23ec) ||
      (codePoint >= 0x23f0 && codePoint <= 0x23f3) ||
      (codePoint >= 0x25fd && codePoint <= 0x25fe) ||
      (codePoint >= 0x2614 && codePoint <= 0x2615) ||
      (codePoint >= 0x2648 && codePoint <= 0x2653) ||
      (codePoint >= 0x267f && codePoint <= 0x267f) ||
      (codePoint >= 0x2693 && codePoint <= 0x2693) ||
      (codePoint >= 0x26a1 && codePoint <= 0x26a1) ||
      (codePoint >= 0x26aa && codePoint <= 0x26ab) ||
      (codePoint >= 0x26bd && codePoint <= 0x26be) ||
      (codePoint >= 0x26c4 && codePoint <= 0x26c5) ||
      (codePoint >= 0x26ce && codePoint <= 0x26ce) ||
      (codePoint >= 0x26d4 && codePoint <= 0x26d4) ||
      (codePoint >= 0x26ea && codePoint <= 0x26ea) ||
      (codePoint >= 0x26f2 && codePoint <= 0x26f3) ||
      (codePoint >= 0x26f5 && codePoint <= 0x26f5) ||
      (codePoint >= 0x26fa && codePoint <= 0x26fa) ||
      (codePoint >= 0x26fd && codePoint <= 0x26fd) ||
      (codePoint >= 0x2705 && codePoint <= 0x2705) ||
      (codePoint >= 0x270a && codePoint <= 0x270b) ||
      (codePoint >= 0x2728 && codePoint <= 0x2728) ||
      (codePoint >= 0x274c && codePoint <= 0x274e) ||
      (codePoint >= 0x2753 && codePoint <= 0x2755) ||
      (codePoint >= 0x2757 && codePoint <= 0x2757) ||
      (codePoint >= 0x2795 && codePoint <= 0x2797) ||
      (codePoint >= 0x27b0 && codePoint <= 0x27b0) ||
      (codePoint >= 0x27bf && codePoint <= 0x27bf) ||
      (codePoint >= 0x2b1b && codePoint <= 0x2b1c) ||
      (codePoint >= 0x2b50 && codePoint <= 0x2b50) ||
      (codePoint >= 0x2b55 && codePoint <= 0x2b55) ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff01 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f000 && codePoint <= 0x1f9ff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3ffff)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export interface TableCellAlignment {
  align: 'left' | 'center' | 'right' | 'none';
}

/**
 * Detect delimiter alignment pattern: :---:, :---, ---:, or ---
 */
export function parseDelimiterAlignment(cellText: string): 'left' | 'center' | 'right' | 'none' {
  const trimmed = cellText.trim();
  const startsWithColon = trimmed.startsWith(':');
  const endsWithColon = trimmed.endsWith(':');
  if (startsWithColon && endsWithColon) {
    return 'center';
  }
  if (startsWithColon) {
    return 'left';
  }
  if (endsWithColon) {
    return 'right';
  }
  return 'none';
}

/**
 * Format delimiter cell with appropriate alignment colons and min width.
 */
export function formatDelimiterCell(align: 'left' | 'center' | 'right' | 'none', width: number): string {
  const hyphensNeeded = Math.max(3, width);
  if (align === 'center') {
    return `:${'-'.repeat(Math.max(1, hyphensNeeded - 2))}:`;
  }
  if (align === 'left') {
    return `:${'-'.repeat(Math.max(2, hyphensNeeded - 1))}`;
  }
  if (align === 'right') {
    return `${'-'.repeat(Math.max(2, hyphensNeeded - 1))}:`;
  }
  return '-'.repeat(hyphensNeeded);
}

/**
 * Pad a cell string to the target width based on alignment.
 */
export function padCell(content: string, targetWidth: number, align: 'left' | 'center' | 'right' | 'none'): string {
  const currentWidth = calculateStringWidth(content);
  const paddingNeeded = Math.max(0, targetWidth - currentWidth);
  if (paddingNeeded === 0) {
    return content;
  }
  if (align === 'right') {
    return ' '.repeat(paddingNeeded) + content;
  }
  if (align === 'center') {
    const leftPad = Math.floor(paddingNeeded / 2);
    const rightPad = paddingNeeded - leftPad;
    return ' '.repeat(leftPad) + content + ' '.repeat(rightPad);
  }
  // Default to left align
  return content + ' '.repeat(paddingNeeded);
}

/**
 * Check if a single line is a markdown table delimiter row (e.g. | --- | :---: |)
 */
export function isDelimiterRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') && !trimmed.endsWith('|')) {
    return false;
  }
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * Check if a single line looks like a markdown table row (contains pipe)
 */
export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes('|');
}

/**
 * Split a table row into cells, taking care of escaped pipes \| and inline code spans `...`
 */
export function splitRowCells(row: string): string[] {
  const trimmed = row.trim();
  // Strip outer pipes if present
  let inner = trimmed;
  if (inner.startsWith('|')) {
    inner = inner.slice(1);
  }
  if (inner.endsWith('|') && !inner.endsWith('\\|')) {
    inner = inner.slice(0, -1);
  }

  const cells: string[] = [];
  let current = '';
  let escaped = false;
  let inCodeSpan = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      current += char;
      escaped = true;
    } else if (char === '`') {
      inCodeSpan = !inCodeSpan;
      current += char;
    } else if (char === '|' && !inCodeSpan) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Format a Markdown table block (all consecutive lines).
 */
export function formatMarkdownTable(
  tableSource: string,
  alignment: TablePipeAlignment = 'aligned'
): string {
  const lines = tableSource.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return tableSource;
  }

  // Parse lines into 2D cell array
  const parsedRows: string[][] = lines.map(splitRowCells);
  const columnCount = Math.max(...parsedRows.map((r) => r.length), 1);

  // Normalize all rows to have columnCount cells
  const normalizedRows = parsedRows.map((row) => {
    const filled = [...row];
    while (filled.length < columnCount) {
      filled.push('');
    }
    return filled;
  });

  // Identify delimiter row index (usually index 1)
  let delimiterIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isDelimiterRow(lines[i])) {
      delimiterIndex = i;
      break;
    }
  }

  // Determine alignments per column
  const alignments: ('left' | 'center' | 'right' | 'none')[] = [];
  if (delimiterIndex !== -1) {
    const delimiterCells = normalizedRows[delimiterIndex];
    for (let c = 0; c < columnCount; c++) {
      alignments.push(parseDelimiterAlignment(delimiterCells[c] || '---'));
    }
  } else {
    for (let c = 0; c < columnCount; c++) {
      alignments.push('none');
    }
  }

  if (alignment === 'compact') {
    // Compact: minimal 1-space padding: | cell | cell |
    return normalizedRows
      .map((row, rIdx) => {
        if (rIdx === delimiterIndex) {
          const cells = row.map((_, cIdx) => formatDelimiterCell(alignments[cIdx], 3));
          return `| ${cells.join(' | ')} |`;
        }
        return `| ${row.join(' | ')} |`;
      })
      .join('\n');
  }

  // Aligned: calculate max width for each column
  const colWidths: number[] = new Array(columnCount).fill(3); // minimum width 3 for ---
  for (let rIdx = 0; rIdx < normalizedRows.length; rIdx++) {
    if (rIdx === delimiterIndex) {
      continue;
    }
    const row = normalizedRows[rIdx];
    for (let cIdx = 0; cIdx < columnCount; cIdx++) {
      const w = calculateStringWidth(row[cIdx]);
      if (w > colWidths[cIdx]) {
        colWidths[cIdx] = w;
      }
    }
  }

  return normalizedRows
    .map((row, rIdx) => {
      if (rIdx === delimiterIndex) {
        const cells = row.map((_, cIdx) => formatDelimiterCell(alignments[cIdx], colWidths[cIdx]));
        return `| ${cells.join(' | ')} |`;
      }
      const cells = row.map((cell, cIdx) => padCell(cell, colWidths[cIdx], alignments[cIdx]));
      return `| ${cells.join(' | ')} |`;
    })
    .join('\n');
}

export interface TableBlockRange {
  startOffset: number;
  endOffset: number;
  tableText: string;
  cursorRow: number;
  cursorCol: number;
  columnCount: number;
  rowCount: number;
}

/**
 * Locate table block at cursor position in full text.
 */
export function findTableBlockAtCursor(text: string, cursorOffset: number): TableBlockRange | null {
  const lines = text.split('\n');
  let currentOffset = 0;
  let cursorLineIdx = -1;
  let cursorColInLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length;
    const lineEnd = currentOffset + lineLen;
    if (cursorOffset >= currentOffset && cursorOffset <= lineEnd) {
      cursorLineIdx = i;
      cursorColInLine = cursorOffset - currentOffset;
      break;
    }
    currentOffset += lineLen + 1; // +1 for '\n'
  }

  if (cursorLineIdx === -1 || !isTableRow(lines[cursorLineIdx])) {
    return null;
  }

  // Scan backwards for table start
  let startLine = cursorLineIdx;
  while (startLine > 0 && isTableRow(lines[startLine - 1])) {
    startLine--;
  }

  // Scan forwards for table end
  let endLine = cursorLineIdx;
  while (endLine < lines.length - 1 && isTableRow(lines[endLine + 1])) {
    endLine++;
  }

  // Calculate start and end character offsets
  let startOffset = 0;
  for (let i = 0; i < startLine; i++) {
    startOffset += lines[i].length + 1;
  }

  let endOffset = startOffset;
  for (let i = startLine; i <= endLine; i++) {
    endOffset += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }

  const tableLines = lines.slice(startLine, endLine + 1);
  const tableText = tableLines.join('\n');

  // Determine cursor row and col within table
  const relativeRow = cursorLineIdx - startLine;
  const cursorLineText = lines[cursorLineIdx];

  // Count pipes before cursor in this line to determine column
  let pipeCount = 0;
  for (let i = 0; i < cursorColInLine; i++) {
    if (cursorLineText[i] === '|' && (i === 0 || cursorLineText[i - 1] !== '\\')) {
      pipeCount++;
    }
  }
  const relativeCol = Math.max(0, pipeCount - 1);

  const parsed = tableLines.map(splitRowCells);
  const columnCount = Math.max(...parsed.map((r) => r.length), 1);

  return {
    startOffset,
    endOffset,
    tableText,
    cursorRow: relativeRow,
    cursorCol: relativeCol,
    columnCount,
    rowCount: tableLines.length,
  };
}

export interface TableNavigationResult {
  updatedText: string;
  newCursorOffset: number;
}

/**
 * Handle Tab / Shift+Tab navigation in a Markdown table.
 */
export function navigateTable(
  text: string,
  cursorOffset: number,
  direction: 'next' | 'prev',
  alignment: TablePipeAlignment = 'aligned'
): TableNavigationResult | null {
  const block = findTableBlockAtCursor(text, cursorOffset);
  if (!block) {
    return null;
  }

  const formatted = formatMarkdownTable(block.tableText, alignment);
  const formattedLines = formatted.split('\n');

  let targetRow = block.cursorRow;
  let targetCol = block.cursorCol;

  if (direction === 'next') {
    targetCol++;
    if (targetCol >= block.columnCount) {
      targetCol = 0;
      targetRow++;
    }
    // If target is delimiter row, skip it
    if (targetRow < formattedLines.length && isDelimiterRow(formattedLines[targetRow])) {
      targetRow++;
    }
    // If passed the last row, insert a new row
    if (targetRow >= formattedLines.length) {
      const emptyRow = `| ${new Array(block.columnCount).fill(' ').join(' | ')} |`;
      formattedLines.push(emptyRow);
      targetRow = formattedLines.length - 1;
      targetCol = 0;
    }
  } else {
    // 'prev'
    targetCol--;
    if (targetCol < 0) {
      targetCol = block.columnCount - 1;
      targetRow--;
    }
    // If target is delimiter row, skip backwards
    if (targetRow >= 0 && isDelimiterRow(formattedLines[targetRow])) {
      targetRow--;
    }
    if (targetRow < 0) {
      targetRow = 0;
      targetCol = 0;
    }
  }

  // Re-format if a row was appended
  const finalTable = formatMarkdownTable(formattedLines.join('\n'), alignment);
  const finalLines = finalTable.split('\n');

  // Clamp targetRow
  targetRow = Math.min(Math.max(0, targetRow), finalLines.length - 1);

  // Find cursor offset for target cell: right after the (targetCol + 1)-th pipe + 1 space
  const targetLine = finalLines[targetRow];
  let pipesFound = 0;
  let cellOffsetInLine = 0;

  for (let i = 0; i < targetLine.length; i++) {
    if (targetLine[i] === '|' && (i === 0 || targetLine[i - 1] !== '\\')) {
      pipesFound++;
      if (pipesFound === targetCol + 1) {
        cellOffsetInLine = i + 2; // after '| '
        break;
      }
    }
  }

  // Calculate global cursor offset
  let offsetBeforeTargetLine = block.startOffset;
  for (let i = 0; i < targetRow; i++) {
    offsetBeforeTargetLine += finalLines[i].length + 1;
  }
  const newCursorOffset = offsetBeforeTargetLine + Math.min(cellOffsetInLine, targetLine.length);

  const updatedText =
    text.slice(0, block.startOffset) + finalTable + text.slice(block.endOffset);

  return {
    updatedText,
    newCursorOffset,
  };
}
