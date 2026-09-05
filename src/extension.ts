import * as vscode from 'vscode';
import { registerToggleReadonlyCommand } from './commands/toggle-readonly';
import { registerMarpPreviewCommand, MarpPreviewManager } from './commands/marp-preview';
import { registerNativeMarkdownPreviewCommand } from './commands/native-markdown-preview';
import { MarkdownEditorProvider } from './providers/markdown-editor-provider';
import { setExtensionContext } from './utils/extension-context';
import { setMarkdownEditorProvider } from './utils/editor-provider-hook';
import { registerReloadExtensionCommand } from './commands/reload-extension';
import { registerEditorSwitchGuard } from './utils/editor-switch-guard';
import { getOutputChannel } from './utils/logger';

export { getExtensionContext } from './utils/extension-context';
export { getMarkdownEditorProvider } from './utils/editor-provider-hook';

export function activate(context: vscode.ExtensionContext): void {
  setExtensionContext(context);
  const output = getOutputChannel();
  output.appendLine('MD WYSIWYG Editor activated');

  const marpManager = new MarpPreviewManager(context);
  const provider = new MarkdownEditorProvider(context, marpManager);
  setMarkdownEditorProvider(provider);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      MarkdownEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    registerToggleReadonlyCommand(context, provider),
    registerMarpPreviewCommand(context, marpManager),
    registerNativeMarkdownPreviewCommand(context, provider),
    registerEditorSwitchGuard(context),
    registerReloadExtensionCommand(context),
    output,
  );
}

export function deactivate(): void {
  // Disposables are cleaned up via context.subscriptions
}
