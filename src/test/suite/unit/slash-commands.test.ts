import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  SLASH_COMMANDS,
  detectSlashTrigger,
  filterSlashCommands,
} from '../../../utils/slash-commands';
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

async function openSlashJsdom(
  uri: vscode.Uri,
  initialMarkdown: string,
  editorMode: 'markdown' | 'preview' = 'markdown',
  readonly = false,
) {
  mockVscode.setMockFile(uri, initialMarkdown);
  const ctx = mockVscode.createMockExtensionContext(process.cwd());
  mockVscode.setMockConfiguration('md-wysiwyg-editor', {
    defaultMode: editorMode === 'preview' ? 'preview' : 'visual',
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

suite('slash-commands (TC-SLASH-001–009)', () => {
  setup(() => {
    mockVscode.resetVscodeMock();
  });

  test('TC-SLASH-001: detectSlashTrigger matches / and /query at line start or after whitespace', () => {
    assert.deepStrictEqual(detectSlashTrigger('/'), { query: '', matchLength: 1 });
    assert.deepStrictEqual(detectSlashTrigger('/mer'), { query: 'mer', matchLength: 4 });
    assert.deepStrictEqual(detectSlashTrigger('hello /tab'), { query: 'tab', matchLength: 4 });
  });

  test('TC-SLASH-002: detectSlashTrigger ignores URLs, mid-word slashes, and trailing spaces', () => {
    assert.strictEqual(detectSlashTrigger('https://example.com/a'), null);
    assert.strictEqual(detectSlashTrigger('foo/bar'), null);
    assert.strictEqual(detectSlashTrigger('/mer a'), null);
    assert.strictEqual(detectSlashTrigger('plain text'), null);
  });

  test('TC-SLASH-003: filterSlashCommands filters across id, label, description, keywords', () => {
    assert.strictEqual(filterSlashCommands('').length, SLASH_COMMANDS.length);
    assert.deepStrictEqual(
      filterSlashCommands('mer').map((c) => c.id),
      ['mermaid'],
    );
    assert.deepStrictEqual(
      filterSlashCommands('puml').map((c) => c.id),
      ['plantuml'],
    );
    assert.deepStrictEqual(
      filterSlashCommands('katex').map((c) => c.id),
      ['math'],
    );
    assert.ok(filterSlashCommands('table').some((c) => c.id === 'table'));
    assert.deepStrictEqual(filterSlashCommands('zzzzzz'), []);
  });

  test('TC-SLASH-004, TC-SLASH-005 & TC-SLASH-006: Visual slash menu opens, filters, inserts Mermaid, and closes on Escape', async () => {
    const uri = vscode.Uri.file('/tmp/slash-visual.md');
    const { doc, harness, flushBridge } = await openSlashJsdom(uri, '', 'markdown', false);
    try {
      const editorEl = harness.document.getElementById('editor')!;
      const tiptap = (
        harness.window as unknown as {
          __mdWysiwygEditor: {
            commands: {
              insertContent: (s: string) => boolean;
              setTextSelection: (pos: number) => boolean;
            };
          };
        }
      ).__mdWysiwygEditor;
      tiptap.commands.insertContent('/mer');
      await sleep(30);

      const menu = harness.document.getElementById('slash-menu')!;
      assert.strictEqual(menu.classList.contains('hidden'), false);
      const items = menu.querySelectorAll('.slash-menu-item');
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].getAttribute('data-slash-id'), 'mermaid');

      // Escape closes menu
      harness.dispatchKeydown(editorEl, { key: 'Escape' });
      assert.strictEqual(menu.classList.contains('hidden'), true);

      // Re-trigger via selection update and click item to insert Mermaid block
      tiptap.commands.setTextSelection(4);
      tiptap.commands.setTextSelection(5);
      await sleep(30);
      assert.strictEqual(menu.classList.contains('hidden'), false);
      menu.querySelector('.slash-menu-item')!.click();
      await sleep(220);
      await flushBridge();

      assert.strictEqual(menu.classList.contains('hidden'), true);
      assert.ok(doc.markdownText.includes('```mermaid'));
    } finally {
      harness.dispose();
    }
  });

  test('TC-SLASH-007 & TC-SLASH-009: Guard blocks slash menu in Readonly, Preview, and IME composition', async () => {
    const roUri = vscode.Uri.file('/tmp/slash-ro.md');
    const { harness: roHarness } = await openSlashJsdom(roUri, 'Hello\n', 'markdown', true);
    try {
      const editorEl = roHarness.document.getElementById('editor')!;
      const pmEl = editorEl.querySelector('.ProseMirror') ?? editorEl;
      const p = pmEl.querySelector('p') ?? pmEl;
      p.textContent = '/mer';
      roHarness.document.dispatchEvent(new roHarness.window.Event('selectionchange'));
      await sleep(30);
      assert.ok(roHarness.document.getElementById('slash-menu')!.classList.contains('hidden'));
    } finally {
      roHarness.dispose();
    }

    const imeUri = vscode.Uri.file('/tmp/slash-ime.md');
    const { harness: imeHarness } = await openSlashJsdom(imeUri, 'Start\n', 'markdown', false);
    try {
      const editorEl = imeHarness.document.getElementById('editor')!;
      const pmEl = editorEl.querySelector('.ProseMirror') ?? editorEl;
      pmEl.dispatchEvent(new imeHarness.window.Event('compositionstart', { bubbles: true }));
      const p = pmEl.querySelector('p') ?? pmEl;
      p.textContent = '/mer';
      imeHarness.document.dispatchEvent(new imeHarness.window.Event('selectionchange'));
      await sleep(30);
      assert.ok(imeHarness.document.getElementById('slash-menu')!.classList.contains('hidden'));
    } finally {
      imeHarness.dispose();
    }
  });

  test('TC-SLASH-010: Ctrl+Z after slash command insertion and inline typing restores exact pre-edit cursor position', async () => {
    const uri = vscode.Uri.file('/tmp/slash-undo-cursor.md');
    const { doc, harness, flushBridge } = await openSlashJsdom(
      uri,
      'Line 1\n\n\n\nLine 3\n',
      'markdown',
      false,
    );
    try {
      const editorEl = harness.document.getElementById('editor')!;
      const pmEl = editorEl.querySelector('.ProseMirror') ?? editorEl;
      const tiptap = (
        harness.window as unknown as {
          __mdWysiwygEditor: {
            state: { selection: { from: number; to: number } };
            commands: {
              insertContent: (s: string) => boolean;
              setTextSelection: (pos: number) => boolean;
            };
          };
        }
      ).__mdWysiwygEditor;

      // Move cursor to middle paragraph (between Line 1 and Line 3) and type '/mer'
      tiptap.commands.setTextSelection(9);
      const posBeforeSlash = tiptap.state.selection.from;
      tiptap.commands.insertContent('/mer');
      await sleep(220);
      await flushBridge();

      const posAfterSlash = tiptap.state.selection.from;
      assert.strictEqual(posAfterSlash, posBeforeSlash + 4);

      // Select Mermaid from slash menu
      const menu = harness.document.getElementById('slash-menu')!;
      assert.strictEqual(menu.classList.contains('hidden'), false);
      menu.querySelector('.slash-menu-item')!.click();
      await flushBridge();
      assert.ok(doc.markdownText.includes('```mermaid'));

      // Undo Mermaid insertion via Ctrl+Z -> cursor must return to posAfterSlash (not Mermaid end / doc end)
      const ev1 = harness.dispatchKeydown(pmEl, { key: 'z', ctrlKey: true, metaKey: false });
      assert.strictEqual(ev1.defaultPrevented, true);
      await flushBridge();

      assert.strictEqual(doc.markdownText.includes('```mermaid'), false);
      assert.strictEqual(tiptap.state.selection.from, posAfterSlash);
      assert.strictEqual(menu.classList.contains('hidden'), true);

      // Undo '/mer' typing via Ctrl+Z -> cursor must return to posBeforeSlash
      const ev2 = harness.dispatchKeydown(pmEl, { key: 'z', ctrlKey: true, metaKey: false });
      assert.strictEqual(ev2.defaultPrevented, true);
      await flushBridge();
      assert.strictEqual(tiptap.state.selection.from, posBeforeSlash);
    } finally {
      harness.dispose();
    }
  });

  test('/toc slash command removes /toc trigger text and inserts TOC cleanly', async () => {
    const uri = vscode.Uri.file('/tmp/slash-toc.md');
    const { doc, harness, flushBridge } = await openSlashJsdom(
      uri,
      '# Heading One\n\nBody\n',
      'markdown',
      false,
    );
    try {
      const tiptap = (
        harness.window as unknown as {
          __mdWysiwygEditor: {
            state: { doc: { content: { size: number } } };
            commands: {
              insertContent: (s: string) => boolean;
              setTextSelection: (pos: number) => boolean;
            };
          };
        }
      ).__mdWysiwygEditor;
      const endPos = tiptap.state.doc.content.size;
      tiptap.commands.setTextSelection(Math.max(1, endPos - 1));
      tiptap.commands.insertContent(' /toc');
      await sleep(30);

      const menu = harness.document.getElementById('slash-menu')!;
      assert.strictEqual(menu.classList.contains('hidden'), false);
      menu.querySelector('button[data-slash-id="toc"]')!.click();
      await sleep(220);
      await flushBridge();

      assert.strictEqual(doc.markdownText.includes('/toc'), false);
      assert.ok(doc.markdownText.includes('<!-- TOC -->'));
      assert.ok(doc.markdownText.includes('[Heading One](#heading-one)'));
    } finally {
      harness.dispose();
    }
  });
});
