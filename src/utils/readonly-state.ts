import * as vscode from 'vscode';

const READONLY_KEY_PREFIX = 'readonly:';

export function getReadonlyKey(uri: vscode.Uri): string {
  return `${READONLY_KEY_PREFIX}${uri.toString()}`;
}

export function isReadonly(context: vscode.ExtensionContext, uri: vscode.Uri): boolean {
  return context.workspaceState.get<boolean>(getReadonlyKey(uri), false);
}

export async function setReadonly(
  context: vscode.ExtensionContext,
  uri: vscode.Uri,
  value: boolean,
): Promise<void> {
  await context.workspaceState.update(getReadonlyKey(uri), value);
}

export async function toggleReadonly(
  context: vscode.ExtensionContext,
  uri: vscode.Uri,
): Promise<boolean> {
  const next = !isReadonly(context, uri);
  await setReadonly(context, uri, next);
  return next;
}

/** Untitled workspace: RO state is session-only (workspaceState may not persist). */
export function isPersistableWorkspace(): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return false;
  }
  return vscode.workspace.name !== undefined;
}
