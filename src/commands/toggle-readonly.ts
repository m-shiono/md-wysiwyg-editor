import * as vscode from 'vscode';
import { isReadonly, toggleReadonly } from '../utils/readonly-state';
import type { MarkdownEditorProvider } from '../providers/markdown-editor-provider';

export function registerToggleReadonlyCommand(
  context: vscode.ExtensionContext,
  provider: MarkdownEditorProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand('vsc-md-editor.toggleReadonly', async () => {
    const uri = provider.getActiveUri();
    if (!uri) {
      void vscode.window.showWarningMessage('No active MD WYSIWYG editor');
      return;
    }
    const next = await toggleReadonly(context, uri);
    provider.refreshReadonly(uri, next);
    void vscode.window.setStatusBarMessage(
      next ? 'Readonly mode enabled' : 'Readonly mode disabled',
      3000,
    );
  });
}

export function getReadonlyState(
  context: vscode.ExtensionContext,
  uri: vscode.Uri,
): boolean {
  return isReadonly(context, uri);
}
