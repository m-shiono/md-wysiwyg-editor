import type { EditorMode } from './editor-mode';

export interface DocumentStats {
  charCount: number;
  wordCount: number;
  lineCount: number;
  selectedCharCount: number;
  selectedWordCount: number;
  line?: number;
  column?: number;
}

const CJK_CHAR_RE =
  /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uAC00-\uD7AF\uFF66-\uFF9F]/gu;
const LATIN_WORD_RE = /[A-Za-z0-9_'\u00C0-\u024F-]+/g;

/**
 * Count characters (excluding line breaks) and words (CJK char-level + Latin word-level).
 */
function countTextMetrics(text: string): { chars: number; words: number } {
  if (!text) {
    return { chars: 0, words: 0 };
  }
  const withoutNewlines = text.replace(/\r?\n/g, '');
  const chars = Array.from(withoutNewlines).length;

  const spacedNewlines = text.replace(/\r?\n/g, ' ');
  const cjkMatches = spacedNewlines.match(CJK_CHAR_RE);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Replace CJK characters with spaces so adjacent Latin tokens stay separated
  const withoutCjk = spacedNewlines.replace(CJK_CHAR_RE, ' ');
  const latinMatches = withoutCjk.match(LATIN_WORD_RE);
  const latinCount = latinMatches ? latinMatches.length : 0;

  return { chars, words: cjkCount + latinCount };
}

/**
 * Compute character, word, and line statistics for a Markdown document and optional selection.
 */
export function countDocumentStats(text: string, selectedText?: string): DocumentStats {
  const { chars, words } = countTextMetrics(text);
  const lineCount = text.length === 0 ? 1 : text.split(/\r?\n/).length;

  const sel = selectedText ? countTextMetrics(selectedText) : { chars: 0, words: 0 };

  return {
    charCount: chars,
    wordCount: words,
    lineCount,
    selectedCharCount: sel.chars,
    selectedWordCount: sel.words,
  };
}

/**
 * Compute 1-based line and column from a UTF-16 string offset (clamped safely).
 */
export function computeLineColumnFromOffset(
  text: string,
  offset: number,
): { line: number; column: number; lineCount: number } {
  const lineCount = text.length === 0 ? 1 : text.split(/\r?\n/).length;
  const clamped = Math.max(0, Math.min(offset, text.length));
  const prefix = text.slice(0, clamped);
  const linesBefore = prefix.split(/\r?\n/);
  const line = linesBefore.length;
  const lastLine = linesBefore[linesBefore.length - 1] ?? '';
  // Handle offset sitting between \r and \n gracefully
  const normalizedLastLine = lastLine.endsWith('\r') ? lastLine.slice(0, -1) : lastLine;
  const column = Array.from(normalizedLastLine).length + 1;

  return { line, column, lineCount };
}

/**
 * Estimate 1-based Markdown source line number from Visual editor block context.
 */
export function estimateVisualLineNumber(
  markdownText: string,
  anchorText: string,
  blockIndex: number,
  totalBlocks: number,
): number {
  const lines = markdownText.length === 0 ? [''] : markdownText.split(/\r?\n/);
  const lineCount = lines.length;
  if (lineCount <= 1) {
    return 1;
  }

  const ratio =
    totalBlocks > 1 ? Math.max(0, Math.min(1, blockIndex / (totalBlocks - 1))) : 0;
  const estimatedLine = Math.max(1, Math.min(lineCount, Math.round(ratio * (lineCount - 1)) + 1));

  const needle = anchorText.trim().slice(0, 40);
  if (needle.length >= 2) {
    let bestLine = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(needle)) {
        const lineNum = i + 1;
        const dist = Math.abs(lineNum - estimatedLine);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestLine = lineNum;
        }
      }
    }
    if (bestLine > 0) {
      return bestLine;
    }
  }

  return estimatedLine;
}

function formatCountLabel(count: number, selectedCount: number, unit: string): string {
  const base = `${count.toLocaleString('en-US')} ${unit}`;
  if (selectedCount > 0) {
    return `${base} (${selectedCount.toLocaleString('en-US')} sel)`;
  }
  return base;
}

/**
 * Format compact status bar text for the active editor mode.
 */
export function formatStatusBarText(stats: DocumentStats, mode: EditorMode): string {
  const charPart = formatCountLabel(stats.charCount, stats.selectedCharCount, 'chars');
  const wordPart = formatCountLabel(stats.wordCount, stats.selectedWordCount, 'words');

  if (mode === 'raw') {
    const line = stats.line ?? 1;
    const col = stats.column ?? 1;
    return `Ln ${line}, Col ${col} | ${charPart} | ${wordPart}`;
  }
  if (mode === 'markdown') {
    const line = Math.max(1, Math.min(stats.line ?? 1, stats.lineCount));
    return `Ln ${line} / ${stats.lineCount} | ${charPart} | ${wordPart}`;
  }
  return `${stats.lineCount.toLocaleString('en-US')} lines | ${charPart} | ${wordPart}`;
}

/**
 * Format multi-line tooltip for the status bar item.
 */
export function formatStatusBarTooltip(stats: DocumentStats, mode: EditorMode): string {
  const modeLabel = mode === 'raw' ? 'Source' : mode === 'markdown' ? 'Visual' : 'Preview';
  const lines = [
    `MD WYSIWYG Editor (${modeLabel})`,
    `Lines: ${stats.lineCount.toLocaleString('en-US')}`,
    `Characters: ${stats.charCount.toLocaleString('en-US')}`,
    `Words: ${stats.wordCount.toLocaleString('en-US')}`,
  ];
  if (stats.selectedCharCount > 0) {
    lines.push(
      `Selected: ${stats.selectedCharCount.toLocaleString('en-US')} chars, ${stats.selectedWordCount.toLocaleString('en-US')} words`,
    );
  }
  return lines.join('\n');
}
