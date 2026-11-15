import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownEditorProvider } from '../../../providers/markdown-editor-provider';
import { MarkdownDocument } from '../../../providers/markdown-document';
import { MarpPreviewManager } from '../../../commands/marp-preview';
import { convertMarkdownToStandaloneHtml, registerExportCommands } from '../../../commands/export-document';
import { showNativeMarkdownPreview } from '../../../commands/native-markdown-preview';
import { registerEditorSwitchGuard } from '../../../utils/editor-switch-guard';
import { rewriteImageSrcForDisplay } from '../../../utils/image-uri-rewrite';
import { isSafeImagePath } from '../../../utils/image-numbering';
import { shouldAcceptWebviewUpdate } from '../../../utils/webview-update-epoch';
import { getReadonlyKey } from '../../../utils/readonly-state';
import { getWebviewCspContent } from '../../../utils/csp';
import { getOutputChannel, OUTPUT_CHANNEL_NAME } from '../../../utils/logger';
import { NO_MARP_MESSAGE } from '../../../utils/marp-constants';
import { bootEditorWebviewInJsdom } from '../../helpers/webview-jsdom-harness';

type MockPanelLike = {
  viewType: string;
  title: string;
  webview: {
    html: string;
    options: { enableScripts?: boolean; localResourceRoots?: vscode.Uri[] };
    cspSource: string;
    postedMessages: Array<Record<string, unknown>>;
    simulateReceiveMessage: (msg: unknown) => void;
    asWebviewUri: (uri: vscode.Uri) => vscode.Uri;
  };
  dispose: () => void;
};

type VscodeMockExtras = typeof vscode & {
  createMockExtensionContext: (extPath?: string) => vscode.ExtensionContext;
  createMockWebviewPanel: (
    viewType: string,
    title: string,
    viewColumn?: number,
    options?: Record<string, unknown>,
  ) => MockPanelLike;
  setMockFile: (uri: vscode.Uri | { toString(): string; fsPath: string }, content: string) => void;
  setMockSaveDialogHandler: (fn: (options?: unknown) => vscode.Uri | undefined) => void;
  setMockCommandInterceptor: (fn: (cmd: string, ...args: unknown[]) => unknown) => void;
  setMockAppName: (name: string) => void;
  getExecutedCommands: () => Array<{ command: string; args: unknown[] }>;
  getRecordedMessages: () => Array<{ level: string; message: string }>;
  getRecordedOutputLines: () => string[];
  resetVscodeMock: () => void;
};

const vscodeExt = vscode as unknown as VscodeMockExtras;

function makeCancellationToken(): vscode.CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: new vscode.EventEmitter<unknown>().event,
  };
}

