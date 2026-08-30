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
  const text = flattenTipTapNodesToText(nodes);
  return [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }];
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
