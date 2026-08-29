import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownDocument } from './markdown-document';
import { MarpPreviewManager } from '../commands/marp-preview';
import {
  convertGfmTableToHtml,
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
import type { WebviewInboundMessage, WebviewOutboundMessage } from '../webviews/messages';

export class MarkdownEditorProvider implements vscode.CustomEditorProvider<MarkdownDocument> {
  static readonly viewType = 'vsc-md-editor.wysiwyg';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<MarkdownDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  private readonly _openPanels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly marpManager: MarpPreviewManager,
  ) {}

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
    this._openPanels.set(document.uri.toString(), webviewPanel);
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ...this.getWorkspaceImgRoots(document.uri),
      ],
    };

    const readonly = isReadonly(this.context, document.uri);
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, readonly);

    const sendInit = (): void => {
      this.postMessage(webviewPanel.webview, {
        type: 'init',
        docJson: document.docJson,
        readonly,
        uri: document.uri.toString(),
      });
    };

    sendInit();

    webviewPanel.webview.onDidReceiveMessage(async (raw: unknown) => {
      const message = raw as WebviewInboundMessage;
      await this.handleMessage(document, webviewPanel, message);
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
      this.postMessage(webviewPanel.webview, {
        type: 'docUpdated',
        docJson: document.docJson,
      });
      void this.marpManager.updatePreview(document.uri, document.markdownText);
    });

    webviewPanel.onDidDispose(() => {
      this._openPanels.delete(document.uri.toString());
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
      this.postMessage(panel.webview, {
        type: 'docUpdated',
        docJson: document.docJson,
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

  private async handleMessage(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel,
    message: WebviewInboundMessage,
  ): Promise<void> {
    const readonly = isReadonly(this.context, document.uri);

    switch (message.type) {
      case 'ready':
        sendInitFallback(panel, document, readonly);
        break;
      case 'update':
        if (readonly) {
          return;
        }
        document.updateFromJson(message.docJson);
        break;
      case 'convertGfmTable':
        if (readonly) {
          return;
        }
        {
          const doc = JSON.parse(message.docJson) as TipTapDoc;
          const converted = convertGfmTableToHtml(doc);
          document.updateDoc(converted, 'Convert GFM table');
        }
        break;
      case 'checkTableLimits':
        {
          const limits = checkTableLimits(message.rows, message.cols);
          this.postMessage(panel.webview, {
            type: 'tableLimitWarning',
            ...limits,
          });
        }
        break;
      case 'pasteImage':
        await this.handleImagePaste(document, panel, message, readonly);
        break;
      case 'mermaidError':
        logError(`Mermaid render error: ${message.error}`);
        break;
      case 'log':
        logInfo(message.message);
        break;
      default:
        break;
    }

    function sendInitFallback(
      webviewPanel: vscode.WebviewPanel,
      doc: MarkdownDocument,
      ro: boolean,
    ): void {
      void webviewPanel.webview.postMessage({
        type: 'init',
        docJson: doc.docJson,
        readonly: ro,
        uri: doc.uri.toString(),
      });
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

      this.postMessage(panel.webview, {
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
<body data-readonly="${readonly}">
  <div id="toolbar">
    <button data-cmd="bold" title="Bold"><b>B</b></button>
    <button data-cmd="italic" title="Italic"><i>I</i></button>
    <button data-cmd="heading" data-level="1" title="Heading 1">H1</button>
    <button data-cmd="heading" data-level="2" title="Heading 2">H2</button>
    <button data-cmd="bulletList" title="Bullet List">• List</button>
    <button data-cmd="orderedList" title="Ordered List">1. List</button>
    <button data-cmd="link" title="Link">Link</button>
    <button data-cmd="codeBlock" title="Code Block">Code</button>
    <button data-cmd="insertTable" title="Insert Table">Table</button>
  </div>
  <div id="table-warning" class="hidden"></div>
  <div id="editor"></div>
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
