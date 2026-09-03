import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownDocument } from './markdown-document';
import { MarpPreviewManager } from '../commands/marp-preview';
import {
  convertTableToGfm,
  convertTableToHtml,
  jsonToDoc,
  serializeMarkdown,
  type TipTapDoc,
} from '../serializers/markdown-serializer';
import { isReadonly } from '../utils/readonly-state';
import { checkTableLimits, countTableDimensions } from '../utils/table-limits';
import {
  formatImageFilename,
  getNextImageSequence,
  isSafeImagePath,
  mimeToExtension,
} from '../utils/image-numbering';
import { logError, logInfo } from '../utils/logger';
import {
  acceptsWebviewContentUpdate,
  DEFAULT_EDITOR_MODE,
  EditorModeState,
  isEditorMode,
  type EditorMode,
} from '../utils/editor-mode';
import { buildModeSwitchMessages } from '../utils/editor-mode-sync';
import { applyDisplayUriRewrite } from '../utils/preview-projection';
import type { WebviewUriResolver } from '../utils/image-uri-rewrite';
import { buildPreviewProjectionMessages } from '../utils/preview-projection';
import { handleCustomEditorDisposed } from '../utils/editor-switch-guard';
import { shouldAcceptWebviewUpdate } from '../utils/webview-update-epoch';
import { buildThemeUpdatedMessage, mapColorThemeKind } from '../utils/theme-sync';
import type { WebviewInboundMessage, WebviewOutboundMessage } from '../webviews/messages';

