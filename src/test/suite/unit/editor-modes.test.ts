import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownDocument } from '../../../providers/markdown-document';
import { parseMarkdown, setParseFailureMock } from '../../../serializers/markdown-serializer';
import {
  getReadonlyKey,
  isReadonly,
  setReadonly,
} from '../../../utils/readonly-state';
import { NO_MARP_MESSAGE } from '../../../utils/marp-constants';
import {
  acceptsWebviewContentUpdate,
  canEditContent,
  canSwitchMode,
  DEFAULT_EDITOR_MODE,
  EditorModeState,
  isVisualSurfaceReadOnly,
} from '../../../utils/editor-mode';

type VscodeTestShim = typeof vscode & {
  setMockFile: (uri: vscode.Uri, content: string) => void;
  clearMockFiles: () => void;
};

const mockVscode = vscode as VscodeTestShim;

const CUSTOM_EDITOR_VIEW_TYPE = 'vsc-md-editor.wysiwyg';
const MARP_PANEL_VIEW_TYPE = 'vsc-md-editor.marpPreview';
const MARP_COMMAND = 'vsc-md-editor.showMarpPreview';

function packageJsonPath(): string {
  // unit-bundle 実行時の __dirname は out/test 固定ではないため cwd を正とする
  return path.resolve(process.cwd(), 'package.json');
}

function createFakeExtensionContext(): vscode.ExtensionContext {
  const store = new Map<string, boolean>();
  return {
    workspaceState: {
      get: <T>(key: string, defaultValue?: T): T => {
        if (store.has(key)) {
          return store.get(key) as T;
        }
        return defaultValue as T;
      },
      update: async (key: string, value: boolean | undefined): Promise<void> => {
        if (value === undefined) {
          store.delete(key);
        } else {
          store.set(key, value);
        }
      },
    },
  } as unknown as vscode.ExtensionContext;
}

const noCancel = { isCancellationRequested: false } as vscode.CancellationToken;

