export type WebviewOutboundMessage =
  | { type: 'init'; docJson: string; readonly: boolean; uri: string }
  | { type: 'docUpdated'; docJson: string }
  | { type: 'readonlyChanged'; readonly: boolean }
  | { type: 'tableLimitWarning'; exceeded: boolean; message?: string; rows: number; cols: number }
  | { type: 'imageInserted'; relativePath: string };

export type WebviewInboundMessage =
  | { type: 'ready' }
  | { type: 'update'; docJson: string }
  | { type: 'convertGfmTable'; docJson: string }
  | { type: 'checkTableLimits'; rows: number; cols: number }
  | { type: 'pasteImage'; mime: string; dataBase64: string }
  | { type: 'mermaidError'; error: string }
  | { type: 'log'; message: string };

export interface VsCodeApi {
  postMessage(message: WebviewInboundMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export { acquireVsCodeApi };
