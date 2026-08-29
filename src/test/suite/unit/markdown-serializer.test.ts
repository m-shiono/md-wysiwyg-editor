import * as assert from 'assert';
import {
  parseMarkdown,
  serializeMarkdown,
  roundTrip,
  setSerializeFailureMock,
  convertGfmTableToHtml,
} from '../../../serializers/markdown-serializer';
import { sanitizeHtml } from '../../../utils/sanitize';
import { checkTableLimits, TABLE_SOFT_LIMIT_MESSAGE } from '../../../utils/table-limits';

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

  test('TC-054: HTML table round-trip preserves table tag', () => {
    const md = 'Intro\n\n<table><tr><td>A</td><td>B</td></tr></table>\n';
    const result = roundTrip(md);
    assert.ok(result.includes('<table>'));
    assert.ok(result.includes('<td>A</td>'));
  });

  test('TC-019: GFM table converts on first edit helper', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    const doc = parseMarkdown(md);
    const tableNode = doc.content.find((n) => n.type === 'table');
    assert.ok(tableNode);
    assert.strictEqual(tableNode?.attrs?.gfmSource, true);
    const converted = convertGfmTableToHtml(doc);
    const convertedTable = converted.content.find((n) => n.type === 'table');
    assert.strictEqual(convertedTable?.attrs?.converted, true);
    assert.ok(typeof convertedTable?.attrs?.html === 'string');
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
