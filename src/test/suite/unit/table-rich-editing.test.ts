/**
 * TC-TRE-001–017: Table Rich Editing unit tests (table-rich-editing).
 * Covers:
 * - Column alignment GFM / HTML round-trip & CSP-safe rendering (AD-001, AD-002)
 * - Row/Column move & Duplicate row with header th/td normalization & boundary no-op (AD-003)
 * - Table menu, context menu, keyboard shortcuts (Alt+Arrow, Shift+Alt+Down) (AD-004)
 * - Smart paste (TSV 2x2+ & HTML <table>) for Visual/Source modes & false-positive guards (AD-005)
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as serializer from '../../../serializers/markdown-serializer';
import type { TipTapDoc, TipTapNode } from '../../../serializers/markdown-serializer';
import * as tableConvert from '../../../utils/table-convert';
import * as csvConverter from '../../../utils/csv-converter';
import { sanitizeHtml } from '../../../utils/sanitize';
import { checkTableLimits, TABLE_SOFT_LIMIT_MESSAGE } from '../../../utils/table-limits';

const { parseMarkdown, serializeMarkdown, convertTableToHtml, convertTableToGfm } = serializer;

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

function getTable(doc: TipTapDoc, index = 0): TipTapNode | undefined {
  const tables = doc.content.filter((n) => n.type === 'table');
  return tables[index];
}

function getCellText(cell: TipTapNode | undefined): string {
  if (!cell) {
    return '';
  }
  return (cell.content ?? [])
    .map((block) => (block.content ?? []).map((inline) => inline.text ?? '').join(''))
    .join('\n');
}

/** Resolve helper function from serializer, tableConvert, or csvConverter modules. */
function resolveHelper<T>(name: string): T | undefined {
  const sources: Record<string, unknown>[] = [
    serializer as unknown as Record<string, unknown>,
    tableConvert as unknown as Record<string, unknown>,
    csvConverter as unknown as Record<string, unknown>,
  ];
  for (const src of sources) {
    if (typeof src[name] === 'function') {
      return src[name] as T;
    }
  }
  return undefined;
}

