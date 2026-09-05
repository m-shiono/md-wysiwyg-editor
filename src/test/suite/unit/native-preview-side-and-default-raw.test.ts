/**
 * TC-001–020: native-preview-side-and-default-raw contracts.
 * Host Default Preview command / Webview wiring for Custom Editor.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownDocument } from '../../../providers/markdown-document';
import { setParseFailureMock } from '../../../serializers/markdown-serializer';
import {
  DEFAULT_EDITOR_MODE,
  EditorModeState,
  isEditorMode,
} from '../../../utils/editor-mode';
import { isBuiltinSwitchToSameMdFile } from '../../../utils/editor-switch-guard';

type VscodeTestShim = typeof vscode & {
  setMockFile: (uri: vscode.Uri, content: string) => void;
  clearMockFiles: () => void;
};

const mockVscode = vscode as VscodeTestShim;

const WYSIWYG_VIEW_TYPE = 'vsc-md-editor.wysiwyg';
const SIDE_PREVIEW_COMMAND = 'vsc-md-editor.showNativeMarkdownPreviewToSide';
const NATIVE_PREVIEW_COMMAND_MODULE = 'src/commands/native-markdown-preview.ts';
const DEFAULT_PREVIEW_A11Y_LABEL = 'Open Default Markdown Preview to the Side';
const OUTPUT_CHANNEL_NAME = 'MD WYSIWYG Editor';

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

function packageJsonPath(): string {
  return path.resolve(process.cwd(), 'package.json');
}

function extractModeToolbarHtml(providerSrc: string): string {
  const match = providerSrc.match(/id="mode-toolbar"[\s\S]*?<\/div>/);
  assert.ok(match, '#mode-toolbar HTML fragment must exist in provider');
  return match[0];
}

function loadCompiledCommand(): Record<string, unknown> {
  const jsPath = path.resolve(process.cwd(), 'out/commands/native-markdown-preview.js');
  if (!fs.existsSync(jsPath)) {
    return {};
  }
  return require(jsPath) as Record<string, unknown>;
}

function getCommandExport<T>(exportName: string): T | undefined {
  const mod = loadCompiledCommand();
  const value = mod[exportName];
  return typeof value === 'function' ? (value as T) : undefined;
}

function assertNativePreviewCommandSource(): string {
  const abs = path.resolve(process.cwd(), NATIVE_PREVIEW_COMMAND_MODULE);
  assert.ok(
    fs.existsSync(abs),
    `${NATIVE_PREVIEW_COMMAND_MODULE} required for Default Preview Host gate`,
  );
  return readRepoFile(NATIVE_PREVIEW_COMMAND_MODULE);
}

suite('native-preview-side-and-default-raw (TC-001–020)', () => {
  teardown(() => {
    mockVscode.clearMockFiles();
    setParseFailureMock(false);
  });

  // --- TC-001: initial Raw ---

  test('TC-001: DEFAULT_EDITOR_MODE and EditorModeState open as raw', () => {
    const state = new EditorModeState();
    assert.strictEqual(DEFAULT_EDITOR_MODE, 'raw');
    assert.strictEqual(state.mode, 'raw', 'initial editorMode must be raw');
  });

  test('TC-001: initial Webview HTML uses data-mode=raw and Edit Raw Text active', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      /data-mode="\$\{[^}]*DEFAULT_EDITOR_MODE[^}]*\}"|data-mode="raw"/.test(providerSrc) ||
        /data-mode="\$\{[^}]*\}"/.test(providerSrc),
      'body data-mode must follow DEFAULT_EDITOR_MODE (raw)',
    );

    // Static fallback HTML (pre-template) must not hardcode markdown as initial active.
    const toolbar = extractModeToolbarHtml(providerSrc);
    const rawActive =
      /data-mode="raw"[^>]*class="[^"]*active|class="[^"]*active[^"]*"[^>]*data-mode="raw"/.test(
        toolbar,
      );
    const markdownActive =
      /data-mode="markdown"[^>]*class="[^"]*active|class="[^"]*active[^"]*"[^>]*data-mode="markdown"/.test(
        toolbar,
      );

    if (/data-mode="\$\{/.test(providerSrc)) {
      assert.ok(
        /DEFAULT_EDITOR_MODE|editorMode|initialMode/.test(providerSrc),
        'templated data-mode must derive from DEFAULT_EDITOR_MODE / initial mode',
      );
      assert.ok(
        !markdownActive || rawActive,
        'initial active button must be raw when HTML is static',
      );
    } else {
      assert.ok(/data-mode="raw"/.test(providerSrc), 'body[data-mode="raw"] required');
      assert.ok(rawActive, 'Edit Raw Text button must be active initially');
      assert.ok(!markdownActive, 'Edit Rich Editor must not be the initial active mode');
    }

    assert.ok(toolbar.includes('Edit Raw Text'), 'Raw display label Edit Raw Text required');
  });

  // --- TC-002 / TC-020: mode round-trip, no I/O ---

  test('TC-002: mode-toolbar three modes round-trip preview→markdown→raw→preview', () => {
    const state = new EditorModeState();
    assert.strictEqual(state.setMode('preview'), 'preview');
    assert.strictEqual(state.setMode('markdown'), 'markdown');
    assert.strictEqual(state.setMode('raw'), 'raw');
    assert.strictEqual(state.setMode('preview'), 'preview');

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(/function applyMode\(/.test(editorSrc), 'applyMode must exist for mode toolbar');
    assert.ok(
      /#mode-toolbar button\[data-mode\]/.test(editorSrc),
      'mode toolbar must bind only data-mode buttons',
    );
  });

  test('TC-020: mode switch alone does not write disk or change dirty', async () => {
    const uri = vscode.Uri.file('/tmp/native-preview-mode-no-io.md');
    const initial = '# Title\n\nHello\n';
    mockVscode.setMockFile(uri, initial);
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    let dirtyEvents = 0;
    doc!.onDidChange(() => {
      dirtyEvents += 1;
    });

    const state = new EditorModeState();
    for (const mode of ['preview', 'markdown', 'raw', 'preview'] as const) {
      state.setMode(mode);
    }

    const onDisk = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    assert.strictEqual(onDisk, initial, 'mode switch must not write disk');
    assert.strictEqual(dirtyEvents, 0, 'mode switch alone must not change dirty');
    doc!.dispose();
  });

  // --- TC-003 / TC-015 / TC-018: Default Preview non-mode UI ---

  test('TC-003: Default Preview is first peer button without data-mode', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    const toolbar = extractModeToolbarHtml(providerSrc);

    assert.ok(
      /Default Preview[\s\S]*Editor Preview[\s\S]*Edit Rich Editor[\s\S]*Edit Raw Text/.test(
        toolbar,
      ),
      'left→right order: Default Preview | Editor Preview | Edit Rich Editor | Edit Raw Text',
    );
    assert.ok(
      /data-action="native-preview-to-side"[\s\S]*data-mode="preview"[\s\S]*data-mode="markdown"[\s\S]*data-mode="raw"/.test(
        toolbar,
      ),
      'Default Preview (data-action) must precede the three data-mode buttons',
    );
    assert.ok(/Default Preview/.test(toolbar), 'button label Default Preview required');
    assert.ok(/Editor Preview/.test(toolbar), 'preview mode label Editor Preview required');
    assert.ok(!/>\s*Preview\s*</.test(toolbar), 'legacy Preview label must not remain');
    assert.ok(!/Side Preview/.test(toolbar), 'legacy Side Preview label must not remain');

    const sideBtnMatch = toolbar.match(
      /<button[^>]*(?:data-action="native-preview-to-side"|Default Preview)[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(sideBtnMatch, 'Default Preview button element required');
    const sideBtn = sideBtnMatch[0];
    assert.ok(
      /data-action="native-preview-to-side"/.test(sideBtn),
      'data-action="native-preview-to-side" required',
    );
    assert.ok(!/\sdata-mode=/.test(sideBtn), 'Default Preview must not have data-mode');
  });

  test('TC-003: Default Preview click must not change editorMode (source contract)', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /native-preview-to-side|openNativePreviewToSide/.test(editorSrc),
      'Webview must wire Default Preview action',
    );
    assert.ok(
      /data-action=["']native-preview-to-side["']/.test(editorSrc) ||
        /querySelector(?:All)?\([^)]*native-preview/.test(editorSrc),
      'Default Preview listener must target data-action, not data-mode',
    );
    assert.ok(
      /attachModeToolbarHandlers[\s\S]*attachSidePreviewHandler|attachSidePreviewHandler\(\)/.test(
        editorSrc,
      ),
      'attachSidePreviewHandler must run after mode toolbar init',
    );
    // Default Preview path must not call applyMode
    const sideHandlerSlice =
      editorSrc.match(
        /native-preview-to-side[\s\S]{0,400}|openNativePreviewToSide[\s\S]{0,400}/,
      )?.[0] ?? '';
    assert.ok(sideHandlerSlice.length > 0, 'Default Preview handler slice required');
    assert.ok(
      !/\bapplyMode\s*\(/.test(sideHandlerSlice),
      'Default Preview must not call applyMode',
    );
  });

  test('TC-015: EditorMode allows only preview|markdown|raw — no fourth id', () => {
    assert.strictEqual(isEditorMode('preview'), true);
    assert.strictEqual(isEditorMode('markdown'), true);
    assert.strictEqual(isEditorMode('raw'), true);
    assert.strictEqual(isEditorMode('native-preview'), false);
    assert.strictEqual(isEditorMode('side-preview'), false);

    const modeSrc = readRepoFile('src/utils/editor-mode.ts');
    assert.ok(
      /'preview'\s*\|\s*'markdown'\s*\|\s*'raw'/.test(modeSrc),
      'EditorMode union must be preview | markdown | raw only',
    );
    assert.ok(!/native-preview/.test(modeSrc), 'native-preview must not be an EditorMode');

    const state = new EditorModeState();
    const before = state.mode;
    state.setMode('native-preview' as Parameters<EditorModeState['setMode']>[0]);
    assert.strictEqual(state.mode, before, 'invalid fourth mode id must be rejected');
  });

  test('TC-018: Default Preview a11y labels and Editor Preview mode label', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    const toolbar = extractModeToolbarHtml(providerSrc);
    const sideBtnMatch = toolbar.match(/<button[^>]*native-preview-to-side[^>]*>/);
    assert.ok(sideBtnMatch, 'Default Preview button with data-action required for a11y check');
    const sideBtn = sideBtnMatch[0];
    assert.ok(
      new RegExp(`title="${DEFAULT_PREVIEW_A11Y_LABEL}"`).test(sideBtn),
      `title must be "${DEFAULT_PREVIEW_A11Y_LABEL}"`,
    );
    assert.ok(
      new RegExp(`aria-label="${DEFAULT_PREVIEW_A11Y_LABEL}"`).test(sideBtn),
      `aria-label must be "${DEFAULT_PREVIEW_A11Y_LABEL}"`,
    );

    const previewModeMatch = toolbar.match(/<button[^>]*data-mode="preview"[^>]*>[\s\S]*?<\/button>/);
    assert.ok(previewModeMatch, 'Editor Preview mode button required');
    assert.ok(
      /Editor Preview/.test(previewModeMatch[0]),
      'mode id preview display label must be Editor Preview',
    );
  });

  // --- TC-007: command registration ---

  test('TC-007: package.json registers showNativeMarkdownPreviewToSide without editor/title icon', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath(), 'utf8')) as {
      contributes: {
        commands: Array<{ command: string; title?: string }>;
        menus?: { 'editor/title'?: Array<{ command: string }> };
      };
      activationEvents?: string[];
    };

    const commands = pkg.contributes.commands.map((c) => c.command);
    assert.ok(
      commands.includes(SIDE_PREVIEW_COMMAND),
      `expected commands to include ${SIDE_PREVIEW_COMMAND}`,
    );

    const titleMenus = pkg.contributes.menus?.['editor/title'] ?? [];
    assert.ok(
      !titleMenus.some((m) => m.command === SIDE_PREVIEW_COMMAND),
      'Default Preview must not add editor/title icon (Non-Goal)',
    );

    const extensionSrc = readRepoFile('src/extension.ts');
    assert.ok(
      /registerNativeMarkdownPreview|showNativeMarkdownPreviewToSide|native-markdown-preview/.test(
        extensionSrc,
      ),
      'activate must register Default Preview command',
    );
  });

  // --- TC-014: Webview postMessage only ---

  test('TC-014: Webview posts openNativePreviewToSide only — no direct showPreviewToSide', () => {
    const messagesSrc = readRepoFile('src/webviews/messages.ts');
    assert.ok(
      /type:\s*['"]openNativePreviewToSide['"]/.test(messagesSrc),
      'WebviewInboundMessage must include openNativePreviewToSide',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /openNativePreviewToSide/.test(editorSrc),
      'Webview must postMessage openNativePreviewToSide',
    );
    assert.ok(
      !/markdown\.showPreviewToSide/.test(editorSrc),
      'Webview must not call markdown.showPreviewToSide directly',
    );
    assert.ok(
      !/executeCommand\s*\(\s*['"]markdown\.showPreviewToSide['"]/.test(editorSrc),
      'Webview must not executeCommand showPreviewToSide',
    );

    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      /openNativePreviewToSide/.test(providerSrc),
      'provider must handle openNativePreviewToSide inbound message',
    );
    assert.ok(
      /showNativeMarkdownPreviewToSide|native-markdown-preview/.test(providerSrc),
      'provider must delegate Default Preview to Host command helper',
    );
  });

  // --- Host gate: TC-004–006, TC-008–011, TC-016–017, TC-019 ---

  test('TC-004: clean document opens markdown.showPreviewToSide without dialog', async () => {
    const cmdSrc = assertNativePreviewCommandSource();
    assert.ok(
      /markdown\.showPreviewToSide/.test(cmdSrc),
      'Host must invoke markdown.showPreviewToSide',
    );
    assert.ok(
      /openTextDocument/.test(cmdSrc),
      'Host must openTextDocument before showPreviewToSide for Custom Editor reliability',
    );

    const showFn = getCommandExport<
      (args?: {
        isDirty?: boolean;
        uri?: vscode.Uri;
      }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    const executed: Array<{ command: string; args: unknown[] }> = [];
    const dialogCalls: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;

    vscode.commands.executeCommand = (async (command: string, ...args: unknown[]) => {
      executed.push({ command, args });
      return undefined;
    }) as typeof vscode.commands.executeCommand;
    vscode.window.showWarningMessage = (async (message: string) => {
      dialogCalls.push(message);
      return undefined;
    }) as typeof vscode.window.showWarningMessage;

    try {
      const uri = vscode.Uri.file('/tmp/native-preview-clean.md');
      mockVscode.setMockFile(uri, '# clean\n');
      await showFn!({ isDirty: false, uri });
      assert.strictEqual(dialogCalls.length, 0, 'clean must not show Save/Cancel dialog');
      const previewCalls = executed.filter((e) => e.command === 'markdown.showPreviewToSide');
      assert.strictEqual(previewCalls.length, 1, 'showPreviewToSide must run once');
      assert.strictEqual(
        (previewCalls[0].args[0] as vscode.Uri).fsPath,
        uri.fsPath,
        'preview must receive a proper file Uri for the same path',
      );
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
    }
  });

  test('TC-005: dirty→Save success then showPreviewToSide; Save/Cancel only', async () => {
    const cmdSrc = assertNativePreviewCommandSource();
    assert.ok(/\bSave\b/.test(cmdSrc) && /\bCancel\b/.test(cmdSrc), 'dialog must offer Save and Cancel');
    assert.ok(
      !/Don't Save|Dont Save|Don't save/i.test(cmdSrc),
      'Don\'t Save must not be offered',
    );

    const showFn = getCommandExport<
      (args?: {
        isDirty?: boolean;
        uri?: vscode.Uri;
        save?: () => Promise<void>;
      }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    let saved = false;
    const executed: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;

    vscode.window.showWarningMessage = (async (
      _message: string,
      ...items: Array<string | vscode.MessageOptions>
    ): Promise<string | undefined> => {
      const labels = items.filter((i): i is string => typeof i === 'string');
      assert.ok(labels.includes('Save'), 'Save choice required');
      assert.ok(labels.includes('Cancel'), 'Cancel choice required');
      assert.ok(!labels.some((i) => /don't save/i.test(i)), 'Don\'t Save must be absent');
      return 'Save';
    }) as unknown as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await showFn!({
        isDirty: true,
        uri: vscode.Uri.file('/tmp/native-preview-dirty-save.md'),
        save: async () => {
          saved = true;
        },
      });
      assert.strictEqual(saved, true, 'Save path must run document save');
      assert.ok(
        executed.includes('markdown.showPreviewToSide'),
        'preview opens only after successful save',
      );
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
    }
  });

  test('TC-006: dirty→Cancel does not open preview and keeps dirty', async () => {
    const showFn = getCommandExport<
      (args?: {
        isDirty?: boolean;
        uri?: vscode.Uri;
        save?: () => Promise<void>;
      }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    let saved = false;
    const executed: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;

    vscode.window.showWarningMessage = (async () => 'Cancel') as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await showFn!({
        isDirty: true,
        uri: vscode.Uri.file('/tmp/native-preview-dirty-cancel.md'),
        save: async () => {
          saved = true;
        },
      });
      assert.strictEqual(saved, false, 'Cancel must not save');
      assert.ok(
        !executed.includes('markdown.showPreviewToSide'),
        'Cancel must not open preview',
      );
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
    }
  });

  test('TC-008: dismissing dirty dialog (undefined) does not open preview', async () => {
    const showFn = getCommandExport<
      (args?: { isDirty?: boolean; uri?: vscode.Uri }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    const executed: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;

    vscode.window.showWarningMessage = (async () => undefined) as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await showFn!({
        isDirty: true,
        uri: vscode.Uri.file('/tmp/native-preview-dirty-dismiss.md'),
      });
      assert.ok(
        !executed.includes('markdown.showPreviewToSide'),
        'dismiss must not open preview',
      );
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
    }
  });

  test('TC-009: save failure shows ErrorMessage+Output and skips preview', async () => {
    const cmdSrc = assertNativePreviewCommandSource();
    assert.ok(
      (/showErrorMessage/.test(cmdSrc) && new RegExp(OUTPUT_CHANNEL_NAME).test(cmdSrc)) ||
        /logError|getOutputChannel/.test(cmdSrc),
      'save failure must report ErrorMessage and Output channel',
    );

    const showFn = getCommandExport<
      (args?: {
        isDirty?: boolean;
        uri?: vscode.Uri;
        save?: () => Promise<void>;
      }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    const executed: string[] = [];
    const errors: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;
    const originalError = vscode.window.showErrorMessage;

    vscode.window.showWarningMessage = (async () => 'Save') as typeof vscode.window.showWarningMessage;
    vscode.window.showErrorMessage = (async (message: string) => {
      errors.push(message);
      return undefined;
    }) as typeof vscode.window.showErrorMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await showFn!({
        isDirty: true,
        uri: vscode.Uri.file('/tmp/native-preview-save-fail.md'),
        save: async () => {
          throw new Error('serialization error');
        },
      });
      assert.ok(errors.length >= 1, 'ErrorMessage required on save failure');
      assert.ok(
        !executed.includes('markdown.showPreviewToSide'),
        'save failure must not open preview',
      );
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
      vscode.window.showErrorMessage = originalError;
    }
  });

  test('TC-010: Raw parse failure blocks Default Preview save gate', async () => {
    const uri = vscode.Uri.file('/tmp/native-preview-raw-fail.md');
    mockVscode.setMockFile(uri, '# Title\n\nHello\n');
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc);

    setParseFailureMock(true);
    assert.strictEqual(doc!.applyRawSource('broken'), false);
    setParseFailureMock(false);
    assert.strictEqual(doc!.isRawParseFailed, true);

    const showFn = getCommandExport<
      (args?: {
        isDirty?: boolean;
        uri?: vscode.Uri;
        isRawParseFailed?: boolean;
        save?: () => Promise<void>;
      }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    const executed: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;

    vscode.window.showWarningMessage = (async () => 'Save') as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await showFn!({
        isDirty: true,
        uri,
        isRawParseFailed: true,
        save: async () => doc!.save({ isCancellationRequested: false } as vscode.CancellationToken),
      });
      assert.ok(
        !executed.includes('markdown.showPreviewToSide'),
        'raw parse failure must block preview open',
      );
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
      doc!.dispose();
    }
  });

  test('TC-011: unresolved URI shows Warning and skips preview', async () => {
    const showFn = getCommandExport<(args?: { uri?: vscode.Uri }) => Promise<void>>(
      'showNativeMarkdownPreviewToSide',
    );
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    const warnings: string[] = [];
    const executed: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;

    vscode.window.showWarningMessage = (async (message: string) => {
      warnings.push(message);
      return undefined;
    }) as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await showFn!({ uri: undefined });
      assert.ok(
        warnings.some((w) => /Open a Markdown file first/i.test(w)),
        'Warning must mention Open a Markdown file first',
      );
      assert.ok(
        !executed.includes('markdown.showPreviewToSide'),
        'unresolved URI must not open preview',
      );
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
    }
  });

  test('TC-016: empty clean .md still opens showPreviewToSide without dialog', async () => {
    const showFn = getCommandExport<
      (args?: { isDirty?: boolean; uri?: vscode.Uri }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    const executed: string[] = [];
    const dialogCalls: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalWarn = vscode.window.showWarningMessage;

    vscode.window.showWarningMessage = (async (message: string) => {
      dialogCalls.push(message);
      return undefined;
    }) as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      const uri = vscode.Uri.file('/tmp/native-preview-empty.md');
      mockVscode.setMockFile(uri, '');
      await showFn!({ isDirty: false, uri });
      assert.strictEqual(dialogCalls.length, 0);
      assert.ok(executed.includes('markdown.showPreviewToSide'));
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showWarningMessage = originalWarn;
    }
  });

  test('TC-017: showPreviewToSide+showPreview failure reports ErrorMessage+Output', async () => {
    const showFn = getCommandExport<
      (args?: { isDirty?: boolean; uri?: vscode.Uri }) => Promise<void>
    >('showNativeMarkdownPreviewToSide');
    assert.ok(showFn, 'showNativeMarkdownPreviewToSide export required');

    const errors: string[] = [];
    const executed: string[] = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalError = vscode.window.showErrorMessage;

    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      if (command === 'markdown.showPreviewToSide' || command === 'markdown.showPreview') {
        throw new Error('command not found');
      }
      return undefined;
    }) as typeof vscode.commands.executeCommand;
    vscode.window.showErrorMessage = (async (message: string) => {
      errors.push(message);
      return undefined;
    }) as typeof vscode.window.showErrorMessage;

    try {
      await showFn!({
        isDirty: false,
        uri: vscode.Uri.file('/tmp/native-preview-cmd-missing.md'),
      });
      assert.ok(
        executed.includes('markdown.showPreviewToSide'),
        'must attempt showPreviewToSide first',
      );
      assert.ok(
        executed.includes('markdown.showPreview'),
        'must fall back to markdown.showPreview when side preview fails',
      );
      assert.ok(errors.length >= 1, 'ErrorMessage required when both preview commands fail');
    } finally {
      vscode.commands.executeCommand = originalExecute;
      vscode.window.showErrorMessage = originalError;
    }

    const cmdSrc = assertNativePreviewCommandSource();
    assert.ok(
      /showErrorMessage/.test(cmdSrc),
      'Host must surface ErrorMessage when native Markdown Preview fails',
    );
    assert.ok(
      /markdown\.showPreview/.test(cmdSrc),
      'Host must attempt markdown.showPreview fallback',
    );
  });

  test('TC-019: dirty dialog choices are Save and Cancel only', () => {
    const cmdSrc = assertNativePreviewCommandSource();
    const warnCall = cmdSrc.match(/showWarningMessage\([\s\S]*?\);/);
    assert.ok(warnCall, 'showWarningMessage call required for dirty gate');
    const call = warnCall[0];
    assert.ok(/['"]Save['"]/.test(call), 'Save option required');
    assert.ok(/['"]Cancel['"]/.test(call), 'Cancel option required');
    assert.ok(!/Don't Save|Dont Save/i.test(call), 'Don\'t Save must be absent');
  });

  // --- TC-012 / TC-013: non-interference ---

  test('TC-012: Default Preview must not trigger Pattern A / dispose Custom Editor', () => {
    const uri = vscode.Uri.file('/tmp/native-preview-pattern-a.md');
    const wysiwygTab = {
      input: new vscode.TabInputCustom(uri, WYSIWYG_VIEW_TYPE),
    } as vscode.Tab;
    assert.strictEqual(
      isBuiltinSwitchToSameMdFile(uri, wysiwygTab, WYSIWYG_VIEW_TYPE),
      false,
      'WYSIWYG still active must not be Pattern A',
    );

    // Unknown preview-like tab input (e.g. webview preview) must not count as builtin text switch.
    const previewLikeTab = { input: { viewType: 'vscode.markdown.preview.editor' } } as vscode.Tab;
    assert.strictEqual(
      isBuiltinSwitchToSameMdFile(uri, previewLikeTab, WYSIWYG_VIEW_TYPE),
      false,
      'Markdown Preview tab kind must not be Pattern A builtin switch',
    );

    const cmdSrc = assertNativePreviewCommandSource();
    assert.ok(
      !/openWithWysiwyg|vscode\.openWith/.test(cmdSrc),
      'Default Preview must not be openWith / Reopen substitute',
    );
    assert.ok(
      !/\.dispose\s*\(/.test(cmdSrc),
      'Default Preview Host path must not dispose Custom Editor',
    );

    const guardSrc = readRepoFile('src/utils/editor-switch-guard.ts');
    assert.ok(
      /preview|TabInputWebview|markdown\.preview/i.test(guardSrc),
      'Pattern A guard should explicitly exclude Markdown Preview tab kinds',
    );
  });

  test('TC-013: Default Preview must not close or auto-open Marp panel', () => {
    const cmdSrc = assertNativePreviewCommandSource();
    assert.ok(
      !/showMarpPreview|MarpPreviewManager|marpPreview/.test(cmdSrc),
      'Default Preview must not touch Marp panel open/close',
    );

    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      /previewMarpHtml|isMarpDocument/.test(providerSrc),
      'three-point Preview Marp branch remains in provider',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /preview-marp-root|previewMarpHtml/.test(editorSrc),
      'in-editor Marp Preview branch must remain unchanged',
    );
  });
});
