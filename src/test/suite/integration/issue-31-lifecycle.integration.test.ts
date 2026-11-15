import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getMarkdownEditorProvider } from '../../../utils/editor-provider-hook';
import { getExtensionContext } from '../../../utils/extension-context';
import { isReadonly, setReadonly } from '../../../utils/readonly-state';
import { getWebviewCspContent } from '../../../utils/csp';
import { waitFor } from '../../helpers/test-utils';

const VIEW_TYPE = 'md-wysiwyg-editor.wysiwyg';

interface WebviewDiagnosticSnapshot {
  readyReceived: boolean;
  hasProseMirror: boolean;
  editorText: string;
  mermaidSvgCount: number;
  mermaidErrors: string[];
  csp: string;
}

type ProviderWithDiagnostics = ReturnType<typeof getMarkdownEditorProvider> & {
  getWebviewDiagnosticForTest?: (
    uri: vscode.Uri,
    timeoutMs?: number,
  ) => Promise<WebviewDiagnosticSnapshot>;
  getWebviewHtmlForTest?: (uri: vscode.Uri) => string | undefined;
};

function tipTapDocJson(paragraphText: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: paragraphText }] }],
  });
}

async function cleanupWorkspaceEditors(
  provider: ReturnType<typeof getMarkdownEditorProvider>,
  uris: vscode.Uri[],
  tmpDir: string,
): Promise<void> {
  try {
    await vscode.commands.executeCommand('workbench.action.files.saveAll');
  } catch {
    /* ignore */
  }
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  for (const uri of uris) {
    try {
      await waitFor(() => provider?.getOpenDocument(uri) === undefined, 5000);
    } catch {
      /* continue cleanup */
    }
  }
  await new Promise((r) => setTimeout(r, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function openCustomEditor(
  provider: NonNullable<ReturnType<typeof getMarkdownEditorProvider>>,
  uri: vscode.Uri,
): Promise<void> {
  await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);
  await waitFor(() => provider.getOpenDocument(uri) !== undefined, 8000);
}

suite('Issue #31 Real Extension Host Lifecycle & Webview Tests', () => {
  test('TC-I31-002: real Webview posts ready, receives init, and mounts ProseMirror DOM without fake ready', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider() as ProviderWithDiagnostics | undefined;
    assert.ok(provider, 'MarkdownEditorProvider must be registered');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-002-'));
    const mdPath = path.join(tmpDir, 'real-boot.md');
    const uri = vscode.Uri.file(mdPath);
    fs.writeFileSync(mdPath, '# Real Boot Heading\n\nReal paragraph text.\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      assert.ok(
        typeof provider.getWebviewDiagnosticForTest === 'function',
        'TC-I31-002: MarkdownEditorProvider must expose getWebviewDiagnosticForTest handshake so real Webview ready->init->ProseMirror DOM mount can be verified without deliverWebviewMessageForTest',
      );
      const diag = await provider.getWebviewDiagnosticForTest(uri, 8000);
      assert.strictEqual(diag.readyReceived, true, 'Real Webview must post ready to Host');
      assert.strictEqual(diag.hasProseMirror, true, 'Real Webview must mount #editor .ProseMirror');
      assert.ok(diag.editorText.includes('Real Boot Heading'));
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-003: CustomEditor save and saveAs persist changes to disk and clear isDirty', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-003-'));
    const mdPath = path.join(tmpDir, 'save-test.md');
    const saveAsPath = path.join(tmpDir, 'save-as-copy.md');
    const uri = vscode.Uri.file(mdPath);
    fs.writeFileSync(mdPath, '# Initial\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      const doc = provider.getOpenDocument(uri)!;

      await provider.deliverWebviewMessageForTest(uri, {
        type: 'update',
        docJson: tipTapDocJson('Persisted via Save'),
      });
      assert.strictEqual(doc.isDirty, true);

      await vscode.commands.executeCommand('workbench.action.files.save');
      await waitFor(() => !doc.isDirty, 5000);
      assert.ok(fs.readFileSync(mdPath, 'utf8').includes('Persisted via Save'));

      await provider.deliverWebviewMessageForTest(uri, {
        type: 'update',
        docJson: tipTapDocJson('Persisted via SaveAs'),
      });
      await provider.saveCustomDocumentAs(
        doc,
        vscode.Uri.file(saveAsPath),
        new vscode.CancellationTokenSource().token,
      );
      assert.ok(fs.readFileSync(saveAsPath, 'utf8').includes('Persisted via SaveAs'));
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-004: CustomEditor revert restores on-disk markdown content', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-004-'));
    const mdPath = path.join(tmpDir, 'revert-test.md');
    const uri = vscode.Uri.file(mdPath);
    fs.writeFileSync(mdPath, '# Original On Disk\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      const doc = provider.getOpenDocument(uri)!;

      await provider.deliverWebviewMessageForTest(uri, {
        type: 'update',
        docJson: tipTapDocJson('Unsaved Temporary Change'),
      });
      assert.ok(doc.markdownText.includes('Unsaved Temporary Change'));

      await vscode.commands.executeCommand('workbench.action.files.revert');
      await waitFor(() => doc.markdownText.includes('Original On Disk'), 5000);
      assert.strictEqual(doc.markdownText.includes('Unsaved Temporary Change'), false);
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-005: backupCustomDocument writes backup and openCustomDocument restores from backupId', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-005-'));
    const mdPath = path.join(tmpDir, 'hot-exit.md');
    const backupPath = path.join(tmpDir, 'hot-exit.bak');
    const uri = vscode.Uri.file(mdPath);
    const backupUri = vscode.Uri.file(backupPath);
    fs.writeFileSync(mdPath, '# Clean On Disk\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      const doc = provider.getOpenDocument(uri)!;

      await provider.deliverWebviewMessageForTest(uri, {
        type: 'update',
        docJson: tipTapDocJson('Unsaved Hot Exit Recovery'),
      });

      const backup = await provider.backupCustomDocument(
        doc,
        { destination: backupUri },
        new vscode.CancellationTokenSource().token,
      );
      assert.ok(fs.existsSync(backupPath), 'Backup file must be written on disk');

      const restored = await provider.openCustomDocument(
        uri,
        { backupId: backup.id, untitledDocumentData: undefined },
        new vscode.CancellationTokenSource().token,
      );
      assert.ok(
        restored.markdownText.includes('Unsaved Hot Exit Recovery'),
        'openCustomDocument with backupId must restore unsaved backup buffer',
      );
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-006: CustomEditor undo and redo reverse and reapply document edits', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-006-'));
    const mdPath = path.join(tmpDir, 'undo-redo.md');
    const uri = vscode.Uri.file(mdPath);
    fs.writeFileSync(mdPath, 'First State\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      const doc = provider.getOpenDocument(uri)!;

      await provider.deliverWebviewMessageForTest(uri, {
        type: 'update',
        docJson: tipTapDocJson('Second State'),
      });
      assert.ok(doc.markdownText.includes('Second State'));

      await vscode.commands.executeCommand('undo');
      await waitFor(() => doc.markdownText.includes('First State'), 5000);
      assert.ok(doc.markdownText.includes('First State'));

      await vscode.commands.executeCommand('redo');
      await waitFor(() => doc.markdownText.includes('Second State'), 5000);
      assert.ok(doc.markdownText.includes('Second State'));
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-007: updating md-wysiwyg-editor.defaultMode configuration synchronizes open editor mode', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const cfg = vscode.workspace.getConfiguration('md-wysiwyg-editor');
    const originalMode = cfg.get<string>('defaultMode');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-007-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'cfg-sync.md'));
    fs.writeFileSync(uri.fsPath, '# Config Sync\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      await cfg.update('defaultMode', 'source', vscode.ConfigurationTarget.Global);
      await waitFor(() => provider.getEditorMode(uri) === 'raw', 5000);
      assert.strictEqual(provider.getEditorMode(uri), 'raw');
    } finally {
      await cfg.update('defaultMode', originalMode, vscode.ConfigurationTarget.Global);
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-008: closing dirty Custom Editor and deleting temp dir produces no ENOENT error', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-008-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'enoent-guard.md'));
    fs.writeFileSync(uri.fsPath, '# Clean\n', 'utf8');

    const origShowError = vscode.window.showErrorMessage;
    const shownErrors: string[] = [];
    (vscode.window as unknown as { showErrorMessage: (m: string) => Promise<unknown> }).showErrorMessage =
      async (m: string) => {
        shownErrors.push(m);
        return undefined;
      };

    try {
      await openCustomEditor(provider, uri);
      await provider.deliverWebviewMessageForTest(uri, {
        type: 'update',
        docJson: tipTapDocJson('Dirty before close'),
      });
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
      vscode.window.showErrorMessage = origShowError;
    }

    assert.strictEqual(
      shownErrors.some((m) => /ENOENT|Failed to/i.test(m)),
      false,
      `Must not raise ENOENT error on teardown; errors=${JSON.stringify(shownErrors)}`,
    );
  });

  test('TC-I31-009: Mermaid flowchart renders via real Webview ESM dynamic import under CSP', async function () {
    this.timeout(20000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider() as ProviderWithDiagnostics | undefined;
    assert.ok(provider);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-009-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'mermaid-real.md'));
    fs.writeFileSync(uri.fsPath, '```mermaid\nflowchart TD\n  A[Start] --> B[Done]\n```\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      assert.ok(
        typeof provider.getWebviewDiagnosticForTest === 'function',
        'TC-I31-009: getWebviewDiagnosticForTest required to verify real Chromium Mermaid ESM dynamic import under CSP',
      );
      const diag = await provider.getWebviewDiagnosticForTest(uri, 12000);
      assert.strictEqual(diag.mermaidErrors.length, 0, `Mermaid errors: ${diag.mermaidErrors.join('; ')}`);
      assert.ok(diag.mermaidSvgCount >= 1, 'Expected at least 1 rendered Mermaid <svg> in real Webview');
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-010: Mermaid ELK layout renders via real Webview dynamic ELK ESM chunk under CSP', async function () {
    this.timeout(20000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider() as ProviderWithDiagnostics | undefined;
    assert.ok(provider);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-010-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'mermaid-elk.md'));
    fs.writeFileSync(
      uri.fsPath,
      '```mermaid\n---\nconfig:\n  layout: elk\n---\nflowchart LR\n  A --> B\n```\n',
      'utf8',
    );

    try {
      await openCustomEditor(provider, uri);
      assert.ok(
        typeof provider.getWebviewDiagnosticForTest === 'function',
        'TC-I31-010: getWebviewDiagnosticForTest required to verify real Chromium ELK ESM chunk import under CSP',
      );
      const diag = await provider.getWebviewDiagnosticForTest(uri, 12000);
      assert.strictEqual(diag.mermaidErrors.length, 0, `ELK errors: ${diag.mermaidErrors.join('; ')}`);
      assert.ok(diag.mermaidSvgCount >= 1, 'Expected rendered ELK Mermaid <svg> in real Webview');
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-011: md-wysiwyg-editor.toggleReadonly flips readonly state in real Extension Host', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const ctx = getExtensionContext()!;
    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-011-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'toggle-ro.md'));
    fs.writeFileSync(uri.fsPath, '# Toggle RO\n', 'utf8');

    try {
      await setReadonly(ctx, uri, false);
      await openCustomEditor(provider, uri);
      await vscode.commands.executeCommand('md-wysiwyg-editor.toggleReadonly');
      assert.strictEqual(isReadonly(ctx, uri), true);
      await vscode.commands.executeCommand('md-wysiwyg-editor.toggleReadonly');
      assert.strictEqual(isReadonly(ctx, uri), false);
    } finally {
      await setReadonly(ctx, uri, false);
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-012: md-wysiwyg-editor.showMarpPreview opens Marp Preview webview tab', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-012-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'marp-cmd.md'));
    fs.writeFileSync(uri.fsPath, '---\nmarp: true\n---\n\n# Slide Title\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      await vscode.commands.executeCommand('md-wysiwyg-editor.showMarpPreview');
      await waitFor(() => {
        const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
        return tabs.some(
          (t) =>
            t.input instanceof vscode.TabInputWebview &&
            (t.input.viewType.includes('marpPreview') || t.label.includes('Marp Preview')),
        );
      }, 6000);
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-013: openWithWysiwyg and showNativeMarkdownPreview commands execute cleanly', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-013-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'open-native.md'));
    fs.writeFileSync(uri.fsPath, '# Native Preview & OpenWith\n', 'utf8');

    try {
      const textDoc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(textDoc);
      await vscode.commands.executeCommand('md-wysiwyg-editor.openWithWysiwyg');
      await waitFor(() => provider.getOpenDocument(uri) !== undefined, 6000);

      await vscode.commands.executeCommand('md-wysiwyg-editor.showNativeMarkdownPreview');
      await waitFor(() => {
        const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
        return tabs.some(
          (t) =>
            t.input instanceof vscode.TabInputWebview &&
            t.input.viewType.includes('markdown.preview'),
        );
      }, 6000);
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-014: openWithWysiwyg(uri) opens Custom Editor and export commands are registered', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const registered = await vscode.commands.getCommands(true);
    for (const cmd of [
      'md-wysiwyg-editor.openWithWysiwyg',
      'md-wysiwyg-editor.exportDocument',
      'md-wysiwyg-editor.exportHtml',
      'md-wysiwyg-editor.exportDocx',
      'md-wysiwyg-editor.exportPdf',
      'md-wysiwyg-editor.exportPptx',
    ]) {
      assert.ok(registered.includes(cmd), `Command ${cmd} must be registered`);
    }

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-014-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'open-with-arg.md'));
    fs.writeFileSync(uri.fsPath, '# OpenWith With Uri\n\nBody text.\n', 'utf8');

    try {
      const textDoc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(textDoc);
      await vscode.commands.executeCommand('md-wysiwyg-editor.openWithWysiwyg', uri);
      await waitFor(() => provider.getOpenDocument(uri) !== undefined, 6000);
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-026: real Custom Editor Webview HTML enforces default-src none CSP without unsafe-eval', async function () {
    this.timeout(15000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider() as ProviderWithDiagnostics | undefined;
    assert.ok(provider);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-026-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'csp-real.md'));
    fs.writeFileSync(uri.fsPath, '# CSP Check\n', 'utf8');

    try {
      await openCustomEditor(provider, uri);
      const html = provider.getWebviewHtmlForTest?.(uri);
      if (html) {
        const csp = getWebviewCspContent(html) ?? '';
        assert.ok(csp.includes("default-src 'none'"));
        assert.strictEqual(csp.includes('unsafe-eval'), false);
      } else {
        assert.ok(
          typeof provider.getWebviewDiagnosticForTest === 'function',
          'TC-I31-026: provider must expose getWebviewHtmlForTest or getWebviewDiagnosticForTest to inspect live Webview CSP',
        );
        const diag = await provider.getWebviewDiagnosticForTest(uri, 6000);
        assert.ok(diag.csp.includes("default-src 'none'"));
      }
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });

  test('TC-I31-042 @slow: 10-cycle open, edit, save, and close stress test leaves zero leaked editors', async function () {
    this.timeout(45000);
    const ext = vscode.extensions.getExtension('mshiono.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider()!;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-i31-042-'));
    const uri = vscode.Uri.file(path.join(tmpDir, 'stress.md'));
    fs.writeFileSync(uri.fsPath, '# Cycle 0\n', 'utf8');

    try {
      for (let i = 1; i <= 10; i++) {
        await openCustomEditor(provider, uri);
        await provider.deliverWebviewMessageForTest(uri, {
          type: 'update',
          docJson: tipTapDocJson(`Cycle ${i}`),
        });
        await vscode.commands.executeCommand('workbench.action.files.save');
        await waitFor(() => !provider.getOpenDocument(uri)?.isDirty, 5000);
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await waitFor(() => provider.getOpenDocument(uri) === undefined, 5000);
      }
      assert.ok(fs.readFileSync(uri.fsPath, 'utf8').includes('Cycle 10'));
    } finally {
      await cleanupWorkspaceEditors(provider, [uri], tmpDir);
    }
  });
});
