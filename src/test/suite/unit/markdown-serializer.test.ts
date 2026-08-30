import * as assert from 'assert';
import * as serializer from '../../../serializers/markdown-serializer';
import type { TipTapDoc, TipTapNode } from '../../../serializers/markdown-serializer';
import { sanitizeHtml } from '../../../utils/sanitize';
import { checkTableLimits, TABLE_SOFT_LIMIT_MESSAGE } from '../../../utils/table-limits';

const {
  parseMarkdown,
  serializeMarkdown,
  roundTrip,
  setSerializeFailureMock,
} = serializer;

function getTable(doc: TipTapDoc): TipTapNode | undefined {
  return doc.content.find((n) => n.type === 'table');
}

function normalizeMd(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function isGfmPipeTable(md: string): boolean {
  return /^\| .+\|$/m.test(md) && /\|[ \t-]+\|/.test(md);
}

/** Simulate WYSIWYG cell edit without auto format conversion (TC-019). */
function editTableCell(doc: TipTapDoc, rowIdx: number, colIdx: number, text: string): TipTapDoc {
  const table = getTable(doc);
  if (!table?.content) {
    return doc;
  }
  const rows = table.content.map((row, ri) => {
    if (ri !== rowIdx || !row.content) {
      return row;
    }
    return {
      ...row,
      content: row.content.map((cell, ci) => {
        if (ci !== colIdx) {
          return cell;
        }
        return {
          ...cell,
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
        };
      }),
    };
  });
  return {
    type: 'doc',
    content: doc.content.map((node) =>
      node.type === 'table' ? { ...table, content: rows } : node,
    ),
  };
}

function getSerializerExport(name: string): ((doc: TipTapDoc) => TipTapDoc) | undefined {
  const fn = (serializer as Record<string, unknown>)[name];
  return typeof fn === 'function' ? (fn as (doc: TipTapDoc) => TipTapDoc) : undefined;
}

function getCreateInsertTableDoc():
  | ((options: {
      insertTableFormat: 'gfm' | 'html';
      rows?: number;
      cols?: number;
      withHeaderRow?: boolean;
    }) => TipTapDoc)
  | undefined {
  const fn = (serializer as Record<string, unknown>).createInsertTableDoc;
  return typeof fn === 'function'
    ? (fn as (options: {
        insertTableFormat: 'gfm' | 'html';
        rows?: number;
        cols?: number;
        withHeaderRow?: boolean;
      }) => TipTapDoc)
    : undefined;
}

suite('Markdown serializer unit tests', () => {
  test('TC-052: parse heading paragraph and mermaid block', () => {
    const md = '# Title\n\nParagraph text.\n\n```mermaid\ngraph TD; A-->B\n```\n';
    const doc = parseMarkdown(md);
    assert.strictEqual(doc.type, 'doc');
    assert.ok(doc.content.length >= 2);
    assert.strictEqual(doc.content[0].type, 'heading');
    const codeBlock = doc.content.find((n) => n.type === 'codeBlock');
    assert.ok(codeBlock);
    assert.strictEqual(codeBlock?.attrs?.language, 'mermaid');
  });

  test('TC-053: deterministic serialize output', () => {
    const md = '# Hello\n\n**bold** text.\n';
    const doc = parseMarkdown(md);
    const first = serializeMarkdown(doc);
    const second = serializeMarkdown(doc);
    assert.strictEqual(first, second);
  });

  test('TC-054: HTML table round-trip preserves table tag and tableFormat html', () => {
    const md = 'Intro\n\n<table><tr><td>A</td><td>B</td></tr></table>\n';
    const doc = parseMarkdown(md);
    const tableNode = getTable(doc);
    assert.ok(tableNode, 'HTML table must become TipTap table model');
    assert.strictEqual(tableNode?.attrs?.tableFormat, 'html', 'HTML source must infer tableFormat html');
    assert.ok(
      (tableNode?.content?.length ?? 0) > 0,
      'HTML table must have editable row/cell content (not empty atom)',
    );
    const result = roundTrip(md);
    assert.ok(result.includes('<table>'));
    assert.ok(result.includes('<td>A</td>') || result.includes('>A</td>'));
    assert.ok(!isGfmPipeTable(result), 'HTML table must not round-trip as GFM pipe table');
  });

  test('TC-019: gfm table keeps format after cell edit without auto convert', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    const doc = parseMarkdown(md);
    const table = getTable(doc);
    assert.ok(table);
    assert.strictEqual(table?.attrs?.tableFormat, 'gfm', 'GFM pipe source must infer tableFormat gfm');
    const edited = editTableCell(doc, 1, 0, 'edited');
    assert.strictEqual(getTable(edited)?.attrs?.tableFormat, 'gfm', 'cell edit must not change tableFormat');
    const out = serializeMarkdown(edited);
    assert.ok(isGfmPipeTable(out), 'edited GFM table must serialize as GFM pipe table');
    assert.ok(!out.includes('<table>'), 'must not auto-convert to HTML on edit');
  });

  test('TC-016: insert table with gfm format serializes to pipe table', () => {
    const createInsertTableDoc = getCreateInsertTableDoc();
    assert.ok(createInsertTableDoc, 'createInsertTableDoc export required for TC-016');
    let doc = createInsertTableDoc!({
      insertTableFormat: 'gfm',
      rows: 3,
      cols: 3,
      withHeaderRow: true,
    });
    doc = editTableCell(doc, 1, 0, 'cell text');
    const table = getTable(doc);
    assert.strictEqual(table?.attrs?.tableFormat, 'gfm');
    const out = serializeMarkdown(doc);
    assert.ok(isGfmPipeTable(out), 'GFM insert must serialize as GFM pipe table');
    assert.ok(out.includes('cell text'));
  });

  test('TC-018: insert table with html format serializes to html block', () => {
    const createInsertTableDoc = getCreateInsertTableDoc();
    assert.ok(createInsertTableDoc, 'createInsertTableDoc export required for TC-018');
    let doc = createInsertTableDoc!({
      insertTableFormat: 'html',
      rows: 3,
      cols: 3,
      withHeaderRow: true,
    });
    doc = editTableCell(doc, 1, 1, 'html cell');
    const table = getTable(doc);
    assert.strictEqual(table?.attrs?.tableFormat, 'html');
    const out = serializeMarkdown(doc);
    assert.ok(out.includes('<table>'), 'HTML insert must serialize as HTML table block');
    assert.ok(out.includes('html cell'));
    assert.ok(!isGfmPipeTable(out));
  });

  test('TC-086: convert gfm table to html format on explicit convert', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    const doc = parseMarkdown(md);
    assert.strictEqual(getTable(doc)?.attrs?.tableFormat, 'gfm');
    const convertTableToHtml = getSerializerExport('convertTableToHtml');
    assert.ok(convertTableToHtml, 'convertTableToHtml export required for TC-086');
    const converted = convertTableToHtml!(doc);
    assert.strictEqual(getTable(converted)?.attrs?.tableFormat, 'html');
    const out = serializeMarkdown(converted);
    assert.ok(out.includes('<table>'), 'converted table must serialize as HTML');
    assert.ok(!isGfmPipeTable(out));
  });

  test('TC-087: convert html table to gfm flattens rich cell content', () => {
    const md =
      '<table><tr><td>Line1<br/>Line2</td><td><ul><li>Item A</li></ul></td>' +
      '<td><ul><li><input type="checkbox" checked disabled /> Done</li></ul></td></tr></table>\n';
    const doc = parseMarkdown(md);
    assert.strictEqual(getTable(doc)?.attrs?.tableFormat, 'html');
    const convertTableToGfm = getSerializerExport('convertTableToGfm');
    assert.ok(convertTableToGfm, 'convertTableToGfm export required for TC-087');
    const converted = convertTableToGfm!(doc);
    assert.strictEqual(getTable(converted)?.attrs?.tableFormat, 'gfm');
    const out = serializeMarkdown(converted);
    assert.ok(isGfmPipeTable(out), 'converted table must serialize as GFM pipe table');
    assert.ok(out.includes('Line1'));
    assert.ok(out.includes('Line2') || out.includes('Line1 Line2') || out.includes('Line1<br'));
    assert.ok(out.includes('Item A'));
    assert.ok(out.includes('Done'));
    assert.ok(!out.includes('<ul>'), 'rich list markup must be flattened for GFM');
  });

  test('TC-091: gfm table round-trip preserves pipe format', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    const doc = parseMarkdown(md);
    assert.strictEqual(getTable(doc)?.attrs?.tableFormat, 'gfm');
    const result = roundTrip(md);
    assert.ok(isGfmPipeTable(result), 'GFM round-trip must stay GFM pipe table');
    assert.ok(!result.includes('<table>'), 'GFM round-trip must not emit HTML table');
    assert.strictEqual(normalizeMd(result), normalizeMd(md), 'AD-013 byte-identical GFM round-trip');
  });

  test('TC-092: html table round-trip preserves html format', () => {
    const md = 'Intro\n\n<table><tr><td>A</td><td>B</td></tr></table>\n';
    const doc = parseMarkdown(md);
    assert.strictEqual(getTable(doc)?.attrs?.tableFormat, 'html');
    const result = roundTrip(md);
    assert.ok(result.includes('<table>'), 'HTML round-trip must keep HTML table block');
    assert.ok(result.includes('A') && result.includes('B'));
    assert.ok(!isGfmPipeTable(result), 'HTML round-trip must not convert to GFM pipe table');
  });

  test('image node serializes to markdown image syntax', () => {
    const md = 'See ![alt text](img/image-0001.png) here.\n';
    const doc = parseMarkdown(md);
    const para = doc.content.find((n) => n.type === 'paragraph');
    const image = para?.content?.find((n) => n.type === 'image');
    assert.ok(image, 'image node must be parsed');
    assert.strictEqual(image?.attrs?.src, 'img/image-0001.png');
    const out = serializeMarkdown(doc);
    assert.ok(out.includes('![alt text](img/image-0001.png)') || out.includes('img/image-0001.png'));
  });

  test('TC-056: serialize failure throws', () => {
    setSerializeFailureMock(true);
    try {
      assert.throws(() => serializeMarkdown({ type: 'doc', content: [] }));
    } finally {
      setSerializeFailureMock(false);
    }
  });

  test('TC-058: sanitize strips script tags', () => {
    const result = sanitizeHtml('<script>alert(1)</script><p>ok</p>');
    assert.ok(!result.includes('<script'));
    assert.ok(result.includes('ok'));
  });

  test('TC-022: table soft limit warning message', () => {
    const result = checkTableLimits(101, 5);
    assert.strictEqual(result.exceeded, true);
    assert.strictEqual(result.message, TABLE_SOFT_LIMIT_MESSAGE);
  });

  test('TC-021: table at boundary has no warning', () => {
    const result = checkTableLimits(100, 20);
    assert.strictEqual(result.exceeded, false);
  });
});
