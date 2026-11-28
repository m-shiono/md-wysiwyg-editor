import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  extractOutlineHeadings,
  findLineStartOffset,
} from '../../../utils/editor-assist';
import { MarkdownEditorProvider } from '../../../providers/markdown-editor-provider';
import { MarpPreviewManager } from '../../../commands/marp-preview';
import { bootEditorWebviewInJsdom } from '../../helpers/webview-jsdom-harness';
import type { WebviewInboundMessage } from '../../../webviews/messages';
import type * as vscodeMockTypes from '../../mocks/vscode';

type VscodeTestShim = typeof vscode & typeof vscodeMockTypes;
const mockVscode = vscode as unknown as VscodeTestShim;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeCancellationToken(): vscode.CancellationToken {
  return new vscode.CancellationTokenSource().token;
}

async function openOutlineJsdom(
  uri: vscode.Uri,
  initialMarkdown: string,
  editorMode: 'markdown' | 'raw' = 'raw',
  readonly = false,
) {
  mockVscode.setMockFile(uri, initialMarkdown);
  const ctx = mockVscode.createMockExtensionContext(process.cwd());
  mockVscode.setMockConfiguration('md-wysiwyg-editor', {
    defaultMode: editorMode === 'raw' ? 'source' : 'visual',
  });
  if (readonly) {
    await ctx.workspaceState.update(`readonly:${uri.toString()}`, true);
  }
  const marpManager = new MarpPreviewManager(
    ctx as unknown as vscode.ExtensionContext,
  );
  const provider = new MarkdownEditorProvider(
    ctx as unknown as vscode.ExtensionContext,
    marpManager,
  );
  const doc = await provider.openCustomDocument(
    uri,
    { backupId: undefined, untitledDocumentData: undefined },
    makeCancellationToken(),
  );
  const panel = mockVscode.createMockWebviewPanel(
    MarkdownEditorProvider.viewType,
    path.posix.basename(uri.path) || 'doc.md',
  );
  await provider.resolveCustomEditor(
    doc,
    panel as unknown as vscode.WebviewPanel,
    makeCancellationToken(),
  );

  const html = provider.getWebviewHtmlForTest(uri);
  const harness = bootEditorWebviewInJsdom({ html });

  let cursorFromHost = 0;
  let cursorFromWebview = 0;

  const flushBridge = async (): Promise<void> => {
    for (let pass = 0; pass < 10; pass++) {
      let progressed = false;
      while (cursorFromWebview < harness.postedMessages.length) {
        const msg = harness.postedMessages[cursorFromWebview++]!;
        progressed = true;
        if (msg.type === 'ready') {
          panel.webview.simulateReceiveMessage({ type: 'ready' });
        } else {
          await provider.deliverWebviewMessageForTest(
            uri,
            msg as unknown as WebviewInboundMessage,
          );
        }
      }
      await sleep(0);
      while (cursorFromHost < panel.webview.postedMessages.length) {
        const out = panel.webview.postedMessages[cursorFromHost++] as Record<
          string,
          unknown
        >;
        progressed = true;
        harness.sendHostMessage(out);
      }
      if (!progressed) {
        break;
      }
    }
  };

  await flushBridge();
  return { doc, panel, harness, flushBridge };
}

