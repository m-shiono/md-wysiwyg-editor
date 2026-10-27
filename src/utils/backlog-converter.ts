/**
 * Backlog Format Converter Utility
 * Supports bidirectional conversion between Markdown and Backlog formats,
 * including tables, headings, lists, code blocks, quotes, decorations, and links.
 */

import {
  formatMarkdownTable,
  splitRowCells,
  isDelimiterRow,
  parseDelimiterAlignment,
  formatDelimiterCell,
} from './table-formatter';

/**
 * Convert a Markdown table to Backlog table syntax.
 */
export function markdownTableToBacklogTable(markdownTableText: string): string {
  const lines = markdownTableText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return '';
  }

  // Find delimiter row
  let delimiterIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isDelimiterRow(lines[i])) {
      delimiterIndex = i;
      break;
    }
  }

  const rawRows: string[][] = lines.map(splitRowCells);
  const colCount = Math.max(...rawRows.map((r) => r.length), 1);

  // Column alignments
  const alignments: ('left' | 'center' | 'right' | 'none')[] = [];
  if (delimiterIndex !== -1) {
    const delimiterCells = rawRows[delimiterIndex];
    for (let c = 0; c < colCount; c++) {
      alignments.push(parseDelimiterAlignment(delimiterCells[c] || '---'));
    }
  } else {
    for (let c = 0; c < colCount; c++) {
      alignments.push('none');
    }
  }

  const backlogLines: string[] = [];
  let isHeaderDone = false;

  for (let r = 0; r < rawRows.length; r++) {
    if (r === delimiterIndex) {
      continue;
    }
    const row = rawRows[r];
    // Pad row if needed
    while (row.length < colCount) {
      row.push('');
    }

    if (!isHeaderDone) {
      // First non-delimiter row is header in Backlog
      backlogLines.push(`|${row.join('|')}|h`);
      isHeaderDone = true;
    } else {
      // Data row with alignments
      const cells = row.map((cell, cIdx) => {
        const align = alignments[cIdx];
        let prefix = '';
        if (align === 'left') {
          prefix = 'LEFT:';
        } else if (align === 'center') {
          prefix = 'CENTER:';
        } else if (align === 'right') {
          prefix = 'RIGHT:';
        }
        return `${prefix}${cell}`;
      });
      backlogLines.push(`|${cells.join('|')}|`);
    }
  }

  return backlogLines.join('\n');
}

/**
 * Check if a line is a Backlog table row.
 */
export function isBacklogTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && (trimmed.endsWith('|') || trimmed.endsWith('|h'));
}

/**
 * Convert Backlog table text to GFM Markdown table.
 */
export function backlogTableToMarkdownTable(backlogTableText: string): string {
  const lines = backlogTableText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return '';
  }

  let headerRowCells: string[] = [];
  const dataRows: string[][] = [];
  const colAlignments: Map<number, 'left' | 'center' | 'right'> = new Map();

  for (const line of lines) {
    const isHeader = line.endsWith('|h');
    const content = isHeader ? line.slice(0, -1) : line; // strip trailing 'h'
    const rawCells = splitRowCells(content);

    if (isHeader && headerRowCells.length === 0) {
      headerRowCells = rawCells;
    } else {
      // Data row: check for LEFT:, CENTER:, RIGHT:
      const cleanedCells: string[] = [];
      rawCells.forEach((cell, idx) => {
        let text = cell;
        if (/^LEFT:/i.test(text)) {
          colAlignments.set(idx, 'left');
          text = text.replace(/^LEFT:/i, '');
        } else if (/^CENTER:/i.test(text)) {
          colAlignments.set(idx, 'center');
          text = text.replace(/^CENTER:/i, '');
        } else if (/^RIGHT:/i.test(text)) {
          colAlignments.set(idx, 'right');
          text = text.replace(/^RIGHT:/i, '');
        }
        cleanedCells.push(text.trim());
      });
      dataRows.push(cleanedCells);
    }
  }

  const colCount = Math.max(
    headerRowCells.length,
    ...dataRows.map((r) => r.length),
    1
  );

  // Normalize header
  while (headerRowCells.length < colCount) {
    headerRowCells.push('');
  }

  // Construct delimiter cells
  const delimiterCells: string[] = [];
  for (let c = 0; c < colCount; c++) {
    const align = colAlignments.get(c) || 'none';
    delimiterCells.push(formatDelimiterCell(align, 3));
  }

  // Normalize data rows
  const normalizedDataRows = dataRows.map((r) => {
    const row = [...r];
    while (row.length < colCount) {
      row.push('');
    }
    return row;
  });

  const rawMdTable = [
    `| ${headerRowCells.join(' | ')} |`,
    `| ${delimiterCells.join(' | ')} |`,
    ...normalizedDataRows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');

  return formatMarkdownTable(rawMdTable, 'aligned');
}

/**
 * Convert full Markdown document or snippet to Backlog format.
 */
