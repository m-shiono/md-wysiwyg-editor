import * as vscode from 'vscode';

const RELOAD_WINDOW_COMMAND = 'workbench.action.reloadWindow';

/**
 * Reload VS Code window so updated extension + webview bundles are picked up.
 * Extension Host restart alone does not refresh already-loaded Custom Editor webviews.
 */
export async function reloadExtensionHost(): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    'MD WYSIWYG Editor を再読み込みするには VS Code ウィンドウをリロードします。未保存の変更は保存してください。',
    { modal: true },
    'Reload Plugin',
  );
  if (choice !== 'Reload Plugin') {
    return;
  }
  await vscode.commands.executeCommand(RELOAD_WINDOW_COMMAND);
}

export function registerReloadExtensionCommand(
  _context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('md-wysiwyg-editor.reloadExtension', () => {
    void reloadExtensionHost();
  });
}
