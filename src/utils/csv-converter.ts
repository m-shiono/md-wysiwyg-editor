/**
 * CSV / TSV to Markdown and Markdown to CSV conversion utility
 * RFC 4180 compliant parsing and serialization
 */

import {
  formatMarkdownTable,
  splitRowCells,
  isDelimiterRow,
  type TablePipeAlignment,
} from './table-formatter';
import { sanitizeHtml } from './sanitize';
import type { TipTapNodeLike } from './table-convert';

/**
 * Automatically detect whether delimiter is tab or comma.
 */
export function detectDelimiter(text: string): ',' | '\t' {
  let commaCount = 0;
  let tabCount = 0;
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (char === ',') {
        commaCount++;
      } else if (char === '\t') {
        tabCount++;
      }
    }
  }

  return tabCount > commaCount ? '\t' : ',';
}

/**
 * Parse CSV or TSV string into 2D string matrix according to RFC 4180.
 * In-cell newlines are normalized to '<br />'.
 */
export function parseCsvToMatrix(
  csvText: string,
  delimiter?: ',' | '\t'
): string[][] {
  const delim = delimiter || detectDelimiter(csvText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  let i = 0;
  while (i < csvText.length) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          // Escaped quote "" -> "
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // End of quoted string
          inQuotes = false;
          i++;
          continue;
        }
      } else if (char === '\r') {
        if (i + 1 < csvText.length && csvText[i + 1] === '\n') {
          i++;
        }
        currentCell += '<br />';
        i++;
        continue;
      } else if (char === '\n') {
        currentCell += '<br />';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delim) {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        currentCell = '';
        // Ignore trailing empty lines
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  // Normalize column count across all rows
  const maxCols = Math.max(...rows.map((r) => r.length), 1);
  return rows.map((row) => {
    const filled = [...row];
    while (filled.length < maxCols) {
      filled.push('');
    }
    return filled;
  });
}

/**
 * Format 2D string matrix into CSV or TSV string with proper quoting.
 */
export function formatMatrixToCsv(
  matrix: string[][],
  delimiter: ',' | '\t' = ','
): string {
  return matrix
    .map((row) =>
      row
        .map((cell) => {
          // Restore <br /> to \n
          let normalized = cell.replace(/<br\s*\/?>/gi, '\n');
          // Escape quotes
          const hasDelim = normalized.includes(delimiter);
          const hasQuote = normalized.includes('"');
          const hasNewline = normalized.includes('\n');

          if (hasDelim || hasQuote || hasNewline) {
            normalized = `"${normalized.replace(/"/g, '""')}"`;
          }
          return normalized;
        })
        .join(delimiter)
    )
    .join('\n');
}

/**
 * Convert CSV or TSV text into formatted Markdown table.
 */
export function csvToMarkdownTable(csvText: string): string {
  const matrix = parseCsvToMatrix(csvText);
  if (matrix.length === 0) {
    return '';
  }

  const colCount = matrix[0].length;
  const headerRow = matrix[0];
  const delimiterRow = new Array(colCount).fill('---');
  const dataRows = matrix.slice(1);

  if (dataRows.length === 0) {
    // If only header was provided, add empty data row
    dataRows.push(new Array(colCount).fill(''));
  }

  const rawTable = [
    `| ${headerRow.join(' | ')} |`,
    `| ${delimiterRow.join(' | ')} |`,
    ...dataRows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

  return formatMarkdownTable(rawTable, 'aligned');
}

/**
 * Convert Markdown table text into CSV or TSV text.
 */
export function markdownTableToCsv(
  markdownTableText: string,
  delimiter: ',' | '\t' = ','
): string {
  const lines = markdownTableText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const matrix: string[][] = [];

  for (const line of lines) {
    if (isDelimiterRow(line)) {
      continue;
    }
    const rawCells = splitRowCells(line);
    // Unescape pipes and trim
    const cells = rawCells.map((c) => c.replace(/\\\|/g, '|').trim());
    matrix.push(cells);
  }

  return formatMatrixToCsv(matrix, delimiter);
}

/**
 * Determine whether plain text qualifies as a TSV table for smart paste (AD-005, RK-022).
 * Must have >= 2 rows and >= 2 columns, with inter-token tabs (not just leading indentation tabs)
 * and consistent column counts across all rows.
 */
export function isSmartPasteTsv(text: string): boolean {
  if (!text || !text.includes('\t')) {
    return false;
  }

  // Raw line check for unquoted text: reject if lines only have leading tabs (tab-indented code)
  const hasQuotes = text.includes('"');
  if (!hasQuotes) {
    const rawLines = text
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    if (rawLines.length < 2) {
      return false;
    }
    const colCounts: number[] = [];
    for (const line of rawLines) {
      // Strip leading tabs/spaces to check if there is still an inter-token tab separator
      const trimmedLead = line.replace(/^[\t ]+/, '');
      if (!trimmedLead.includes('\t')) {
        return false;
      }
      const cols = line.split('\t').length;
      if (cols < 2) {
        return false;
      }
      colCounts.push(cols);
    }
    const firstCols = colCounts[0];
    if (!colCounts.every((c) => c === firstCols)) {
      return false;
    }
    return true;
  }

  // Quoted RFC 4180 TSV check: parse rows without padding first to verify column consistency
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentCell += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === '\t') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        currentCell = '';
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
      } else {
        currentCell += char;
        i++;
      }
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) {
    return false;
  }
  const expectedCols = rows[0].length;
  if (expectedCols < 2) {
    return false;
  }
  if (!rows.every((r) => r.length === expectedCols)) {
    return false;
  }
  return true;
}