suite('document-outline (TC-OUT-001–009)', () => {
  setup(() => {
    mockVscode.resetVscodeMock();
  });

  test('TC-OUT-001: extractOutlineHeadings extracts H1-H6 with level, text, slug, line, index', () => {
    const md = '# Title\n\n## Sub\n\n###### Deep';
    const items = extractOutlineHeadings(md);
    assert.deepStrictEqual(items, [
      { level: 1, text: 'Title', slug: 'title', line: 1, index: 0 },
      { level: 2, text: 'Sub', slug: 'sub', line: 3, index: 1 },
      { level: 6, text: 'Deep', slug: 'deep', line: 5, index: 2 },
    ]);
  });

  test('TC-OUT-002: extractOutlineHeadings offsets line numbers when YAML frontmatter is present', () => {
    const md = '---\ntitle: Test\n---\n\n# First\n\n## Second';
    const items = extractOutlineHeadings(md);
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].line, 5);
    assert.strictEqual(items[1].line, 7);
  });

  test('TC-OUT-003: extractOutlineHeadings ignores # inside fenced code blocks', () => {
    const md = '# Real\n\n```bash\n# comment\n```\n\n~~~md\n## also ignored\n~~~\n\n## After';
    const items = extractOutlineHeadings(md);
    assert.deepStrictEqual(
      items.map((h) => h.text),
      ['Real', 'After'],
    );
  });

  test('TC-OUT-004: extractOutlineHeadings deduplicates slugs and handles empty string', () => {
    assert.deepStrictEqual(extractOutlineHeadings(''), []);
    const items = extractOutlineHeadings('# Intro\n\n## Intro\n\n### Intro');
    assert.deepStrictEqual(
      items.map((h) => h.slug),
      ['intro', 'intro-1', 'intro-2'],
    );
  });

  test('TC-OUT-005: findLineStartOffset resolves 1-based line offsets and clamps out-of-range', () => {
    const text = 'line1\r\nline2\nline3';
    assert.strictEqual(findLineStartOffset(text, 0), 0);
    assert.strictEqual(findLineStartOffset(text, 1), 0);
    assert.strictEqual(findLineStartOffset(text, 2), 7);
    assert.strictEqual(findLineStartOffset(text, 3), 13);
    assert.strictEqual(findLineStartOffset(text, 99), 13);
  });

  test('TC-OUT-006 & TC-OUT-007: Outline toggle and click jump in Source mode without dirtying', async () => {
    const uri = vscode.Uri.file('/tmp/outline-test.md');
    const md = '# Top\n\nParagraph\n\n## Section Two\n\nEnd';
    const { doc, harness } = await openOutlineJsdom(uri, md, 'raw', false);
    try {
      const toggleBtn = harness.document.querySelector(
        '#mode-toolbar button[data-action="toggle-outline"]',
      )!;
      const panelEl = harness.document.getElementById('outline-panel')!;
      assert.ok(panelEl.classList.contains('hidden'));
      assert.strictEqual(toggleBtn.getAttribute('aria-pressed'), 'false');

      toggleBtn.click();
      assert.strictEqual(panelEl.classList.contains('hidden'), false);
      assert.strictEqual(toggleBtn.getAttribute('aria-pressed'), 'true');
      assert.strictEqual(harness.document.body.getAttribute('data-mode'), 'raw');

      const items = harness.document.querySelectorAll('#outline-list .outline-item');
      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[1].textContent, 'Section Two');

      items[1].click();
      const rawEl = harness.document.getElementById('raw-editor')! as unknown as {
        selectionStart: number;
      };
      assert.strictEqual(rawEl.selectionStart, findLineStartOffset(md, 5));
      assert.strictEqual(doc.isDirty, false);
    } finally {
      harness.dispose();
    }
  });

  test('TC-OUT-008 & TC-OUT-009: Readonly allows outline toggle/jump and empty headings shows No headings', async () => {
    const uri = vscode.Uri.file('/tmp/outline-empty-ro.md');
    const { harness } = await openOutlineJsdom(uri, 'Just plain text.', 'markdown', true);
    try {
      const toggleBtn = harness.document.querySelector(
        '#mode-toolbar button[data-action="toggle-outline"]',
      )!;
      toggleBtn.click();
      const emptyEl = harness.document.querySelector('#outline-list .outline-empty');
      assert.ok(emptyEl);
      assert.strictEqual(emptyEl.textContent, 'No headings');

      const closeBtn = harness.document.getElementById('outline-close-btn')!;
      closeBtn.click();
      assert.ok(harness.document.getElementById('outline-panel')!.classList.contains('hidden'));
    } finally {
      harness.dispose();
    }
  });

  test('Outline refreshes on full docUpdated and tracks active heading on Source cursor move', async () => {
    const uri = vscode.Uri.file('/tmp/outline-sync.md');
    const { harness } = await openOutlineJsdom(uri, '# First\n\nBody\n\n## Second\n\nTail', 'raw', false);
    try {
      const toggleBtn = harness.document.querySelector(
        '#mode-toolbar button[data-action="toggle-outline"]',
      )!;
      toggleBtn.click();

      const rawEl = harness.document.getElementById('raw-editor')! as unknown as {
        value: string;
        selectionStart: number;
        selectionEnd: number;
        dispatchEvent: (e: unknown) => void;
      };
      // Move cursor to line 6 (under ## Second)
      const offsetLine6 = findLineStartOffset(rawEl.value, 6);
      rawEl.selectionStart = offsetLine6;
      rawEl.selectionEnd = offsetLine6;
      rawEl.dispatchEvent(new harness.window.Event('click', { bubbles: true }));
      const itemsBefore = harness.document.querySelectorAll('#outline-list .outline-item');
      assert.ok(itemsBefore[1].classList.contains('active'));

      // Full docUpdated (e.g., Undo/external reload) updates outline items
      const updatedDocJson = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Updated Heading' }] },
        ],
      });
      harness.sendHostMessage({
        type: 'docUpdated',
        docJson: updatedDocJson,
        markdownText: '# Updated Heading\n',
      });
      const itemsAfter = harness.document.querySelectorAll('#outline-list .outline-item');
      assert.strictEqual(itemsAfter.length, 1);
      assert.strictEqual(itemsAfter[0].textContent, 'Updated Heading');
    } finally {
      harness.dispose();
    }
  });
});
