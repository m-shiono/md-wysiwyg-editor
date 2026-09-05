import * as vscode from 'vscode';
import { logError, logInfo } from '../utils/logger';
import type { MarkdownEditorProvider } from '../providers/markdown-editor-provider';

const PREVIEW_COMMAND = 'vsc-md-editor.showNativeMarkdownPreview';
const LEGACY_PREVIEW_COMMAND = 'vsc-md-editor.showNativeMarkdownPreviewToSide';
const DIRTY_WARNING =
  'Document has unsaved changes. Save before opening the Markdown Preview?';

export interface ShowNativeMarkdownPreviewArgs {
  uri?: vscode.Uri;
  isDirty?: boolean;
  isRawParseFailed?: boolean;
  save?: () => Promise<void>;
}

/** @deprecated Use ShowNativeMarkdownPreviewArgs — kept for call-site compatibility. */
export type ShowNativeMarkdownPreviewToSideArgs = ShowNativeMarkdownPreviewArgs;

/** Dirty gate — Save / Cancel only (two choices). First showWarningMessage in this module for TC-019. */
async function promptSaveOrCancelBeforePreview(): Promise<string | undefined> {
  return vscode.window.showWarningMessage(DIRTY_WARNING, 'Save', 'Cancel');
}

/**
 * Ensure a proper file Uri for markdown.showPreview — Custom Editor tabs
 * may pass a Uri that the built-in Markdown preview ignores unless the
 * TextDocument is opened first and/or Uri.file(fsPath) is used.
 */
async function resolvePreviewUri(uri: vscode.Uri): Promise<vscode.Uri> {
  const previewUri = vscode.Uri.file(uri.fsPath);
  try {
    const doc = await vscode.workspace.openTextDocument(previewUri);
    return doc.uri;
  } catch (error) {
    logError('openTextDocument before native Markdown Preview failed', error);
    return previewUri;
  }
}

/**
 * Host same-group compensation (AD-002/003): built-in showPreview may place the
 * Preview in column 1 when Custom Editor is focused (activeTextEditor undefined).
 * After open, move the active Preview via stable `moveActiveEditor` (public
 * TabGroups in @types/vscode / engines ^1.85 has close only — no tab move API).
 * Preferred tab slot activeIndex+1 is best-effort (1-based command value).
 */
async function movePreviewIntoSameGroup(
  targetGroup: vscode.TabGroup,
  activeIndex: number,
): Promise<void> {
  const targetColumn = targetGroup.viewColumn;
  if (typeof targetColumn !== 'number' || targetColumn < 1) {
    logInfo('Invalid target viewColumn; same-group compensation skipped (no Beside fallback)');
    return;
  }

  // moveActiveEditor tab `value` is 1-based; preferred 0-based index is activeIndex+1.
  const preferredTabPosition = activeIndex + 2;

  try {
    await vscode.commands.executeCommand('moveActiveEditor', {
      to: 'position',
      by: 'group',
      value: targetColumn,
    });
  } catch (error) {
    logError('Same-group moveActiveEditor (by group) failed', error);
    return;
  }

  try {
    await vscode.commands.executeCommand('moveActiveEditor', {
      to: 'position',
      by: 'tab',
      value: preferredTabPosition,
    });
  } catch {
    logInfo(
      'Preferred tab index moveActiveEditor failed or skipped (same-group already applied)',
    );
  }
}

function captureActiveGroupPlacement(): {
  targetGroup: vscode.TabGroup;
  activeIndex: number;
} {
  const targetGroup = vscode.window.tabGroups.activeTabGroup;
  const tabs = targetGroup.tabs ?? [];
  const activeTab = targetGroup.activeTab;
  const activeIndex =
    activeTab && tabs.length > 0 ? Math.max(0, tabs.indexOf(activeTab)) : Math.max(0, tabs.length - 1);
  return { targetGroup, activeIndex };
}

/**
 * Host gate for Default Preview: resolve URI, optional Save/Cancel, then
 * markdown.showPreview + same-group move compensation.
 * Injectable args keep unit tests free of Custom Editor UI.
 */
export async function showNativeMarkdownPreview(
  args?: ShowNativeMarkdownPreviewArgs,
): Promise<void> {
  const uri = args?.uri;
  if (!uri) {
    void vscode.window.showWarningMessage('Open a Markdown file first');
    return;
  }

  const isDirty = args?.isDirty === true;
  if (isDirty) {
    const choice = await promptSaveOrCancelBeforePreview();
    if (choice !== 'Save') {
      return;
    }

    if (args?.isRawParseFailed === true) {
      const message =
        'Cannot open Markdown Preview: Raw Markdown parse failed. Fix the source and save first.';
      logError(message);
      void vscode.window.showErrorMessage(message);
      return;
    }

    try {
      if (args.save) {
        await args.save();
      }
    } catch (error) {
      logError('Default Preview save failed', error);
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : 'Failed to save before opening Markdown Preview',
      );
      return;
    }
  }

  const { targetGroup, activeIndex } = captureActiveGroupPlacement();
  const previewUri = await resolvePreviewUri(uri);

  try {
    await vscode.commands.executeCommand('markdown.showPreview', previewUri);
  } catch (previewError) {
    logError('markdown.showPreview failed', previewError);
    void vscode.window.showErrorMessage(
      'Failed to open Markdown Preview. The markdown.showPreview command may be unavailable.',
    );
    return;
  }

  await movePreviewIntoSameGroup(targetGroup, activeIndex);
}

/** @deprecated Alias of showNativeMarkdownPreview — legacy name for older call sites. */
export const showNativeMarkdownPreviewToSide = showNativeMarkdownPreview;

export function registerNativeMarkdownPreviewCommand(
  _context: vscode.ExtensionContext,
  provider: MarkdownEditorProvider,
): vscode.Disposable {
  const handler = async (): Promise<void> => {
    const uri = provider.getActiveUri();
    if (!uri) {
      await showNativeMarkdownPreview({ uri: undefined });
      return;
    }
    const document = provider.getOpenDocument(uri);
    await showNativeMarkdownPreview({
      uri,
      isDirty: document?.isDirty === true,
      isRawParseFailed: document?.isRawParseFailed === true,
      save: document
        ? () => document.save({ isCancellationRequested: false } as vscode.CancellationToken)
        : undefined,
    });
  };

  const primary = vscode.commands.registerCommand(PREVIEW_COMMAND, handler);
  const legacy = vscode.commands.registerCommand(LEGACY_PREVIEW_COMMAND, handler);
  return vscode.Disposable.from(primary, legacy);
}
