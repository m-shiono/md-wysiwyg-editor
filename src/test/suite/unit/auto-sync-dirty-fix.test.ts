import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownDocument } from '../../../providers/markdown-document';
import { MarkdownEditorProvider } from '../../../providers/markdown-editor-provider';
import { MarpPreviewManager } from '../../../commands/marp-preview';
import {
  parseMarkdown,
  setParseFailureMock,
} from '../../../serializers/markdown-serializer';
import type * as vscodeMockTypes from '../../mocks/vscode';

type VscodeTestShim = typeof vscode & typeof vscodeMockTypes;
const mockVscode = vscode as unknown as VscodeTestShim;

function makeCancellationToken(): vscode.CancellationToken {
  return new vscode.CancellationTokenSource().token;
}

function readMediaEditorSource(): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'media/editor.ts'), 'utf8');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1500,
  intervalMs = 15,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await sleep(intervalMs);
  }
  assert.fail(`waitFor timed out after ${timeoutMs}ms`);
}

async function openProviderEditor(
  uri: vscode.Uri,
  initialContent: string,
  options?: { editorMode?: 'markdown' | 'raw' | 'preview' },
): Promise<{
  provider: MarkdownEditorProvider;
  doc: MarkdownDocument;
  panel: vscodeMockTypes.MockWebviewPanel;
  marpManager: MarpPreviewManager;
}> {
  if (uri.scheme !== 'untitled') {
    mockVscode.setMockFile(uri, initialContent);
  }
  const ctx = mockVscode.createMockExtensionContext(process.cwd());
  if (options?.editorMode) {
    mockVscode.setMockConfiguration('md-wysiwyg-editor', {
      defaultMode: options.editorMode,
    });
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
  panel.webview.simulateReceiveMessage({ type: 'ready' });
  return { provider, doc, panel, marpManager };
}

async function callReloadFromDisk(doc: MarkdownDocument): Promise<boolean> {
  const reloadFn = (doc as unknown as { reloadFromDisk?: () => Promise<boolean> })
    .reloadFromDisk;
  assert.strictEqual(
    typeof reloadFn,
    'function',
    'MarkdownDocument.reloadFromDisk must be implemented',
  );
  return reloadFn!.call(doc);
}

suite('auto-sync-dirty-fix (prevent false dirty & auto-sync external changes)', () => {
  teardown(() => {
    setParseFailureMock(false);
    mockVscode.resetVscodeMock();
  });

  // ---------------------------------------------------------------------------
  // Host MarkdownDocument.updateDoc substantive diff detection (TC-ASDF-001..004)
  // ---------------------------------------------------------------------------

  test('TC-ASDF-001: updateDoc CRLF and no-trailing-newline roundtrip does not mark dirty', async () => {
    const initial = '# Title\r\n\r\nBody';
    const uri = vscode.Uri.file('/w/crlf-doc.md');
    mockVscode.setMockFile(uri, initial);
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    let dirtyEvents = 0;
    doc!.onDidChange(() => {
      dirtyEvents += 1;
    });

    const roundtripDoc = parseMarkdown(initial);
    doc!.updateDoc(roundtripDoc, 'Edit', { syncWebview: false });

    assert.strictEqual(doc!.isDirty, false, 'must remain clean on equivalent roundtrip');
    assert.strictEqual(
      doc!.markdownText,
      initial,
      'must preserve original CRLF and lack of trailing newline',
    );
    assert.strictEqual(dirtyEvents, 0, 'must not fire onDidChange');
    doc!.dispose();
  });

  test('TC-ASDF-002: updateDoc with * list and _ italic format variants does not mark dirty', async () => {
    const initial = '* item1\n* item2\n\n_italic_\n';
    const uri = vscode.Uri.file('/w/format-variants.md');
    mockVscode.setMockFile(uri, initial);
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    let dirtyEvents = 0;
    doc!.onDidChange(() => {
      dirtyEvents += 1;
    });

    const roundtripDoc = parseMarkdown(initial);
    doc!.updateDoc(roundtripDoc, 'Edit', { syncWebview: false });

    assert.strictEqual(doc!.isDirty, false, 'must remain clean when normalized markdown matches');
    assert.strictEqual(
      doc!.markdownText,
      initial,
      'must preserve original * and _ syntax in markdownText',
    );
    assert.strictEqual(dirtyEvents, 0, 'must not fire onDidChange');
    doc!.dispose();
  });

  test('TC-ASDF-003: updateDoc with substantive edit marks dirty, updates markdownText, and registers undo', async () => {
    const initial = '# Title\n\nHello\n';
    const uri = vscode.Uri.file('/w/substantive-edit.md');
    mockVscode.setMockFile(uri, initial);
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    const events: vscode.CustomDocumentEditEvent<MarkdownDocument>[] = [];
    doc!.onDidChange((e) => events.push(e));

    const modified = parseMarkdown('# Title\n\nHello world\n');
    doc!.updateDoc(modified, 'Edit', { syncWebview: false });

    assert.strictEqual(doc!.isDirty, true, 'must become dirty on substantive edit');
    assert.ok(doc!.markdownText.includes('Hello world'), 'markdownText must reflect edit');
    assert.strictEqual(events.length, 1, 'must fire onDidChange once with undo handler');
    assert.strictEqual(typeof events[0].undo, 'function');
    doc!.dispose();
  });

  test('TC-ASDF-004: updateDoc on empty document "" is a clean no-op', async () => {
    const uri = vscode.Uri.file('/w/empty.md');
    mockVscode.setMockFile(uri, '');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    let dirtyEvents = 0;
    doc!.onDidChange(() => {
      dirtyEvents += 1;
    });

    doc!.updateDoc(parseMarkdown(''), 'Edit', { syncWebview: false });

    assert.strictEqual(doc!.isDirty, false);
    assert.strictEqual(doc!.markdownText, '');
    assert.strictEqual(dirtyEvents, 0);
    doc!.dispose();
  });

  // ---------------------------------------------------------------------------
  // Webview NodeView guards, Link dedup, no-op update suppression (TC-ASDF-005..008)
  // ---------------------------------------------------------------------------

  test('TC-ASDF-005: media/editor.ts math NodeView defines ignoreMutation and stopEvent guards', () => {
    const src = readMediaEditorSource();
    const mathBlockMatch = src.match(
      /if\s*\(\s*language\s*===\s*["']math["'][\s\S]*?(?=if\s*\(\s*language\s*===\s*["']plantuml["'])/,
    );
    assert.ok(mathBlockMatch, 'math NodeView branch must exist in media/editor.ts');
    const mathBlock = mathBlockMatch![0];

    assert.match(
      mathBlock,
      /ignoreMutation\s*:\s*\(\s*mutation\s*\)\s*=>[\s\S]*?!code\.contains\(mutation\.target\)/,
      'math NodeView must define ignoreMutation ignoring mutations outside code element',
    );
    assert.match(
      mathBlock,
      /stopEvent\s*:\s*\(\s*event\s*\)\s*=>[\s\S]*?!code\.contains\(/,
      'math NodeView must define stopEvent suppressing events outside code element',
    );
  });

  test('TC-ASDF-006: media/editor.ts plantuml NodeView defines ignoreMutation and stopEvent guards', () => {
    const src = readMediaEditorSource();
    const pumlBlockMatch = src.match(
      /if\s*\(\s*language\s*===\s*["']plantuml["'][\s\S]*?(?=if\s*\(\s*language\s*!==\s*["']mermaid["'])/,
    );
    assert.ok(pumlBlockMatch, 'plantuml NodeView branch must exist in media/editor.ts');
    const pumlBlock = pumlBlockMatch![0];

    assert.match(
      pumlBlock,
      /ignoreMutation\s*:\s*\(\s*mutation\s*\)\s*=>[\s\S]*?!code\.contains\(mutation\.target\)/,
      'plantuml NodeView must define ignoreMutation ignoring mutations outside code element',
    );
    assert.match(
      pumlBlock,
      /stopEvent\s*:\s*\(\s*event\s*\)\s*=>[\s\S]*?!code\.contains\(/,
      'plantuml NodeView must define stopEvent suppressing events outside code element',
    );
  });

  test('TC-ASDF-007: media/editor.ts disables StarterKit bundled link to avoid Link duplicate', () => {
    const src = readMediaEditorSource();
    const starterKitMatch = src.match(/StarterKit\.configure\(\{[\s\S]*?\}\)/);
    assert.ok(starterKitMatch, 'StarterKit.configure block must exist in media/editor.ts');
    assert.match(
      starterKitMatch![0],
      /link\s*:\s*false/,
      'StarterKit.configure must set link: false when Link.configure is used separately',
    );
    assert.match(
      src,
      /Link\.configure\(\s*\{\s*openOnClick\s*:\s*false\s*\}\s*\)/,
      'Link.configure({ openOnClick: false }) must remain configured',
    );
  });

  test('TC-ASDF-008: media/editor.ts onUpdate suppresses postMessage when docJson matches lastSynced', () => {
    const src = readMediaEditorSource();
    const onUpdateMatch = src.match(/onUpdate\s*:\s*\(\{\s*editor:\s*ed\s*\}\)\s*=>\s*\{[\s\S]*?checkTableLimitsFromEditor/);
    assert.ok(onUpdateMatch, 'onUpdate handler must exist in media/editor.ts');
    const onUpdateBlock = onUpdateMatch![0];

    assert.match(
      onUpdateBlock,
      /lastSyncedDocJson/,
      'onUpdate must compare serialized docJson against tracked lastSyncedDocJsonStr before postMessage',
    );
    assert.match(
      src,
      /let\s+lastSyncedDocJson/,
      'media/editor.ts must track lastSyncedDocJsonStr across init/docUpdated/update',
    );
  });

  // ---------------------------------------------------------------------------
  // FileSystemWatcher scope, debounce, self-save, dirty guard (TC-ASDF-009..014)
  // ---------------------------------------------------------------------------

  test('TC-ASDF-009: watcher created with RelativePattern for file/vscode-remote, skipped for untitled', async () => {
    const fileUri = vscode.Uri.file('/w/a.md');
    const remoteUri = vscode.Uri.parse('vscode-remote://ssh+h/w/b.md');
    const untitledUri = vscode.Uri.parse('untitled:Untitled-1.md');

    const fileEd = await openProviderEditor(fileUri, '# A\n');
    const remoteEd = await openProviderEditor(remoteUri, '# B\n');
    const untitledEd = await openProviderEditor(untitledUri, '');

    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(
      watchers.length,
      2,
      'watchers must be created only for file and vscode-remote (not untitled)',
    );

    const p0 = watchers[0].globPattern as vscodeMockTypes.RelativePattern;
    assert.ok(p0 instanceof mockVscode.RelativePattern, 'must use RelativePattern');
    assert.strictEqual(p0.pattern, 'a.md');
    assert.strictEqual(p0.baseUri.path, '/w');

    const p1 = watchers[1].globPattern as vscodeMockTypes.RelativePattern;
    assert.ok(p1 instanceof mockVscode.RelativePattern, 'must use RelativePattern');
    assert.strictEqual(p1.pattern, 'b.md');
    assert.strictEqual(p1.baseUri.scheme, 'vscode-remote');
    assert.strictEqual(p1.baseUri.authority, 'ssh+h');

    fileEd.panel.dispose();
    remoteEd.panel.dispose();
    untitledEd.panel.dispose();
  });

  test('TC-ASDF-010: external change events within burst are debounced 250ms into a single reload', async () => {
    const uri = vscode.Uri.file('/w/debounce.md');
    const { doc, panel } = await openProviderEditor(uri, '# Initial\n');
    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(watchers.length, 1);

    let contentChangeCount = 0;
    doc.onDidContentChange(() => {
      contentChangeCount += 1;
    });

    mockVscode.setMockFile(uri, '# Burst Final\n');
    watchers[0].fireChange(uri);
    await sleep(50);
    watchers[0].fireChange(uri);
    await sleep(50);
    watchers[0].fireChange(uri);

    // Before 250ms from last event, reload must not have run yet.
    await sleep(100);
    assert.strictEqual(
      doc.markdownText,
      '# Initial\n',
      'reload must not execute before 250ms debounce elapses',
    );
    assert.strictEqual(contentChangeCount, 0);

    // After 250ms from last event, reload executes exactly once.
    await waitFor(() => doc.markdownText === '# Burst Final\n', 1000);
    assert.strictEqual(contentChangeCount, 1, 'burst must coalesce into 1 reload');
    assert.strictEqual(doc.isDirty, false);
    panel.dispose();
  });

  test('TC-ASDF-011: self-save suppression window (500ms) skips watcher onDidChange reload', async () => {
    const uri = vscode.Uri.file('/w/self-save.md');
    const { provider, doc, panel } = await openProviderEditor(uri, '# v1\n');
    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(watchers.length, 1);

    doc.updateDoc(parseMarkdown('# v2\n'), 'Edit', { syncWebview: false });
    assert.strictEqual(doc.isDirty, true);

    let contentChangeAfterSave = 0;
    doc.onDidContentChange(() => {
      contentChangeAfterSave += 1;
    });

    await provider.saveCustomDocument(doc, makeCancellationToken());
    assert.strictEqual(doc.isDirty, false);

    // Simulate OS/VS Code FS change notification immediately after save
    watchers[0].fireChange(uri);
    await sleep(320);

    assert.strictEqual(
      contentChangeAfterSave,
      0,
      'self-save event within 500ms must not trigger reloadFromDisk',
    );
    panel.dispose();
  });

  test('TC-ASDF-012: identical disk content skips reloadFromDisk as no-op', async () => {
    const uri = vscode.Uri.file('/w/identical.md');
    const { doc, panel } = await openProviderEditor(uri, '# Same\n');
    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(watchers.length, 1);

    let contentChangeCount = 0;
    doc.onDidContentChange(() => {
      contentChangeCount += 1;
    });

    // Touch event with identical content on disk
    mockVscode.setMockFile(uri, '# Same\n');
    watchers[0].fireChange(uri);
    await sleep(320);

    assert.strictEqual(
      contentChangeCount,
      0,
      'identical disk content must not fire onDidContentChange',
    );
    assert.strictEqual(doc.isDirty, false);
    panel.dispose();
  });

  test('TC-ASDF-013: dirty guard blocks external reload and preserves unsaved user edits', async () => {
    const uri = vscode.Uri.file('/w/dirty-guard.md');
    const { doc, panel } = await openProviderEditor(uri, '# Initial\n');
    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(watchers.length, 1);

    doc.updateDoc(parseMarkdown('# Unsaved User Edit\n'), 'Edit', {
      syncWebview: false,
    });
    assert.strictEqual(doc.isDirty, true);

    mockVscode.setMockFile(uri, '# External Overwrite\n');
    watchers[0].fireChange(uri);
    await sleep(320);

    assert.strictEqual(doc.isDirty, true, 'isDirty must remain true');
    assert.strictEqual(
      doc.markdownText,
      '# Unsaved User Edit\n',
      'unsaved user edits must not be overwritten by external change',
    );
    panel.dispose();
  });

  test('TC-ASDF-014: dirty guard re-checks after async readFile and aborts if user edited in-flight', async () => {
    const uri = vscode.Uri.file('/w/race-guard.md');
    mockVscode.setMockFile(uri, '# Initial\n');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    const origReadFile = vscode.workspace.fs.readFile;
    let releaseRead!: (bytes: Uint8Array) => void;
    vscode.workspace.fs.readFile = async () =>
      new Promise<Uint8Array>((resolve) => {
        releaseRead = resolve;
      });

    try {
      const reloadPromise = callReloadFromDisk(doc!);
      // Wait a microtask so readFile is in-flight
      await sleep(5);
      // User edits while readFile is pending
      doc!.updateDoc(parseMarkdown('# User In-Flight Edit\n'), 'Edit', {
        syncWebview: false,
      });
      assert.strictEqual(doc!.isDirty, true);

      releaseRead(Buffer.from('# External Stale\n', 'utf8'));
      const applied = await reloadPromise;

      assert.strictEqual(applied, false, 'reloadFromDisk must abort when dirty became true');
      assert.strictEqual(doc!.isDirty, true);
      assert.strictEqual(doc!.markdownText, '# User In-Flight Edit\n');
    } finally {
      vscode.workspace.fs.readFile = origReadFile;
      doc!.dispose();
    }
  });

  // ---------------------------------------------------------------------------
  // reloadFromDisk state reset, all-mode sync, error handling (TC-ASDF-015..018)
  // ---------------------------------------------------------------------------

  test('TC-ASDF-015: reloadFromDisk updates doc, resets undo stack and rawParseFailed, keeps clean', async () => {
    const uri = vscode.Uri.file('/w/reload-reset.md');
    mockVscode.setMockFile(uri, '# Initial\n');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    let undoFn: (() => PromiseLike<void> | void) | undefined;
    doc!.onDidChange((e) => {
      undoFn = e.undo;
    });

    // Build an undo entry and save to return to clean state
    doc!.updateDoc(parseMarkdown('# Edited\n'), 'Edit', { syncWebview: false });
    assert.ok(undoFn, 'undo callback should exist before reload');
    await doc!.save(makeCancellationToken());
    assert.strictEqual(doc!.isDirty, false);

    // Put doc into rawParseFailed state
    setParseFailureMock(true);
    const rawOk = doc!.applyRawSource('# Broken', 'Raw edit');
    assert.strictEqual(rawOk, false);
    assert.strictEqual(doc!.isRawParseFailed, true);
    setParseFailureMock(false);

    let dirtyEventsAfter = 0;
    let contentEventsAfter = 0;
    doc!.onDidChange(() => {
      dirtyEventsAfter += 1;
    });
    doc!.onDidContentChange(() => {
      contentEventsAfter += 1;
    });

    mockVscode.setMockFile(uri, '# Updated\n');
    const reloaded = await callReloadFromDisk(doc!);

    assert.strictEqual(reloaded, true);
    assert.strictEqual(doc!.markdownText, '# Updated\n');
    assert.strictEqual(doc!.isDirty, false, 'must remain clean after reloadFromDisk');
    assert.strictEqual(doc!.isRawParseFailed, false, 'must clear rawParseFailed');
    assert.strictEqual(contentEventsAfter, 1, 'must fire onDidContentChange');
    assert.strictEqual(dirtyEventsAfter, 0, 'must NOT fire onDidChange');

    // Old undo callback must be a no-op after editStack reset
    await undoFn!();
    assert.strictEqual(
      doc!.markdownText,
      '# Updated\n',
      'stale undo after reloadFromDisk must not revert to pre-reload content',
    );
    doc!.dispose();
  });

  test('TC-ASDF-016: reloadFromDisk syncs Visual, Raw, Preview, and MarpPreviewManager', async () => {
    // 1. Visual (markdown) mode
    const mdUri = vscode.Uri.file('/w/sync-visual.md');
    const visual = await openProviderEditor(mdUri, '# Visual 1\n', {
      editorMode: 'markdown',
    });
    mockVscode.setMockFile(mdUri, '# Visual 2\n');
    await callReloadFromDisk(visual.doc);
    assert.ok(
      visual.panel.webview.postedMessages.some(
        (m) =>
          (m as { type?: string; markdownText?: string }).type === 'docUpdated' &&
          (m as { markdownText?: string }).markdownText === '# Visual 2\n',
      ),
      'Visual mode must receive docUpdated on reloadFromDisk',
    );
    assert.strictEqual(visual.doc.isDirty, false);
    visual.panel.dispose();

    mockVscode.resetVscodeMock();

    // 2. Raw mode
    const rawUri = vscode.Uri.file('/w/sync-raw.md');
    const raw = await openProviderEditor(rawUri, '# Raw 1\n', {
      editorMode: 'raw',
    });
    mockVscode.setMockFile(rawUri, '# Raw 2\n');
    await callReloadFromDisk(raw.doc);
    assert.ok(
      raw.panel.webview.postedMessages.some(
        (m) =>
          (m as { type?: string; markdownText?: string }).type === 'docUpdated' &&
          (m as { markdownText?: string }).markdownText === '# Raw 2\n',
      ),
      'Raw mode must receive docUpdated with updated markdownText',
    );
    assert.strictEqual(raw.doc.isDirty, false);
    raw.panel.dispose();

    mockVscode.resetVscodeMock();

    // 3. Preview mode (Marp document) + MarpPreviewManager
    const marpUri = vscode.Uri.file('/w/sync-preview.md');
    const preview = await openProviderEditor(
      marpUri,
      '---\nmarp: true\n---\n\n# Slide 1\n',
      { editorMode: 'preview' },
    );
    let marpUpdatedText = '';
    const origUpdatePreview = preview.marpManager.updatePreview.bind(preview.marpManager);
    preview.marpManager.updatePreview = async (uri, markdownText) => {
      if (uri.toString() === marpUri.toString()) {
        marpUpdatedText = markdownText;
      }
      return origUpdatePreview(uri, markdownText);
    };

    const nextMarp = '---\nmarp: true\n---\n\n# Slide 2\n';
    mockVscode.setMockFile(marpUri, nextMarp);
    await callReloadFromDisk(preview.doc);
    assert.ok(
      preview.panel.webview.postedMessages.some((m) => {
        const type = (m as { type?: string }).type;
        return type === 'previewMarpHtml' || type === 'previewHtml';
      }),
      'Preview mode must receive preview projection message on reloadFromDisk',
    );
    assert.strictEqual(marpUpdatedText, nextMarp, 'MarpPreviewManager must be updated');
    assert.strictEqual(preview.doc.isDirty, false);
    preview.panel.dispose();
  });

  test('TC-ASDF-017: reloadFromDisk readFile error is non-destructive and recovers on next read', async () => {
    const uri = vscode.Uri.file('/w/read-err.md');
    mockVscode.setMockFile(uri, '# Stable\n');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    const origReadFile = vscode.workspace.fs.readFile;
    vscode.workspace.fs.readFile = async () => {
      throw new Error('EBUSY: file truncated');
    };

    try {
      const ok = await callReloadFromDisk(doc!);
      assert.strictEqual(ok, false);
      assert.strictEqual(doc!.markdownText, '# Stable\n', 'must keep existing document');
      assert.strictEqual(doc!.isDirty, false);
      assert.strictEqual(
        mockVscode.getRecordedMessages().filter((m) => m.level === 'error').length,
        0,
        'must not show modal error message on transient readFile failure',
      );
    } finally {
      vscode.workspace.fs.readFile = origReadFile;
    }

    // Recovery on subsequent valid reload
    mockVscode.setMockFile(uri, '# Recovered\n');
    const recovered = await callReloadFromDisk(doc!);
    assert.strictEqual(recovered, true);
    assert.strictEqual(doc!.markdownText, '# Recovered\n');
    doc!.dispose();
  });

  test('TC-ASDF-018: reloadFromDisk parseMarkdown error is non-destructive and recovers on next valid content', async () => {
    const uri = vscode.Uri.file('/w/parse-err.md');
    mockVscode.setMockFile(uri, '# Stable\n');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    mockVscode.setMockFile(uri, '# Corrupt\n');
    setParseFailureMock(true);
    try {
      const ok = await callReloadFromDisk(doc!);
      assert.strictEqual(ok, false);
      assert.strictEqual(doc!.markdownText, '# Stable\n', 'must preserve existing document');
      assert.strictEqual(doc!.isDirty, false);
    } finally {
      setParseFailureMock(false);
    }

    mockVscode.setMockFile(uri, '# Recovered After Parse\n');
    const recovered = await callReloadFromDisk(doc!);
    assert.strictEqual(recovered, true);
    assert.strictEqual(doc!.markdownText, '# Recovered After Parse\n');
    doc!.dispose();
  });

  // ---------------------------------------------------------------------------
  // Disposal, external delete ignore, remote scheme (TC-ASDF-019..021)
  // ---------------------------------------------------------------------------

  test('TC-ASDF-019: webviewPanel.onDidDispose disposes watcher and cancels pending debounce timer', async () => {
    const uri = vscode.Uri.file('/w/dispose.md');
    const { doc, panel } = await openProviderEditor(uri, '# Initial\n');
    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(watchers.length, 1);

    mockVscode.setMockFile(uri, '# Should Not Reload\n');
    watchers[0].fireChange(uri);

    // Dispose panel before 250ms debounce elapses
    panel.dispose();
    assert.strictEqual(watchers[0].disposed, true, 'watcher must be disposed');

    await sleep(320);
    assert.strictEqual(
      doc.markdownText,
      '# Initial\n',
      'pending debounce timer must be cleared on dispose',
    );
  });

  test('TC-ASDF-020: watcher ignores create and delete events and external delete does not destroy doc', async () => {
    const uri = vscode.Uri.file('/w/delete-ignore.md');
    const { doc, panel } = await openProviderEditor(uri, '# Keep Me\n');
    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(watchers.length, 1);

    assert.strictEqual(
      watchers[0].ignoreCreateEvents,
      true,
      'createFileSystemWatcher must set ignoreCreateEvents: true',
    );
    assert.strictEqual(
      watchers[0].ignoreDeleteEvents,
      true,
      'createFileSystemWatcher must set ignoreDeleteEvents: true',
    );

    await vscode.workspace.fs.delete(uri);
    watchers[0].fireDelete(uri);
    await sleep(300);

    assert.strictEqual(doc.markdownText, '# Keep Me\n', 'document must remain intact');
    panel.dispose();
  });

  test('TC-ASDF-021: vscode-remote URI creates watcher and reloadFromDisk preserves scheme and authority', async () => {
    const remoteUri = vscode.Uri.parse('vscode-remote://wsl+Ubuntu/home/user/doc.md');
    const { doc, panel } = await openProviderEditor(remoteUri, '# Remote Initial\n');
    const watchers = mockVscode.getCreatedFileSystemWatchers();
    assert.strictEqual(watchers.length, 1);

    const readUris: vscode.Uri[] = [];
    const origReadFile = vscode.workspace.fs.readFile;
    vscode.workspace.fs.readFile = async (u: vscode.Uri) => {
      readUris.push(u);
      return origReadFile(u);
    };

    try {
      mockVscode.setMockFile(remoteUri, '# Remote Updated\n');
      watchers[0].fireChange(remoteUri);
      await waitFor(() => doc.markdownText === '# Remote Updated\n', 1000);

      assert.ok(readUris.length >= 1, 'readFile must be called for remote URI');
      assert.strictEqual(readUris[0].scheme, 'vscode-remote');
      assert.strictEqual(readUris[0].authority, 'wsl+Ubuntu');
    } finally {
      vscode.workspace.fs.readFile = origReadFile;
      panel.dispose();
    }
  });
});
