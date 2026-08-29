import * as vscode from 'vscode';

export const OUTPUT_CHANNEL_NAME = 'MD WYSIWYG Editor';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }
  return outputChannel;
}

export function logInfo(message: string): void {
  getOutputChannel().appendLine(`[INFO] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.message : error ? String(error) : '';
  getOutputChannel().appendLine(`[ERROR] ${message}${detail ? `: ${detail}` : ''}`);
}

export function logWarn(message: string): void {
  getOutputChannel().appendLine(`[WARN] ${message}`);
}
