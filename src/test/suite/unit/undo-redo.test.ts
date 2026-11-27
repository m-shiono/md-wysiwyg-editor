import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  MAX_UNDO_HISTORY,
  UndoGroupTracker,
} from '../../../utils/undo-grouping';
import { MarkdownDocument } from '../../../providers/markdown-document';
import { MarkdownEditorProvider } from '../../../providers/markdown-editor-provider';
import { MarpPreviewManager } from '../../../commands/marp-preview';
import { parseMarkdown } from '../../../serializers/markdown-serializer';
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

async function openProviderWithJsdom(
  uri: vscode.Uri,
  initialMarkdown: string,
  editorMode: 'markdown' | 'raw' = 'markdown',
) {
  mockVscode.setMockFile(uri, initialMarkdown);
  const ctx = mockVscode.createMockExtensionContext(process.cwd());
  mockVscode.setMockConfiguration('md-wysiwyg-editor', {
    defaultMode: editorMode === 'raw' ? 'source' : 'visual',
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

function dispatchInputLike(
  win: object,
  target: { dispatchEvent: (ev: unknown) => boolean },
  type: 'beforeinput' | 'input',
  init?: { inputType?: string; data?: string | null; isComposing?: boolean },
): void {
  const w = win as Record<string, unknown>;
  const EventCtor = (w.InputEvent ?? w.Event) as new (
    t: string,
    opts?: Record<string, unknown>,
  ) => Record<string, unknown>;
  const ev = new EventCtor(type, {
    bubbles: true,
    cancelable: true,
    inputType: init?.inputType ?? 'insertText',
    data: init?.data ?? null,
    isComposing: init?.isComposing ?? false,
  });
  if (init?.inputType !== undefined && ev.inputType === undefined) {
    Object.defineProperty(ev, 'inputType', { value: init.inputType });
  }
  if (init?.data !== undefined && ev.data === undefined) {
    Object.defineProperty(ev, 'data', { value: init.data });
  }
  if (init?.isComposing !== undefined && ev.isComposing === undefined) {
    Object.defineProperty(ev, 'isComposing', { value: init.isComposing });
  }
  target.dispatchEvent(ev);
}

function dispatchComposition(
  win: object,
  target: { dispatchEvent: (ev: unknown) => boolean },
  type: 'compositionstart' | 'compositionend',
  data = '',
): void {
  const w = win as Record<string, unknown>;
  const Ctor = (w.CompositionEvent ?? w.Event) as new (
    t: string,
    opts?: Record<string, unknown>,
  ) => Record<string, unknown>;
  const ev = new Ctor(type, { bubbles: true, cancelable: true, data });
  target.dispatchEvent(ev);
}

suite('undo-redo (single-source history, grouping, IME, Ctrl+Z)', () => {
  teardown(() => {
    mockVscode.resetVscodeMock();
  });

  // ---------------------------------------------------------------------------
  // UndoGroupTracker unit tests (TC-UNDO-001..003)
  // ---------------------------------------------------------------------------

  test('TC-UNDO-001: groups English word typing and breaks after whitespace boundary', () => {
    const tracker = new UndoGroupTracker({ idleMs: 800, prefix: 't' });
    let t = 1000;
    const typeStr = (str: string) => {
      const ids: string[] = [];
      for (const ch of str) {
        t += 60;
        ids.push(
          tracker.nextGroupId({
            kind: 'insertText',
            insertedText: ch,
            timestamp: t,
          }),
        );
      }
      return ids;
    };

    const helloSpace = typeStr('hello ');
    assert.strictEqual(new Set(helloSpace).size, 1, 'word + trailing space share one group');

    const world = typeStr('world');
    assert.strictEqual(new Set(world).size, 1, 'second word shares one group');
    assert.notStrictEqual(world[0], helloSpace[0], 'new word after space starts new group');

    const spaceThenNext = typeStr(' next');
    assert.strictEqual(spaceThenNext[0], world[0], 'trailing space stays with previous word');
    assert.notStrictEqual(spaceThenNext[1], world[0], 'next word starts new group');
  });

  test('TC-UNDO-002: breaks on punctuation, 800ms idle, line break, and insert/delete switch', () => {
    const tracker = new UndoGroupTracker({ idleMs: 800, prefix: 't' });
    const g1a = tracker.nextGroupId({ kind: 'insertText', insertedText: 'a', timestamp: 100 });
    const g1b = tracker.nextGroupId({ kind: 'insertText', insertedText: ',', timestamp: 150 });
    const g1c = tracker.nextGroupId({ kind: 'insertText', insertedText: ' ', timestamp: 200 });
    assert.strictEqual(g1a, g1b);
    assert.strictEqual(g1b, g1c);

    // Next word after punctuation + space starts new group
    const g2 = tracker.nextGroupId({ kind: 'insertText', insertedText: 'b', timestamp: 250 });
    assert.notStrictEqual(g2, g1a);

    // Idle > 800ms starts new group
    const g3 = tracker.nextGroupId({ kind: 'insertText', insertedText: 'c', timestamp: 1200 });
    assert.notStrictEqual(g3, g2);

    // Line break starts new group and forces boundary on subsequent char
    const g4 = tracker.nextGroupId({ kind: 'insertLineBreak', timestamp: 1250 });
    assert.notStrictEqual(g4, g3);
    const g5 = tracker.nextGroupId({ kind: 'insertText', insertedText: 'd', timestamp: 1300 });
    assert.notStrictEqual(g5, g4);

    // Switch insert -> deleteBackward -> deleteForward
    const g6a = tracker.nextGroupId({ kind: 'deleteBackward', timestamp: 1350 });
    const g6b = tracker.nextGroupId({ kind: 'deleteBackward', timestamp: 1400 });
    assert.strictEqual(g6a, g6b);
    assert.notStrictEqual(g6a, g5);

    const g7 = tracker.nextGroupId({ kind: 'deleteForward', timestamp: 1450 });
    assert.notStrictEqual(g7, g6a);
  });

  test('TC-UNDO-003: breaks on cursor move, IME compositionConfirm, and command', () => {
    const tracker = new UndoGroupTracker({ idleMs: 800, prefix: 't' });
    const g1 = tracker.nextGroupId({ kind: 'insertText', insertedText: 'a', timestamp: 100 });
    tracker.notifyCursorMove();
    const g2 = tracker.nextGroupId({ kind: 'insertText', insertedText: 'b', timestamp: 150 });
    assert.notStrictEqual(g2, g1, 'cursor move must break typing group');

    const g3 = tracker.nextGroupId({ kind: 'compositionConfirm', timestamp: 200 });
    const g4 = tracker.nextGroupId({ kind: 'compositionConfirm', timestamp: 250 });
    assert.notStrictEqual(g3, g2);
    assert.notStrictEqual(g4, g3, 'each IME confirmation is its own group');

    const g5 = tracker.nextGroupId({ kind: 'command', timestamp: 300 });
    const g6 = tracker.nextGroupId({ kind: 'insertText', insertedText: 'x', timestamp: 320 });
    assert.notStrictEqual(g5, g4);
    assert.notStrictEqual(g6, g5);
  });

  // ---------------------------------------------------------------------------
  // MarkdownDocument history & dirty tests (TC-UNDO-004..007)
  // ---------------------------------------------------------------------------

  test('TC-UNDO-004: supports 12 consecutive undo/redo steps back to clean initial state', async () => {
    const uri = vscode.Uri.file('/w/undo-12.md');
    const initial = 'Initial line\n';
    mockVscode.setMockFile(uri, initial);
    const doc = (await MarkdownDocument.create(uri, undefined))!;

    for (let i = 1; i <= 12; i++) {
      doc.applyRawSource(`Step ${i}\n`, 'Raw edit', {
        syncWebview: false,
        undoGroupId: `grp-${i}`,
      });
    }

    assert.strictEqual(doc.undoDepth, 12);
    assert.strictEqual(doc.isDirty, true);

    for (let i = 11; i >= 1; i--) {
      assert.strictEqual(doc.undo(), true);
      assert.strictEqual(doc.markdownText, `Step ${i}\n`);
      assert.strictEqual(doc.isDirty, true);
    }

    // 12th undo restores initial clean state
    assert.strictEqual(doc.undo(), true);
    assert.strictEqual(doc.markdownText, initial);
    assert.strictEqual(doc.isDirty, false, 'returning to initial state clears dirty');
    assert.strictEqual(doc.undo(), false);

    // 12 redos restore final state
    for (let i = 1; i <= 12; i++) {
      assert.strictEqual(doc.redo(), true);
      assert.strictEqual(doc.markdownText, `Step ${i}\n`);
      assert.strictEqual(doc.isDirty, true);
    }
    assert.strictEqual(doc.redo(), false);
    doc.dispose();
  });

  test('TC-UNDO-005: coalesces same undoGroupId into single edit event and single undo step', async () => {
    const uri = vscode.Uri.file('/w/undo-coalesce.md');
    mockVscode.setMockFile(uri, 'Start\n');
    const doc = (await MarkdownDocument.create(uri, undefined))!;

    let changeEvents = 0;
    doc.onDidChange(() => {
      changeEvents += 1;
    });

    doc.updateDoc(parseMarkdown('Start a\n'), 'Edit', {
      syncWebview: false,
      undoGroupId: 'word-1',
    });
    doc.updateDoc(parseMarkdown('Start ab\n'), 'Edit', {
      syncWebview: false,
      undoGroupId: 'word-1',
    });
    doc.updateDoc(parseMarkdown('Start abc\n'), 'Edit', {
      syncWebview: false,
      undoGroupId: 'word-1',
    });

    assert.strictEqual(changeEvents, 1, 'same undoGroupId emits only one onDidChange');
    assert.strictEqual(doc.undoDepth, 1);
    assert.strictEqual(doc.markdownText, 'Start abc\n');

    assert.strictEqual(doc.undo(), true);
    assert.strictEqual(doc.markdownText, 'Start\n');
    assert.strictEqual(doc.isDirty, false);
    doc.dispose();
  });

  test('TC-UNDO-006: tracks save point accurately across undo and redo', async () => {
    const uri = vscode.Uri.file('/w/undo-savepoint.md');
    mockVscode.setMockFile(uri, 'v0\n');
    const doc = (await MarkdownDocument.create(uri, undefined))!;

    doc.applyRawSource('v1\n', 'Raw edit', { syncWebview: false, undoGroupId: 'g1' });
    await doc.save(makeCancellationToken());
    assert.strictEqual(doc.isDirty, false);

    // Even if same group id is sent after save, save point must not be coalesced across
    doc.applyRawSource('v2\n', 'Raw edit', { syncWebview: false, undoGroupId: 'g1' });
    doc.applyRawSource('v3\n', 'Raw edit', { syncWebview: false, undoGroupId: 'g3' });
    assert.strictEqual(doc.isDirty, true);

    assert.strictEqual(doc.undo(), true);
    assert.strictEqual(doc.markdownText, 'v2\n');
    assert.strictEqual(doc.isDirty, true);

    assert.strictEqual(doc.undo(), true);
    assert.strictEqual(doc.markdownText, 'v1\n');
    assert.strictEqual(doc.isDirty, false, 'returning to saved state clears dirty');

    assert.strictEqual(doc.undo(), true);
    assert.strictEqual(doc.markdownText, 'v0\n');
    assert.strictEqual(doc.isDirty, true, 'undoing past saved point is dirty relative to disk');

    assert.strictEqual(doc.redo(), true);
    assert.strictEqual(doc.markdownText, 'v1\n');
    assert.strictEqual(doc.isDirty, false, 'redoing back to saved point clears dirty');
    doc.dispose();
  });

  test('TC-UNDO-007: caps history at MAX_UNDO_HISTORY (100)', async () => {
    const uri = vscode.Uri.file('/w/undo-cap.md');
    mockVscode.setMockFile(uri, 's0\n');
    const doc = (await MarkdownDocument.create(uri, undefined))!;

    for (let i = 1; i <= MAX_UNDO_HISTORY + 5; i++) {
      doc.applyRawSource(`s${i}\n`, 'Raw edit', {
        syncWebview: false,
        undoGroupId: `cap-${i}`,
      });
    }

    assert.strictEqual(doc.undoDepth, MAX_UNDO_HISTORY);
    let undoCount = 0;
    while (doc.undo()) {
      undoCount += 1;
    }
    assert.strictEqual(undoCount, MAX_UNDO_HISTORY);
    assert.strictEqual(doc.markdownText, 's5\n');
    assert.strictEqual(doc.isDirty, true);
    doc.dispose();
  });

  // ---------------------------------------------------------------------------
  // Webview JSDOM + Provider integration tests (TC-UNDO-008..013)
  // ---------------------------------------------------------------------------

  test('TC-UNDO-008: Visual mode handles both Ctrl+Z (macOS style) and Cmd+Z', async () => {
    const uri = vscode.Uri.file('/w/visual-ctrlz.md');
    const { doc, harness, flushBridge, panel } = await openProviderWithJsdom(
      uri,
      'Initial\n',
      'markdown',
    );
    try {
      const editorEl = harness.document.getElementById('editor')!;
      const pmEl = editorEl.querySelector('.ProseMirror') ?? editorEl;

      // Apply two distinct edits via Host->Webview or toolbar/TipTap
      await providerUpdateVisual(harness, flushBridge, 'Edit one', 'cmd-1');
      assert.ok(doc.markdownText.includes('Edit one'));

      // 1. Ctrl+Z (ctrlKey: true, metaKey: false)
      const evCtrl = harness.dispatchKeydown(pmEl, { key: 'z', ctrlKey: true, metaKey: false });
      assert.strictEqual(evCtrl.defaultPrevented, true);
      await flushBridge();
      assert.strictEqual(doc.markdownText, 'Initial\n');
      assert.strictEqual(doc.isDirty, false);

      // Redo with Ctrl+Y
      const evRedo = harness.dispatchKeydown(pmEl, { key: 'y', ctrlKey: true, metaKey: false });
      assert.strictEqual(evRedo.defaultPrevented, true);
      await flushBridge();
      assert.ok(doc.markdownText.includes('Edit one'));

      // 2. Cmd+Z (metaKey: true, ctrlKey: false)
      const evMeta = harness.dispatchKeydown(pmEl, { key: 'z', metaKey: true, ctrlKey: false });
      assert.strictEqual(evMeta.defaultPrevented, true);
      await flushBridge();
      assert.strictEqual(doc.markdownText, 'Initial\n');
    } finally {
      harness.dispose();
      panel.dispose();
    }
  });

  test('TC-UNDO-009: Visual mode suppresses updates during IME composition and commits on compositionend', async () => {
    const uri = vscode.Uri.file('/w/visual-ime.md');
    const { doc, harness, flushBridge, panel } = await openProviderWithJsdom(
      uri,
      'Start\n',
      'markdown',
    );
    try {
      const editorEl = harness.document.getElementById('editor')!;
      const pmEl = editorEl.querySelector('.ProseMirror') ?? editorEl;
      pmEl.focus();
      const beforeCount = harness.postedMessages.filter((m) => m.type === 'update').length;

      dispatchComposition(harness.window, pmEl, 'compositionstart', '');
      // Intermediate composition DOM mutation
      const p = pmEl.querySelector('p') ?? pmEl;
      p.textContent = 'Start へんかん';
      dispatchInputLike(harness.window, pmEl, 'input', {
        inputType: 'insertCompositionText',
        data: 'へんかん',
        isComposing: true,
      });
      await sleep(180);

      const midCount = harness.postedMessages.filter((m) => m.type === 'update').length;
      assert.strictEqual(midCount, beforeCount, 'must not emit update while composing');

      // Finalize IME composition
      p.textContent = 'Start 変換';
      dispatchComposition(harness.window, pmEl, 'compositionend', '変換');
      await sleep(60);
      await flushBridge();

      const afterCount = harness.postedMessages.filter((m) => m.type === 'update').length;
      assert.strictEqual(afterCount, beforeCount + 1, 'compositionend commits one update');
      assert.ok(doc.markdownText.includes('変換'));

      // Single Ctrl+Z reverts the entire IME commit back to Start
      harness.dispatchKeydown(pmEl, { key: 'z', ctrlKey: true });
      await flushBridge();
      assert.strictEqual(doc.markdownText, 'Start\n');
    } finally {
      harness.dispose();
      panel.dispose();
    }
  });

  test('TC-UNDO-010: Source mode reverts to initial text on first Ctrl+Z and restores cursor', async () => {
    const uri = vscode.Uri.file('/w/raw-initial-undo.md');
    const { doc, harness, flushBridge, panel } = await openProviderWithJsdom(
      uri,
      'alpha',
      'raw',
    );
    try {
      const rawEl = harness.document.getElementById('raw-editor')! as unknown as {
        value: string;
        selectionStart: number;
        selectionEnd: number;
        focus: () => void;
        setSelectionRange: (s: number, e: number) => void;
        dispatchEvent: (ev: unknown) => boolean;
      };
      rawEl.focus();
      rawEl.setSelectionRange(5, 5);
      assert.strictEqual(rawEl.value, 'alpha');

      // Type " beta" (1st word boundary / command)
      dispatchInputLike(harness.window, rawEl, 'beforeinput', {
        inputType: 'insertText',
        data: ' ',
      });
      rawEl.value = 'alpha ';
      rawEl.setSelectionRange(6, 6);
      dispatchInputLike(harness.window, rawEl, 'input', {
        inputType: 'insertText',
        data: ' ',
      });

      dispatchInputLike(harness.window, rawEl, 'beforeinput', {
        inputType: 'insertText',
        data: 'b',
      });
      rawEl.value = 'alpha beta';
      rawEl.setSelectionRange(10, 10);
      dispatchInputLike(harness.window, rawEl, 'input', {
        inputType: 'insertText',
        data: 'b',
      });

      await sleep(320);
      await flushBridge();
      assert.strictEqual(doc.markdownText, 'alpha beta');

      // 1st Ctrl+Z immediately reverts "beta" -> "alpha " (no wasted pop!)
      harness.dispatchKeydown(rawEl as never, { key: 'z', ctrlKey: true });
      await flushBridge();
      assert.strictEqual(rawEl.value, 'alpha ');

      // 2nd Ctrl+Z reverts to exact initial "alpha" and restores cursor at 5
      harness.dispatchKeydown(rawEl as never, { key: 'z', ctrlKey: true });
      await flushBridge();
      assert.strictEqual(rawEl.value, 'alpha');
      assert.strictEqual(rawEl.selectionStart, 5);
      assert.strictEqual(doc.isDirty, false);

      // Ctrl+Y redoes back
      harness.dispatchKeydown(rawEl as never, { key: 'y', ctrlKey: true });
      await flushBridge();
      assert.strictEqual(rawEl.value, 'alpha ');
    } finally {
      harness.dispose();
      panel.dispose();
    }
  });

  test('TC-UNDO-011: Source mode ignores Enter during IME composition (no false list continuation)', async () => {
    const uri = vscode.Uri.file('/w/raw-ime-enter.md');
    const { harness, panel } = await openProviderWithJsdom(uri, '- item', 'raw');
    try {
      const rawEl = harness.document.getElementById('raw-editor')! as unknown as {
        value: string;
        selectionStart: number;
        selectionEnd: number;
        focus: () => void;
        setSelectionRange: (s: number, e: number) => void;
        dispatchEvent: (ev: unknown) => boolean;
      };
      rawEl.focus();
      rawEl.setSelectionRange(6, 6);
      assert.strictEqual(harness.document.body.getAttribute('data-mode'), 'raw');

      const ev = new (harness.window.KeyboardEvent as new (
        t: string,
        init?: Record<string, unknown>,
      ) => { defaultPrevented: boolean })(
        'keydown',
        {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          isComposing: true,
        },
      );
      rawEl.dispatchEvent(ev);
      assert.strictEqual(ev.defaultPrevented, false, 'IME Enter must not trigger list auto-continue');
      assert.strictEqual(rawEl.value, '- item');
    } finally {
      harness.dispose();
      panel.dispose();
    }
  });

  test('TC-UNDO-012: 10+ steps across Visual and Source modes undo cleanly back to initial state', async () => {
    const uri = vscode.Uri.file('/w/cross-mode-12.md');
    const { doc, harness, flushBridge, panel } = await openProviderWithJsdom(
      uri,
      'Base\n',
      'markdown',
    );
    try {
      const editorEl = harness.document.getElementById('editor')!;
      const pmEl = editorEl.querySelector('.ProseMirror') ?? editorEl;

      // 10 distinct word/command edits in Visual mode
      let text = 'Base';
      for (let i = 1; i <= 10; i++) {
        text += ` w${i}`;
        await providerUpdateVisual(harness, flushBridge, text, `vis-${i}`);
      }
      assert.strictEqual(doc.undoDepth, 10);

      // Switch to Source mode and make 2 more edits
      const rawBtn = harness.document.querySelector('#mode-toolbar button[data-mode="raw"]')!;
      rawBtn.click();
      await flushBridge();

      const rawEl = harness.document.getElementById('raw-editor')! as unknown as {
        value: string;
        selectionStart: number;
        selectionEnd: number;
        focus: () => void;
        setSelectionRange: (s: number, e: number) => void;
        dispatchEvent: (ev: unknown) => boolean;
      };
      rawEl.focus();

      // Edit 11 via command (Tab indent or direct update)
      const val11 = `${rawEl.value}raw1\n`;
      rawEl.setSelectionRange(rawEl.value.length, rawEl.value.length);
      dispatchInputLike(harness.window, rawEl, 'beforeinput', {
        inputType: 'insertFromPaste',
        data: 'raw1',
      });
      rawEl.value = val11;
      dispatchInputLike(harness.window, rawEl, 'input', {
        inputType: 'insertFromPaste',
      });
      await sleep(320);
      await flushBridge();

      // Edit 12
      const val12 = `${rawEl.value}raw2\n`;
      dispatchInputLike(harness.window, rawEl, 'beforeinput', {
        inputType: 'insertFromPaste',
        data: 'raw2',
      });
      rawEl.value = val12;
      dispatchInputLike(harness.window, rawEl, 'input', {
        inputType: 'insertFromPaste',
      });
      await sleep(320);
      await flushBridge();

      assert.strictEqual(doc.undoDepth, 12);

      // Undo 2 Source edits via Ctrl+Z
      harness.dispatchKeydown(rawEl as never, { key: 'z', ctrlKey: true });
      await flushBridge();
      assert.strictEqual(doc.undoDepth, 11);

      harness.dispatchKeydown(rawEl as never, { key: 'z', ctrlKey: true });
      await flushBridge();
      assert.strictEqual(doc.undoDepth, 10);

      // Switch back to Visual mode and undo all 10 Visual edits via Ctrl+Z
      const visBtn = harness.document.querySelector('#mode-toolbar button[data-mode="markdown"]')!;
      visBtn.click();
      await flushBridge();

      for (let step = 9; step >= 0; step--) {
        harness.dispatchKeydown(pmEl, { key: 'z', ctrlKey: true });
        await flushBridge();
        assert.strictEqual(doc.undoDepth, step);
      }

      assert.strictEqual(doc.markdownText, 'Base\n');
      assert.strictEqual(doc.isDirty, false);
    } finally {
      harness.dispose();
      panel.dispose();
    }
  });

  test('TC-UNDO-013: does not hijack Ctrl+Z inside FindWidget input and blocks undo when readonly', async () => {
    const uri = vscode.Uri.file('/w/scope-ro-undo.md');
    const { doc, harness, flushBridge, panel } = await openProviderWithJsdom(
      uri,
      'Hello\n',
      'markdown',
    );
    try {
      await providerUpdateVisual(harness, flushBridge, 'Hello changed', 'edit-1');
      const countBefore = harness.postedMessages.filter(
        (m) => m.type === 'requestUndo',
      ).length;

      // Focus Find input -> Ctrl+Z must NOT emit requestUndo
      const findInput = harness.document.getElementById('find-input')!;
      findInput.focus();
      const evFind = harness.dispatchKeydown(findInput, { key: 'z', ctrlKey: true });
      assert.strictEqual(evFind.defaultPrevented, false);
      const countAfterFind = harness.postedMessages.filter(
        (m) => m.type === 'requestUndo',
      ).length;
      assert.strictEqual(countAfterFind, countBefore);

      // Toggle readonly ON -> Ctrl+Z on editor must NOT undo
      harness.sendHostMessage({ type: 'readonlyChanged', readonly: true });
      const editorEl = harness.document.getElementById('editor')!;
      const pmEl = editorEl.querySelector('.ProseMirror') ?? editorEl;
      pmEl.focus();
      harness.dispatchKeydown(pmEl, { key: 'z', ctrlKey: true });
      await flushBridge();
      assert.ok(doc.markdownText.includes('Hello changed'));
    } finally {
      harness.dispose();
      panel.dispose();
    }
  });
});

async function providerUpdateVisual(
  harness: ReturnType<typeof bootEditorWebviewInJsdom>,
  flushBridge: () => Promise<void>,
  text: string,
  groupId: string,
): Promise<void> {
  const pmEl =
    harness.document.getElementById('editor')!.querySelector('.ProseMirror') ??
    harness.document.getElementById('editor')!;
  const p = pmEl.querySelector('p');
  if (p) {
    p.textContent = text;
  }
  const docJson = JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  harness.postedMessages.push({
    type: 'update',
    docJson,
    undoGroupId: groupId,
    selectionAfter: { visual: { anchor: text.length + 1, head: text.length + 1 } },
  });
  await flushBridge();
}
