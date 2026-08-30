import type { Root, Content, PhrasingContent, Table, TableCell, TableRow, Html, Code, BlockContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmTableToMarkdown } from 'mdast-util-gfm-table';
import { sanitizeHtml } from '../utils/sanitize';
import {
  convertTableToGfmAtIndex,
  flattenTipTapNodesToText,
} from '../utils/table-convert';

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

export type TableFormat = 'gfm' | 'html';

export interface SerializeOptions {
  deterministic?: boolean;
}

export interface CreateInsertTableDocOptions {
  insertTableFormat: TableFormat;
  rows?: number;
  cols?: number;
  withHeaderRow?: boolean;
}

const DEFAULT_SERIALIZE_OPTIONS: SerializeOptions = {
  deterministic: true,
};

let serializeFailureMock = false;
let parseFailureMock = false;

/** Test hook for TC-056. */
export function setSerializeFailureMock(enabled: boolean): void {
  serializeFailureMock = enabled;
}

/** Test hook for TC-078 / TC-079 (Raw parse failure). */
export function setParseFailureMock(enabled: boolean): void {
  parseFailureMock = enabled;
}

/** Parse Markdown string into TipTap document model. */
export function parseMarkdown(markdown: string): TipTapDoc {
  if (parseFailureMock) {
    throw new Error('Parse failure (mocked)');
  }
  if (markdown.includes('\0')) {
    throw new Error('Invalid markdown: null byte');
  }
  const tree = fromMarkdown(markdown, {
    extensions: [gfmTable()],
    mdastExtensions: [gfmTableFromMarkdown()],
  });
  const gfmTableSources = extractGfmTableSources(markdown);
  return mdastToTipTap(tree, { gfmTableSources, gfmTableSourceIndex: 0 }) as TipTapDoc;
}

/** Serialize TipTap document model to deterministic Markdown. */
export function serializeMarkdown(
  doc: TipTapDoc,
  options: SerializeOptions = DEFAULT_SERIALIZE_OPTIONS,
): string {
  if (serializeFailureMock) {
    throw new Error('Serialize failure (mocked)');
  }
  const mdast = tipTapToMdast(doc);
  const result = toMarkdown(mdast, {
    extensions: [gfmTableToMarkdown()],
    bullet: '-',
    emphasis: '*',
    strong: '*',
    rule: '-',
    listItemIndent: 'one',
    fences: true,
  });
  if (options.deterministic) {
    return normalizeOutput(result);
  }
  return result;
}

/** Round-trip helper for tests. */
export function roundTrip(markdown: string): string {
  const doc = parseMarkdown(markdown);
  return serializeMarkdown(doc);
}

function normalizeOutput(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function extractGfmTableSources(markdown: string): string[] {
  const sources: string[] = [];
  const lines = markdown.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    if (/^\|.*\|$/.test(line)) {
      const start = index;
      index += 1;
      while (index < lines.length && /^\|.*\|$/.test(lines[index]?.trim() ?? '')) {
        index += 1;
      }
      sources.push(lines.slice(start, index).join('\n'));
    } else {
      index += 1;
    }
  }
  return sources;
}

function tableContentFingerprint(node: TipTapNode): string {
  return JSON.stringify(node.content ?? []);
}

interface MdastToTipTapContext {
  gfmTableSources: string[];
  gfmTableSourceIndex: number;
}

