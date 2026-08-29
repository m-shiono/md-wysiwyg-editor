export const TABLE_MAX_ROWS = 100;
export const TABLE_MAX_COLS = 20;

export const TABLE_SOFT_LIMIT_MESSAGE =
  'Table exceeds recommended size (100 rows × 20 columns)';

export interface TableLimitResult {
  exceeded: boolean;
  message?: string;
  rows: number;
  cols: number;
}

export function checkTableLimits(rows: number, cols: number): TableLimitResult {
  const exceeded = rows > TABLE_MAX_ROWS || cols > TABLE_MAX_COLS;
  return {
    exceeded,
    message: exceeded ? TABLE_SOFT_LIMIT_MESSAGE : undefined,
    rows,
    cols,
  };
}

export function countTableDimensions(html: string): { rows: number; cols: number } {
  const rowMatches = html.match(/<tr[\s>]/gi);
  const rows = rowMatches?.length ?? 0;
  let cols = 0;
  const firstRow = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (firstRow) {
    const cellMatches = firstRow[1].match(/<t[dh][\s>]/gi);
    cols = cellMatches?.length ?? 0;
  }
  return { rows, cols };
}
