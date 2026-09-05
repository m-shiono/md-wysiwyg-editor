import * as vscode from 'vscode';
import { logError } from '../utils/logger';
import type { MarkdownEditorProvider } from '../providers/markdown-editor-provider';

const SIDE_PREVIEW_COMMAND = 'vsc-md-editor.showNativeMarkdownPreviewToSide';
const DIRTY_WARNING =
  'Document has unsaved changes. Save before opening the Markdown Preview to the side?';

export interface ShowNativeMarkdownPreviewToSideArgs {
  uri?: vscode.Uri;
  isDirty?: boolean;
  isRawParseFailed?: boolean;
  save?: () => Promise<void>;
}

/** Dirty gate — Save / Cancel only (two choices). First showWarningMessage in this module for TC-019. */
async function promptSaveOrCancelBeforePreview(): Promise<string | undefined> {
  return vscode.window.showWarningMessage(DIRTY_WARNING, 'Save', 'Cancel');
}

/**
 * Ensure a proper file Uri for markdown.showPreview* — Custom Editor tabs
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
 * Host gate for Default Preview: resolve URI, optional Save/Cancel, then
 * markdown.showPreviewToSide (fallback: showPreview). Injectable args keep
 * unit tests free of Custom Editor UI.
 */
export async function showNativeMarkdownPreviewToSide(
  args?: ShowNativeMarkdownPreviewToSideArgs,
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

  const previewUri = await resolvePreviewUri(uri);

  try {
    await vscode.commands.executeCommand('markdown.showPreviewToSide', previewUri);
  } catch (sideError) {
    logError('markdown.showPreviewToSide failed', sideError);
    try {
      await vscode.commands.executeCommand('markdown.showPreview', previewUri);
    } catch (previewError) {
      logError('markdown.showPreview fallback failed', previewError);
      void vscode.window.showErrorMessage(
        'Failed to open Markdown Preview. The markdown.showPreviewToSide / markdown.showPreview commands may be unavailable.',
      );
    }
  }
}

export function registerNativeMarkdownPreviewCommand(
  _context: vscode.ExtensionContext,
  provider: MarkdownEditorProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(SIDE_PREVIEW_COMMAND, async () => {
    const uri = provider.getActiveUri();
    if (!uri) {
      await showNativeMarkdownPreviewToSide({ uri: undefined });
      return;
    }
    const document = provider.getOpenDocument(uri);
    await showNativeMarkdownPreviewToSide({
      uri,
      isDirty: document?.isDirty === true,
      isRawParseFailed: document?.isRawParseFailed === true,
      save: document
        ? () => document.save({ isCancellationRequested: false } as vscode.CancellationToken)
        : undefined,
    });
  });
}