suite('Issue #31 Compatibility, Defects, and Security Tests', () => {
  setup(() => {
    vscodeExt.resetVscodeMock();
  });

  teardown(() => {
    vscodeExt.resetVscodeMock();
  });

  test('TC-I31-001: openCustomDocument safely falls back without throwing on ENOENT', async () => {
    const ctx = vscodeExt.createMockExtensionContext(process.cwd());
    const provider = new MarkdownEditorProvider(ctx, new MarpPreviewManager(ctx));
    const missingUri = vscode.Uri.file('/tmp/nonexistent-tc-i31-001.md');

    let opened: MarkdownDocument | undefined;
    await assert.doesNotReject(async () => {
      opened = await provider.openCustomDocument(
        missingUri,
        { backupId: undefined, untitledDocumentData: undefined },
        makeCancellationToken(),
      );
    });
    assert.ok(opened, 'C-1: openCustomDocument must return a fallback MarkdownDocument instead of throwing');
  });

  test('TC-I31-024: mock vscode preserves instanceof parity, URI schemes, fs, and custom editor registration', async () => {
    const fileUri = vscode.Uri.file('/tmp/example/doc.md');
    const remoteUri = vscode.Uri.parse('vscode-remote://ssh-remote+box/home/user/doc.md');
    assert.ok(fileUri instanceof vscode.Uri);
    assert.strictEqual(remoteUri.scheme, 'vscode-remote');
    assert.strictEqual(remoteUri.authority, 'ssh-remote+box');
    assert.strictEqual(vscode.Uri.joinPath(remoteUri, '..', 'img').scheme, 'vscode-remote');

    const tabCustom = new vscode.TabInputCustom(fileUri, 'md-wysiwyg-editor.markdownEditor');
    const tabWebview = new vscode.TabInputWebview('markdown.preview');
    const tabText = new vscode.TabInputText(fileUri);
    assert.ok(tabCustom instanceof vscode.TabInputCustom);
    assert.ok(tabWebview instanceof vscode.TabInputWebview);
    assert.ok(tabText instanceof vscode.TabInputText);

    await vscode.workspace.fs.writeFile(fileUri, Buffer.from('# Hello', 'utf8'));
    const readBack = await vscode.workspace.fs.readFile(fileUri);
    assert.strictEqual(Buffer.from(readBack).toString('utf8'), '# Hello');
  });

  test('TC-I31-026: pure constants and utility helpers verified cleanly in unit suite', () => {
    // Moved from integration/extension.test.ts (TC-028, TC-057, TC-062, TC-042)
    const uri = vscode.Uri.file('/tmp/test.md');
    assert.ok(getReadonlyKey(uri).startsWith('readonly:'));

    const html = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-abc\'" />';
    const csp = getWebviewCspContent(html);
    assert.ok(csp?.includes("default-src 'none'"));

    const channel = getOutputChannel();
    assert.strictEqual(channel.name, OUTPUT_CHANNEL_NAME);

    assert.strictEqual(NO_MARP_MESSAGE, 'No Marp slides detected');
  });

  test('TC-I31-027: pasted image separates displaySrc (webview URI) from persisted relativePath', async () => {
    const ctx = vscodeExt.createMockExtensionContext(process.cwd());
    const provider = new MarkdownEditorProvider(ctx, new MarpPreviewManager(ctx));
    const mdUri = vscode.Uri.file('/tmp/paste-sep/doc.md');
    vscodeExt.setMockFile(mdUri, '# Doc\n');

    const doc = await provider.openCustomDocument(
      mdUri,
      { backupId: undefined, untitledDocumentData: undefined },
      makeCancellationToken(),
    );
    const panel = vscodeExt.createMockWebviewPanel(
      'md-wysiwyg-editor.markdownEditor',
      'doc.md',
    );
    await provider.resolveCustomEditor(doc, panel as unknown as vscode.WebviewPanel, makeCancellationToken());

    panel.webview.simulateReceiveMessage({ type: 'ready' });
    panel.webview.simulateReceiveMessage({
      type: 'pasteImage',
      mime: 'image/png',
      dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    });

    await new Promise((r) => setTimeout(r, 20));
    const inserted = panel.webview.postedMessages.find((m) => m.type === 'imageInserted') as
      | { type: string; relativePath?: string; displaySrc?: string }
      | undefined;
    assert.ok(inserted, 'Host must post imageInserted after pasteImage');
    assert.strictEqual(inserted.relativePath, 'img/image-0001.png');
    assert.ok(
      typeof inserted.displaySrc === 'string' && inserted.displaySrc.includes('vscode-cdn.net'),
      `D-1: imageInserted must provide displaySrc webview URI, got: ${JSON.stringify(inserted)}`,
    );

    // Webview side must render <img src=displaySrc> while keeping relativePath in docJson
    const harness = bootEditorWebviewInJsdom({
      html: panel.webview.html,
      initMessage: {
        docJson: doc.docJson,
        markdownText: doc.markdownText,
        readonly: false,
        editorMode: 'markdown',
      },
    });
    try {
      harness.sendHostMessage({
        type: 'imageInserted',
        relativePath: 'img/image-0001.png',
        displaySrc: inserted.displaySrc,
      });
      const imgEl = harness.document.querySelector('#editor img:not(.ProseMirror-separator)');
      assert.ok(imgEl, 'Webview must insert <img> into #editor');
      assert.strictEqual(
        imgEl.getAttribute('src'),
        inserted.displaySrc,
        'D-1: Webview DOM <img> src must use displaySrc so image is immediately visible',
      );
      const lastUpdate = [...harness.postedMessages].reverse().find((m) => m.type === 'update') as
        | { docJson?: string }
        | undefined;
      assert.ok(lastUpdate?.docJson, 'Webview must emit update after imageInserted');
      assert.ok(
        lastUpdate.docJson.includes('img/image-0001.png') &&
          !lastUpdate.docJson.includes('vscode-cdn.net'),
        'D-1: Persisted docJson must keep relativePath and never leak webview-cdn URI',
      );
    } finally {
      harness.dispose();
    }
  });

  test('TC-I31-028: imageInserted after updateEpoch bump includes current epoch in update', () => {
    const harness = bootEditorWebviewInJsdom({
      initMessage: {
        docJson: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Before table convert' }] }],
        }),
        markdownText: 'Before table convert',
        readonly: false,
        editorMode: 'markdown',
      },
    });
    try {
      harness.sendHostMessage({
        type: 'docUpdated',
        docJson: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After table convert' }] }],
        }),
        markdownText: 'After table convert',
        updateEpoch: 2,
      });

      const beforeLen = harness.postedMessages.length;
      harness.sendHostMessage({
        type: 'imageInserted',
        relativePath: 'img/image-0001.png',
        displaySrc: 'https://mock.vscode-resource.vscode-cdn.net/img/image-0001.png',
      });

      const updateMsg = harness.postedMessages
        .slice(beforeLen)
        .find((m) => m.type === 'update') as { epoch?: number } | undefined;
      assert.ok(updateMsg, 'imageInserted must emit an update message');
      assert.strictEqual(
        shouldAcceptWebviewUpdate(updateMsg.epoch, 2),
        true,
        `D-2: update message after imageInserted must carry epoch >= 2, got ${String(updateMsg.epoch)}`,
      );
    } finally {
      harness.dispose();
    }
  });

  test('TC-I31-030: vscode-remote URIs preserve scheme/authority and guards handle malformed inputs safely', async () => {
    const remoteMdUri = vscode.Uri.parse('vscode-remote://ssh-remote+devbox/home/alice/project/doc.md');
    const seenUris: vscode.Uri[] = [];
    const resolver = {
      asWebviewUri: (uri: { fsPath: string; toString(): string }) => {
        const parsed = vscode.Uri.parse(uri.toString());
        seenUris.push(parsed);
        return vscode.Uri.parse(`https://mock.vscode-resource.vscode-cdn.net/${parsed.scheme}/${parsed.authority}${parsed.path}`);
      },
    };

    const rewritten = rewriteImageSrcForDisplay('img/arch.png', remoteMdUri, resolver);
    assert.ok(seenUris.length > 0, 'Local relative image must invoke resolver');
    assert.strictEqual(
      seenUris[0].scheme,
      'vscode-remote',
      `Remote URI scheme must be preserved instead of collapsing to file://, got ${seenUris[0].toString()}`,
    );
    assert.ok(rewritten.includes('vscode-remote/ssh-remote+devbox'));

    const ctx = vscodeExt.createMockExtensionContext('/tmp/ext');
    const manager = new MarpPreviewManager(ctx);
    await manager.show(remoteMdUri, '---\nmarp: true\n---\n\n![img](img/arch.png)\n');
    const provider = new MarkdownEditorProvider(ctx, manager);
    const remoteRoot = (provider as unknown as { getWorkspaceImgRoots: (u: vscode.Uri) => vscode.Uri[] })
      .getWorkspaceImgRoots(remoteMdUri);
    assert.strictEqual(remoteRoot[0].scheme, 'vscode-remote');
    assert.strictEqual(remoteRoot[0].authority, 'ssh-remote+devbox');

    // 1. native-markdown-preview (showNativeMarkdownPreview / resolvePreviewUri) preserves vscode-remote scheme & authority
    const remoteContent = '# Remote Doc\n\n<img src="img/%E0%A4%A.png" alt="bad-encoding" />\n';
    vscodeExt.setMockFile(remoteMdUri, remoteContent);
    await showNativeMarkdownPreview({ uri: remoteMdUri });
    const showPreviewCall = vscodeExt
      .getExecutedCommands()
      .find((c) => c.command === 'markdown.showPreview');
    assert.ok(showPreviewCall, 'native-markdown-preview must execute markdown.showPreview');
    const previewArg = showPreviewCall.args[0] as vscode.Uri;
    assert.strictEqual(previewArg.scheme, 'vscode-remote');
    assert.strictEqual(previewArg.authority, 'ssh-remote+devbox');
    assert.strictEqual(previewArg.path, '/home/alice/project/doc.md');
    assert.strictEqual(previewArg.toString(), remoteMdUri.toString());

    // 2. export-document preserves vscode-remote scheme on default export target URI and handles malformed %-encoded <img src>
    let capturedDefaultUri: vscode.Uri | undefined;
    const remoteHtmlUri = vscode.Uri.parse(
      'vscode-remote://ssh-remote+devbox/home/alice/project/doc.html',
    );
    vscodeExt.setMockSaveDialogHandler((options) => {
      capturedDefaultUri = (options as { defaultUri?: vscode.Uri } | undefined)?.defaultUri;
      return remoteHtmlUri;
    });
    const expDisposables = registerExportCommands(ctx, provider);
    try {
      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportHtml', remoteMdUri);
      });
    } finally {
      expDisposables.forEach((d) => d.dispose());
    }
    assert.ok(capturedDefaultUri, 'exportHtml must supply defaultUri to showSaveDialog');
    assert.strictEqual(capturedDefaultUri.scheme, 'vscode-remote');
    assert.strictEqual(capturedDefaultUri.authority, 'ssh-remote+devbox');
    assert.strictEqual(capturedDefaultUri.path, '/home/alice/project/doc.html');
    const exportedHtml = Buffer.from(await vscode.workspace.fs.readFile(remoteHtmlUri)).toString('utf8');
    assert.ok(exportedHtml.includes('img/%E0%A4%A.png'));

    await assert.doesNotReject(async () => {
      const standaloneHtml = await convertMarkdownToStandaloneHtml(
        '# Bad Img\n\n<img src="img/%ZZ-broken.png" alt="broken" />\n',
        process.cwd(),
      );
      assert.ok(standaloneHtml.includes('img/%ZZ-broken.png'));
    });

    // 3. editor-switch-guard (getActiveMarkdownUri) handles non-file URIs with .md path
    (vscode.window.tabGroups.activeTabGroup as unknown as { activeTab: unknown }).activeTab = undefined;
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = {
      document: { uri: remoteMdUri },
    };
    const guardDisposable = registerEditorSwitchGuard(ctx);
    try {
      await vscode.commands.executeCommand('md-wysiwyg-editor.openWithWysiwyg');
      const remoteOpenWith = [...vscodeExt.getExecutedCommands()]
        .reverse()
        .find((c) => c.command === 'vscode.openWith');
      assert.ok(remoteOpenWith, 'openWithWysiwyg must invoke vscode.openWith for vscode-remote .md activeTextEditor');
      const remoteTarget = remoteOpenWith.args[0] as vscode.Uri;
      assert.strictEqual(remoteTarget.scheme, 'vscode-remote');
      assert.strictEqual(remoteTarget.authority, 'ssh-remote+devbox');

      const virtualMdUri = {
        scheme: 'memfs',
        authority: 'workspace',
        path: '/notes/virtual.md',
        fsPath: '',
        toString: () => 'memfs://workspace/notes/virtual.md',
      } as unknown as vscode.Uri;
      (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = {
        document: { uri: virtualMdUri },
      };
      await vscode.commands.executeCommand('md-wysiwyg-editor.openWithWysiwyg');
      const virtualOpenWith = [...vscodeExt.getExecutedCommands()]
        .reverse()
        .find((c) => c.command === 'vscode.openWith');
      assert.ok(virtualOpenWith, 'getActiveMarkdownUri must accept non-file URI with .md path even when fsPath is empty');
      assert.strictEqual(
        (virtualOpenWith.args[0] as vscode.Uri).toString(),
        'memfs://workspace/notes/virtual.md',
      );

      const openWithCountBeforeTxt = vscodeExt
        .getExecutedCommands()
        .filter((c) => c.command === 'vscode.openWith').length;
      (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = {
        document: { uri: vscode.Uri.parse('vscode-remote://ssh-remote+devbox/home/alice/project/notes.txt') },
      };
      await vscode.commands.executeCommand('md-wysiwyg-editor.openWithWysiwyg');
      const openWithCountAfterTxt = vscodeExt
        .getExecutedCommands()
        .filter((c) => c.command === 'vscode.openWith').length;
      assert.strictEqual(
        openWithCountAfterTxt,
        openWithCountBeforeTxt,
        'getActiveMarkdownUri must ignore non-.md remote URIs',
      );
    } finally {
      guardDisposable.dispose();
    }

    // 4. MarkdownEditorProvider onDidReceiveMessage ignores malformed payloads and tableOperation docJson safely
    const doc = await provider.openCustomDocument(
      remoteMdUri,
      { backupId: undefined, untitledDocumentData: undefined },
      makeCancellationToken(),
    );
    const panel = vscodeExt.createMockWebviewPanel('md-wysiwyg-editor.markdownEditor', 'doc.md');
    await provider.resolveCustomEditor(doc, panel as unknown as vscode.WebviewPanel, makeCancellationToken());
    const initialMarkdown = doc.markdownText;

    const malformedPayloads: unknown[] = [
      null,
      undefined,
      'raw-string',
      42,
      {},
      { type: 123 },
      { type: null },
      { type: 'tableOperation', operation: 'convertToHtml', docJson: '{not-valid-json' },
      { type: 'tableOperation', operation: 'convertToGfm', docJson: 'null' },
      { type: 'tableOperation', operation: 'convertToHtml', docJson: 123 },
    ];
    for (const payload of malformedPayloads) {
      assert.doesNotThrow(() => {
        panel.webview.simulateReceiveMessage(payload);
      }, `onDidReceiveMessage must not throw for payload: ${JSON.stringify(payload)}`);
    }
    await new Promise((r) => setTimeout(r, 15));
    assert.strictEqual(doc.isDirty, false, 'Malformed messages must not mutate document');
    assert.strictEqual(doc.markdownText, initialMarkdown);
    assert.ok(
      vscodeExt.getRecordedOutputLines().some((line) => line.includes('Invalid docJson in tableOperation')),
      'Malformed tableOperation JSON must be logged without throwing',
    );
  });

  test('TC-I31-031: vscode-remote image path traversal is rejected by isSafeImagePath and never rewritten', () => {
    const remoteStr = 'vscode-remote://ssh-remote+devbox/home/alice/project/doc.md';
    const remoteUri = vscode.Uri.parse(remoteStr);

    assert.strictEqual(isSafeImagePath(remoteStr, '../secret.png'), false);
    assert.strictEqual(isSafeImagePath(remoteStr, 'img/%2e%2e/secret.png'), false);
    assert.strictEqual(isSafeImagePath(remoteStr, 'img/safe-0001.png'), true);

    let resolverCalled = false;
    const result = rewriteImageSrcForDisplay('../../etc/passwd.png', remoteUri, {
      asWebviewUri: (u) => {
        resolverCalled = true;
        return u;
      },
    });
    assert.strictEqual(resolverCalled, false);
    assert.strictEqual(result, '../../etc/passwd.png');
  });

  test('TC-I31-032: untitled documents handle paste, workspace roots, Marp preview, and export safely without crash', async () => {
    const ctx = vscodeExt.createMockExtensionContext('/tmp/ext');
    const manager = new MarpPreviewManager(ctx);
    const provider = new MarkdownEditorProvider(ctx, manager);
    const untitledUri = vscode.Uri.parse('untitled:Untitled-1.md');
    vscodeExt.setMockFile(untitledUri, '---\nmarp: true\n---\n\n# Untitled Slide\n');

    const doc = await provider.openCustomDocument(
      untitledUri,
      { backupId: undefined, untitledDocumentData: undefined },
      makeCancellationToken(),
    );
    const panel = vscodeExt.createMockWebviewPanel('md-wysiwyg-editor.markdownEditor', 'Untitled-1.md');
    await assert.doesNotReject(async () => {
      await provider.resolveCustomEditor(doc, panel as unknown as vscode.WebviewPanel, makeCancellationToken());
    });

    const roots = (provider as unknown as { getWorkspaceImgRoots: (u: vscode.Uri) => vscode.Uri[] })
      .getWorkspaceImgRoots(untitledUri);
    assert.strictEqual(roots.length, 0, 'untitled document should not invent filesystem img root');

    panel.webview.simulateReceiveMessage({ type: 'ready' });
    panel.webview.simulateReceiveMessage({
      type: 'pasteImage',
      mime: 'image/png',
      dataBase64: 'AQID',
    });
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(
      vscodeExt.getRecordedMessages().some((m) => m.level === 'warn' && m.message.includes('Save document first')),
    );

    await assert.doesNotReject(async () => {
      await manager.show(untitledUri, '---\nmarp: true\n---\n\n# Untitled Slide\n');
    });

    vscodeExt.setMockSaveDialogHandler(() => undefined);
    const expDisposables = registerExportCommands(ctx, provider);
    try {
      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportHtml');
      });
    } finally {
      expDisposables.forEach((d) => d.dispose());
    }
  });

  test('TC-I31-035: updateReadonlyBadge is idempotent across repeated ON/OFF toggles without duplicate suffix', async () => {
    const ctx = vscodeExt.createMockExtensionContext(process.cwd());
    const provider = new MarkdownEditorProvider(ctx, new MarpPreviewManager(ctx));
    const mdUri = vscode.Uri.file('/tmp/ro-badge/notes.md');
    vscodeExt.setMockFile(mdUri, '# Notes\n');

    const doc = await provider.openCustomDocument(
      mdUri,
      { backupId: undefined, untitledDocumentData: undefined },
      makeCancellationToken(),
    );
    const panel = vscodeExt.createMockWebviewPanel('md-wysiwyg-editor.markdownEditor', 'notes.md');
    await provider.resolveCustomEditor(doc, panel as unknown as vscode.WebviewPanel, makeCancellationToken());

    provider.refreshReadonly(mdUri, true);
    assert.strictEqual(panel.title, 'notes.md (Readonly)');
    provider.refreshReadonly(mdUri, true);
    assert.strictEqual(panel.title, 'notes.md (Readonly)', 'D-4: repeated ON must not stack (Readonly)');

    provider.refreshReadonly(mdUri, false);
    assert.strictEqual(panel.title, 'notes.md');
    provider.refreshReadonly(mdUri, false);
    assert.strictEqual(panel.title, 'notes.md');

    provider.refreshReadonly(mdUri, true);
    assert.strictEqual(panel.title, 'notes.md (Readonly)');
    provider.refreshReadonly(mdUri, false);
    assert.strictEqual(panel.title, 'notes.md');
  });

  test('TC-I31-037: package.json activationEvents cover all contributed commands including toggleReadonly and showMarpPreview', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
      activationEvents?: string[];
      contributes?: { commands?: Array<{ command: string }> };
    };
    const activationEvents = new Set(pkg.activationEvents ?? []);
    const commands = (pkg.contributes?.commands ?? []).map((c) => c.command);

    assert.ok(commands.length >= 14);
    for (const cmd of commands) {
      assert.ok(
        activationEvents.has(`onCommand:${cmd}`),
        `RK-003: package.json activationEvents missing onCommand:${cmd}`,
      );
    }
  });

  test('TC-I31-038: engines.vscode and @types/vscode stay pinned to ^1.85.0 floor', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
      engines?: { vscode?: string };
      devDependencies?: Record<string, string>;
    };
    assert.strictEqual(pkg.engines?.vscode, '^1.85.0');
    assert.strictEqual(pkg.devDependencies?.['@types/vscode'], '^1.85.0');
  });

  test('TC-I31-039: derivative IDE profiles do not fall back to showPreviewToSide and show error + OutputChannel log when markdown.showPreview fails', async () => {
    const uri = vscode.Uri.file('/tmp/deriv/readme.md');
    for (const appName of ['Cursor', 'Windsurf', 'Antigravity', 'VSCodium']) {
      vscodeExt.resetVscodeMock();
      vscodeExt.setMockAppName(appName);
      vscodeExt.setMockCommandInterceptor((cmd) => {
        if (cmd === 'markdown.showPreview') {
          throw new Error(`Command not found in ${appName}`);
        }
        return undefined;
      });

      await assert.doesNotReject(async () => {
        await showNativeMarkdownPreview({ uri });
      });

      const called = vscodeExt.getExecutedCommands().map((c) => c.command);
      assert.strictEqual(
        called.includes('markdown.showPreviewToSide'),
        false,
        `AD-007 (${appName}): must NOT fall back to markdown.showPreviewToSide when markdown.showPreview fails; called=${JSON.stringify(called)}`,
      );

      const errorMessages = vscodeExt.getRecordedMessages().filter((m) => m.level === 'error');
      assert.ok(
        errorMessages.some((m) => m.message.includes('markdown.showPreview')),
        `AD-007 (${appName}): expected error notification when markdown.showPreview fails; messages=${JSON.stringify(errorMessages)}`,
      );

      const outputLines = vscodeExt.getRecordedOutputLines();
      assert.ok(
        outputLines.some((line) => line.includes('[ERROR]') && line.includes('markdown.showPreview failed')),
        `AD-007 (${appName}): expected OutputChannel error log when markdown.showPreview fails; output=${JSON.stringify(outputLines)}`,
      );
    }

    // Also verify moveActiveEditor failure logs to OutputChannel without showPreviewToSide fallback
    vscodeExt.resetVscodeMock();
    vscodeExt.setMockAppName('Cursor');
    vscodeExt.setMockCommandInterceptor((cmd) => {
      if (cmd === 'moveActiveEditor') {
        throw new Error('moveActiveEditor unavailable');
      }
      return undefined;
    });
    await assert.doesNotReject(async () => {
      await showNativeMarkdownPreview({ uri });
    });
    const moveFailedCalls = vscodeExt.getExecutedCommands().map((c) => c.command);
    assert.strictEqual(
      moveFailedCalls.includes('markdown.showPreviewToSide'),
      false,
      'AD-007: moveActiveEditor failure must not fall back to markdown.showPreviewToSide',
    );
    assert.ok(
      vscodeExt
        .getRecordedOutputLines()
        .some((line) => line.includes('[ERROR]') && line.includes('moveActiveEditor')),
      'AD-007: moveActiveEditor failure must log to OutputChannel',
    );
  });

  test('TC-I31-040: Cmd+F / Cmd+H / Cmd+K are focus-scoped and do not hijack keystrokes outside editor containers', () => {
    const harness = bootEditorWebviewInJsdom({
      initMessage: {
        docJson: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Focus scope test' }] }],
        }),
        markdownText: 'Focus scope test',
        readonly: false,
        editorMode: 'markdown',
      },
    });
    try {
      const findWidget = harness.document.getElementById('find-widget')!;
      // 1. Keystroke on document.body (outside #editor, #raw-editor, #find-widget) must NOT be intercepted
      const bodyFindEv = harness.dispatchKeydown(harness.document.body, { key: 'f', metaKey: true });
      assert.strictEqual(
        bodyFindEv.defaultPrevented,
        false,
        'D-3: Cmd+F on document.body must not call preventDefault()',
      );
      assert.strictEqual(
        findWidget.classList.contains('hidden'),
        true,
        'D-3: Cmd+F outside editor must not open #find-widget',
      );

      const bodyReplaceEv = harness.dispatchKeydown(harness.document.body, { key: 'h', metaKey: true });
      assert.strictEqual(bodyReplaceEv.defaultPrevented, false);

      // 2. Keystroke inside #editor opens FindWidget
      const editorEl = harness.document.getElementById('editor')!;
      const editorFindEv = harness.dispatchKeydown(editorEl, { key: 'f', metaKey: true });
      assert.strictEqual(editorFindEv.defaultPrevented, true);
      assert.strictEqual(findWidget.classList.contains('hidden'), false);
      harness.dispatchKeydown(harness.document.getElementById('find-input')!, { key: 'Escape' });

      // 3. Raw mode: Cmd+K inside #raw-editor wraps selection, while Cmd+K on body does not intercept
      harness.sendHostMessage({ type: 'modeChanged', editorMode: 'raw' });
      const bodyLinkEv = harness.dispatchKeydown(harness.document.body, { key: 'k', metaKey: true });
      assert.strictEqual(bodyLinkEv.defaultPrevented, false);

      const rawTextarea = harness.document.getElementById('raw-editor')!;
      rawTextarea.value = 'click here';
      rawTextarea.setSelectionRange?.(6, 10);
      rawTextarea.focus();
      const rawLinkEv = harness.dispatchKeydown(rawTextarea, { key: 'k', metaKey: true });
      assert.strictEqual(rawLinkEv.defaultPrevented, true);
      assert.ok((rawTextarea.value ?? '').includes('[here]('));
    } finally {
      harness.dispose();
    }
  });
});
