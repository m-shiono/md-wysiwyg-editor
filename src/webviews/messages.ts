import type { EditorMode } from '../utils/editor-mode';

export type { EditorMode };

export type WebviewOutboundMessage =
  | {
      type: 'init';
      docJson: string;
      markdownText: string;
      readonly: boolean;
      uri: string;
      editorMode: EditorMode;
    }
  /** docJson omitted for Markdown-originated sync (markdownText only — TC-067). */
  | { type: 'docUpdated'; docJson?: string; markdownText: string }
  | { type: 'convertToGfmCancelled' }
  | { type: 'readonlyChanged'; readonly: boolean }
  | { type: 'tableLimitWarning'; exceeded: boolean; message?: string; rows: number; cols: number }
  | { type: 'imageInserted'; relativePath: string }
  | { type: 'rawParseFailed'; failed: boolean; message?: string }
  | { type: 'modeChanged'; editorMode: EditorMode }
  | { type: 'previewMarpHtml'; html: string }
  | { type: 'themeUpdated'; kind: 'light' | 'dark' | 'highContrast' };

export type WebviewInboundMessage =
  | { type: 'ready' }
  | { type: 'update'; docJson: string; epoch?: number }
  | { type: 'updateRaw'; markdown: string }
  | { type: 'setMode'; editorMode: EditorMode }
  | {
      type: 'requestConvertToGfm';
      tableIndex: number;
      docJson?: string;
      epoch?: number;
    }
  | {
      type: 'tableOperation';
      operation: 'convertToHtml' | 'convertToGfm';
      docJson: string;
      tableIndex: number;
    }
  | { type: 'checkTableLimits'; rows: number; cols: number }
  | { type: 'pasteImage'; mime: string; dataBase64: string }
  | { type: 'mermaidError'; error: string }
  | { type: 'log'; message: string }
  | { type: 'openNativePreview' };

export interface VsCodeApi {
  postMessage(message: WebviewInboundMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export { acquireVsCodeApi };
