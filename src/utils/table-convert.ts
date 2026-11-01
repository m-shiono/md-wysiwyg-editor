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

export type ColumnAlignment = 'left' | 'center' | 'right' | null;

/**
 * Normalize row cell types so that row 0 uses `tableHeader` (th) and rows >= 1 use `tableCell` (td).
 */
export function normalizeTableRowCellTypes<T extends TipTapNodeLike>(rows: T[]): T[] {
  return rows.map((row, rIdx) => {
    const expectedType = rIdx === 0 ? 'tableHeader' : 'tableCell';
    const cells = (row.content ?? []).map((cell) => ({
      ...cell,
      type: expectedType,
    }));
    return {
      ...row,
      content: cells,
    };
  });
}

/**
 * Bulk-update column alignment across all rows of a table (AD-001, AD-002).
 * If the target column already has `align` (non-null), re-applying the same alignment toggles it to `null`.
 */
export function setColumnAlignment<T extends TipTapNodeLike>(
  table: T,
  colIndex: number,
  align: ColumnAlignment,
): T {
  const rows = table.content ?? [];
  if (rows.length === 0 || colIndex < 0) {
    return table;
  }

  // Check if all existing cells in colIndex already have `align`
  const currentAlign = (rows[0]?.content?.[colIndex]?.attrs?.textAlign as ColumnAlignment) ?? null;
  const nextAlign: ColumnAlignment =
    align !== null && currentAlign === align ? null : align;

  const updatedRows = rows.map((row) => {
    const cells = (row.content ?? []).map((cell, cIdx) => {
      if (cIdx !== colIndex) {
        return cell;
      }
      const nextAttrs: Record<string, unknown> = {
        ...(cell.attrs ?? {}),
        textAlign: nextAlign,
      };
      return {
        ...cell,
        attrs: nextAttrs,
      };
    });
    return {
      ...row,
      content: cells,
    };
  });

  return {
    ...table,
    content: updatedRows,
  };
}

/**
 * Move a table row up or down by swapping with the adjacent row (AD-003).
 * Normalizes row 0 to `tableHeader` (th) and rows >= 1 to `tableCell` (td).
 */
export function moveTableRow<T extends TipTapNodeLike>(
  table: T,
  rowIndex: number,
  direction: 'up' | 'down',
): { table: T; targetRowIndex: number; moved: boolean } {
  const rows = [...(table.content ?? [])];
  const targetRowIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
  if (
    rowIndex < 0 ||
    rowIndex >= rows.length ||
    targetRowIndex < 0 ||
    targetRowIndex >= rows.length
  ) {
    return { table, targetRowIndex: rowIndex, moved: false };
  }

  const temp = rows[rowIndex];
  rows[rowIndex] = rows[targetRowIndex];
  rows[targetRowIndex] = temp;

  const normalizedRows = normalizeTableRowCellTypes(rows);

  return {
    table: {
      ...table,
      content: normalizedRows,
    },
    targetRowIndex,
    moved: true,
  };
}

/**
 * Move a table column left or right across all rows, including `textAlign` attributes (AD-003).
 */
export function moveTableColumn<T extends TipTapNodeLike>(
  table: T,
  colIndex: number,
  direction: 'left' | 'right',
): { table: T; targetColIndex: number; moved: boolean } {
  const rows = table.content ?? [];
  const colCount = rows[0]?.content?.length ?? 0;
  const targetColIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
  if (
    rows.length === 0 ||
    colIndex < 0 ||
    colIndex >= colCount ||
    targetColIndex < 0 ||
    targetColIndex >= colCount
  ) {
    return { table, targetColIndex: colIndex, moved: false };
  }

  const updatedRows = rows.map((row) => {
    const cells = [...(row.content ?? [])];
    if (colIndex < cells.length && targetColIndex < cells.length) {
      const temp = cells[colIndex];
      cells[colIndex] = cells[targetColIndex];
      cells[targetColIndex] = temp;
    }
    return {
      ...row,
      content: cells,
    };
  });

  return {
    table: {
      ...table,
      content: updatedRows,
    },
    targetColIndex,
    moved: true,
  };
}

/**
 * Duplicate the row at `rowIndex` and insert it directly below as a data row (`tableCell` / `td`) (AD-003).
 */
export function duplicateTableRow<T extends TipTapNodeLike>(
  table: T,
  rowIndex: number,
): { table: T; targetRowIndex: number } {
  const rows = [...(table.content ?? [])];
  if (rowIndex < 0 || rowIndex >= rows.length) {
    return { table, targetRowIndex: rowIndex };
  }

  const sourceRow = rows[rowIndex];
  const clonedRow: TipTapNodeLike = JSON.parse(JSON.stringify(sourceRow));
  clonedRow.content = (clonedRow.content ?? []).map((cell) => ({
    ...cell,
    type: 'tableCell',
  }));

  const targetRowIndex = rowIndex + 1;
  rows.splice(targetRowIndex, 0, clonedRow);

  const normalizedRows = normalizeTableRowCellTypes(rows);

  return {
    table: {
      ...table,
      content: normalizedRows,
    },
    targetRowIndex,
  };
}

