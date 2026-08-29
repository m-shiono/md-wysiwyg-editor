import * as vscode from 'vscode';
import { Marp } from '@marp-team/marp-core';
import { sanitizeHtml } from '../utils/sanitize';
import { logError } from '../utils/logger';
import { NO_MARP_MESSAGE } from '../utils/marp-constants';

export { NO_MARP_MESSAGE };

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
    this.panel.webview.html = this.renderHtml(content);
  }

  async updatePreview(uri: vscode.Uri, content: string): Promise<void> {
    if (this.panel && this.currentUri?.toString() === uri.toString()) {
      this.panel.webview.html = this.renderHtml(content);
    }
  }

  private renderHtml(content: string): string {
    const marp = new Marp();
    try {
      if (!isMarpDocument(content)) {
        return wrapPreviewHtml(
          `<div class="guidance"><h2>${NO_MARP_MESSAGE}</h2><p>Add Marp front matter to enable slide preview:</p><pre>---\nmarp: true\n---</pre></div>`,
        );
      }
      const { html, css } = marp.render(content);
      const sanitized = sanitizeHtml(html);
      const safeCss = sanitizeCss(css);
      return wrapPreviewHtml(`<style>${safeCss}</style>${sanitized}`);
    } catch (error) {
      logError('Marp parse error', error);
      return wrapPreviewHtml(
        `<div class="error"><h2>Marp preview error</h2><p>${sanitizeHtml(String(error))}</p></div>`,
      );
    }
  }
}

function isMarpDocument(content: string): boolean {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return false;
  }
  const fm = fmMatch[1];
  if (/marp\s*:\s*true/i.test(fm)) {
    return true;
  }
  return /^---\s*$/m.test(content.slice(fmMatch[0].length));
}

/** Strip CSS constructs that can break out of a style tag or execute expressions. */
function sanitizeCss(css: string): string {
  return css
    .replace(/<\/style/gi, '')
    .replace(/<script/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/@import/gi, '');
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
