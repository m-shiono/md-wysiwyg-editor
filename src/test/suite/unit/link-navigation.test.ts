import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  classifyLinkHref,
  resolveRelativeLinkTarget,
} from '../../../utils/link-navigation';
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

async function openLinkJsdom(
  uri: vscode.Uri,
  initialMarkdown: string,
  editorMode: 'markdown' | 'preview' = 'markdown',
) {
  mockVscode.setMockFile(uri, initialMarkdown);
  const ctx = mockVscode.createMockExtensionContext(process.cwd());
  mockVscode.setMockConfiguration('md-wysiwyg-editor', {
    defaultMode: editorMode === 'preview' ? 'preview' : 'visual',
  });
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
  return { provider, doc, panel, harness, flushBridge };
}

suite('link-navigation (TC-LINK-001–010)', () => {
  setup(() => {
    mockVscode.resetVscodeMock();
  });

  test('TC-LINK-001: classifyLinkHref accepts https, http, mailto as external', () => {
    assert.deepStrictEqual(classifyLinkHref('https://example.com/a'), {
      kind: 'external',
      url: 'https://example.com/a',
    });
    assert.deepStrictEqual(classifyLinkHref('HTTP://example.com'), {
      kind: 'external',
      url: 'HTTP://example.com',
    });
    assert.deepStrictEqual(classifyLinkHref('mailto:dev@example.com'), {
      kind: 'external',
      url: 'mailto:dev@example.com',
    });
  });

  test('TC-LINK-002: classifyLinkHref classifies #anchor links', () => {
    assert.deepStrictEqual(classifyLinkHref('#section-1'), {
      kind: 'anchor',
      slug: 'section-1',
    });
    assert.deepStrictEqual(classifyLinkHref('#%E6%97%A5%E6%9C%AC%E8%AA%9E'), {
      kind: 'anchor',
      slug: '日本語',
    });
  });

  test('TC-LINK-003: classifyLinkHref classifies relative file links with optional fragment', () => {
    assert.deepStrictEqual(classifyLinkHref('./other.md'), {
      kind: 'relative',
      path: './other.md',
    });
    assert.deepStrictEqual(classifyLinkHref('../doc.md#sec'), {
      kind: 'relative',
      path: '../doc.md',
      fragment: 'sec',
    });
  });

  test('TC-LINK-004: classifyLinkHref blocks unsafe schemes and control characters', () => {
    for (const bad of [
      '',
      '   ',
      'javascript:alert(1)',
      'JAVASCRIPT:void(0)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'vbscript:msgbox(1)',
      'command:workbench.action.quit',
      '//evil.com/phish',
      'https://example.com/\x00evil',
    ]) {
      assert.strictEqual(classifyLinkHref(bad).kind, 'unsafe', `Expected unsafe for ${bad}`);
    }
  });

  test('TC-LINK-005: resolveRelativeLinkTarget preserves file/vscode-remote and rejects untitled', () => {
    const fileDoc = vscode.Uri.file('/workspace/docs/readme.md');
    const resolvedFile = resolveRelativeLinkTarget(fileDoc, './arch.md', vscode.Uri.joinPath);
    assert.ok(resolvedFile);
    assert.strictEqual(resolvedFile.scheme, 'file');
    assert.ok(resolvedFile.path.endsWith('/workspace/docs/arch.md'));

    const remoteDoc = vscode.Uri.parse('vscode-remote://ssh-remote+host/repo/docs/a.md');
    const resolvedRemote = resolveRelativeLinkTarget(remoteDoc, '../b.md', vscode.Uri.joinPath);
    assert.ok(resolvedRemote);
    assert.strictEqual(resolvedRemote.scheme, 'vscode-remote');
    assert.strictEqual(resolvedRemote.authority, 'ssh-remote+host');

    const untitledDoc = vscode.Uri.parse('untitled:Untitled-1.md');
    assert.strictEqual(resolveRelativeLinkTarget(untitledDoc, './a.md', vscode.Uri.joinPath), null);
  });

  test('TC-LINK-006: Host openLink handles external, existing/missing relative, and unsafe without dirtying', async () => {
    const docUri = vscode.Uri.file('/tmp/docs/main.md');
    const targetUri = vscode.Uri.file('/tmp/docs/sub.md');
    mockVscode.setMockFile(docUri, '# Main');
    mockVscode.setMockFile(targetUri, '# Sub');

    const ctx = mockVscode.createMockExtensionContext(process.cwd());
    const marpManager = new MarpPreviewManager(ctx as unknown as vscode.ExtensionContext);
    const provider = new MarkdownEditorProvider(
      ctx as unknown as vscode.ExtensionContext,
      marpManager,
    );
    const doc = await provider.openCustomDocument(
      docUri,
      { backupId: undefined, untitledDocumentData: undefined },
      makeCancellationToken(),
    );
    const panel = mockVscode.createMockWebviewPanel(MarkdownEditorProvider.viewType, 'main.md');
    await provider.resolveCustomEditor(
      doc,
      panel as unknown as vscode.WebviewPanel,
      makeCancellationToken(),
    );

    await provider.deliverWebviewMessageForTest(docUri, {
      type: 'openLink',
      href: 'https://example.com',
    });
    assert.strictEqual(mockVscode.getOpenedExternalUris().length, 1);
    assert.strictEqual(mockVscode.getOpenedExternalUris()[0].toString(), 'https://example.com/');

    await provider.deliverWebviewMessageForTest(docUri, {
      type: 'openLink',
      href: './sub.md',
    });
    const openCalls = mockVscode
      .getExecutedCommands()
      .filter((c) => c.command === 'vscode.open');
    assert.strictEqual(openCalls.length, 1);

    await provider.deliverWebviewMessageForTest(docUri, {
      type: 'openLink',
      href: './missing.md',
    });
    assert.ok(
      mockVscode
        .getRecordedMessages()
        .some((m) => m.level === 'warn' && m.message.includes('Target file not found')),
    );

    await provider.deliverWebviewMessageForTest(docUri, {
      type: 'openLink',
      href: 'javascript:alert(1)',
    });
    assert.strictEqual(mockVscode.getOpenedExternalUris().length, 1);
    assert.strictEqual(doc.isDirty, false);
  });

  test('TC-LINK-007: Preview mode link click sends openLink to host', async () => {
    const uri = vscode.Uri.file('/tmp/link-preview.md');
    const { harness, flushBridge } = await openLinkJsdom(
      uri,
      '[Example](https://example.com)',
      'preview',
    );
    try {
      const link = harness.document.querySelector('#editor a[href]')!;
      assert.ok(link);
      link.click();
      await flushBridge();
      assert.strictEqual(mockVscode.getOpenedExternalUris().length, 1);
    } finally {
      harness.dispose();
    }
  });

  test('TC-LINK-008, TC-LINK-009 & TC-LINK-010: Visual click shows #link-popover, Open navigates, Ctrl+Click navigates directly', async () => {
    const uri = vscode.Uri.file('/tmp/link-visual.md');
    const { harness, flushBridge } = await openLinkJsdom(
      uri,
      '[Example](https://example.com)',
      'markdown',
    );
    try {
      const link = harness.document.querySelector('#editor a[href]')!;
      assert.ok(link);

      // Normal click opens popover without navigating yet
      link.click();
      const popover = harness.document.getElementById('link-popover')!;
      assert.strictEqual(popover.classList.contains('hidden'), false);
      assert.strictEqual(
        harness.document.getElementById('link-popover-url')!.textContent,
        'https://example.com',
      );
      assert.strictEqual(mockVscode.getOpenedExternalUris().length, 0);

      // Escape hides popover
      harness.document.dispatchEvent(
        new harness.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      assert.strictEqual(popover.classList.contains('hidden'), true);

      // Re-open and click Open button
      link.click();
      const openBtn = popover.querySelector('button[data-link-action="open"]')!;
      openBtn.click();
      await flushBridge();
      assert.strictEqual(popover.classList.contains('hidden'), true);
      assert.strictEqual(mockVscode.getOpenedExternalUris().length, 1);

      // Ctrl+Click navigates directly without opening popover
      link.dispatchEvent(
        new harness.window.MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      );
      await flushBridge();
      assert.strictEqual(popover.classList.contains('hidden'), true);
      assert.strictEqual(mockVscode.getOpenedExternalUris().length, 2);
    } finally {
      harness.dispose();
    }
  });

  test('TC-LINK-011: link click stops propagation to window to prevent VS Code Webview double navigation', async () => {
    const uri = vscode.Uri.file('/tmp/link-propagation.md');
    const { harness } = await openLinkJsdom(
      uri,
      '[Example](https://example.com)',
      'markdown',
    );
    try {
      let windowBubbleCalled = false;
      const win = harness.window as unknown as {
        addEventListener: (type: string, fn: () => void) => void;
      };
      win.addEventListener('click', () => {
        windowBubbleCalled = true;
      });
      const link = harness.document.querySelector('#editor a[href]')!;
      const ev = new harness.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      link.dispatchEvent(ev);
      assert.strictEqual(ev.defaultPrevented, true);
      assert.strictEqual(windowBubbleCalled, false);
      assert.strictEqual(mockVscode.getOpenedExternalUris().length, 0);
    } finally {
      harness.dispose();
    }
  });

  test('Unlink from #link-popover removes clicked link even when cursor was elsewhere', async () => {
    const uri = vscode.Uri.file('/tmp/link-unlink.md');
    const { doc, harness, flushBridge } = await openLinkJsdom(
      uri,
      'Start text\n\n[Target](https://example.com)',
      'markdown',
    );
    try {
      const tiptap = (
        harness.window as unknown as {
          __mdWysiwygEditor: {
            state: { selection: { from: number } };
            commands: { setTextSelection: (pos: number) => boolean };
          };
        }
      ).__mdWysiwygEditor;
      // Put cursor at very beginning ('Start text')
      tiptap.commands.setTextSelection(1);

      const link = harness.document.querySelector('#editor a[href]')!;
      link.click();
      const popover = harness.document.getElementById('link-popover')!;
      assert.strictEqual(popover.classList.contains('hidden'), false);

      popover.querySelector('button[data-link-action="unlink"]')!.click();
      await sleep(220);
      await flushBridge();

      assert.strictEqual(popover.classList.contains('hidden'), true);
      assert.strictEqual(doc.markdownText.includes('https://example.com'), false);
      assert.ok(doc.markdownText.includes('Target'));
    } finally {
      harness.dispose();
    }
  });
});
