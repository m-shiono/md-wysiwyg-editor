import type * as vscode from 'vscode';

const GLOBAL_KEY = '__vscMdEditorExtensionContext';

type GlobalWithContext = typeof globalThis & {
  [GLOBAL_KEY]?: vscode.ExtensionContext;
};

/** Called from activate so tests can access workspaceState across bundle boundaries. */
export function setExtensionContext(context: vscode.ExtensionContext): void {
  (globalThis as GlobalWithContext)[GLOBAL_KEY] = context;
}

/** Returns activation context for integration tests. */
export function getExtensionContext(): vscode.ExtensionContext | undefined {
  return (globalThis as GlobalWithContext)[GLOBAL_KEY];
}
