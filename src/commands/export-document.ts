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
import { splitYamlFrontmatter } from '../utils/yaml-frontmatter';
import type { MarkdownEditorProvider } from '../providers/markdown-editor-provider';
import { getMarkdownEditorProvider } from '../utils/editor-provider-hook';
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
  const { frontmatterBody, body } = splitYamlFrontmatter(markdown);

  // Convert markdown body (excluding YAML frontmatter) to HTML body via unified pipeline
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(body);

  let htmlBody = String(file);

  // Replace local relative image sources with Base64 data URIs
  // Supports both double and single quotes, and URL-encoded file paths (e.g. %20 for spaces)
  const imgRegex = /<img\s+[^>]*src=(["'])([^"']+)\1[^>]*>/gi;
  const matches = [...htmlBody.matchAll(imgRegex)];

  for (const match of matches) {
    const originalTag = match[0];
    const src = match[2];

    if (!src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
      try {
        const cleanSrc = decodeURI(src.split('?')[0].split('#')[0]);
        const ext = path.extname(cleanSrc).toLowerCase().replace('.', '');
        if (baseDir && ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
          const fullPath = path.resolve(baseDir, cleanSrc);
          if (fs.existsSync(fullPath)) {
            const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            const b64 = fs.readFileSync(fullPath).toString('base64');
            const dataUri = `data:${mime};base64,${b64}`;
            const newTag = originalTag.replace(src, dataUri);
            htmlBody = htmlBody.replace(originalTag, newTag);
          }
        }
      } catch (err) {
        logError(`Failed to inline image ${src}: ${err}`);
      }
    }
  }

  // Extract first H1 heading from body, else frontmatter `title`, else fallback
  const titleMatch = body.match(/^#\s+(.+)$/m);
  let rawTitle = titleMatch ? titleMatch[1].trim() : '';
  if (!rawTitle && frontmatterBody !== null) {
    const fmTitleMatch = frontmatterBody.match(/^\s*title\s*:\s*(.+)$/im);
    if (fmTitleMatch) {
      rawTitle = fmTitleMatch[1].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  const title = (rawTitle || 'Document Export')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
 * Retrieves the latest document text, preferring open Custom Editor / TextDocument buffers.
 */
export async function getDocumentText(
  targetUri: vscode.Uri,
  provider?: MarkdownEditorProvider,
): Promise<string> {
  const customDoc =
    provider?.getOpenDocument(targetUri) ?? getMarkdownEditorProvider()?.getOpenDocument(targetUri);
  if (customDoc) {
    return customDoc.markdownText;
  }
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
 * Checks if a command is available on system PATH (shell: false, timeout-guarded).
 */
export function checkCommandAvailable(
  command: string,
  args: string[] = ['--version'],
  timeoutMs = 10000,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      }
    };
    const timer = setTimeout(() => {
      finish(false);
    }, timeoutMs);
    try {
      const proc = child_process.spawn(command, args, { stdio: 'ignore', shell: false });
      proc.on('error', () => finish(false));
      proc.on('close', (code) => finish(code === 0 || code === null));
    } catch {
      finish(false);
    }
  });
}

type CliInvocation = {
  command: string;
  prefixArgs: string[];
  source: 'local' | 'path' | 'npx';
};

function getLocalSearchRoots(
  context: vscode.ExtensionContext,
  targetUri: vscode.Uri,
): string[] {
  const roots: string[] = [];
  if (targetUri.scheme === 'file' && targetUri.fsPath) {
    let dir = path.dirname(targetUri.fsPath);
    for (let i = 0; i < 6; i++) {
      roots.push(dir);
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (folder.uri.scheme === 'file' && folder.uri.fsPath) {
      roots.push(folder.uri.fsPath);
    }
  }
  if (context.extensionPath) {
    roots.push(context.extensionPath);
  }
  return roots;
}

function resolveMarpCliPackageEntry(root: string): string | undefined {
  const pkgDir = path.join(root, 'node_modules', '@marp-team', 'marp-cli');
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    return undefined;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
      bin?: string | Record<string, string>;
    };
    const binRel =
      typeof pkg.bin === 'string'
        ? pkg.bin
        : pkg.bin && typeof pkg.bin === 'object'
          ? (pkg.bin.marp ?? Object.values(pkg.bin)[0])
          : undefined;
    if (typeof binRel !== 'string' || !binRel) {
      return undefined;
    }
    const entryPath = path.resolve(pkgDir, binRel);
    const rel = path.relative(pkgDir, entryPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return undefined;
    }
    if (fs.existsSync(entryPath)) {
      return entryPath;
    }
  } catch {
    /* ignore malformed package.json */
  }
  return undefined;
}

function findLocalMarpInvocation(
  context: vscode.ExtensionContext,
  targetUri: vscode.Uri,
): CliInvocation | undefined {
  for (const root of getLocalSearchRoots(context, targetUri)) {
    // Resolve @marp-team/marp-cli JS entry via process.execPath on both win32 and POSIX
    // to avoid spawning marp.cmd with shell: false (EINVAL on Windows).
    const pkgEntry = resolveMarpCliPackageEntry(root);
    if (pkgEntry) {
      return { command: process.execPath, prefixArgs: [pkgEntry], source: 'local' };
    }
    const localBin = path.join(root, 'node_modules', '.bin', 'marp');
    if (fs.existsSync(localBin)) {
      try {
        const head = fs.readFileSync(localBin, 'utf8').slice(0, 128);
        if (/^#!.*\bnode\b/.test(head)) {
          return { command: process.execPath, prefixArgs: [localBin], source: 'local' };
        }
      } catch {
        /* fallback below on POSIX */
      }
      if (process.platform !== 'win32') {
        return { command: localBin, prefixArgs: [], source: 'local' };
      }
    }
  }
  return undefined;
}

export async function resolveMarpCliCommand(
  context: vscode.ExtensionContext,
  targetUri: vscode.Uri,
): Promise<CliInvocation | undefined> {
  const localInvocation = findLocalMarpInvocation(context, targetUri);
  if (localInvocation) {
    return localInvocation;
  }
  if (await checkCommandAvailable('marp', ['--version'])) {
    return { command: 'marp', prefixArgs: [], source: 'path' };
  }
  if (await checkCommandAvailable('npx', ['@marp-team/marp-cli', '--version'], 12000)) {
    return { command: 'npx', prefixArgs: ['-y', '@marp-team/marp-cli'], source: 'npx' };
  }
  return undefined;
}

function getDefaultExportUri(targetUri: vscode.Uri, ext: string): vscode.Uri {
  const basePath = (targetUri.path || targetUri.fsPath).replace(/\.md$/i, '') + ext;
  if (targetUri.scheme === 'untitled') {
    return vscode.Uri.file(path.posix.basename(basePath));
  }
  return targetUri.with({ path: basePath });
}

function getDocumentBaseDir(targetUri: vscode.Uri): string {
  return targetUri.scheme === 'file' ? path.dirname(targetUri.fsPath) : '';
}

async function ensureCleanForExport(
  targetUri: vscode.Uri,
  provider: MarkdownEditorProvider,
): Promise<boolean> {
  const customDoc = provider.getOpenDocument(targetUri);
  const textDoc = vscode.workspace.textDocuments?.find(
    (d) => d.uri.toString() === targetUri.toString(),
  );
  const isDirty = Boolean(customDoc?.isDirty || textDoc?.isDirty);
  if (!isDirty) {
    return true;
  }
  if (customDoc?.isRawParseFailed) {
    void vscode.window.showErrorMessage(
      'Raw Markdown parse failed. Fix syntax errors before saving or exporting.',
    );
    return false;
  }
  const choice = await vscode.window.showWarningMessage(
    'Document has unsaved changes. Save before exporting?',
    { modal: true },
    'Save',
    'Cancel',
  );
  if (choice !== 'Save') {
    return false;
  }
  try {
    if (customDoc?.isDirty) {
      const cts = new vscode.CancellationTokenSource();
      try {
        await customDoc.save(cts.token);
      } finally {
        cts.dispose();
      }
    }
    if (textDoc?.isDirty) {
      await textDoc.save();
    }
    return true;
  } catch (err) {
    logError(`Save before export failed: ${err}`);
    void vscode.window.showErrorMessage(`Failed to save before export: ${err}`);
    return false;
  }
}

function runSpawnCommand(
  command: string,
  args: string[],
  label: string,
  timeoutMs = 30000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const proc = child_process.spawn(command, args, { shell: false });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          proc.kill();
        } catch {
          /* ignore */
        }
        reject(new Error(`${label} timed out after ${timeoutMs}ms (network/offline or CLI hung).`));
      }
    }, timeoutMs);
    proc.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const detail = stderr.trim() ? `: ${stderr.trim()}` : '';
        reject(new Error(`${label} exited with code ${code}${detail}`));
      }
    });
    proc.on('error', (err) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function registerExportCommands(
  context: vscode.ExtensionContext,
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

      if (!(await ensureCleanForExport(targetUri, provider))) {
        return;
      }

      const defaultUri = getDefaultExportUri(targetUri, '.html');
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'HTML Document': ['html', 'htm'] },
        saveLabel: 'Export HTML',
      });

      if (!saveUri) {
        return;
      }

      try {
        const text = await getDocumentText(targetUri, provider);
        const baseDir = getDocumentBaseDir(targetUri);
        const html = await convertMarkdownToStandaloneHtml(text, baseDir);

        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(html, 'utf-8'));
        const label = path.posix.basename(saveUri.path || saveUri.fsPath);
        const action = await vscode.window.showInformationMessage(
          `Exported HTML: ${label}`,
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

      if (!(await ensureCleanForExport(targetUri, provider))) {
        return;
      }

      // Check if Marp document
      const text = await getDocumentText(targetUri, provider);

      if (isMarpDocument(text) && targetUri.scheme === 'file') {
        const marpCli = await resolveMarpCliCommand(context, targetUri);
        if (marpCli) {
          const defaultUri = getDefaultExportUri(targetUri, '.pdf');
          const saveUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'PDF Document': ['pdf'] },
            saveLabel: 'Export PDF',
          });
          if (!saveUri) {
            return;
          }

          try {
            await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: 'Exporting Marp PDF...' },
              async () => {
                await runSpawnCommand(
                  marpCli.command,
                  [...marpCli.prefixArgs, targetUri.fsPath, '--pdf', '-o', saveUri.fsPath],
                  'Marp CLI',
                );
                void vscode.window.showInformationMessage(
                  `Exported PDF: ${path.basename(saveUri.fsPath)}`,
                );
              },
            );
          } catch (err) {
            logError(`Marp PDF export failed: ${err}`);
            void vscode.window.showErrorMessage(
              `Export PDF failed: ${err}. If offline, install @marp-team/marp-cli locally.`,
            );
          }
          return;
        }
      }

      // Fallback: Generate standalone HTML in OS temp dir and open for printing
      try {
        const baseDir = getDocumentBaseDir(targetUri);
        const html = await convertMarkdownToStandaloneHtml(text, baseDir);
        const baseName = path.posix.basename(targetUri.path || targetUri.fsPath || 'document.md');
        const tempHtmlPath = path.join(
          os.tmpdir(),
          `md-wysiwyg-print-${Date.now()}-${baseName}.html`,
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

      if (!(await ensureCleanForExport(targetUri, provider))) {
        return;
      }

      if (targetUri.scheme !== 'file') {
        void vscode.window.showWarningMessage('Save document to local disk before exporting to DOCX.');
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

      const defaultUri = getDefaultExportUri(targetUri, '.docx');
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'Word Document': ['docx'] },
        saveLabel: 'Export DOCX',
      });
      if (!saveUri) {
        return;
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Exporting DOCX via Pandoc...' },
          async () => {
            await runSpawnCommand(
              'pandoc',
              [targetUri.fsPath, '-f', 'markdown', '-t', 'docx', '-o', saveUri.fsPath],
              'Pandoc',
            );
            void vscode.window.showInformationMessage(
              `Exported DOCX: ${path.basename(saveUri.fsPath)}`,
            );
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

      if (!(await ensureCleanForExport(targetUri, provider))) {
        return;
      }

      const text = await getDocumentText(targetUri, provider);

      if (!isMarpDocument(text)) {
        void vscode.window.showInformationMessage(
          'PPTX export is available for Marp slide documents only (documents starting with "marp: true" frontmatter).',
        );
        return;
      }

      if (targetUri.scheme !== 'file') {
        void vscode.window.showWarningMessage('Save document to local disk before exporting to PPTX.');
        return;
      }

      const marpCli = await resolveMarpCliCommand(context, targetUri);
      if (!marpCli) {
        void vscode.window.showErrorMessage(
          'Marp CLI is not installed locally and npx is unavailable (offline). Install @marp-team/marp-cli to export PPTX.',
        );
        return;
      }

      const defaultUri = getDefaultExportUri(targetUri, '.pptx');
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'PowerPoint Presentation': ['pptx'] },
        saveLabel: 'Export PPTX',
      });
      if (!saveUri) {
        return;
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Exporting Marp PPTX...' },
          async () => {
            await runSpawnCommand(
              marpCli.command,
              [...marpCli.prefixArgs, targetUri.fsPath, '--pptx', '-o', saveUri.fsPath],
              'Marp CLI',
            );
            void vscode.window.showInformationMessage(
              `Exported PPTX: ${path.basename(saveUri.fsPath)}`,
            );
          },
        );
      } catch (err) {
        logError(`Marp PPTX export failed: ${err}`);
        void vscode.window.showErrorMessage(
          `Export PPTX failed: ${err}. If offline, install @marp-team/marp-cli locally.`,
        );
      }
    }),
  );

  return disposables;
}
