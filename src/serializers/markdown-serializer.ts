import type { Root, Content, PhrasingContent, Table, TableCell, TableRow, Html, Code, BlockContent, List, ListItem } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmStrikethroughFromMarkdown, gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import { gfmTaskListItemFromMarkdown, gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmTableToMarkdown } from 'mdast-util-gfm-table';
import { sanitizeHtml } from '../utils/sanitize';
import {
  convertTableToGfmAtIndex,
  flattenTipTapNodesToText,
} from '../utils/table-convert';

/** mdast GFM delete node (strikethrough). */
type DeleteNode = { type: 'delete'; children: PhrasingContent[] };

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
    extensions: [
      gfmTable(),
      // singleTilde: false — 単独 ~ は取り消し線にしない（AD-002 / TC-121）
      gfmStrikethrough({ singleTilde: false }),
      gfmTaskListItem(),
    ],
    mdastExtensions: [
      gfmTableFromMarkdown(),
      gfmStrikethroughFromMarkdown(),
      gfmTaskListItemFromMarkdown(),
    ],
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
    extensions: [gfmTableToMarkdown(), gfmStrikethroughToMarkdown(), gfmTaskListItemToMarkdown()],
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
        // paragraph-only フィルタは引用内の見出し・リスト等を落とすため禁止（AD-006）
        content: node.children.map((c) => mdastToTipTap(c, context) as TipTapNode),
      };
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: node.lang ?? null },
        content: node.value ? [{ type: 'text', text: node.value }] : [],
      };
    case 'list': {
      const listNode = node as List;
      const isTaskList = listNode.children.some(
        (item) => typeof (item as ListItem).checked === 'boolean',
      );
      if (isTaskList) {
        // 1. [ ] も unordered taskList へ正規化（番号は保持しない — AD-003）
        return {
          type: 'taskList',
          content: listNode.children.map((item) => ({
            type: 'taskItem' as const,
            attrs: { checked: (item as ListItem).checked === true },
            content: item.children.map((c) => mdastToTipTap(c, context) as TipTapNode),
          })),
        };
      }
      const listType = listNode.ordered ? 'orderedList' : 'bulletList';
      return {
        type: listType,
        content: listNode.children.map((item) => ({
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
  let htmlStrikeDepth = 0;

  const withHtmlStrike = (
    marks: Array<{ type: string; attrs?: Record<string, unknown> }>,
  ): Array<{ type: string; attrs?: Record<string, unknown> }> => {
    if (htmlStrikeDepth > 0 && !marks.some((m) => m.type === 'strike')) {
      return [...marks, { type: 'strike' }];
    }
    return marks;
  };

  const pushText = (
    text: string,
    marks: Array<{ type: string; attrs?: Record<string, unknown> }>,
  ): void => {
    if (!text) {
      return;
    }
    const resolved = withHtmlStrike(marks);
    result.push({
      type: 'text',
      text,
      ...(resolved.length > 0 ? { marks: resolved } : {}),
    });
  };

  const walk = (
    children: PhrasingContent[],
    marks: Array<{ type: string; attrs?: Record<string, unknown> }>,
  ): void => {
    for (const node of children) {
      switch (node.type) {
        case 'text':
          pushText(node.value, marks);
          break;
        case 'strong':
          walk(node.children, [...marks, { type: 'bold' }]);
          break;
        case 'emphasis':
          walk(node.children, [...marks, { type: 'italic' }]);
          break;
        case 'inlineCode':
          // code 優先 — strike と同時適用しない（AD-008）
          result.push({
            type: 'text',
            text: node.value,
            marks: [{ type: 'code' }],
          });
          break;
        case 'link':
          walk(node.children, [
            ...marks,
            { type: 'link', attrs: { href: node.url, target: '_blank' } },
          ]);
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
        case 'html': {
          const trimmed = node.value.trim();
          if (/^<(del|s|strike)(\s[^>]*)?>$/i.test(trimmed)) {
            htmlStrikeDepth += 1;
            break;
          }
          if (/^<\/(del|s|strike)\s*>$/i.test(trimmed)) {
            htmlStrikeDepth = Math.max(0, htmlStrikeDepth - 1);
            break;
          }
          // GFM セル内 <br /> を text にすると改行が落ち、htmlBlock にすると二重改行になる
          if (isGfmBreakHtml(node.value)) {
            const last = result[result.length - 1];
            if (last?.type !== 'hardBreak') {
              result.push({ type: 'hardBreak' });
            }
            break;
          }
          pushText(node.value, marks);
          break;
        }
        default: {
          // GFM strikethrough (`delete`) は @types/mdast の PhrasingContent に含まれない
          if ((node as { type: string }).type === 'delete') {
            walk((node as unknown as DeleteNode).children, [...marks, { type: 'strike' }]);
          }
          break;
        }
      }
    }
  };

  walk(nodes, []);
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

function gfmTableToHtmlTable(table: Table, _context: MdastToTipTapContext): TipTapNode {
  const rows = table.children.map((row: TableRow) => {
    const cells = row.children.map((cell: TableCell) => ({
      type: row.children.indexOf(cell) === 0 && table.align ? 'tableHeader' : 'tableCell',
      // phrasing として扱う。mdastToTipTap だと <br /> が htmlBlock になる
      content: [
        {
          type: 'paragraph',
          content: phrasingToTipTap(cell.children),
        },
      ],
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
          .map(tipTapNodeToMdast)
          .filter((c): c is Content => c !== undefined) as BlockContent[],
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
          type: 'listItem' as const,
          spread: false,
          checked: item.attrs?.checked === true,
          children: (item.content ?? [])
            .map(tipTapNodeToMdast)
            .filter((c): c is Content => c !== undefined) as BlockContent[],
        })),
      };
    default:
      return undefined;
  }
}

const GFM_CELL_BREAK_HTML = '<br />';

function isGfmBreakHtml(value: string): boolean {
  return /<br\s*\/?>/i.test(value);
}

function pushGfmCellBreak(result: PhrasingContent[]): void {
  const last = result[result.length - 1];
  if (last?.type === 'html' && isGfmBreakHtml(last.value)) {
    return;
  }
  result.push({ type: 'html', value: GFM_CELL_BREAK_HTML });
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
    if (node.type === 'hardBreak') {
      // mdast `break` はパイプ表で空白になるため HTML <br /> を使う
      pushGfmCellBreak(result);
      continue;
    }
    if (node.type !== 'text' || !node.text) {
      continue;
    }
    const marks = node.marks ?? [];
    // code 優先 — 他 mark と同時シリアライズしない（AD-008）
    if (marks.some((m) => m.type === 'code')) {
      result.push({ type: 'inlineCode', value: node.text });
      continue;
    }
    let content: PhrasingContent = { type: 'text', value: node.text };
    // 決定的ネスト: link → italic → bold → strike（外側へ）（AD-014）
    for (const markType of ['link', 'italic', 'bold', 'strike'] as const) {
      const mark = marks.find((m) => m.type === markType);
      if (!mark) {
        continue;
      }
      if (markType === 'bold') {
        content = { type: 'strong', children: [content] };
      } else if (markType === 'italic') {
        content = { type: 'emphasis', children: [content] };
      } else if (markType === 'strike') {
        content = { type: 'delete', children: [content] } as PhrasingContent;
      } else if (markType === 'link') {
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
  const result: PhrasingContent[] = [];
  for (const node of nodes) {
    if (node.type === 'paragraph') {
      const phrasing = tipTapPhrasingToMdast(node.content ?? []);
      if (phrasing.length === 0) {
        continue;
      }
      if (result.length > 0) {
        pushGfmCellBreak(result);
      }
      result.push(...phrasing);
      continue;
    }
    if (node.type === 'hardBreak') {
      if (result.length > 0) {
        pushGfmCellBreak(result);
      }
    }
  }
  if (result.length > 0) {
    return result;
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

function cloneDoc(doc: TipTapDoc): TipTapDoc {
  return JSON.parse(JSON.stringify(doc)) as TipTapDoc;
}

function flattenBlockText(node: TipTapNode): string {
  if (node.type === 'text') {
    return node.text ?? '';
  }
  return (node.content ?? []).map(flattenBlockText).join('');
}

/** TipTap heading toggle for unit tests (TC-108). */
export function applyToggleHeading(doc: TipTapDoc, level: number): TipTapDoc {
  const next = cloneDoc(doc);
  const first = next.content[0];
  if (!first) {
    return next;
  }
  if (first.type === 'heading' && first.attrs?.level === level) {
    next.content[0] = { type: 'paragraph', content: first.content ?? [] };
    return next;
  }
  next.content[0] = {
    type: 'heading',
    attrs: { level },
    content: first.content ?? [],
  };
  return next;
}

/** TipTap inline code toggle for unit tests (TC-109). */
export function applyToggleInlineCode(doc: TipTapDoc): TipTapDoc {
  const next = cloneDoc(doc);
  const first = next.content[0];
  if (!first || first.type !== 'paragraph') {
    return next;
  }
  first.content = (first.content ?? []).map((node) => {
    if (node.type !== 'text') {
      return node;
    }
    const marks = [...(node.marks ?? [])];
    const codeIndex = marks.findIndex((m) => m.type === 'code');
    if (codeIndex >= 0) {
      marks.splice(codeIndex, 1);
    } else {
      marks.push({ type: 'code' });
    }
    return { ...node, marks: marks.length > 0 ? marks : undefined };
  });
  return next;
}

/** TipTap code block toggle for unit tests (TC-109). */
export function applyToggleCodeBlock(doc: TipTapDoc): TipTapDoc {
  const next = cloneDoc(doc);
  const first = next.content[0];
  if (!first) {
    return next;
  }
  if (first.type === 'codeBlock') {
    next.content[0] = { type: 'paragraph', content: first.content ?? [] };
    return next;
  }
  const text = flattenBlockText(first);
  next.content[0] = {
    type: 'codeBlock',
    attrs: { language: null },
    content: text ? [{ type: 'text', text }] : [],
  };
  return next;
}

/** Exclusive list conversion: bullet / ordered / task (TC-112). checked is dropped off-task. */
export function convertExclusiveList(
  doc: TipTapDoc,
  target: 'bulletList' | 'orderedList' | 'taskList',
): TipTapDoc {
  const next = cloneDoc(doc);
  const first = next.content[0];
  if (!first || !['bulletList', 'orderedList', 'taskList'].includes(first.type)) {
    return next;
  }
  next.content[0] = {
    type: target,
    content: (first.content ?? []).map((item) => {
      if (target === 'taskList') {
        return {
          type: 'taskItem',
          attrs: { checked: false },
          content: item.content ?? [],
        };
      }
      return {
        type: 'listItem',
        content: item.content ?? [],
      };
    }),
  };
  return next;
}

/** Insert horizontal rule (not a toggle) — TC-113. */
export function insertHorizontalRule(doc: TipTapDoc): TipTapDoc {
  const next = cloneDoc(doc);
  next.content.push({ type: 'horizontalRule' });
  return next;
}

/** Toggle taskItem checked at index within the first taskList (TC-111). */
export function toggleTaskItemChecked(doc: TipTapDoc, itemIndex: number): TipTapDoc {
  const next = cloneDoc(doc);
  const walk = (nodes: TipTapNode[]): boolean => {
    for (const node of nodes) {
      if (node.type === 'taskList') {
        const item = node.content?.[itemIndex];
        if (item?.type === 'taskItem') {
          item.attrs = {
            ...item.attrs,
            checked: !(item.attrs?.checked === true),
          };
          return true;
        }
        return false;
      }
      if (node.content && walk(node.content)) {
        return true;
      }
    }
    return false;
  };
  walk(next.content);
  return next;
}
