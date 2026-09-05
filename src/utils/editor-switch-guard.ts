import * as vscode from 'vscode';

export const WYSIWYG_VIEW_TYPE = 'vsc-md-editor.wysiwyg';

/** Delay after custom editor dispose before reading active tab (ms). */
export const DISPOSE_CHECK_DELAY_MS = 150;

const CONFIG_SECTION = 'vsc-md-editor';
const AUTO_RESTORE_KEY = 'autoRestoreOnBuiltinSwitch';

const WYSIWYG_RESTORE_MESSAGE =
  'ビルトイン Markdown エディタに切り替わりました。WYSIWYG で編集する場合は、エディタ内の Preview / Markdown / Raw ボタンを使うか、下のボタンで WYSIWYG Editor を再度開いてください。';
const WYSIWYG_RESTORE_ACTION = 'WYSIWYG Editor で開く';

/**
 * Pattern A: same `.md` URI active but not on WYSIWYG custom editor after dispose.
 * Markdown Preview tabs (TabInputWebview / markdown.preview.*) must not count as
 * a builtin text switch — Default Preview opens Preview in the same group.
 */
export function isBuiltinSwitchToSameMdFile(
  disposedUri: vscode.Uri,
  activeTab: vscode.Tab | undefined,
  wysiwygViewType: string = WYSIWYG_VIEW_TYPE,
): boolean {
  if (!activeTab?.input) {
    return false;
  }
  if (!disposedUri.fsPath.toLowerCase().endsWith('.md')) {
    return false;
  }

  // Standard Markdown Preview (and other webviews) are not Pattern A.
  if (activeTab.input instanceof vscode.TabInputWebview) {
    return false;
  }

  const disposedKey = disposedUri.toString();

  if (activeTab.input instanceof vscode.TabInputText) {
    return activeTab.input.uri.toString() === disposedKey;
  }

  if (activeTab.input instanceof vscode.TabInputCustom) {
    return (
      activeTab.input.uri.toString() === disposedKey &&
      activeTab.input.viewType !== wysiwygViewType
    );
  }

  // Unknown preview-like inputs (e.g. vscode.markdown.preview.editor) are not Pattern A.
  const previewLike = activeTab.input as { viewType?: string };
  if (
    typeof previewLike.viewType === 'string' &&
    /markdown\.preview/i.test(previewLike.viewType)
  ) {
    return false;
  }

  return false;
}

export async function openWithWysiwyg(uri: vscode.Uri): Promise<void> {
  await vscode.commands.executeCommand('vscode.openWith', uri, WYSIWYG_VIEW_TYPE);
}

function getActiveMarkdownUri(): vscode.Uri | undefined {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (activeTab?.input instanceof vscode.TabInputText) {
    return activeTab.input.uri;
  }
  if (activeTab?.input instanceof vscode.TabInputCustom) {
    return activeTab.input.uri;
  }
  const doc = vscode.window.activeTextEditor?.document;
  if (doc && doc.uri.fsPath.toLowerCase().endsWith('.md')) {
    return doc.uri;
  }
  return undefined;
}

export function handleCustomEditorDisposed(
  _context: vscode.ExtensionContext,
  uri: vscode.Uri,
): void {
  setTimeout(() => {
    void (async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (!isBuiltinSwitchToSameMdFile(uri, activeTab)) {
        return;
      }

      const autoRestore = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<boolean>(AUTO_RESTORE_KEY, false);

      if (autoRestore) {
        await openWithWysiwyg(uri);
        return;
      }

      const choice = await vscode.window.showInformationMessage(
        WYSIWYG_RESTORE_MESSAGE,
        WYSIWYG_RESTORE_ACTION,
      );
      if (choice === WYSIWYG_RESTORE_ACTION) {
        await openWithWysiwyg(uri);
      }
    })();
  }, DISPOSE_CHECK_DELAY_MS);
}

export function registerEditorSwitchGuard(
  _context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'vsc-md-editor.openWithWysiwyg',
    async (uri?: vscode.Uri) => {
      const target = uri ?? getActiveMarkdownUri();
      if (!target) {
        void vscode.window.showWarningMessage('アクティブな Markdown ファイルがありません');
        return;
      }
      await openWithWysiwyg(target);
    },
  );
}
