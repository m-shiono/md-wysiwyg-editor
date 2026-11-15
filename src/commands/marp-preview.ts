import * as vscode from 'vscode';
import { sanitizeHtml } from '../utils/sanitize';
import { logError } from '../utils/logger';
import { NO_MARP_MESSAGE } from '../utils/marp-constants';
import { isMarpDocument } from '../utils/is-marp-document';
import { renderMarpPreviewFragment } from '../utils/marp-render';
import { rewriteImageUrisInHtml } from '../utils/image-uri-rewrite';
import { getMarkdownEditorProvider } from '../utils/editor-provider-hook';

export { NO_MARP_MESSAGE, isMarpDocument };

function getMarpImgRoots(uri: vscode.Uri): vscode.Uri[] {
  if (uri.scheme === 'untitled') {
    return [];
  }
  return [vscode.Uri.joinPath(uri, '..', 'img')];
}

export class MarpPreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentUri: vscode.Uri | undefined;
  private lastRenderedContent: string | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async show(uri: vscode.Uri, content: string): Promise<void> {
    const localResourceRoots = [
      vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ...getMarpImgRoots(uri),
    ];
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'md-wysiwyg-editor.marpPreview',
        'Marp Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots,
        },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentUri = undefined;
        this.lastRenderedContent = undefined;
      });
    } else {
      this.panel.webview.options = {
        enableScripts: false,
        localResourceRoots,
      };
    }
    this.currentUri = uri;
    this.lastRenderedContent = content;
    this.panel.title = `Marp Preview — ${uri.path.split('/').pop() ?? 'document'}`;
    this.panel.webview.html = this.renderHtml(uri, content);
  }

  async updatePreview(uri: vscode.Uri, content: string): Promise<void> {
    if (!this.panel) {
      return;
    }
    if (this.currentUri?.toString() === uri.toString() && this.lastRenderedContent !== content) {
      this.lastRenderedContent = content;
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
      const fragment = renderMarpPreviewFragment(content, {
        katexFontPath: this.panel!.webview
          .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'fonts'))
          .toString(),
      });
      if (!fragment) {
        return wrapPreviewHtml(
          `<div class="guidance"><h2>${NO_MARP_MESSAGE}</h2><p>Add Marp front matter to enable slide preview:</p><pre>---\nmarp: true\n---</pre></div>`,
        );
      }
      const rewritten = rewriteImageUrisInHtml(fragment, uri, {
        asWebviewUri: (localUri) =>
          this.panel!.webview.asWebviewUri(
            localUri instanceof vscode.Uri ? localUri : vscode.Uri.parse(localUri.toString()),
          ),
      });
      return wrapPreviewHtml(rewritten, this.panel!.webview.cspSource);
    } catch (error) {
      logError('Marp parse error', error);
      return wrapPreviewHtml(
        `<div class="error"><h2>Marp preview error</h2><p>${sanitizeHtml(String(error))}</p></div>`,
      );
    }
  }
}

function wrapPreviewHtml(body: string, cspSource?: string): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src${cspSource ? ` ${cspSource}` : ''} data: https:`,
    `font-src data:${cspSource ? ` ${cspSource}` : ''}`,
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

async function resolveMarpSourceContent(uri: vscode.Uri): Promise<string> {
  const openCustomDoc = getMarkdownEditorProvider()?.getOpenDocument(uri);
  if (openCustomDoc) {
    return openCustomDoc.markdownText;
  }
  const openTextDoc = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === uri.toString(),
  );
  if (openTextDoc) {
    return openTextDoc.getText();
  }
  const data = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(data).toString('utf8');
}

export function registerMarpPreviewCommand(
  _context: vscode.ExtensionContext,
  manager: MarpPreviewManager,
): vscode.Disposable {
  return vscode.commands.registerCommand('md-wysiwyg-editor.showMarpPreview', async () => {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (
      activeTab?.input instanceof vscode.TabInputCustom &&
      activeTab.input.uri.path.toLowerCase().endsWith('.md')
    ) {
      const uri = activeTab.input.uri;
      const content = await resolveMarpSourceContent(uri);
      await manager.show(uri, content);
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      await manager.show(editor.document.uri, editor.document.getText());
      return;
    }

    const activeCustomUri = getMarkdownEditorProvider()?.getActiveUri();
    if (activeCustomUri && activeCustomUri.path.toLowerCase().endsWith('.md')) {
      const content = await resolveMarpSourceContent(activeCustomUri);
      await manager.show(activeCustomUri, content);
      return;
    }

    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    for (const tab of tabs) {
      if (
        tab.input instanceof vscode.TabInputCustom &&
        tab.input.uri.path.toLowerCase().endsWith('.md')
      ) {
        const uri = tab.input.uri;
        const content = await resolveMarpSourceContent(uri);
        await manager.show(uri, content);
        return;
      }
    }
    void vscode.window.showWarningMessage('Open a Markdown file first');
  });
}