function mdastToTipTap(
  node: Root | Content,
  context: MdastToTipTapContext = { gfmTableSources: [], gfmTableSourceIndex: 0 },
): TipTapNode | TipTapDoc {
  if (node.type === 'root') {
    const content: TipTapNode[] = [];
    for (const child of node.children) {
      const converted = mdastToTipTap(child, context);
      if ('type' in converted && converted.type !== 'doc') {
        content.push(converted as TipTapNode);
      }
    }
    return { type: 'doc', content };
  }

  switch (node.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: node.depth },
        content: phrasingToTipTap(node.children),
      };
    case 'paragraph':
      return {
        type: 'paragraph',
        content: phrasingToTipTap(node.children),
      };
    case 'blockquote':
      return {
        type: 'blockquote',
        content: node.children
          .filter((c) => c.type === 'paragraph')
          .map((c) => mdastToTipTap(c, context) as TipTapNode),
      };
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: node.lang ?? null },
        content: node.value ? [{ type: 'text', text: node.value }] : [],
      };
    case 'list': {
      const listType = node.ordered ? 'orderedList' : 'bulletList';
      return {
        type: listType,
        content: node.children.map((item) => ({
          type: 'listItem',
          content: item.children.map((c) => mdastToTipTap(c, context) as TipTapNode),
        })),
      };
    }
    case 'table': {
      const tableNode = gfmTableToHtmlTable(node, context);
      const source = context.gfmTableSources[context.gfmTableSourceIndex];
      context.gfmTableSourceIndex += 1;
      if (source) {
        tableNode.attrs = {
          ...tableNode.attrs,
          gfmSourceMarkdown: source,
          gfmContentFingerprint: tableContentFingerprint(tableNode),
        };
      }
      return tableNode;
    }
    case 'html':
      return htmlToTipTap(node);
    case 'thematicBreak':
      return { type: 'horizontalRule' };
    default:
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: extractRawText(node) }],
      };
  }
}

function phrasingToTipTap(nodes: PhrasingContent[]): TipTapNode[] {
  const result: TipTapNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result.push({ type: 'text', text: node.value });
        break;
      case 'strong':
        result.push({
          type: 'text',
          text: node.children.map((c) => (c.type === 'text' ? c.value : '')).join(''),
          marks: [{ type: 'bold' }],
        });
        break;
      case 'emphasis':
        result.push({
          type: 'text',
          text: node.children.map((c) => (c.type === 'text' ? c.value : '')).join(''),
          marks: [{ type: 'italic' }],
        });
        break;
      case 'inlineCode':
        result.push({
          type: 'text',
          text: node.value,
          marks: [{ type: 'code' }],
        });
        break;
      case 'link':
        result.push({
          type: 'text',
          text: node.children.map((c) => (c.type === 'text' ? c.value : '')).join(''),
          marks: [{ type: 'link', attrs: { href: node.url, target: '_blank' } }],
        });
        break;
      case 'image':
        result.push({
          type: 'image',
          attrs: {
            src: node.url,
            alt: node.alt ?? '',
            title: node.title ?? null,
          },
        });
        break;
      case 'html':
        result.push({ type: 'text', text: node.value });
        break;
      default:
        break;
    }
  }
  return result;
}

function inferTableFormat(attrs?: Record<string, unknown>): TableFormat {
  if (attrs?.tableFormat === 'gfm' || attrs?.tableFormat === 'html') {
    return attrs.tableFormat;
  }
  if (attrs?.gfmSource === true) {
    return 'gfm';
  }
  if (typeof attrs?.html === 'string' && attrs.html.length > 0) {
    return 'html';
  }
  if (attrs?.gfmSource === false || attrs?.converted === true) {
    return 'html';
  }
  return 'gfm';
}

function gfmTableToHtmlTable(table: Table, context: MdastToTipTapContext): TipTapNode {
  const rows = table.children.map((row: TableRow) => {
    const cells = row.children.map((cell: TableCell) => ({
      type: row.children.indexOf(cell) === 0 && table.align ? 'tableHeader' : 'tableCell',
      content: cell.children.length
        ? cell.children.map((c) => mdastToTipTap(c, context) as TipTapNode)
        : [{ type: 'paragraph' }],
    }));
    return { type: 'tableRow', content: cells };
  });
  return {
    type: 'table',
    attrs: { tableFormat: 'gfm', gfmSource: true, converted: false },
    content: rows,
  };
}

function htmlToTipTap(node: Html): TipTapNode {
  const sanitized = sanitizeHtml(node.value);
  if (/<table[\s>]/i.test(sanitized)) {
    const parsed = parseHtmlTableToTipTap(sanitized);
    if (parsed) {
      return parsed;
    }
    // Fallback: keep raw HTML only when structure cannot be recovered
    return {
      type: 'table',
      attrs: { tableFormat: 'html', html: sanitized, gfmSource: false, converted: true },
      content: [],
    };
  }
  return {
    type: 'htmlBlock',
    attrs: { html: sanitized },
  };
}