function extractAlignFromAttrString(attrStr: string): 'left' | 'center' | 'right' | null {
  const alignMatch = attrStr.match(/\b(?:data-)?align\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (alignMatch) {
    const val = (alignMatch[1] ?? alignMatch[2] ?? alignMatch[3] ?? '').trim().toLowerCase();
    if (val === 'left' || val === 'center' || val === 'right') {
      return val;
    }
  }
  const styleMatch = attrStr.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (styleMatch) {
    const styleVal = styleMatch[1] ?? styleMatch[2] ?? styleMatch[3] ?? '';
    const textAlignMatch = styleVal.match(/text-align\s*:\s*(left|center|right)\b/i);
    if (textAlignMatch) {
      return textAlignMatch[1].toLowerCase() as 'left' | 'center' | 'right';
    }
  }
  return null;
}

function stripTagsToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

interface ParsedClipboardHtmlTable {
  matrix: string[][];
  alignments: Array<'left' | 'center' | 'right' | null>;
}

function parseClipboardHtmlTable(rawHtml: string): ParsedClipboardHtmlTable | null {
  if (!rawHtml || !/<table[\s>]/i.test(rawHtml)) {
    return null;
  }
  const withoutScripts = rawHtml
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*script\b[^>]*\/?\s*>/gi, '');
  const tableMatch = withoutScripts.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  const tableBody = tableMatch ? tableMatch[1] : withoutScripts;
  const rowMatches = [...tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rowMatches.length === 0) {
    return null;
  }

  const matrix: string[][] = [];
  const alignments: Array<'left' | 'center' | 'right' | null> = [];

  for (const rowMatch of rowMatches) {
    const cellsHtml = rowMatch[1] ?? '';
    const cellMatches = [...cellsHtml.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
    if (cellMatches.length === 0) {
      continue;
    }
    const rowCells: string[] = [];
    cellMatches.forEach((cellMatch, colIndex) => {
      const attrStr = cellMatch[2] ?? '';
      const rawInner = cellMatch[3] ?? '';
      const sanitizedInner = sanitizeHtml(rawInner);
      const align = extractAlignFromAttrString(attrStr);
      if (align && !alignments[colIndex]) {
        alignments[colIndex] = align;
      } else if (alignments[colIndex] === undefined) {
        alignments[colIndex] = null;
      }

      const normalizedBreaks = sanitizedInner
        .replace(/<\/p>\s*<p[^>]*>/gi, '<br />')
        .replace(/<br\s*\/?>/gi, '\n');
      const plain = stripTagsToPlainText(normalizedBreaks)
        .split('\n')
        .map((s) => s.trim())
        .filter((s, _idx, arr) => s.length > 0 || arr.length === 1)
        .join('<br />');
      rowCells.push(plain.trim());
    });
    matrix.push(rowCells);
  }

  if (matrix.length === 0) {
    return null;
  }
  const maxCols = Math.max(...matrix.map((r) => r.length), 1);
  while (alignments.length < maxCols) {
    alignments.push(null);
  }
  const normalizedMatrix = matrix.map((row) => {
    const filled = [...row];
    while (filled.length < maxCols) {
      filled.push('');
    }
    return filled;
  });

  return { matrix: normalizedMatrix, alignments };
}

export interface SmartPasteContext {
  plainText?: string;
  htmlText?: string;
  inCodeBlock?: boolean;
  inInlineCode?: boolean;
  readonly?: boolean;
  editorMode?: string;
}

/**
 * Guard check for whether smart table paste should trigger (AD-005, TC-TRE-014, TC-TRE-017).
 */
export function shouldTriggerSmartTablePaste(context: SmartPasteContext): boolean {
  if (context.readonly) {
    return false;
  }
  if (context.editorMode && context.editorMode !== 'markdown' && context.editorMode !== 'raw') {
    return false;
  }
  if (context.inCodeBlock || context.inInlineCode) {
    return false;
  }
  if (context.htmlText && parseClipboardHtmlTable(context.htmlText) !== null) {
    return true;
  }
  if (context.plainText && isSmartPasteTsv(context.plainText)) {
    return true;
  }
  return false;
}

/**
 * Convert clipboard TSV or HTML `<table>` to a formatted GFM pipe table string for Source (`raw`) mode (AD-005).
 */
export function convertSmartPasteToMarkdown(
  clipboard: { plainText?: string; htmlText?: string },
  alignment: TablePipeAlignment = 'aligned',
): string | null {
  if (clipboard.htmlText) {
    const parsedHtml = parseClipboardHtmlTable(clipboard.htmlText);
    if (parsedHtml && parsedHtml.matrix.length > 0) {
      const { matrix, alignments } = parsedHtml;
      const colCount = matrix[0].length;
      const headerRow = matrix[0];
      const delimiterRow = alignments.map((a) => {
        if (a === 'left') return ':---';
        if (a === 'center') return ':---:';
        if (a === 'right') return '---:';
        return '---';
      });
      const dataRows = matrix.length > 1 ? matrix.slice(1) : [new Array(colCount).fill('')];
      const rawTable = [
        `| ${headerRow.join(' | ')} |`,
        `| ${delimiterRow.join(' | ')} |`,
        ...dataRows.map((row) => `| ${row.join(' | ')} |`),
      ].join('\n');
      return formatMarkdownTable(rawTable, alignment);
    }
  }

  if (clipboard.plainText && isSmartPasteTsv(clipboard.plainText)) {
    const matrix = parseCsvToMatrix(clipboard.plainText, '\t');
    if (matrix.length < 2) {
      return null;
    }
    const colCount = matrix[0].length;
    const headerRow = matrix[0];
    const delimiterRow = new Array(colCount).fill('---');
    const dataRows = matrix.slice(1);
    const rawTable = [
      `| ${headerRow.join(' | ')} |`,
      `| ${delimiterRow.join(' | ')} |`,
      ...dataRows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
    return formatMarkdownTable(rawTable, alignment);
  }

  return null;
}

function cellTextToTipTapContent(cellText: string): TipTapNodeLike[] {
  const parts = cellText.split(/<br\s*\/?>/i);
  if (parts.length <= 1) {
    return [
      {
        type: 'paragraph',
        content: cellText ? [{ type: 'text', text: cellText }] : [],
      },
    ];
  }
  const inlineNodes: TipTapNodeLike[] = [];
  parts.forEach((part, idx) => {
    if (idx > 0) {
      inlineNodes.push({ type: 'hardBreak' });
    }
    if (part) {
      inlineNodes.push({ type: 'text', text: part });
    }
  });
  return [
    {
      type: 'paragraph',
      content: inlineNodes,
    },
  ];
}

/**
 * Convert clipboard TSV or HTML `<table>` into a TipTap `table` node for Visual (`markdown`) mode (AD-005).
 */
export function convertSmartPasteToTipTapTable(
  clipboard: { plainText?: string; htmlText?: string },
  tableFormat: 'gfm' | 'html' = 'gfm',
): TipTapNodeLike | null {
  if (clipboard.htmlText) {
    const parsedHtml = parseClipboardHtmlTable(clipboard.htmlText);
    if (parsedHtml && parsedHtml.matrix.length > 0) {
      const { matrix, alignments } = parsedHtml;
      const rows: TipTapNodeLike[] = matrix.map((rowCells, rIdx) => {
        const isHeader = rIdx === 0;
        const cells: TipTapNodeLike[] = rowCells.map((cellText, cIdx) => {
          const align = alignments[cIdx] ?? null;
          return {
            type: isHeader ? 'tableHeader' : 'tableCell',
            ...(align ? { attrs: { textAlign: align } } : {}),
            content: cellTextToTipTapContent(cellText),
          };
        });
        return { type: 'tableRow', content: cells };
      });
      return {
        type: 'table',
        attrs: {
          tableFormat,
          gfmSource: tableFormat === 'gfm',
          converted: tableFormat === 'html',
        },
        content: rows,
      };
    }
  }

  if (clipboard.plainText && isSmartPasteTsv(clipboard.plainText)) {
    const matrix = parseCsvToMatrix(clipboard.plainText, '\t');
    if (matrix.length < 2) {
      return null;
    }
    const rows: TipTapNodeLike[] = matrix.map((rowCells, rIdx) => {
      const isHeader = rIdx === 0;
      const cells: TipTapNodeLike[] = rowCells.map((cellText) => ({
        type: isHeader ? 'tableHeader' : 'tableCell',
        content: cellTextToTipTapContent(cellText),
      }));
      return { type: 'tableRow', content: cells };
    });
    return {
      type: 'table',
      attrs: {
        tableFormat,
        gfmSource: tableFormat === 'gfm',
        converted: tableFormat === 'html',
      },
      content: rows,
    };
  }

  return null;
}