export class MarkdownEditorProvider implements vscode.CustomEditorProvider<MarkdownDocument> {
  static readonly viewType = 'vsc-md-editor.wysiwyg';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<MarkdownDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  private readonly _openPanels = new Map<string, vscode.WebviewPanel>();
  private readonly _openDocuments = new Map<string, MarkdownDocument>();
  private readonly _modeStates = new Map<string, EditorModeState>();
  /** Convert bumps this; older webview `update` messages must not restore HTML. */
  private readonly _minUpdateEpoch = new Map<string, number>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly marpManager: MarpPreviewManager,
  ) {
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme((theme) => {
        const message = buildThemeUpdatedMessage(mapColorThemeKind(theme.kind));
        for (const panel of this._openPanels.values()) {
          this.postMessage(panel.webview, message);
        }
      }),
    );
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<MarkdownDocument> {
    const doc = await MarkdownDocument.create(uri, openContext.backupId);
    if (!doc) {
      throw new Error(`Unable to open document: ${uri.fsPath}`);
    }
    return doc;
  }

  async resolveCustomEditor(
    document: MarkdownDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const key = document.uri.toString();
    this._openPanels.set(key, webviewPanel);
    this._openDocuments.set(key, document);
    if (!this._modeStates.has(key)) {
      this._modeStates.set(key, new EditorModeState());
    }

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ...this.getWorkspaceImgRoots(document.uri),
      ],
    };

    const readonly = isReadonly(this.context, document.uri);
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, readonly);

    // Init only after webview posts `ready` — messages sent before the script
    // loads are dropped by VS Code.
    webviewPanel.webview.onDidReceiveMessage((raw: unknown) => {
      const message = raw as WebviewInboundMessage;
      void this.handleMessage(document, webviewPanel, message);
    });

    document.onDidChange((event) => {
      this._onDidChangeCustomDocument.fire({
        document,
        label: event.label,
        undo: event.undo,
        redo: event.redo,
      });
      void this.marpManager.updatePreview(document.uri, document.markdownText);
    });

    document.onDidContentChange(() => {
      const mode = this.modeStateFor(document).mode;
      if (mode === 'preview') {
        this.postPreviewProjection(document, webviewPanel.webview);
      } else {
        this.postDisplayMessage(document, webviewPanel.webview, {
          type: 'docUpdated',
          docJson: document.docJson,
          markdownText: document.markdownText,
        });
      }
      // Content mutations clear Raw-fail state — keep webview banner in sync.
      if (!document.isRawParseFailed) {
        this.postMessage(webviewPanel.webview, {
          type: 'rawParseFailed',
          failed: false,
        });
      }
      void this.marpManager.updatePreview(document.uri, document.markdownText);
    });

    webviewPanel.onDidDispose(() => {
      this._openPanels.delete(key);
      this._openDocuments.delete(key);
      this._modeStates.delete(key);
      this._minUpdateEpoch.delete(key);
      handleCustomEditorDisposed(this.context, document.uri);
    });

    void this.marpManager.updatePreview(document.uri, document.markdownText);
  }

  async saveCustomDocument(
    document: MarkdownDocument,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.save(cancellation);
  }

  async saveCustomDocumentAs(
    document: MarkdownDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.saveAs(destination, cancellation);
  }

  async revertCustomDocument(document: MarkdownDocument): Promise<void> {
    await document.revert();
    const panel = this._openPanels.get(document.uri.toString());
    if (panel) {
      this.postDisplayMessage(document, panel.webview, {
        type: 'docUpdated',
        docJson: document.docJson,
        markdownText: document.markdownText,
      });
    }
  }

  async backupCustomDocument(
    document: MarkdownDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    await document.backup(context.destination);
    return { id: context.destination.toString(), delete: () => Promise.resolve() };
  }

  getActiveUri(): vscode.Uri | undefined {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input instanceof vscode.TabInputCustom) {
      if (activeTab.input.viewType === MarkdownEditorProvider.viewType) {
        return activeTab.input.uri;
      }
    }
    for (const [uriStr, panel] of this._openPanels) {
      if (panel.active) {
        return vscode.Uri.parse(uriStr);
      }
    }
    for (const [uriStr] of this._openPanels) {
      return vscode.Uri.parse(uriStr);
    }
    return undefined;
  }

  getEditorMode(uri: vscode.Uri): EditorMode {
    return this._modeStates.get(uri.toString())?.mode ?? DEFAULT_EDITOR_MODE;
  }

  /** Integration tests: open Document for a custom editor tab. */
  getOpenDocumentForTest(uri: vscode.Uri): MarkdownDocument | undefined {
    return this._openDocuments.get(uri.toString());
  }

  /** Integration tests: simulate an inbound webview postMessage. */
  async deliverWebviewMessageForTest(
    uri: vscode.Uri,
    message: WebviewInboundMessage,
  ): Promise<void> {
    const key = uri.toString();
    const panel = this._openPanels.get(key);
    const document = this._openDocuments.get(key);
    if (!panel || !document) {
      throw new Error(`No open custom editor for ${key}`);
    }
    await this.handleMessage(document, panel, message);
  }

  refreshReadonly(uri: vscode.Uri, readonly: boolean): void {
    const panel = this._openPanels.get(uri.toString());
    if (panel) {
      this.postMessage(panel.webview, { type: 'readonlyChanged', readonly });
      void this.updateReadonlyBadge(panel, readonly);
    }
  }

  private async updateReadonlyBadge(
    panel: vscode.WebviewPanel,
    readonly: boolean,
  ): Promise<void> {
    panel.title = readonly ? `${path.basename(panel.title ?? 'document.md')} (Readonly)` : path.basename(panel.title ?? 'document.md');
  }

  private getWorkspaceImgRoots(documentUri: vscode.Uri): vscode.Uri[] {
    const dir = vscode.Uri.file(path.dirname(documentUri.fsPath));
    return [vscode.Uri.joinPath(dir, 'img')];
  }

  private postMessage(webview: vscode.Webview, message: WebviewOutboundMessage): void {
    void webview.postMessage(message);
  }

  /** Host → Webview `themeUpdated` on init/ready and VS Code color theme change (TC-013). */
  private postThemeUpdated(webview: vscode.Webview): void {
    this.postMessage(
      webview,
      buildThemeUpdatedMessage(mapColorThemeKind(vscode.window.activeColorTheme.kind)),
    );
  }

  private postDisplayMessage(
    document: MarkdownDocument,
    webview: vscode.Webview,
    message: WebviewOutboundMessage,
  ): void {
    this.postMessage(
      webview,
      applyDisplayUriRewrite(message, document.uri, this.webviewUriResolver(webview)),
    );
  }

  private webviewUriResolver(webview: vscode.Webview): WebviewUriResolver {
    return {
      asWebviewUri: (uri) => webview.asWebviewUri(vscode.Uri.file(uri.fsPath)),
    };
  }

  private postPreviewProjection(document: MarkdownDocument, webview: vscode.Webview): void {
    const mode = this.modeStateFor(document).mode;
    for (const message of buildPreviewProjectionMessages(
      mode,
      document.docJson,
      document.markdownText,
    )) {
      this.postDisplayMessage(document, webview, message);
    }
  }

  private modeStateFor(document: MarkdownDocument): EditorModeState {
    const key = document.uri.toString();
    let state = this._modeStates.get(key);
    if (!state) {
      state = new EditorModeState();
      this._modeStates.set(key, state);
    }
    return state;
  }

  private async handleMessage(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel,
    message: WebviewInboundMessage,
  ): Promise<void> {
    const readonly = isReadonly(this.context, document.uri);
    const modeState = this.modeStateFor(document);

    switch (message.type) {
      case 'ready':
        this.postDisplayMessage(document, panel.webview, {
          type: 'init',
          docJson: document.docJson,
          markdownText: document.markdownText,
          readonly,
          uri: document.uri.toString(),
          editorMode: modeState.mode,
        });
        this.postThemeUpdated(panel.webview);
        if (modeState.mode === 'preview') {
          this.postPreviewProjection(document, panel.webview);
        }
        break;
      case 'setMode':
        // Mode switch alone: display only — no disk I/O, no dirty (AD-016).
        if (!isEditorMode(message.editorMode)) {
          return;
        }
        {
          const next = modeState.setMode(message.editorMode);
          for (const outbound of buildModeSwitchMessages(
            next,
            document.docJson,
            document.markdownText,
          )) {
            this.postDisplayMessage(document, panel.webview, outbound);
          }
        }
        break;
      case 'update':
        if (
          readonly ||
          !acceptsWebviewContentUpdate(modeState.mode) ||
          typeof message.docJson !== 'string'
        ) {
          return;
        }
        if (
          !shouldAcceptWebviewUpdate(
            message.epoch,
            this._minUpdateEpoch.get(document.uri.toString()) ?? 0,
          )
        ) {
          return;
        }
        // Do not echo docJson — webview already has TipTap content (TC-067).
        document.updateFromJson(message.docJson, 'Edit', { syncWebview: false });
        // Markdown edit clears Raw-fail banner if it was showing.
        this.postMessage(panel.webview, {
          type: 'rawParseFailed',
          failed: false,
        });
        // markdownText only — Raw surface refresh; avoid setContent echo.
        this.postMessage(panel.webview, {
          type: 'docUpdated',
          markdownText: document.markdownText,
        });
        break;
      case 'updateRaw':
        // Late flush after Raw→other mode must still apply; only file RO blocks.
        if (readonly || typeof message.markdown !== 'string') {
          return;
        }
        {
          const ok = document.applyRawSource(message.markdown, 'Raw edit', { syncWebview: false });
          this.postMessage(panel.webview, {
            type: 'rawParseFailed',
            failed: document.isRawParseFailed,
            message: ok
              ? undefined
              : 'Raw Markdown parse failed. Document was not modified.',
          });
          if (ok) {
            this.postDisplayMessage(document, panel.webview, {
              type: 'docUpdated',
              docJson: document.docJson,
              markdownText: document.markdownText,
            });
          }
        }
        break;
      case 'requestConvertToGfm':
        if (readonly || typeof message.tableIndex !== 'number') {
          return;
        }
        {
          const answer = await vscode.window.showWarningMessage(
            'リッチ内容（改行・リスト・チェックボックス等）はプレーンテキストに flatten されます。続行しますか？',
            { modal: true },
            '変換',
          );
          if (answer !== '変換') {
            this.postMessage(panel.webview, { type: 'convertToGfmCancelled' });
            return;
          }
          const key = document.uri.toString();
          if (typeof message.epoch === 'number') {
            this._minUpdateEpoch.set(key, message.epoch);
          }
          // Editor snapshot at click — not later document.doc (stale HTML update may have landed).
          const source =
            typeof message.docJson === 'string' ? jsonToDoc(message.docJson) : document.doc;
          document.updateDoc(
            convertTableToGfm(source, message.tableIndex),
            'Convert table to GFM',
          );
        }
        break;
      case 'tableOperation':
        if (readonly || typeof message.docJson !== 'string') {
          return;
        }
        {
          const doc = JSON.parse(message.docJson) as TipTapDoc;
          const tableIndex = message.tableIndex ?? 0;
          if (message.operation === 'convertToHtml') {
            document.updateDoc(convertTableToHtml(doc, tableIndex), 'Convert table to HTML');
          } else if (message.operation === 'convertToGfm') {
            document.updateDoc(convertTableToGfm(doc, tableIndex), 'Convert table to GFM');
          }
        }
        break;
      case 'checkTableLimits':
        if (typeof message.rows !== 'number' || typeof message.cols !== 'number') {
          return;
        }
        {
          const limits = checkTableLimits(message.rows, message.cols);
          this.postMessage(panel.webview, {
            type: 'tableLimitWarning',
            ...limits,
          });
        }
        break;
      case 'pasteImage':
        if (
          typeof message.mime !== 'string' ||
          typeof message.dataBase64 !== 'string'
        ) {
          return;
        }
        await this.handleImagePaste(document, panel, message, readonly);
        break;
      case 'mermaidError':
        if (typeof message.error === 'string') {
          logError(`Mermaid render error: ${message.error}`);
        }
        break;
      case 'log':
        if (typeof message.message === 'string') {
          logInfo(message.message);
        }
        break;
      default:
        break;
    }
  }

  private async handleImagePaste(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel,
    message: Extract<WebviewInboundMessage, { type: 'pasteImage' }>,
    readonly: boolean,
  ): Promise<void> {
    if (readonly) {
      return;
    }

    if (document.uri.scheme !== 'file') {
      void vscode.window.showWarningMessage('Save document first');
      return;
    }

    const ext = mimeToExtension(message.mime);
    if (!ext) {
      return;
    }

    const mdDir = path.dirname(document.uri.fsPath);
    const imgDir = path.join(mdDir, 'img');

    try {
      const imgDirUri = vscode.Uri.file(imgDir);
      try {
        await vscode.workspace.fs.createDirectory(imgDirUri);
      } catch {
        /* may exist */
      }

      const entries = await vscode.workspace.fs.readDirectory(imgDirUri);
      const filenames = entries.map(([name]) => name);
      const seq = getNextImageSequence(filenames);
      const filename = formatImageFilename(seq, ext);
      const relativePath = `img/${filename}`;

      if (!isSafeImagePath(document.uri.toString(), relativePath)) {
        void vscode.window.showErrorMessage('Invalid image path');
        return;
      }

      const imageUri = vscode.Uri.file(path.join(imgDir, filename));
      if (!imageUri.fsPath.startsWith(imgDir + path.sep) && imageUri.fsPath !== imgDir) {
        void vscode.window.showErrorMessage('Invalid image path');
        return;
      }
      const data = Buffer.from(message.dataBase64, 'base64');
      await vscode.workspace.fs.writeFile(imageUri, data);

      this.postDisplayMessage(document, panel.webview, {
        type: 'imageInserted',
        relativePath,
      });
      logInfo(`Image saved: ${relativePath}`);
    } catch (error) {
      logError('Image paste failed', error);
      void vscode.window.showErrorMessage('Failed to save pasted image');
    }
  }

  private getHtml(webview: vscode.Webview, readonly: boolean): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.css'),
    );
    const nonce = getNonce();

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data: https: file:`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" nonce="${nonce}" />
  <title>MD WYSIWYG Editor</title>
</head>
<body data-readonly="${readonly}" data-mode="markdown">
  <div id="mode-toolbar" role="toolbar" aria-label="Editor mode">
    <button type="button" data-mode="preview" title="Preview">Preview</button>
    <button type="button" data-mode="markdown" class="active" title="Edit Rich Editor">Edit Rich Editor</button>
    <button type="button" data-mode="raw" title="Edit Raw Text">Edit Raw Text</button>
  </div>
  <div id="toolbar" role="toolbar" aria-label="Formatting">
    <button type="button" data-cmd="bold" title="Bold" aria-pressed="false"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic" aria-pressed="false"><i>I</i></button>
    <button type="button" data-cmd="strike" title="Strikethrough" aria-pressed="false"><span style="text-decoration:line-through">S</span></button>
    <button type="button" data-cmd="inlineCode" title="Inline Code" aria-pressed="false">\`</button>
    <span class="toolbar-sep" role="separator" aria-hidden="true"></span>
    <button type="button" data-cmd="heading" data-level="1" title="Heading 1" aria-pressed="false">H1</button>
    <button type="button" data-cmd="heading" data-level="2" title="Heading 2" aria-pressed="false">H2</button>
    <button type="button" data-cmd="heading" data-level="3" title="H3" aria-pressed="false">H3</button>
    <button type="button" data-cmd="heading" data-level="4" title="H4" aria-pressed="false">H4</button>
    <button type="button" data-cmd="heading" data-level="5" title="H5" aria-pressed="false">H5</button>
    <button type="button" data-cmd="heading" data-level="6" title="H6" aria-pressed="false">H6</button>
    <span class="toolbar-sep" role="separator" aria-hidden="true"></span>
    <button type="button" data-cmd="bulletList" title="Bullet List" aria-pressed="false">• List</button>
    <button type="button" data-cmd="orderedList" title="Ordered List" aria-pressed="false">1. List</button>
    <button type="button" data-cmd="taskList" title="Task List" aria-pressed="false">Task</button>
    <button type="button" data-cmd="blockquote" title="Blockquote" aria-pressed="false">Quote</button>
    <span class="toolbar-sep" role="separator" aria-hidden="true"></span>
    <button type="button" data-cmd="link" title="Link" aria-pressed="false">Link</button>
    <button type="button" data-cmd="codeBlock" title="Code Block" aria-pressed="false">Code</button>
    <button type="button" data-cmd="horizontalRule" title="Horizontal rule">―</button>
    <div id="table-menu" class="toolbar-dropdown">
      <button type="button" id="table-menu-btn" title="Table">Table ▼</button>
      <div id="table-menu-panel" class="toolbar-dropdown-panel hidden" role="menu" aria-label="Table operations">
        <button type="button" data-table-op="insert" role="menuitem">Insert table</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="addRowBefore" role="menuitem">Add row above</button>
        <button type="button" data-table-op="addRowAfter" role="menuitem">Add row below</button>
        <button type="button" data-table-op="deleteRow" role="menuitem">Delete row</button>
        <button type="button" data-table-op="addColumnBefore" role="menuitem">Add column left</button>
        <button type="button" data-table-op="addColumnAfter" role="menuitem">Add column right</button>
        <button type="button" data-table-op="deleteColumn" role="menuitem">Delete column</button>
        <button type="button" data-table-op="deleteTable" role="menuitem">Delete table</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="convertToGfm" role="menuitem">Convert to GFM pipe table</button>
        <button type="button" data-table-op="convertToHtml" role="menuitem">Convert to HTML table</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="setDefaultGfm" role="menuitem">New tables default: GFM</button>
        <button type="button" data-table-op="setDefaultHtml" role="menuitem">New tables default: HTML</button>
      </div>
    </div>
  </div>
  <div id="link-input-bar" class="hidden" role="group" aria-label="Link URL">
    <input type="url" id="link-url-input" placeholder="https://example.com" spellcheck="false" aria-label="Link URL" />
  </div>
  <div id="table-warning" class="hidden"></div>
  <div id="raw-parse-banner" class="hidden" role="alert"></div>
  <div id="preview-marp-root" class="hidden" role="document" aria-readonly="true"></div>
  <div id="editor"></div>
  <textarea id="raw-editor" class="hidden" spellcheck="false" aria-label="Raw Markdown"></textarea>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export function countTablesInDoc(docJson: string): number {
  const doc = JSON.parse(docJson) as TipTapDoc;
  return doc.content.filter((n) => n.type === 'table').length;
}

export { countTableDimensions, checkTableLimits, serializeMarkdown };
export { getWebviewCspContent } from '../utils/csp';