/**
 * Parse HTML `<table>` into an editable TipTap table model (AD-005).
 * Prefer structured rows/cells over atom htmlBlock so WYSIWYG edits persist.
 */
function parseHtmlTableToTipTap(html: string): TipTapNode | null {
  const rowMatches = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rowMatches.length === 0) {
    return null;
  }
  const rows: TipTapNode[] = [];
  for (const rowMatch of rowMatches) {
    const cellsHtml = rowMatch[1] ?? '';
    const cellMatches = [...cellsHtml.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
    if (cellMatches.length === 0) {
      continue;
    }
    const cells: TipTapNode[] = cellMatches.map((cellMatch) => {
      const tag = (cellMatch[1] ?? 'td').toLowerCase();
      const inner = cellMatch[2] ?? '';
      const cellType = tag === 'th' ? 'tableHeader' : 'tableCell';
      return {
        type: cellType,
        content: htmlCellInnerToTipTap(inner),
      };
    });
    rows.push({ type: 'tableRow', content: cells });
  }
  if (rows.length === 0) {
    return null;
  }
  return {
    type: 'table',
    attrs: { tableFormat: 'html', gfmSource: false, converted: true },
    content: rows,
  };
}

function htmlCellInnerToTipTap(inner: string): TipTapNode[] {
  const listMatch = inner.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i);
  if (listMatch) {
    const items = [...listMatch[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => {
      const checked = /type\s*=\s*["']?checkbox/i.test(m[1]) && /\bchecked\b/i.test(m[1]);
      const text = stripHtmlTags(m[1]).trim();
      if (/type\s*=\s*["']?checkbox/i.test(m[1])) {
        return {
          type: 'taskItem',
          attrs: { checked },
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
        };
      }
      return {
        type: 'listItem',
        content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
      };
    });
    const isTask = items.some((i) => i.type === 'taskItem');
    return [
      {
        type: isTask ? 'taskList' : 'bulletList',
        content: items,
      },
    ];
  }
  const withBreaks = inner.replace(/<br\s*\/?>/gi, '\n');
  const text = stripHtmlTags(withBreaks);
  const lines = text.split('\n');
  if (lines.length <= 1) {
    return [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ];
  }
  return lines.map((line) => ({
    type: 'paragraph',
    content: line ? [{ type: 'text', text: line }] : [],
  }));
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function extractRawText(node: Content): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((c) => extractRawText(c as Content)).join('');
  }
  return '';
}

function tipTapToMdast(doc: TipTapDoc): Root {
  return {
    type: 'root',
    children: doc.content.map(tipTapNodeToMdast).filter(Boolean) as Content[],
  };
}

function tipTapNodeToMdast(node: TipTapNode): Content | undefined {
  switch (node.type) {
    case 'heading':
      return {
        type: 'heading',
        depth: Math.min(6, Math.max(1, (node.attrs?.level as number) ?? 1)) as 1 | 2 | 3 | 4 | 5 | 6,
        children: tipTapPhrasingToMdast(node.content ?? []),
      };
    case 'paragraph':
      return {
        type: 'paragraph',
        children: tipTapPhrasingToMdast(node.content ?? []),
      };
    case 'blockquote':
      return {
        type: 'blockquote',
        children: (node.content ?? [])
          .filter((c) => c.type === 'paragraph')
          .map((c) => ({
            type: 'paragraph' as const,
            children: tipTapPhrasingToMdast(c.content ?? []),
          })),
      };
    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? undefined;
      const text = (node.content ?? []).map((c) => c.text ?? '').join('');
      return { type: 'code', lang, value: text } as Code;
    }
    case 'bulletList':
    case 'orderedList':
      return {
        type: 'list',
        ordered: node.type === 'orderedList',
        spread: false,
        children: (node.content ?? []).map((item) => ({
          type: 'listItem' as const,
          spread: false,
          children: (item.content ?? [])
            .map(tipTapNodeToMdast)
            .filter((c): c is Content => c !== undefined) as BlockContent[],
        })),
      };
    case 'table':
      if (inferTableFormat(node.attrs) === 'gfm') {
        const fingerprint = tableContentFingerprint(node);
        const storedFingerprint = node.attrs?.gfmContentFingerprint as string | undefined;
        const sourceMarkdown = node.attrs?.gfmSourceMarkdown as string | undefined;
        if (
          typeof sourceMarkdown === 'string' &&
          typeof storedFingerprint === 'string' &&
          fingerprint === storedFingerprint
        ) {
          const value = sourceMarkdown.endsWith('\n') ? sourceMarkdown : `${sourceMarkdown}\n`;
          return { type: 'html', value };
        }
        return tipTapTableToMdast(node);
      }
      return tableToHtmlBlock(node);
    case 'htmlBlock':
      return { type: 'html', value: (node.attrs?.html as string) ?? '' };
    case 'horizontalRule':
      return { type: 'thematicBreak' };
    case 'image':
      return {
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: (node.attrs?.src as string) ?? '',
            alt: (node.attrs?.alt as string) ?? '',
            title: (node.attrs?.title as string | null | undefined) ?? null,
          },
        ],
      };
    case 'taskList':
      return {
        type: 'list',
        ordered: false,
        spread: false,
        children: (node.content ?? []).map((item) => ({
          type: 'listItem',
          spread: false,
          checked: item.attrs?.checked === true,
          children: [
            {
              type: 'paragraph',
              children: tipTapPhrasingToMdast(item.content ?? []),
            },
          ],
        })),
      };
    default:
      return undefined;
  }
}