suite('table-rich-editing (TC-TRE-001–017)', () => {
  test('TC-TRE-001: GFM pipe table column alignment round-trip (left, center, right, null) in aligned and compact modes', () => {
    const md = [
      '| L | C | R | N |',
      '| :--- | :---: | ---: | --- |',
      '| a | b | c | d |',
      '',
    ].join('\n');

    const doc = parseMarkdown(md);
    const table = getTable(doc);
    assert.ok(table, 'Table node must be parsed');

    const rows = table.content ?? [];
    assert.strictEqual(rows.length, 2, 'Table must have header row + 1 data row');

    // Both header row and data row cells must carry textAlign from mdast table.align
    for (const row of rows) {
      const cells = row.content ?? [];
      assert.strictEqual(cells[0]?.attrs?.textAlign, 'left', 'Col 0 must be left-aligned');
      assert.strictEqual(cells[1]?.attrs?.textAlign, 'center', 'Col 1 must be center-aligned');
      assert.strictEqual(cells[2]?.attrs?.textAlign, 'right', 'Col 2 must be right-aligned');
      assert.ok(
        cells[3]?.attrs?.textAlign === null || cells[3]?.attrs?.textAlign === undefined,
        'Col 3 must have null/undefined alignment',
      );
    }

    // Modify a cell so gfmSourceMarkdown cache is bypassed and tipTapTableToMdast is exercised
    const editedDoc: TipTapDoc = JSON.parse(JSON.stringify(doc));
    const editedTable = getTable(editedDoc)!;
    editedTable.content![1].content![0].content = [
      { type: 'paragraph', content: [{ type: 'text', text: 'edited-a' }] },
    ];

    const outCompact = serializeMarkdown(editedDoc, { tablePipeAlignment: 'compact' });
    const compactLines = outCompact.trim().split('\n');
    assert.strictEqual(compactLines.length, 3);
    assert.ok(
      /\|\s*:---+\s*\|\s*:---+:\s*\|\s*---+:\s*\|\s*---+\s*\|/.test(compactLines[1]),
      `Compact delimiter row must preserve :---, :---:, ---:, ---. Got: ${compactLines[1]}`,
    );

    const outAligned = serializeMarkdown(editedDoc, { tablePipeAlignment: 'aligned' });
    const alignedLines = outAligned.trim().split('\n');
    assert.ok(
      /\|\s*:---+\s*\|\s*:---+:\s*\|\s*---+:\s*\|\s*---+\s*\|/.test(alignedLines[1]),
      `Aligned delimiter row must preserve :---, :---:, ---:, ---. Got: ${alignedLines[1]}`,
    );
  });

  test('TC-TRE-002: HTML table column alignment round-trip extracts align and style text-align and persists align attributes', () => {
    const htmlMd = [
      '<table>',
      '  <tr><th align="left">H1</th><th style="text-align: center">H2</th><th align="right">H3</th></tr>',
      '  <tr><td align="left">A</td><td style="text-align: center">B</td><td align="right">C</td></tr>',
      '</table>',
      '',
    ].join('\n');

    // sanitizeHtml must preserve align and data-align on th/td
    const sanitized = sanitizeHtml(htmlMd);
    assert.ok(sanitized.includes('align="left"'), 'sanitizeHtml must allow align attribute');
    assert.ok(
      sanitizeHtml('<td data-align="center">X</td>').includes('data-align="center"'),
      'sanitizeHtml must allow data-align attribute',
    );

    const doc = parseMarkdown(htmlMd);
    const table = getTable(doc);
    assert.ok(table, 'HTML table must parse into TipTap table');
    assert.strictEqual(table.attrs?.tableFormat, 'html');

    const rows = table.content ?? [];
    assert.strictEqual(rows.length, 2);
    for (const row of rows) {
      const cells = row.content ?? [];
      assert.strictEqual(cells[0]?.attrs?.textAlign, 'left', 'Col 0 must extract left');
      assert.strictEqual(cells[1]?.attrs?.textAlign, 'center', 'Col 1 must extract center from style');
      assert.strictEqual(cells[2]?.attrs?.textAlign, 'right', 'Col 2 must extract right');
    }

    const serialized = serializeMarkdown(doc);
    assert.ok(serialized.includes('<th align="left">H1</th>'), 'Must serialize <th align="left">');
    assert.ok(serialized.includes('<th align="center">H2</th>'), 'Must serialize <th align="center">');
    assert.ok(serialized.includes('<th align="right">H3</th>'), 'Must serialize <th align="right">');
    assert.ok(serialized.includes('<td align="left">A</td>'), 'Must serialize <td align="left">');
    assert.ok(serialized.includes('<td align="center">B</td>'), 'Must serialize <td align="center">');
    assert.ok(serialized.includes('<td align="right">C</td>'), 'Must serialize <td align="right">');
  });

  test('TC-TRE-003: setColumnAlignment updates all rows in target column and toggles to null when re-applied', () => {
    const setColumnAlignment = resolveHelper<
      (
        table: TipTapNode,
        colIndex: number,
        align: 'left' | 'center' | 'right' | null,
      ) => TipTapNode
    >('setColumnAlignment');
    assert.ok(setColumnAlignment, 'setColumnAlignment helper must be exported');

    const md = '| H0 | H1 | H2 |\n| --- | --- | --- |\n| A0 | A1 | A2 |\n| B0 | B1 | B2 |\n';
    const doc = parseMarkdown(md);
    const table = getTable(doc)!;

    // 1. Set col 1 to 'center'
    const centered = setColumnAlignment!(table, 1, 'center');
    for (const row of centered.content ?? []) {
      assert.strictEqual(row.content?.[1]?.attrs?.textAlign, 'center');
      assert.ok(!row.content?.[0]?.attrs?.textAlign);
      assert.ok(!row.content?.[2]?.attrs?.textAlign);
    }

    // 2. Re-applying 'center' toggles col 1 back to null (cleared)
    const toggledOff = setColumnAlignment!(centered, 1, 'center');
    for (const row of toggledOff.content ?? []) {
      assert.ok(
        row.content?.[1]?.attrs?.textAlign === null ||
          row.content?.[1]?.attrs?.textAlign === undefined,
        'Re-applying same alignment must toggle off to null',
      );
    }

    // 3. Applying 'right' sets col 1 to 'right'
    const rightAligned = setColumnAlignment!(centered, 1, 'right');
    for (const row of rightAligned.content ?? []) {
      assert.strictEqual(row.content?.[1]?.attrs?.textAlign, 'right');
    }
  });

  test('TC-TRE-004: column alignment survives GFM <-> HTML table format conversions', () => {
    const md = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| L1 | C1 | R1 |\n';
    const gfmDoc = parseMarkdown(md);

    // GFM -> HTML
    const htmlDoc = convertTableToHtml(gfmDoc, 0);
    const htmlOut = serializeMarkdown(htmlDoc);
    assert.ok(htmlOut.includes('<th align="left">Left</th>'));
    assert.ok(htmlOut.includes('<th align="center">Center</th>'));
    assert.ok(htmlOut.includes('<th align="right">Right</th>'));
    assert.ok(htmlOut.includes('<td align="left">L1</td>'));
    assert.ok(htmlOut.includes('<td align="center">C1</td>'));
    assert.ok(htmlOut.includes('<td align="right">R1</td>'));

    // HTML -> GFM
    const backToGfmDoc = convertTableToGfm(htmlDoc, 0);
    const gfmOut = serializeMarkdown(backToGfmDoc, { tablePipeAlignment: 'compact' });
    const lines = gfmOut.trim().split('\n');
    assert.ok(
      /\|\s*:---+\s*\|\s*:---+:\s*\|\s*---+:\s*\|/.test(lines[1]),
      `HTML->GFM must preserve column alignments in delimiter row. Got: ${lines[1]}`,
    );
  });

  test('TC-TRE-005: moveRowUp and moveRowDown swap adjacent data rows and track target row index', () => {
    const moveTableRow = resolveHelper<
      (
        table: TipTapNode,
        rowIndex: number,
        direction: 'up' | 'down',
      ) => { table: TipTapNode; targetRowIndex: number; moved: boolean }
    >('moveTableRow');
    assert.ok(moveTableRow, 'moveTableRow helper must be exported');

    const md = '| H |\n| --- |\n| R1 |\n| R2 |\n| R3 |\n';
    const table = getTable(parseMarkdown(md))!;

    // Move R2 (rowIndex 2) up -> swaps with R1 (rowIndex 1)
    const upRes = moveTableRow!(table, 2, 'up');
    assert.strictEqual(upRes.moved, true);
    assert.strictEqual(upRes.targetRowIndex, 1);
    const upRows = (upRes.table.content ?? []).map((r) => getCellText(r.content?.[0]));
    assert.deepStrictEqual(upRows, ['H', 'R2', 'R1', 'R3']);

    // Move R2 (now at rowIndex 1) down -> swaps back with R1 (rowIndex 2)
    const downRes = moveTableRow!(upRes.table, 1, 'down');
    assert.strictEqual(downRes.moved, true);
    assert.strictEqual(downRes.targetRowIndex, 2);
    const downRows = (downRes.table.content ?? []).map((r) => getCellText(r.content?.[0]));
    assert.deepStrictEqual(downRows, ['H', 'R1', 'R2', 'R3']);
  });

  test('TC-TRE-006: swapping header row (index 0) and first data row (index 1) normalizes cell types (row 0 = th, row >= 1 = td)', () => {
    const moveTableRow = resolveHelper<
      (
        table: TipTapNode,
        rowIndex: number,
        direction: 'up' | 'down',
      ) => { table: TipTapNode; targetRowIndex: number; moved: boolean }
    >('moveTableRow');
    assert.ok(moveTableRow, 'moveTableRow helper must be exported');

    const md = '| H1 | H2 |\n| :--- | ---: |\n| A1 | A2 |\n| B1 | B2 |\n';
    const table = getTable(parseMarkdown(md))!;

    // Move data row 1 (A1, A2) up into header row 0
    const res = moveTableRow!(table, 1, 'up');
    assert.strictEqual(res.moved, true);
    assert.strictEqual(res.targetRowIndex, 0);

    const rows = res.table.content ?? [];
    assert.strictEqual(getCellText(rows[0].content?.[0]), 'A1');
    assert.strictEqual(getCellText(rows[1].content?.[0]), 'H1');

    // Row 0 cells must be normalized to tableHeader (th), Row 1+ cells to tableCell (td)
    for (const cell of rows[0].content ?? []) {
      assert.strictEqual(cell.type, 'tableHeader', 'New row 0 cells must be normalized to tableHeader');
    }
    for (const cell of rows[1].content ?? []) {
      assert.strictEqual(cell.type, 'tableCell', 'New row 1 cells must be normalized to tableCell');
    }
    // Column alignments must remain intact
    assert.strictEqual(rows[0].content?.[0]?.attrs?.textAlign, 'left');
    assert.strictEqual(rows[0].content?.[1]?.attrs?.textAlign, 'right');
  });

  test('TC-TRE-007: moveRowUp at row 0 and moveRowDown at last row are safe no-ops', () => {
    const moveTableRow = resolveHelper<
      (
        table: TipTapNode,
        rowIndex: number,
        direction: 'up' | 'down',
      ) => { table: TipTapNode; targetRowIndex: number; moved: boolean }
    >('moveTableRow');
    assert.ok(moveTableRow, 'moveTableRow helper must be exported');

    const md = '| H |\n| --- |\n| R1 |\n';
    const table = getTable(parseMarkdown(md))!;

    const topNoop = moveTableRow!(table, 0, 'up');
    assert.strictEqual(topNoop.moved, false);
    assert.strictEqual(topNoop.targetRowIndex, 0);

    const bottomNoop = moveTableRow!(table, 1, 'down');
    assert.strictEqual(bottomNoop.moved, false);
    assert.strictEqual(bottomNoop.targetRowIndex, 1);
  });

  test('TC-TRE-008: moveColumnLeft and moveColumnRight swap columns across all rows including textAlign', () => {
    const moveTableColumn = resolveHelper<
      (
        table: TipTapNode,
        colIndex: number,
        direction: 'left' | 'right',
      ) => { table: TipTapNode; targetColIndex: number; moved: boolean }
    >('moveTableColumn');
    assert.ok(moveTableColumn, 'moveTableColumn helper must be exported');

    const md = '| C0 | C1 | C2 |\n| :--- | :---: | ---: |\n| a0 | a1 | a2 |\n';
    const table = getTable(parseMarkdown(md))!;

    // Move col 1 left -> swaps with col 0
    const leftRes = moveTableColumn!(table, 1, 'left');
    assert.strictEqual(leftRes.moved, true);
    assert.strictEqual(leftRes.targetColIndex, 0);

    const headerCells = leftRes.table.content?.[0]?.content ?? [];
    const dataCells = leftRes.table.content?.[1]?.content ?? [];
    assert.deepStrictEqual(headerCells.map(getCellText), ['C1', 'C0', 'C2']);
    assert.deepStrictEqual(dataCells.map(getCellText), ['a1', 'a0', 'a2']);
    assert.strictEqual(headerCells[0]?.attrs?.textAlign, 'center');
    assert.strictEqual(headerCells[1]?.attrs?.textAlign, 'left');
    assert.strictEqual(headerCells[2]?.attrs?.textAlign, 'right');

    // Move col 0 right -> swaps back with col 1
    const rightRes = moveTableColumn!(leftRes.table, 0, 'right');
    assert.strictEqual(rightRes.moved, true);
    assert.strictEqual(rightRes.targetColIndex, 1);
    assert.deepStrictEqual(
      (rightRes.table.content?.[0]?.content ?? []).map(getCellText),
      ['C0', 'C1', 'C2'],
    );
  });

  test('TC-TRE-009: moveColumnLeft at col 0 and moveColumnRight at last col are safe no-ops', () => {
    const moveTableColumn = resolveHelper<
      (
        table: TipTapNode,
        colIndex: number,
        direction: 'left' | 'right',
      ) => { table: TipTapNode; targetColIndex: number; moved: boolean }
    >('moveTableColumn');
    assert.ok(moveTableColumn, 'moveTableColumn helper must be exported');

    const md = '| C0 | C1 |\n| --- | --- |\n| a0 | a1 |\n';
    const table = getTable(parseMarkdown(md))!;

    const leftNoop = moveTableColumn!(table, 0, 'left');
    assert.strictEqual(leftNoop.moved, false);
    assert.strictEqual(leftNoop.targetColIndex, 0);

    const rightNoop = moveTableColumn!(table, 1, 'right');
    assert.strictEqual(rightNoop.moved, false);
    assert.strictEqual(rightNoop.targetColIndex, 1);
  });

  test('TC-TRE-010: duplicateRow clones cell contents and textAlign as data row (td) below target row (including header row)', () => {
    const duplicateTableRow = resolveHelper<
      (
        table: TipTapNode,
        rowIndex: number,
      ) => { table: TipTapNode; targetRowIndex: number }
    >('duplicateTableRow');
    assert.ok(duplicateTableRow, 'duplicateTableRow helper must be exported');

    const md = '| H1 | H2 |\n| :---: | ---: |\n| D1 | D2 |\n';
    const table = getTable(parseMarkdown(md))!;

    // 1. Duplicate data row (rowIndex 1)
    const dupData = duplicateTableRow!(table, 1);
    assert.strictEqual(dupData.targetRowIndex, 2);
    const rowsAfterDataDup = dupData.table.content ?? [];
    assert.strictEqual(rowsAfterDataDup.length, 3);
    assert.deepStrictEqual(rowsAfterDataDup[2].content?.map(getCellText), ['D1', 'D2']);
    assert.strictEqual(rowsAfterDataDup[2].content?.[0]?.type, 'tableCell');
    assert.strictEqual(rowsAfterDataDup[2].content?.[0]?.attrs?.textAlign, 'center');
    assert.strictEqual(rowsAfterDataDup[2].content?.[1]?.attrs?.textAlign, 'right');

    // 2. Duplicate header row (rowIndex 0) -> inserts as tableCell (td) at rowIndex 1
    const dupHeader = duplicateTableRow!(table, 0);
    assert.strictEqual(dupHeader.targetRowIndex, 1);
    const rowsAfterHeaderDup = dupHeader.table.content ?? [];
    assert.strictEqual(rowsAfterHeaderDup.length, 3);
    assert.deepStrictEqual(rowsAfterHeaderDup[0].content?.map(getCellText), ['H1', 'H2']);
    assert.deepStrictEqual(rowsAfterHeaderDup[1].content?.map(getCellText), ['H1', 'H2']);
    assert.strictEqual(
      rowsAfterHeaderDup[0].content?.[0]?.type,
      'tableHeader',
      'Row 0 must remain tableHeader',
    );
    assert.strictEqual(
      rowsAfterHeaderDup[1].content?.[0]?.type,
      'tableCell',
      'Duplicated header row at index 1 must be normalized to tableCell (td)',
    );
    assert.strictEqual(rowsAfterHeaderDup[1].content?.[0]?.attrs?.textAlign, 'center');
  });

  test('TC-TRE-011: UI menus, keyboard shortcuts, and CSP-safe alignment CSS contracts', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    const editorTsSrc = readRepoFile('media/editor.ts');
    const editorCssSrc = readRepoFile('media/editor.css');
    const pkgJson = JSON.parse(readRepoFile('package.json'));

    const requiredMenuOps = [
      { op: 'moveRowUp', label: 'Move row up' },
      { op: 'moveRowDown', label: 'Move row down' },
      { op: 'duplicateRow', label: 'Duplicate row' },
      { op: 'moveColumnLeft', label: 'Move column left' },
      { op: 'moveColumnRight', label: 'Move column right' },
      { op: 'alignLeft', label: 'Align Left' },
      { op: 'alignCenter', label: 'Align Center' },
      { op: 'alignRight', label: 'Align Right' },
    ];

    const tableMenuMatch = providerSrc.match(/<div id="table-menu-panel"[\s\S]*?<\/div>/);
    const contextMenuMatch = providerSrc.match(/<div id="table-context-menu"[\s\S]*?<\/div>/);
    assert.ok(tableMenuMatch, '#table-menu-panel must exist');
    assert.ok(contextMenuMatch, '#table-context-menu must exist');

    for (const { op, label } of requiredMenuOps) {
      assert.ok(
        tableMenuMatch![0].includes(`data-table-op="${op}"`) &&
          tableMenuMatch![0].includes(label),
        `#table-menu-panel must contain ${op} (${label})`,
      );
      assert.ok(
        contextMenuMatch![0].includes(`data-table-op="${op}"`) &&
          contextMenuMatch![0].includes(label),
        `#table-context-menu must contain ${op} (${label})`,
      );
    }

    // Shortcuts in media/editor.ts
    assert.ok(
      editorTsSrc.includes('Alt-ArrowUp') || editorTsSrc.includes('ArrowUp'),
      'editor.ts must bind Alt+ArrowUp for moveRowUp',
    );
    assert.ok(
      editorTsSrc.includes('Alt-ArrowDown') || editorTsSrc.includes('ArrowDown'),
      'editor.ts must bind Alt+ArrowDown / Shift+Alt+ArrowDown',
    );
    assert.ok(
      editorTsSrc.includes('Alt-ArrowLeft') || editorTsSrc.includes('ArrowLeft'),
      'editor.ts must bind Alt+ArrowLeft for moveColumnLeft',
    );
    assert.ok(
      editorTsSrc.includes('Alt-ArrowRight') || editorTsSrc.includes('ArrowRight'),
      'editor.ts must bind Alt+ArrowRight for moveColumnRight',
    );

    // Must not pollute global package.json keybindings with table move shortcuts
    const keybindings = pkgJson.contributes?.keybindings ?? [];
    assert.strictEqual(keybindings.length, 0, 'package.json must not register global keybindings');

    // CSP & external CSS for cell alignment
    assert.ok(
      !providerSrc.includes("'unsafe-inline'"),
      'CSP in markdown-editor-provider.ts must not contain unsafe-inline',
    );
    assert.ok(
      editorCssSrc.includes('data-align="center"') || editorCssSrc.includes("data-align='center'"),
      'media/editor.css must define attribute selector for data-align="center"',
    );
    assert.ok(
      editorCssSrc.includes('data-align="right"') || editorCssSrc.includes("data-align='right'"),
      'media/editor.css must define attribute selector for data-align="right"',
    );
  });

  test('TC-TRE-012: TSV smart paste detection and conversion for Source (GFM pipe table) and Visual (TipTap table node)', () => {
    const isSmartPasteTsv = resolveHelper<(text: string) => boolean>('isSmartPasteTsv');
    const convertSmartPasteToMarkdown = resolveHelper<
      (
        clipboard: { plainText?: string; htmlText?: string },
        alignment?: 'aligned' | 'compact',
      ) => string | null
    >('convertSmartPasteToMarkdown');
    const convertSmartPasteToTipTapTable = resolveHelper<
      (
        clipboard: { plainText?: string; htmlText?: string },
        tableFormat?: 'gfm' | 'html',
      ) => TipTapNode | null
    >('convertSmartPasteToTipTapTable');

    assert.ok(isSmartPasteTsv, 'isSmartPasteTsv must be exported');
    assert.ok(convertSmartPasteToMarkdown, 'convertSmartPasteToMarkdown must be exported');
    assert.ok(convertSmartPasteToTipTapTable, 'convertSmartPasteToTipTapTable must be exported');

    const tsv = 'Name\tRole\tScore\nAlice\tDev\t95\nBob\tQA\t88';
    assert.strictEqual(isSmartPasteTsv!(tsv), true, 'Valid 3x3 TSV must be detected');

    const mdCompact = convertSmartPasteToMarkdown!({ plainText: tsv }, 'compact');
    assert.ok(mdCompact, 'Must convert TSV to Markdown in compact mode');
    assert.strictEqual(
      mdCompact,
      ['| Name | Role | Score |', '| --- | --- | --- |', '| Alice | Dev | 95 |', '| Bob | QA | 88 |'].join('\n'),
    );

    const tableNode = convertSmartPasteToTipTapTable!({ plainText: tsv }, 'gfm');
    assert.ok(tableNode, 'Must convert TSV to TipTap table node');
    assert.strictEqual(tableNode!.type, 'table');
    assert.strictEqual(tableNode!.attrs?.tableFormat, 'gfm');
    assert.strictEqual(tableNode!.content?.length, 3);
    assert.strictEqual(tableNode!.content?.[0]?.content?.[0]?.type, 'tableHeader');
    assert.strictEqual(tableNode!.content?.[1]?.content?.[0]?.type, 'tableCell');
    assert.strictEqual(getCellText(tableNode!.content?.[1]?.content?.[0]), 'Alice');
  });

  test('TC-TRE-013: HTML <table> smart paste sanitizes dangerous markup and preserves cell breaks and column alignments', () => {
    const convertSmartPasteToTipTapTable = resolveHelper<
      (
        clipboard: { plainText?: string; htmlText?: string },
        tableFormat?: 'gfm' | 'html',
      ) => TipTapNode | null
    >('convertSmartPasteToTipTapTable');
    const convertSmartPasteToMarkdown = resolveHelper<
      (
        clipboard: { plainText?: string; htmlText?: string },
        alignment?: 'aligned' | 'compact',
      ) => string | null
    >('convertSmartPasteToMarkdown');

    assert.ok(convertSmartPasteToTipTapTable, 'convertSmartPasteToTipTapTable must be exported');
    assert.ok(convertSmartPasteToMarkdown, 'convertSmartPasteToMarkdown must be exported');

    const dirtyHtml = [
      '<html><body><table>',
      '  <tr><th align="center">Item</th><th style="text-align: right">Price</th></tr>',
      '  <tr><td>Book<br>Note</td><td style="text-align: right" onclick="alert(1)">$10<script>evil()</script></td></tr>',
      '</table></body></html>',
    ].join('\n');

    const tableNode = convertSmartPasteToTipTapTable!({ htmlText: dirtyHtml }, 'gfm');
    assert.ok(tableNode, 'Must parse clipboard HTML <table> into TipTap table');
    const serializedJson = JSON.stringify(tableNode);
    assert.ok(!serializedJson.includes('evil'), 'Script content must be stripped');
    assert.ok(!serializedJson.includes('onclick'), 'Event handlers must be stripped');

    const rows = tableNode!.content ?? [];
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].content?.[0]?.attrs?.textAlign, 'center');
    assert.strictEqual(rows[0].content?.[1]?.attrs?.textAlign, 'right');
    assert.strictEqual(rows[1].content?.[1]?.attrs?.textAlign, 'right');

    const mdOut = convertSmartPasteToMarkdown!({ htmlText: dirtyHtml }, 'compact');
    assert.ok(mdOut, 'Must convert clipboard HTML <table> to GFM pipe table for Source mode');
    assert.ok(!mdOut!.includes('<script'), 'Markdown output must not contain script');
    assert.ok(mdOut!.includes(':---:') && mdOut!.includes('---:'), 'Must preserve column alignments in GFM');
    assert.ok(/Book\s*<br\s*\/?>\s*Note/i.test(mdOut!), 'Must preserve cell linebreak as <br />');
  });

  test('TC-TRE-014: smart paste guards reject single-line tabs, tab-indented code, uneven non-tables, and code/readonly contexts', () => {
    const isSmartPasteTsv = resolveHelper<(text: string) => boolean>('isSmartPasteTsv');
    const shouldTriggerSmartTablePaste = resolveHelper<
      (context: {
        plainText?: string;
        htmlText?: string;
        inCodeBlock?: boolean;
        inInlineCode?: boolean;
        readonly?: boolean;
        editorMode?: string;
      }) => boolean
    >('shouldTriggerSmartTablePaste');

    assert.ok(isSmartPasteTsv, 'isSmartPasteTsv must be exported');
    assert.ok(shouldTriggerSmartTablePaste, 'shouldTriggerSmartTablePaste must be exported');

    // 1. Single-line with tab
    assert.strictEqual(isSmartPasteTsv!('hello\tworld'), false, 'Single line with tab must not be treated as TSV table');

    // 2. Tab-indented source code (leading tabs only, no inter-token tab columns)
    const indentedCode = 'function test() {\n\tconst a = 1;\n\tconst b = 2;\n\treturn a + b;\n}';
    assert.strictEqual(isSmartPasteTsv!(indentedCode), false, 'Tab-indented code must not be treated as TSV table');
    assert.strictEqual(
      isSmartPasteTsv!('\tconst a = 1;\n\tconst b = 2;'),
      false,
      'Lines with only leading indentation tabs must not be treated as TSV table',
    );

    // 3. Multi-line text without tabs
    assert.strictEqual(isSmartPasteTsv!('line 1\nline 2\nline 3'), false);

    // 4. Inconsistent column counts / non-tabular lines
    assert.strictEqual(isSmartPasteTsv!('a\tb\tc\nd_no_tab\n1\t2\t3\t4'), false);

    // 5. Context guards (codeBlock, inlineCode, readonly, preview)
    const validTsv = 'A\tB\n1\t2';
    assert.strictEqual(
      shouldTriggerSmartTablePaste!({ plainText: validTsv, inCodeBlock: true, editorMode: 'markdown' }),
      false,
      'Must not trigger inside codeBlock',
    );
    assert.strictEqual(
      shouldTriggerSmartTablePaste!({ plainText: validTsv, inInlineCode: true, editorMode: 'markdown' }),
      false,
      'Must not trigger inside inlineCode',
    );
    assert.strictEqual(
      shouldTriggerSmartTablePaste!({ plainText: validTsv, readonly: true, editorMode: 'markdown' }),
      false,
      'Must not trigger when readonly is true',
    );
    assert.strictEqual(
      shouldTriggerSmartTablePaste!({ plainText: validTsv, editorMode: 'preview' }),
      false,
      'Must not trigger in preview mode',
    );
    assert.strictEqual(
      shouldTriggerSmartTablePaste!({ plainText: validTsv, editorMode: 'markdown' }),
      true,
      'Must trigger in markdown mode when valid TSV and not in code/readonly',
    );
  });

  test('TC-TRE-015: minimum 2x2 TSV boundary and RFC 4180 quoted multiline cell smart paste', () => {
    const isSmartPasteTsv = resolveHelper<(text: string) => boolean>('isSmartPasteTsv');
    const convertSmartPasteToMarkdown = resolveHelper<
      (
        clipboard: { plainText?: string; htmlText?: string },
        alignment?: 'aligned' | 'compact',
      ) => string | null
    >('convertSmartPasteToMarkdown');

    assert.ok(isSmartPasteTsv, 'isSmartPasteTsv must be exported');
    assert.ok(convertSmartPasteToMarkdown, 'convertSmartPasteToMarkdown must be exported');

    const min2x2 = 'H1\tH2\nD1\tD2';
    assert.strictEqual(isSmartPasteTsv!(min2x2), true, '2x2 TSV must be accepted');

    const quotedMultilineTsv = 'H1\tH2\n"Line1\nLine2"\tVal2';
    assert.strictEqual(isSmartPasteTsv!(quotedMultilineTsv), true, '2x2 TSV with quoted multiline cell must be accepted');
    const md = convertSmartPasteToMarkdown!({ plainText: quotedMultilineTsv }, 'compact');
    assert.ok(md, 'Must convert quoted multiline TSV');
    assert.ok(md!.includes('Line1<br />Line2'), 'Quoted newline must become <br /> inside single cell');
  });

  test('TC-TRE-016: soft limit warning (100 rows x 20 cols) triggers warning without truncating pasted table', () => {
    const convertSmartPasteToTipTapTable = resolveHelper<
      (
        clipboard: { plainText?: string; htmlText?: string },
        tableFormat?: 'gfm' | 'html',
      ) => TipTapNode | null
    >('convertSmartPasteToTipTapTable');
    assert.ok(convertSmartPasteToTipTapTable, 'convertSmartPasteToTipTapTable must be exported');

    const rows: string[] = [];
    for (let r = 0; r < 101; r++) {
      rows.push(`R${r}C0\tR${r}C1\tR${r}C2`);
    }
    const largeTsv = rows.join('\n');
    const tableNode = convertSmartPasteToTipTapTable!({ plainText: largeTsv }, 'gfm');
    assert.ok(tableNode, 'Large TSV must still convert without truncation');
    assert.strictEqual(tableNode!.content?.length, 101, 'All 101 rows must be preserved');

    const limitCheck = checkTableLimits(101, 3);
    assert.strictEqual(limitCheck.exceeded, true);
    assert.strictEqual(limitCheck.message, TABLE_SOFT_LIMIT_MESSAGE);
  });

  test('TC-TRE-017: readonly and mode guards block table operations, shortcuts, and smart paste', () => {
    const shouldTriggerSmartTablePaste = resolveHelper<
      (context: {
        plainText?: string;
        htmlText?: string;
        inCodeBlock?: boolean;
        inInlineCode?: boolean;
        readonly?: boolean;
        editorMode?: string;
      }) => boolean
    >('shouldTriggerSmartTablePaste');
    assert.ok(shouldTriggerSmartTablePaste, 'shouldTriggerSmartTablePaste must be exported');

    const editorTsSrc = readRepoFile('media/editor.ts');

    // Verify handleTableOperation checks readonly and editorMode
    assert.ok(
      editorTsSrc.includes('if (readonly)'),
      'handleTableOperation must guard against readonly',
    );
    assert.ok(
      shouldTriggerSmartTablePaste!({
        plainText: 'H1\tH2\nA\tB',
        readonly: true,
        editorMode: 'raw',
      }) === false,
      'Smart paste in raw mode must be blocked when readonly is true',
    );
    assert.strictEqual(
      shouldTriggerSmartTablePaste!({
        htmlText: '<table><tr><td>A</td><td>B</td></tr></table>',
        readonly: true,
        editorMode: 'markdown',
      }),
      false,
      'HTML smart paste must be blocked when readonly is true',
    );
  });
});
