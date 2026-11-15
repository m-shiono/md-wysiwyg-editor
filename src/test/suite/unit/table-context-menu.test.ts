import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { bootEditorWebviewInJsdom } from '../../helpers/webview-jsdom-harness';

function createSampleTableDoc(): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col A' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col B' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1A' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1B' }] }] },
            ],
          },
        ],
      },
    ],
  });
}

suite('Table Context Menu Tests (JSDOM runtime)', () => {
  test('TC-I31-019a: Right-clicking table cell opens context menu and executes row operation', () => {
    const harness = bootEditorWebviewInJsdom({
      initMessage: {
        docJson: createSampleTableDoc(),
        markdownText: '| Col A | Col B |\n| --- | --- |\n| R1A | R1B |',
        readonly: false,
        editorMode: 'markdown',
      },
    });
    try {
      const editorEl = harness.document.getElementById('editor')!;
      const cell = editorEl.querySelector('td')!;
      assert.ok(cell, 'Expected rendered td in TipTap table');

      const menu = harness.document.getElementById('table-context-menu')!;
      assert.strictEqual(menu.classList.contains('hidden'), true);

      cell.dispatchEvent(new harness.window.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 24,
      }));

      assert.strictEqual(menu.classList.contains('hidden'), false);
      assert.strictEqual(editorEl.querySelectorAll('tr').length, 2);

      const addRowAfterBtn = menu.querySelector('[data-table-op="addRowAfter"]')!;
      addRowAfterBtn.click();

      assert.strictEqual(menu.classList.contains('hidden'), true);
      assert.strictEqual(editorEl.querySelectorAll('tr').length, 3);
      assert.ok(harness.postedMessages.some((m) => m.type === 'update'));
    } finally {
      harness.dispose();
    }
  });

  test('TC-I31-019b: Context menu closes on Escape and is blocked in readonly and non-visual modes', () => {
    const harness = bootEditorWebviewInJsdom({
      initMessage: {
        docJson: createSampleTableDoc(),
        markdownText: '| Col A | Col B |\n| --- | --- |\n| R1A | R1B |',
        readonly: false,
        editorMode: 'markdown',
      },
    });
    try {
      const editorEl = harness.document.getElementById('editor')!;
      const cell = editorEl.querySelector('td')!;
      const menu = harness.document.getElementById('table-context-menu')!;

      cell.dispatchEvent(new harness.window.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 16,
        clientY: 16,
      }));
      assert.strictEqual(menu.classList.contains('hidden'), false);

      harness.dispatchKeydown(harness.document, { key: 'Escape' });
      assert.strictEqual(menu.classList.contains('hidden'), true);

      harness.sendHostMessage({ type: 'readonlyChanged', readonly: true });
      cell.dispatchEvent(new harness.window.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 16,
        clientY: 16,
      }));
      assert.strictEqual(menu.classList.contains('hidden'), true);

      harness.sendHostMessage({ type: 'readonlyChanged', readonly: false });
      harness.sendHostMessage({ type: 'modeChanged', editorMode: 'preview' });
      cell.dispatchEvent(new harness.window.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 16,
        clientY: 16,
      }));
      assert.strictEqual(menu.classList.contains('hidden'), true);
    } finally {
      harness.dispose();
    }
  });

  test('TC-I31-019c: editor.css defines context menu styles', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'media/editor.css'), 'utf8');
    assert.ok(css.includes('#table-context-menu'), 'media/editor.css must define #table-context-menu');
  });
});