function tipTapPhrasingToMdast(nodes: TipTapNode[]): PhrasingContent[] {
  const result: PhrasingContent[] = [];
  for (const node of nodes) {
    if (node.type === 'image') {
      result.push({
        type: 'image',
        url: (node.attrs?.src as string) ?? '',
        alt: (node.attrs?.alt as string) ?? '',
        title: (node.attrs?.title as string | null | undefined) ?? null,
      });
      continue;
    }
    if (node.type !== 'text' || !node.text) {
      continue;
    }
    const marks = node.marks ?? [];
    let content: PhrasingContent = { type: 'text', value: node.text };
    for (const mark of marks) {
      if (mark.type === 'bold') {
        content = { type: 'strong', children: [content] };
      } else if (mark.type === 'italic') {
        content = { type: 'emphasis', children: [content] };
      } else if (mark.type === 'code') {
        content = { type: 'inlineCode', value: node.text };
      } else if (mark.type === 'link') {
        content = {
          type: 'link',
          url: (mark.attrs?.href as string) ?? '',
          children: [content],
        };
      }
    }
    result.push(content);
  }
  return result;
}

function tipTapTableToMdast(node: TipTapNode): Table {
  const rows = (node.content ?? []).map((row) => ({
    type: 'tableRow' as const,
    children: (row.content ?? []).map((cell) => ({
      type: 'tableCell' as const,
      children: cellToPhrasing(cell.content ?? []),
    })),
  }));
  return {
    type: 'table',
    align: null,
    children: rows,
  };
}

function cellToPhrasing(nodes: TipTapNode[]): PhrasingContent[] {
  for (const node of nodes) {
    if (node.type === 'paragraph') {
      const phrasing = tipTapPhrasingToMdast(node.content ?? []);
      if (phrasing.length > 0) {
        return phrasing;
      }
    }
  }
  const text = flattenTipTapNodesToText(nodes);
  return text ? [{ type: 'text', value: text }] : [];
}

function mapTableAtIndex(
  doc: TipTapDoc,
  tableIndex: number,
  transform: (table: TipTapNode) => TipTapNode,
): TipTapDoc {
  let index = 0;
  const content = doc.content.map((node) => {
    if (node.type !== 'table') {
      return node;
    }
    if (index === tableIndex) {
      index += 1;
      return transform(node);
    }
    index += 1;
    return node;
  });
  return { type: 'doc', content };
}

