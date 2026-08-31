import * as vscode from 'vscode';
import { sanitizeHtml } from '../utils/sanitize';
import { logError } from '../utils/logger';
import { NO_MARP_MESSAGE } from '../utils/marp-constants';
import { isMarpDocument } from '../utils/is-marp-document';
import { renderMarpPreviewFragment } from '../utils/marp-render';
import { rewriteImageUrisInHtml } from '../utils/image-uri-rewrite';

export { NO_MARP_MESSAGE, isMarpDocument };

export class MarpPreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentUri: vscode.Uri | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async show(uri: vscode.Uri, content: string): Promise<void> {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'vsc-md-editor.marpPreview',
        'Marp Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, 'media'),
          ],
        },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentUri = undefined;
      });
    }
    this.currentUri = uri;
    this.panel.title = `Marp Preview — ${uri.path.split('/').pop() ?? 'document'}`;
    this.panel.webview.html = this.renderHtml(uri, content);
  }

  async updatePreview(uri: vscode.Uri, content: string): Promise<void> {
    if (this.panel && this.currentUri?.toString() === uri.toString()) {
      this.panel.webview.html = this.renderHtml(uri, content);
    }
  }

  private renderHtml(uri: vscode.Uri, content: string): string {
    try {
      if (!isMarpDocument(content)) {
        return wrapPreviewHtml(
          `<div class="guidance"><h2>${NO_MARP_MESSAGE}</h2><p>Add Marp front matter to enable slide preview:</p><pre>---\nmarp: true\n---</pre></div>`,
        );
      }
      const fragment = renderMarpPreviewFragment(content);
      if (!fragment) {
        return wrapPreviewHtml(
          `<div class="guidance"><h2>${NO_MARP_MESSAGE}</h2><p>Add Marp front matter to enable slide preview:</p><pre>---\nmarp: true\n---</pre></div>`,
        );
      }
      const rewritten = rewriteImageUrisInHtml(fragment, uri, {
        asWebviewUri: (localUri) => this.panel!.webview.asWebviewUri(vscode.Uri.file(localUri.fsPath)),
      });
      return wrapPreviewHtml(rewritten);
    } catch (error) {
      logError('Marp parse error', error);
      return wrapPreviewHtml(
        `<div class="error"><h2>Marp preview error</h2><p>${sanitizeHtml(String(error))}</p></div>`,
      );
    }
  }
}

function wrapPreviewHtml(body: string): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src data: https:",
    "font-src data:",
  ].join('; ');
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); padding: 1rem; }
.guidance, .error { padding: 1rem; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
pre { background: var(--vscode-textBlockQuote-background); padding: 0.5rem; }
</style></head><body>${body}</body></html>`;
}

export function registerMarpPreviewCommand(
  _context: vscode.ExtensionContext,
  manager: MarpPreviewManager,
): vscode.Disposable {
  return vscode.commands.registerCommand('vsc-md-editor.showMarpPreview', async () => {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input instanceof vscode.TabInputCustom && activeTab.input.uri.path.endsWith('.md')) {
      const uri = activeTab.input.uri;
      const data = await vscode.workspace.fs.readFile(uri);
      await manager.show(uri, Buffer.from(data).toString('utf8'));
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      await manager.show(editor.document.uri, editor.document.getText());
      return;
    }

    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    for (const tab of tabs) {
      if (tab.input instanceof vscode.TabInputCustom && tab.input.uri.path.endsWith('.md')) {
        const uri = tab.input.uri;
        const data = await vscode.workspace.fs.readFile(uri);
        await manager.show(uri, Buffer.from(data).toString('utf8'));
        return;
      }
    }
    void vscode.window.showWarningMessage('Open a Markdown file first');
  });
}
