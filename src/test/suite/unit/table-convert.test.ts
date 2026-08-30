import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMarkdown, serializeMarkdown } from '../../../serializers/markdown-serializer';
import { convertTableToGfmAtIndex } from '../../../utils/table-convert';

const testMdPath = join(__dirname, '../../../../../temporary/test.md');

function getTableAt(doc: ReturnType<typeof parseMarkdown>, index: number) {
  const tables = doc.content.filter((n) => n.type === 'table');
  return tables[index];
}

function isGfmPipeTable(md: string): boolean {
  return /^\|[^\n]+\|\s*\n\|[-:\s|]+\|\s*\n/m.test(md);
}

suite('table-convert', () => {
  test('TC-087: convert html table at index 0 to gfm serializes pipe table', () => {
    const md =
      '<table><tr><td>Line1<br/>Line2</td><td><ul><li>Item A</li></ul></td></tr></table>\n';
    const doc = parseMarkdown(md);
    assert.strictEqual(getTableAt(doc, 0)?.attrs?.tableFormat, 'html');

    const converted = convertTableToGfmAtIndex(doc, 0);
    assert.strictEqual(getTableAt(converted, 0)?.attrs?.tableFormat, 'gfm');

    const out = serializeMarkdown(converted);
    assert.ok(isGfmPipeTable(out), 'must serialize as GFM pipe table');
    assert.ok(out.includes('Line1'));
    assert.ok(out.includes('Item A'));
    assert.ok(!out.includes('<table>'), 'HTML block must be replaced by GFM');
  });

  test('TC-097: convert only middle html table in multi-table document', () => {
    const md =
      '| gfm1 | gfm1 |\n| --- | --- |\n| a | b |\n\n' +
      '<table><tr><th>html-h</th></tr><tr><td>html-cell</td></tr></table>\n\n' +
      '| gfm2 | gfm2 |\n| --- | --- |\n| c | d |\n';
    const doc = parseMarkdown(md);

    assert.strictEqual(getTableAt(doc, 0)?.attrs?.tableFormat, 'gfm');
    assert.strictEqual(getTableAt(doc, 1)?.attrs?.tableFormat, 'html');
    assert.strictEqual(getTableAt(doc, 2)?.attrs?.tableFormat, 'gfm');

    const converted = convertTableToGfmAtIndex(doc, 1);

    assert.strictEqual(getTableAt(converted, 0)?.attrs?.tableFormat, 'gfm');
    assert.strictEqual(getTableAt(converted, 1)?.attrs?.tableFormat, 'gfm');
    assert.strictEqual(getTableAt(converted, 2)?.attrs?.tableFormat, 'gfm');

    const out = serializeMarkdown(converted);
    assert.ok(out.includes('html-cell'), 'converted table content preserved');
    assert.ok(isGfmPipeTable(out), 'document must contain GFM pipe tables');
    assert.ok(!out.includes('<table>'), 'middle table must not remain HTML');
    assert.ok(out.includes('gfm1') && out.includes('gfm2'), 'other tables unchanged');
  });

  test('TC-100: converting wrong tableIndex 0 leaves html table in test.md', () => {
    const md =
      '| あああ | あああ | あああ |\n| --- | --- | --- |\n| あああ |  | あああ |\n\n' +
      '<table><tr><th>html-h</th></tr><tr><td>html-cell</td></tr></table>\n\n' +
      '| aaa | bbb |\n| --- | --- |\n| c | d |\n';
    const doc = parseMarkdown(md);
    const htmlBlockIndex = doc.content.findIndex(
      (n) => n.type === 'table' && n.attrs?.tableFormat === 'html',
    );
    assert.ok(htmlBlockIndex >= 0);

    const htmlTableIndex = doc.content
      .slice(0, htmlBlockIndex)
      .filter((n) => n.type === 'table').length;
    assert.strictEqual(htmlTableIndex, 1, 'HTML table must be top-level table index 1');

    const wrongTarget = convertTableToGfmAtIndex(doc, 0);
    assert.ok(
      serializeMarkdown(wrongTarget).includes('<table>'),
      'index 0 converts first GFM table only — HTML must remain',
    );

    const correctTarget = convertTableToGfmAtIndex(doc, htmlTableIndex);
    assert.ok(
      !serializeMarkdown(correctTarget).includes('<table>'),
      'index 1 must convert the HTML table',
    );
  });

  test('TC-099: temporary/test.md html table at index 1 converts to gfm', () => {
    let md: string;
    try {
      md = readFileSync(testMdPath, 'utf8');
    } catch {
      md =
        '| あああ | あああ | あああ |\n| --- | --- | --- |\n| あああ |  | あああ |\n| あああ |  |  |\n\n' +
        '<table>\n  <tr>\n    <th>あああ</th>\n    <th>あああ</th>\n    <th>あああ</th>\n  </tr>\n' +
        '  <tr>\n    <td>あああ</td>\n    <td>あああ</td>\n    <td>あああ</td>\n  </tr>\n' +
        '  <tr>\n    <td>あああ</td>\n    <td>あああ</td>\n    <td>あああ</td>\n  </tr>\n</table>\n\n' +
        '| aaa | bbb |\n| --- | --- |\n| fuga | aaa |\n';
    }

    const doc = parseMarkdown(md);
    const tables = doc.content.filter((n) => n.type === 'table');
    const htmlBlocks = doc.content.filter((n) => n.type === 'htmlBlock');
    assert.strictEqual(htmlBlocks.length, 0, 'must not fall back to htmlBlock atoms');
    assert.strictEqual(tables.length, 3, 'test.md must have 2 GFM + 1 HTML table');

    const htmlIndex = tables.findIndex((t) => t.attrs?.tableFormat === 'html');
    assert.strictEqual(htmlIndex, 1, 'HTML table must be at index 1 (not 0)');

    const htmlTable = tables[htmlIndex];
    assert.ok(
      (htmlTable.content?.length ?? 0) > 0,
      'HTML table must have editable rows, not html-only atom',
    );

    const converted = convertTableToGfmAtIndex(doc, htmlIndex);
    assert.strictEqual(tables[htmlIndex]?.attrs?.tableFormat, 'html');
    assert.strictEqual(
      converted.content.filter((n) => n.type === 'table')[htmlIndex]?.attrs?.tableFormat,
      'gfm',
    );

    const out = serializeMarkdown(converted);
    const htmlTableCount = (out.match(/<table[\s>]/gi) ?? []).length;
    assert.strictEqual(htmlTableCount, 0, `HTML table must be gone after convert; got:\n${out}`);
    assert.ok(out.includes('あああ'), 'cell text must remain');
    assert.ok(isGfmPipeTable(out), 'must contain GFM pipe table output');
  });
});