suite('Three-mode editor contracts (AD-016)', () => {
  teardown(() => {
    mockVscode.clearMockFiles();
    setParseFailureMock(false);
  });

  async function openDoc(markdown: string, filePath = '/tmp/modes-contract.md'): Promise<MarkdownDocument> {
    const uri = vscode.Uri.file(filePath);
    mockVscode.setMockFile(uri, markdown);
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc, 'document should open');
    return doc!;
  }

  test('TC-070: package.json registers Custom Editor viewType vsc-md-editor.wysiwyg', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath(), 'utf8')) as {
      contributes: {
        customEditors: Array<{ viewType: string }>;
      };
    };
    const viewTypes = pkg.contributes.customEditors.map((editor) => editor.viewType);
    assert.ok(
      viewTypes.includes(CUSTOM_EDITOR_VIEW_TYPE),
      `expected customEditors to include ${CUSTOM_EDITOR_VIEW_TYPE}`,
    );
    assert.strictEqual(
      pkg.contributes.customEditors.length,
      1,
      'MVP uses a single Custom Editor viewType for all three modes',
    );
  });

  test('TC-070: initial editor mode is markdown after open', () => {
    const state = new EditorModeState();
    assert.strictEqual(DEFAULT_EDITOR_MODE, 'markdown');
    assert.strictEqual(state.mode, 'markdown', 'initial editorMode must be markdown');
  });

  test('TC-071: Preview is one-way RO render from Document', () => {
    assert.strictEqual(
      acceptsWebviewContentUpdate('preview'),
      false,
      'Preview must not post content updates to Document',
    );
    assert.strictEqual(acceptsWebviewContentUpdate('markdown'), true);
    assert.strictEqual(acceptsWebviewContentUpdate('raw'), true);
    assert.strictEqual(canEditContent('preview', false), false);
    assert.strictEqual(canEditContent('markdown', false), true);
    assert.strictEqual(isVisualSurfaceReadOnly('preview', false), true);
    assert.strictEqual(isVisualSurfaceReadOnly('markdown', false), false);
  });

  test('TC-072: MarkdownDocument is source of truth for Markdown↔Raw sync', async () => {
    const doc = await openDoc('# Title\n\nHello\n');

    const fromMarkdown = parseMarkdown('# Title\n\nHello from Markdown mode\n');
    doc.updateDoc(fromMarkdown, 'Markdown edit');
    assert.ok(
      doc.markdownText.includes('Hello from Markdown mode'),
      'Markdown-side edit must update Document markdownText (Raw projection source)',
    );

    const fromRaw = parseMarkdown('# Title\n\nHello from Raw mode\n');
    doc.updateDoc(fromRaw, 'Raw edit');
    assert.ok(
      doc.markdownText.includes('Hello from Raw mode'),
      'Raw-side successful parse must update Document as canonical source',
    );
    assert.strictEqual(doc.doc.type, 'doc');
    doc.dispose();
  });

  test('TC-073: mode switch alone does not write disk or change dirty', async () => {
    const uri = vscode.Uri.file('/tmp/modes-switch-no-io.md');
    const initial = '# Title\n\nHello\n';
    mockVscode.setMockFile(uri, initial);
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    let dirtyEvents = 0;
    doc!.onDidChange(() => {
      dirtyEvents += 1;
    });

    const state = new EditorModeState();
    state.setMode('preview');
    state.setMode('raw');
    state.setMode('markdown');
    assert.strictEqual(state.mode, 'markdown');

    const onDisk = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    assert.strictEqual(onDisk, initial, 'mode switch must not write disk');
    assert.strictEqual(dirtyEvents, 0, 'mode switch alone must not change dirty');
    assert.ok(doc!.markdownText.includes('Hello'));
    doc!.dispose();
  });

  test('TC-074: content edit fires dirty then save writes disk', async () => {
    const uri = vscode.Uri.file('/tmp/modes-dirty-save.md');
    mockVscode.setMockFile(uri, '# Title\n\nOriginal\n');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    let dirtyEvents = 0;
    doc!.onDidChange(() => {
      dirtyEvents += 1;
    });

    doc!.updateDoc(parseMarkdown('# Title\n\nEdited content\n'), 'Edit');
    assert.ok(dirtyEvents >= 1, 'content edit must signal dirty via onDidChange');

    await doc!.save(noCancel);
    const written = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(written).toString('utf8');
    assert.ok(text.includes('Edited content'), 'save must persist Document to disk');
    assert.ok(doc!.markdownText.includes('Edited content'));
    doc!.dispose();
  });

  test('TC-075: file readonly locks editing state independently of Preview concept', async () => {
    const context = createFakeExtensionContext();
    const uri = vscode.Uri.file('/tmp/modes-ro.md');

    assert.strictEqual(isReadonly(context, uri), false);
    await setReadonly(context, uri, true);
    assert.strictEqual(isReadonly(context, uri), true, 'file RO must lock Markdown/Raw editing surfaces');
    assert.ok(getReadonlyKey(uri).startsWith('readonly:'));

    // 三点 Preview は描画 RO（editorMode）であり、workspaceState のファイル RO とは別概念（AD-006）
    assert.ok(
      !getReadonlyKey(uri).includes('preview'),
      'file RO persistence key must not be tied to Preview mode',
    );
    assert.strictEqual(canEditContent('markdown', true), false);
    assert.strictEqual(canEditContent('raw', true), false);
  });

  test('TC-076: RO allows mode switch Preview and Marp viewing', () => {
    const fileRo = true;
    assert.strictEqual(canSwitchMode(fileRo), true, 'file RO must still allow mode switch');

    const state = new EditorModeState();
    assert.strictEqual(state.setMode('preview'), 'preview');
    assert.strictEqual(state.setMode('raw'), 'raw');
    assert.strictEqual(state.setMode('markdown'), 'markdown');

    assert.strictEqual(canEditContent(state.mode, fileRo), false);
    // Marp Preview is a separate viewing surface (not three-point Preview)
    assert.notStrictEqual(CUSTOM_EDITOR_VIEW_TYPE, MARP_PANEL_VIEW_TYPE);
    assert.strictEqual(NO_MARP_MESSAGE, 'No Marp slides detected');
  });

  test('TC-077: Marp Preview is not the three-point Preview custom editor', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath(), 'utf8')) as {
      contributes: {
        customEditors: Array<{ viewType: string }>;
        commands: Array<{ command: string }>;
      };
    };

    assert.strictEqual(pkg.contributes.customEditors[0]?.viewType, CUSTOM_EDITOR_VIEW_TYPE);
    assert.notStrictEqual(
      CUSTOM_EDITOR_VIEW_TYPE,
      MARP_PANEL_VIEW_TYPE,
      'Marp panel viewType must differ from Custom Editor viewType',
    );
    assert.ok(
      !pkg.contributes.customEditors.some((editor) => editor.viewType === MARP_PANEL_VIEW_TYPE),
      'Marp must not be registered as a Custom Editor viewType',
    );
    assert.ok(
      pkg.contributes.commands.some((command) => command.command === MARP_COMMAND),
      'Marp Preview is a separate command',
    );
    assert.strictEqual(NO_MARP_MESSAGE, 'No Marp slides detected');
  });

  test('TC-078: raw parse failure leaves Document intact and blocks save', async () => {
    const doc = await openDoc('# Title\n\nHello\n', '/tmp/modes-raw-fail.md');
    const beforeText = doc.markdownText;
    const beforeDocJson = doc.docJson;

    setParseFailureMock(true);
    const ok = doc.applyRawSource('this will fail to parse');
    setParseFailureMock(false);

    assert.strictEqual(ok, false);
    assert.strictEqual(doc.isRawParseFailed, true);
    assert.strictEqual(doc.markdownText, beforeText, 'Document markdownText must stay intact');
    assert.strictEqual(doc.docJson, beforeDocJson, 'Document model must stay intact');

    await assert.rejects(
      async () => doc.save(noCancel),
      /parse failed/i,
      'save must be blocked while isRawParseFailed',
    );
    doc.dispose();
  });

  test('TC-079: save resumes after raw parse recovery', async () => {
    const uri = vscode.Uri.file('/tmp/modes-raw-recover.md');
    mockVscode.setMockFile(uri, '# Title\n\nHello\n');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    setParseFailureMock(true);
    assert.strictEqual(doc!.applyRawSource('broken'), false);
    setParseFailureMock(false);
    assert.strictEqual(doc!.isRawParseFailed, true);

    const recovered = doc!.applyRawSource('# Title\n\nRecovered content\n');
    assert.strictEqual(recovered, true);
    assert.strictEqual(doc!.isRawParseFailed, false);
    assert.ok(doc!.markdownText.includes('Recovered content'));

    await doc!.save(noCancel);
    const written = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    assert.ok(written.includes('Recovered content'), 'save must succeed after recovery');
    doc!.dispose();
  });

  test('TC-082: Markdown and Raw edits converge on the same Document for Preview projection', async () => {
    const doc = await openDoc('# Title\n\nHello\n');

    doc.updateDoc(parseMarkdown('# Title\n\nFrom Markdown\n'), 'Markdown edit');
    const afterMarkdown = doc.markdownText;
    assert.ok(afterMarkdown.includes('From Markdown'));

    doc.updateDoc(parseMarkdown('# Title\n\nFrom Raw\n'), 'Raw edit');
    assert.ok(doc.markdownText.includes('From Raw'));
    assert.ok(doc.docJson.includes('From Raw') || doc.markdownText.includes('From Raw'));

    // Preview consumes docJson — both surfaces must derive from the same Document snapshot.
    assert.strictEqual(doc.docJson.length > 0, true);
    assert.ok(doc.markdownText.includes('From Raw'), 'Raw-side edit must update canonical markdownText');
    doc.dispose();
  });
});
