/**
 * CSV / TSV to Markdown and Markdown to CSV conversion utility
 * RFC 4180 compliant parsing and serialization
 */

import {
  formatMarkdownTable,
  splitRowCells,
  isDelimiterRow,
} from './table-formatter';

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
