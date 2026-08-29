import type { Root, Content, PhrasingContent, Table, TableCell, TableRow, Html, Code, BlockContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmTableToMarkdown } from 'mdast-util-gfm-table';
import { sanitizeHtml } from '../utils/sanitize';

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

export interface SerializeOptions {
  deterministic?: boolean;
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
  return mdastToTipTap(tree) as TipTapDoc;
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

function mdastToTipTap(node: Root | Content): TipTapNode | TipTapDoc {
  if (node.type === 'root') {
    const content: TipTapNode[] = [];
    for (const child of node.children) {
      const converted = mdastToTipTap(child);
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
          .map((c) => mdastToTipTap(c) as TipTapNode),
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
          content: item.children.map((c) => mdastToTipTap(c) as TipTapNode),
        })),
      };
    }
    case 'table':
      return gfmTableToHtmlTable(node);
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

function gfmTableToHtmlTable(table: Table): TipTapNode {
  const rows = table.children.map((row: TableRow) => {
    const cells = row.children.map((cell: TableCell) => ({
      type: row.children.indexOf(cell) === 0 && table.align ? 'tableHeader' : 'tableCell',
      content: cell.children.length
        ? cell.children.map((c) => mdastToTipTap(c) as TipTapNode)
        : [{ type: 'paragraph' }],
    }));
    return { type: 'tableRow', content: cells };
  });
  return {
    type: 'table',
    attrs: { gfmSource: true, converted: false },
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
      attrs: { html: sanitized, gfmSource: false, converted: true },
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
    attrs: { gfmSource: false, converted: true },
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

/** Convert GFM table node to HTML-backed editable table on first edit (TC-019 / AD-005). */
export function convertGfmTableToHtml(doc: TipTapDoc): TipTapDoc {
  const content = doc.content.map((node) => {
    if (node.type === 'table' && node.attrs?.gfmSource && !node.attrs?.converted) {
      const html = tipTapTableToHtml(node);
      return {
        type: 'table',
        attrs: { html, gfmSource: false, converted: true },
        // Keep row/cell content so TipTap can edit; do not collapse to atom htmlBlock.
        content: node.content ?? [],
      };
    }
    return node;
  });
  return { type: 'doc', content };
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
