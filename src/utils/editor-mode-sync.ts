import type { EditorMode } from './editor-mode';
import type { WebviewOutboundMessage } from '../webviews/messages';

/** Preview / Markdown receive TipTap docJson from Document on mode switch. */
export function shouldProjectDocJsonOnModeSwitch(mode: EditorMode): boolean {
  return mode === 'preview' || mode === 'markdown';
}

/**
 * Outbound messages after a mode switch (display only — no disk I/O).
 * Re-projects Document to visual surfaces so Preview / Markdown / Raw stay aligned.
 */
export function buildModeSwitchMessages(
  mode: EditorMode,
  docJson: string,
  markdownText: string,
): WebviewOutboundMessage[] {
  const messages: WebviewOutboundMessage[] = [{ type: 'modeChanged', editorMode: mode }];
  if (shouldProjectDocJsonOnModeSwitch(mode)) {
    messages.push({ type: 'docUpdated', docJson, markdownText });
  } else {
    messages.push({ type: 'docUpdated', markdownText });
  }
  return messages;
}
