import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { isMarpDocument } from '../utils/is-marp-document';
import type { MarkdownEditorProvider } from '../providers/markdown-editor-provider';
import { logError } from '../utils/logger';

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'bmp',
  'ico',
]);

const STANDALONE_HTML_CSS = `
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #24292f;
  background-color: #ffffff;
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
}
@media (prefers-color-scheme: dark) {
  body {
    color: #c9d1d9;
    background-color: #0d1117;
  }
}
h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
p, ul, ol, table, pre, blockquote {
  margin-top: 0;
  margin-bottom: 16px;
}
table {
  border-collapse: collapse;
  width: 100%;
  overflow: auto;
}
table th, table td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}
table tr:nth-child(2n) {
  background-color: #f6f8fa;
}
@media (prefers-color-scheme: dark) {
  table tr:nth-child(2n) {
    background-color: #161b22;
  }
}
code {
  padding: 0.2em 0.4em;
  font-size: 85%;
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
}
pre code {
  background-color: transparent;
  padding: 0;
}
blockquote {
  padding: 0 1em;
  color: #57606a;
  border-left: 0.25em solid #d0d7de;
}
img {
  max-width: 100%;
  box-sizing: content-box;
}
`;

/**
 * Converts a markdown string into standalone HTML with embedded styles and Base64 images.
 */
export async function convertMarkdownToStandaloneHtml(
  markdown: string,
  baseDir: string,
): Promise<string> {
  // Convert markdown to HTML body via unified pipeline
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(markdown);

  let htmlBody = String(file);

  // Replace local relative image sources with Base64 data URIs
  // Supports both double and single quotes, and URL-encoded file paths (e.g. %20 for spaces)
  const imgRegex = /<img\s+[^>]*src=(["'])([^"']+)\1[^>]*>/gi;
  const matches = [...htmlBody.matchAll(imgRegex)];

  for (const match of matches) {
    const originalTag = match[0];
    const src = match[2];

    if (!src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
      const cleanSrc = decodeURI(src.split('?')[0].split('#')[0]);
      const ext = path.extname(cleanSrc).toLowerCase().replace('.', '');
      if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        const fullPath = path.resolve(baseDir, cleanSrc);
        if (fs.existsSync(fullPath)) {
          try {
            const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            const b64 = fs.readFileSync(fullPath).toString('base64');
            const dataUri = `data:${mime};base64,${b64}`;
            const newTag = originalTag.replace(src, dataUri);
            htmlBody = htmlBody.replace(originalTag, newTag);
          } catch (err) {
            logError(`Failed to inline image ${src}: ${err}`);
          }
        }
      }
    }
  }

  // Extract first H1 heading as document title if available
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Document Export';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
${STANDALONE_HTML_CSS}
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;
}

/**
 * Retrieves the latest document text, preferring in-memory text if document is open.
 */
export async function getDocumentText(targetUri: vscode.Uri): Promise<string> {
  const openDoc = vscode.workspace.textDocuments?.find(
    (d) => d.uri.toString() === targetUri.toString(),
  );
  if (openDoc) {
    return openDoc.getText();
  }
  const rawBytes = await vscode.workspace.fs.readFile(targetUri);
  return Buffer.from(rawBytes).toString('utf-8');
}

/**
 * Checks if a command is available on system PATH.
 */
export function checkCommandAvailable(command: string, args: string[] = ['--version']): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const proc = child_process.spawn(command, args, { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0 || code === null));
    } catch {
      resolve(false);
    }
  });
}

