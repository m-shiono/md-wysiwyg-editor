/** Shared table format conversion helpers (Host serializer + Webview editor). */

export interface TipTapNodeLike {
  type: string;
  content?: TipTapNodeLike[];
  attrs?: Record<string, unknown>;
  text?: string;
}

export interface TipTapDocLike {
  type: string;
  content?: TipTapNodeLike[];
}

export function flattenTipTapNodesToText(nodes: TipTapNodeLike[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      parts.push(node.text);
    } else if (node.type === 'paragraph') {
      const text = flattenTipTapNodesToText(node.content ?? []);
      if (text) {
        parts.push(text);
      }
    } else if (
      node.type === 'bulletList' ||
      node.type === 'orderedList' ||
      node.type === 'taskList'
    ) {
      for (const item of node.content ?? []) {
        const text = flattenTipTapNodesToText(item.content ?? []);
        if (text) {
          parts.push(text);
        }
      }
    } else if (node.content) {
      const text = flattenTipTapNodesToText(node.content);
      if (text) {
        parts.push(text);
      }
    }
  }
  return parts.join(' ');
}

export function flattenCellContent(nodes: TipTapNodeLike[]): TipTapNodeLike[] {
  const paragraphs: TipTapNodeLike[] = [];
  const pushParagraph = (text: string): void => {
    if (!text) {
      return;
    }
    paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text }] });
  };

  for (const node of nodes) {
    if (node.type === 'paragraph') {
      // 段落境界はセル内改行として残す（スペース結合しない）
      pushParagraph(flattenTipTapNodesToText(node.content ?? []));
    } else if (node.type === 'hardBreak') {
      continue;
    } else if (
      node.type === 'bulletList' ||
      node.type === 'orderedList' ||
      node.type === 'taskList'
    ) {
      pushParagraph(flattenTipTapNodesToText([node]));
    } else if (node.content) {
      for (const nested of flattenCellContent(node.content)) {
        if (nested.type === 'paragraph') {
          pushParagraph(flattenTipTapNodesToText(nested.content ?? []));
        }
      }
    } else {
      pushParagraph(flattenTipTapNodesToText([node]));
    }
  }

  return paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph', content: [] }];
}

function mapTableAtIndex<T extends TipTapDocLike>(
  doc: T,
  tableIndex: number,
  transform: (table: TipTapNodeLike) => TipTapNodeLike,
): T {
  let index = 0;
  const content = (doc.content ?? []).map((node) => {
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
  return { ...doc, content };
}

/** Convert one table at `tableIndex` from HTML format to GFM (flatten rich cells). */
export function convertTableToGfmAtIndex<T extends TipTapDocLike>(
  doc: T,
  tableIndex: number,
): T {
  return mapTableAtIndex(doc, tableIndex, (table) => {
    const rows = (table.content ?? []).map((row) => ({
      ...row,
      content: (row.content ?? []).map((cell) => ({
        ...cell,
        content: flattenCellContent(cell.content ?? []),
      })),
    }));
    return {
      ...table,
      attrs: {
        ...table.attrs,
        tableFormat: 'gfm',
        html: null,
        gfmSource: false,
        converted: false,
      },
      content: rows,
    };
  });
}