function tableToHtmlBlock(node: TipTapNode): Html {
  // Prefer live TipTap table content so WYSIWYG edits are persisted (AD-005).
  if (node.content && node.content.length > 0) {
    const html = tipTapTableToHtml(node);
    return { type: 'html', value: '\n' + html + '\n' };
  }
  if (node.attrs?.html && typeof node.attrs.html === 'string') {
    return { type: 'html', value: '\n' + node.attrs.html + '\n' };
  }
  const html = tipTapTableToHtml(node);
  return { type: 'html', value: '\n' + html + '\n' };
}

function tipTapTableToHtml(node: TipTapNode): string {
  const rows = node.content ?? [];
  let html = '<table>\n';
  for (const row of rows) {
    html += '  <tr>\n';
    for (const cell of row.content ?? []) {
      const tag = cell.type === 'tableHeader' ? 'th' : 'td';
      const inner = (cell.content ?? [])
        .map((c) => {
          if (c.type === 'paragraph') {
            return (c.content ?? []).map((t) => t.text ?? '').join('');
          }
          if (c.type === 'bulletList') {
            const items = (c.content ?? [])
              .map((li) => `<li>${(li.content ?? []).map((p) => (p.content ?? []).map((t) => t.text ?? '').join('')).join('')}</li>`)
              .join('');
            return `<ul>${items}</ul>`;
          }
          if (c.type === 'taskList') {
            const items = (c.content ?? [])
              .map(
                (li) =>
                  `<li><input type="checkbox"${li.attrs?.checked ? ' checked' : ''} disabled /> ${(li.content ?? []).map((p) => (p.content ?? []).map((t) => t.text ?? '').join('')).join('')}</li>`,
              )
              .join('');
            return `<ul>${items}</ul>`;
          }
          return '';
        })
        .join('<br/>');
      html += `    <${tag}>${sanitizeHtml(inner)}</${tag}>\n`;
    }
    html += '  </tr>\n';
  }
  html += '</table>';
  return sanitizeHtml(html);
}

/** Create a 3×3 table document for insert operations (§3). */
export function createInsertTableDoc(options: CreateInsertTableDocOptions): TipTapDoc {
  const rowCount = options.rows ?? 3;
  const colCount = options.cols ?? 3;
  const withHeaderRow = options.withHeaderRow ?? true;
  const tableRows: TipTapNode[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const cells: TipTapNode[] = [];
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const isHeader = withHeaderRow && rowIndex === 0;
      cells.push({
        type: isHeader ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      });
    }
    tableRows.push({ type: 'tableRow', content: cells });
  }
  return {
    type: 'doc',
    content: [
      {
        type: 'table',
        attrs: { tableFormat: options.insertTableFormat },
        content: tableRows,
      },
    ],
  };
}

/** Explicit GFM→HTML format conversion for one table (§3). */
export function convertTableToHtml(doc: TipTapDoc, tableIndex = 0): TipTapDoc {
  return mapTableAtIndex(doc, tableIndex, (table) => ({
    ...table,
    attrs: { ...table.attrs, tableFormat: 'html' },
  }));
}

/** Explicit HTML→GFM format conversion with rich-cell flatten (§3). */
export function convertTableToGfm(doc: TipTapDoc, tableIndex = 0): TipTapDoc {
  return convertTableToGfmAtIndex(doc, tableIndex);
}

/** Serialize TipTap doc to JSON string for webview transport. */
export function docToJson(doc: TipTapDoc): string {
  return JSON.stringify(doc);
}

/** Parse JSON from webview into TipTap doc. */
export function jsonToDoc(json: string): TipTapDoc {
  return JSON.parse(json) as TipTapDoc;
}

/** Check if document contains parseable content. */
export function canSerialize(doc: TipTapDoc): boolean {
  return doc.type === 'doc' && Array.isArray(doc.content);
}

/** Large file threshold (RK-004). */
export const LARGE_FILE_THRESHOLD_BYTES = 500 * 1024;

export function isLargeFile(content: string): boolean {
  return Buffer.byteLength(content, 'utf8') > LARGE_FILE_THRESHOLD_BYTES;
}