export function registerExportCommands(
  _context: vscode.ExtensionContext,
  provider: MarkdownEditorProvider,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  const getTargetUri = (uri?: vscode.Uri): vscode.Uri | undefined => {
    return uri ?? provider.getActiveUri() ?? vscode.window.activeTextEditor?.document.uri;
  };

  // Main Export Menu
  disposables.push(
    vscode.commands.registerCommand('md-wysiwyg-editor.exportDocument', async (uri?: vscode.Uri) => {
      const targetUri = getTargetUri(uri);
      if (!targetUri) {
        void vscode.window.showWarningMessage('Open a Markdown file first to export.');
        return;
      }

      const options: vscode.QuickPickItem[] = [
        {
          label: '$(file-code) HTML',
          description: 'Standalone HTML with embedded styles and images',
          detail: 'No external tools required. Ideal for sharing and browser viewing.',
        },
        {
          label: '$(file-pdf) PDF',
          description: 'PDF document via browser print or Marp CLI',
          detail: 'High fidelity printable layout.',
        },
        {
          label: '$(file-text) DOCX (Word)',
          description: 'Microsoft Word document via Pandoc',
          detail: 'Requires Pandoc installed on your system.',
        },
        {
          label: '$(play) PPTX (PowerPoint)',
          description: 'PowerPoint presentation via Marp',
          detail: 'For Marp slide documents only (with marp: true).',
        },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select export format for current document',
      });

      if (!selected) {
        return;
      }

      if (selected.label.includes('HTML')) {
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportHtml', targetUri);
      } else if (selected.label.includes('PDF')) {
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportPdf', targetUri);
      } else if (selected.label.includes('DOCX')) {
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportDocx', targetUri);
      } else if (selected.label.includes('PPTX')) {
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportPptx', targetUri);
      }
    }),
  );

  // 1. Export HTML
  disposables.push(
    vscode.commands.registerCommand('md-wysiwyg-editor.exportHtml', async (uri?: vscode.Uri) => {
      const targetUri = getTargetUri(uri);
      if (!targetUri) {
        void vscode.window.showWarningMessage('Open a Markdown file first to export.');
        return;
      }

      const defaultUri = vscode.Uri.file(targetUri.fsPath.replace(/\.md$/i, '.html'));
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'HTML Document': ['html', 'htm'] },
        saveLabel: 'Export HTML',
      });

      if (!saveUri) {
        return;
      }

      try {
        const text = await getDocumentText(targetUri);
        const baseDir = path.dirname(targetUri.fsPath);
        const html = await convertMarkdownToStandaloneHtml(text, baseDir);

        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(html, 'utf-8'));
        const action = await vscode.window.showInformationMessage(
          `Exported HTML: ${path.basename(saveUri.fsPath)}`,
          'Open in Browser',
        );
        if (action === 'Open in Browser') {
          void vscode.env.openExternal(saveUri);
        }
      } catch (err) {
        logError(`Failed to export HTML: ${err}`);
        void vscode.window.showErrorMessage(`Export HTML failed: ${err}`);
      }
    }),
  );

  // 2. Export PDF
  disposables.push(
    vscode.commands.registerCommand('md-wysiwyg-editor.exportPdf', async (uri?: vscode.Uri) => {
      const targetUri = getTargetUri(uri);
      if (!targetUri) {
        void vscode.window.showWarningMessage('Open a Markdown file first to export.');
        return;
      }

      // Check if Marp document
      const text = await getDocumentText(targetUri);

      if (isMarpDocument(text)) {
        const hasMarpCli = await checkCommandAvailable('npx', ['@marp-team/marp-cli', '--version']);
        if (hasMarpCli) {
          const defaultUri = vscode.Uri.file(targetUri.fsPath.replace(/\.md$/i, '.pdf'));
          const saveUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'PDF Document': ['pdf'] },
            saveLabel: 'Export PDF',
          });
          if (!saveUri) {
            return;
          }

          // Ensure dirty buffer is saved to disk for CLI
          const openDoc = vscode.workspace.textDocuments?.find(
            (d) => d.uri.toString() === targetUri.toString(),
          );
          if (openDoc?.isDirty) {
            await openDoc.save();
          }

          try {
            await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: 'Exporting Marp PDF...' },
              async () => {
                return new Promise<void>((resolve, reject) => {
                  const proc = child_process.spawn('npx', ['-y', '@marp-team/marp-cli', targetUri.fsPath, '--pdf', '-o', saveUri.fsPath]);
                  proc.on('close', (code) => {
                    if (code === 0) {
                      void vscode.window.showInformationMessage(`Exported PDF: ${path.basename(saveUri.fsPath)}`);
                      resolve();
                    } else {
                      reject(new Error(`Marp CLI exited with code ${code}`));
                    }
                  });
                  proc.on('error', reject);
                });
              },
            );
          } catch (err) {
            logError(`Marp PDF export failed: ${err}`);
            void vscode.window.showErrorMessage(`Export PDF failed: ${err}`);
          }
          return;
        }
      }

      // Fallback: Generate standalone HTML in OS temp dir and open for printing
      try {
        const baseDir = path.dirname(targetUri.fsPath);
        const html = await convertMarkdownToStandaloneHtml(text, baseDir);
        const tempHtmlPath = path.join(
          os.tmpdir(),
          `md-wysiwyg-print-${Date.now()}-${path.basename(targetUri.fsPath)}.html`,
        );
        await fs.promises.writeFile(tempHtmlPath, html, 'utf-8');

        void vscode.env.openExternal(vscode.Uri.file(tempHtmlPath));
        void vscode.window.showInformationMessage(
          'Print document opened in browser. Use File > Print (Cmd+P / Ctrl+P) and select "Save as PDF".',
        );
      } catch (err) {
        logError(`Failed to prepare print document: ${err}`);
        void vscode.window.showErrorMessage(`Print export failed: ${err}`);
      }
    }),
  );

  // 3. Export DOCX
  disposables.push(
    vscode.commands.registerCommand('md-wysiwyg-editor.exportDocx', async (uri?: vscode.Uri) => {
      const targetUri = getTargetUri(uri);
      if (!targetUri) {
        void vscode.window.showWarningMessage('Open a Markdown file first to export.');
        return;
      }

      const hasPandoc = await checkCommandAvailable('pandoc', ['--version']);
      if (!hasPandoc) {
        const installAction = await vscode.window.showWarningMessage(
          'Pandoc is required to export to DOCX. Please install Pandoc on your system.',
          'Visit Pandoc Website',
        );
        if (installAction === 'Visit Pandoc Website') {
          void vscode.env.openExternal(vscode.Uri.parse('https://pandoc.org/installing.html'));
        }
        return;
      }

      const defaultUri = vscode.Uri.file(targetUri.fsPath.replace(/\.md$/i, '.docx'));
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'Word Document': ['docx'] },
        saveLabel: 'Export DOCX',
      });
      if (!saveUri) {
        return;
      }

      // Ensure dirty buffer is saved to disk for CLI
      const openDoc = vscode.workspace.textDocuments?.find(
        (d) => d.uri.toString() === targetUri.toString(),
      );
      if (openDoc?.isDirty) {
        await openDoc.save();
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Exporting DOCX via Pandoc...' },
          async () => {
            return new Promise<void>((resolve, reject) => {
              const proc = child_process.spawn('pandoc', [targetUri.fsPath, '-f', 'markdown', '-t', 'docx', '-o', saveUri.fsPath]);
              proc.on('close', (code) => {
                if (code === 0) {
                  void vscode.window.showInformationMessage(`Exported DOCX: ${path.basename(saveUri.fsPath)}`);
                  resolve();
                } else {
                  reject(new Error(`Pandoc exited with code ${code}`));
                }
              });
              proc.on('error', reject);
            });
          },
        );
      } catch (err) {
        logError(`Pandoc DOCX export failed: ${err}`);
        void vscode.window.showErrorMessage(`Export DOCX failed: ${err}`);
      }
    }),
  );

  // 4. Export PPTX
  disposables.push(
    vscode.commands.registerCommand('md-wysiwyg-editor.exportPptx', async (uri?: vscode.Uri) => {
      const targetUri = getTargetUri(uri);
      if (!targetUri) {
        void vscode.window.showWarningMessage('Open a Markdown file first to export.');
        return;
      }

      const text = await getDocumentText(targetUri);

      if (!isMarpDocument(text)) {
        void vscode.window.showInformationMessage(
          'PPTX export is available for Marp slide documents only (documents starting with "marp: true" frontmatter).',
        );
        return;
      }

      const defaultUri = vscode.Uri.file(targetUri.fsPath.replace(/\.md$/i, '.pptx'));
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'PowerPoint Presentation': ['pptx'] },
        saveLabel: 'Export PPTX',
      });
      if (!saveUri) {
        return;
      }

      // Ensure dirty buffer is saved to disk for CLI
      const pptxOpenDoc = vscode.workspace.textDocuments?.find(
        (d) => d.uri.toString() === targetUri.toString(),
      );
      if (pptxOpenDoc?.isDirty) {
        await pptxOpenDoc.save();
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Exporting Marp PPTX...' },
          async () => {
            return new Promise<void>((resolve, reject) => {
              const proc = child_process.spawn('npx', ['-y', '@marp-team/marp-cli', targetUri.fsPath, '--pptx', '-o', saveUri.fsPath]);
              proc.on('close', (code) => {
                if (code === 0) {
                  void vscode.window.showInformationMessage(`Exported PPTX: ${path.basename(saveUri.fsPath)}`);
                  resolve();
                } else {
                  reject(new Error(`Marp CLI exited with code ${code}`));
                }
              });
              proc.on('error', reject);
            });
          },
        );
      } catch (err) {
        logError(`Marp PPTX export failed: ${err}`);
        void vscode.window.showErrorMessage(`Export PPTX failed: ${err}`);
      }
    }),
  );

  return disposables;
}
