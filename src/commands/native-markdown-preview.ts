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
 * Host gate for Side Preview: resolve URI, optional Save/Cancel, then
 * markdown.showPreviewToSide. Injectable args keep unit tests free of Custom Editor UI.
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
      logError('Side Preview save failed', error);
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : 'Failed to save before opening Markdown Preview',
      );
      return;
    }
  }

  try {
    await vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
  } catch (error) {
    logError('markdown.showPreviewToSide failed', error);
    void vscode.window.showErrorMessage(
      'Failed to open Markdown Preview to the side. The markdown.showPreviewToSide command may be unavailable.',
    );
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
