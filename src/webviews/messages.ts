import type { EditorMode } from '../utils/editor-mode';

export type { EditorMode };

export interface EditorSelectionSnapshot {
  visual?: { anchor: number; head: number };
  raw?: { start: number; end: number };
}

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
  | {
      type: 'docUpdated';
      docJson?: string;
      markdownText: string;
      updateEpoch?: number;
      selection?: EditorSelectionSnapshot;
      isUndoRedo?: boolean;
      origin?: 'raw';
    }
  | { type: 'convertToGfmCancelled' }
  | { type: 'readonlyChanged'; readonly: boolean }
  | { type: 'tableLimitWarning'; exceeded: boolean; message?: string; rows: number; cols: number }
  | { type: 'imageInserted'; relativePath: string; displaySrc?: string }
  | { type: 'rawParseFailed'; failed: boolean; message?: string }
  | { type: 'modeChanged'; editorMode: EditorMode }
  | { type: 'previewMarpHtml'; html: string }
  | { type: 'themeUpdated'; kind: 'light' | 'dark' | 'highContrast' }
  | { type: 'plantUmlRendered'; id: string; svg: string; available: boolean }
  | { type: 'testDiagnosticRequest'; requestId: string };

export type WebviewDiagnosticSnapshot = {
  readyReceived?: boolean;
  hasProseMirror: boolean;
  editorText: string;
  mermaidSvgCount: number;
  mermaidErrors: string[];
  csp: string;
};

export type WebviewInboundMessage =
  | { type: 'ready' }
  | {
      type: 'update';
      docJson: string;
      epoch?: number;
      undoGroupId?: string;
      selectionBefore?: EditorSelectionSnapshot;
      selectionAfter?: EditorSelectionSnapshot;
    }
  | {
      type: 'updateRaw';
      markdown: string;
      undoGroupId?: string;
      selectionBefore?: EditorSelectionSnapshot;
      selectionAfter?: EditorSelectionSnapshot;
    }
  | { type: 'requestUndo' }
  | { type: 'requestRedo' }
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
  | { type: 'renderPlantUml'; id: string; source: string }
  | { type: 'setTablePipeAlignment'; alignment: 'aligned' | 'compact' }
  | { type: 'log'; message: string }
  | { type: 'openNativePreview' }
  | ({ type: 'testDiagnosticResponse'; requestId: string } & WebviewDiagnosticSnapshot);

export interface VsCodeApi {
  postMessage(message: WebviewInboundMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export { acquireVsCodeApi };