export function markdownToBacklog(markdownText: string): string {
  const lines = markdownText.split(/\r?\n/);
  const resultLines: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let inTable = false;
  const tableLines: string[] = [];
  let inQuote = false;
  const quoteLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length > 0) {
      resultLines.push(markdownTableToBacklogTable(tableLines.join('\n')));
      tableLines.length = 0;
    }
    inTable = false;
  };

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      resultLines.push('>>');
      resultLines.push(quoteLines.join('\n'));
      resultLines.push('<<');
      quoteLines.length = 0;
    }
    inQuote = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Code blocks: ```lang ... ``` -> {code:lang} ... {/code}
    if (line.trim().startsWith('```')) {
      flushTable();
      flushQuote();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        resultLines.push(codeBlockLang ? `{code:${codeBlockLang}}` : '{code}');
      } else {
        inCodeBlock = false;
        resultLines.push('{/code}');
      }
      continue;
    }

    if (inCodeBlock) {
      resultLines.push(line);
      continue;
    }

    // 2. Tables
    const isTable = line.trim().startsWith('|') && line.trim().endsWith('|');
    if (isTable) {
      flushQuote();
      inTable = true;
      tableLines.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // 3. Blockquotes: > quote -> >> ... <<
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushTable();
      inQuote = true;
      quoteLines.push(quoteMatch[1]);
      continue;
    } else if (inQuote) {
      flushQuote();
    }

    // 4. Headings: # -> *
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      resultLines.push(`${'*'.repeat(level)} ${headingMatch[2]}`);
      continue;
    }

    // 5. Bullet Lists: - or * with indentation -> - or --
    const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (bulletMatch && !bulletMatch[3].startsWith('[ ]') && !bulletMatch[3].startsWith('[x]')) {
      const indentSpaces = bulletMatch[1].length;
      const nestLevel = Math.floor(indentSpaces / 2) + 1;
      const marker = '-'.repeat(Math.min(nestLevel, 6));
      resultLines.push(`${marker} ${bulletMatch[3]}`);
      continue;
    }

    // 6. Numbered Lists: 1. with indentation -> + or ++
    const numMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (numMatch) {
      const indentSpaces = numMatch[1].length;
      const nestLevel = Math.floor(indentSpaces / 2) + 1;
      const marker = '+'.repeat(Math.min(nestLevel, 6));
      resultLines.push(`${marker} ${numMatch[2]}`);
      continue;
    }

    // 7. Inline conversions: bold, strike, links
    let processed = line;
    // Bold: **text** -> ''text''
    processed = processed.replace(/\*\*([^*]+)\*\*/g, "''$1''");
    // Strike: ~~text~~ -> %%text%%
    processed = processed.replace(/~~([^~]+)~~/g, '%%$1%%');
    // Link: [title](url) -> [[title>url]]
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[[$1>$2]]');

    resultLines.push(processed);
  }

  flushTable();
  flushQuote();

  return resultLines.join('\n');
}

/**
 * Convert full Backlog document or snippet to Markdown format.
 */
export function backlogToMarkdown(backlogText: string): string {
  const lines = backlogText.split(/\r?\n/);
  const resultLines: string[] = [];

  let inCodeBlock = false;
  let inTable = false;
  const tableLines: string[] = [];
  let inQuote = false;
  const quoteLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length > 0) {
      resultLines.push(backlogTableToMarkdownTable(tableLines.join('\n')));
      tableLines.length = 0;
    }
    inTable = false;
  };

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      for (const q of quoteLines) {
        resultLines.push(`> ${q}`);
      }
      quoteLines.length = 0;
    }
    inQuote = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Code blocks: {code:lang} ... {/code}
    const codeStartMatch = line.match(/^\{code(?::([a-zA-Z0-9_-]+))?\}$/);
    if (codeStartMatch) {
      flushTable();
      flushQuote();
      inCodeBlock = true;
      const lang = codeStartMatch[1] || '';
      resultLines.push(`\`\`\`${lang}`);
      continue;
    }
    if (line.trim() === '{/code}') {
      inCodeBlock = false;
      resultLines.push('```');
      continue;
    }

    if (inCodeBlock) {
      resultLines.push(line);
      continue;
    }

    // 2. Quotes: >> ... <<
    if (line.trim() === '>>') {
      flushTable();
      flushQuote();
      inQuote = true;
      continue;
    }
    if (line.trim() === '<<') {
      flushQuote();
      continue;
    }
    if (inQuote) {
      quoteLines.push(line);
      continue;
    }

    // 3. Tables
    if (isBacklogTableRow(line)) {
      inTable = true;
      tableLines.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // 4. Headings: * -> #
    const headingMatch = line.match(/^(\*{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      resultLines.push(`${'#'.repeat(level)} ${headingMatch[2]}`);
      continue;
    }

    // 5. Bullet Lists: - -> -
    const bulletMatch = line.match(/^(-{1,6})\s+(.*)$/);
    if (bulletMatch) {
      const level = bulletMatch[1].length;
      const indent = '  '.repeat(level - 1);
      resultLines.push(`${indent}- ${bulletMatch[2]}`);
      continue;
    }

    // 6. Numbered Lists: + -> 1.
    const numMatch = line.match(/^(\+{1,6})\s+(.*)$/);
    if (numMatch) {
      const level = numMatch[1].length;
      const indent = '  '.repeat(level - 1);
      resultLines.push(`${indent}1. ${numMatch[2]}`);
      continue;
    }

    // 7. Inline conversions: bold, strike, links
    let processed = line;
    // Bold: ''text'' -> **text**
    processed = processed.replace(/''([^']+)''/g, '**$1**');
    // Strike: %%text%% -> ~~text~~
    processed = processed.replace(/%%([^%]+)%%/g, '~~$1~~');
    // Link: [[title>url]] -> [title](url) or [[url]] -> [url](url)
    processed = processed.replace(/\[\[([^>\]]+)>([^\]]+)\]\]/g, '[$1]($2)');
    processed = processed.replace(/\[\[([^\]]+)\]\]/g, '[$1]($1)');

    resultLines.push(processed);
  }

  flushTable();
  flushQuote();

  return resultLines.join('\n');
}
