/**
 * TC-EXP-001–008 / TC-I31-015 / TC-I31-033 / TC-I31-034 / TC-I31-041:
 * Document Export Support (runtime tests replacing static readRepoFile checks).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  convertMarkdownToStandaloneHtml,
  checkCommandAvailable,
  getDocumentText,
  registerExportCommands,
} from '../../../commands/export-document';
import { MarkdownDocument } from '../../../providers/markdown-document';
import { MarkdownEditorProvider } from '../../../providers/markdown-editor-provider';
import { MarpPreviewManager, registerMarpPreviewCommand } from '../../../commands/marp-preview';
import { isMarpDocument } from '../../../utils/is-marp-document';

type VscodeMockExtras = typeof vscode & {
  createMockExtensionContext: (extPath?: string) => vscode.ExtensionContext;
  createMockWebviewPanel: (
    viewType: string,
    title: string,
    viewColumn?: number,
    options?: Record<string, unknown>,
  ) => {
    webview: {
      html: string;
      options: Record<string, unknown>;
      cspSource: string;
      postedMessages: unknown[];
      simulateReceiveMessage: (msg: unknown) => void;
    };
    title: string;
    dispose: () => void;
  };
  createMockTextDocument: (
    uri: vscode.Uri,
    text: string,
    opts?: { languageId?: string; isDirty?: boolean; onSave?: () => Promise<boolean> | boolean },
  ) => vscode.TextDocument;
  setMockFile: (uri: vscode.Uri, content: string | Uint8Array) => void;
  getMockFileContent: (uri: vscode.Uri) => string | undefined;
  setMockQuickPickHandler: (
    handler: ((items: Array<{ label: string }>) => unknown) | undefined,
  ) => void;
  setMockSaveDialogHandler: (handler: (() => vscode.Uri | undefined) | undefined) => void;
  setMockMessageHandler: (
    handler:
      | ((level: 'info' | 'warn' | 'error', message: string, ...items: unknown[]) => unknown)
      | undefined,
  ) => void;
  getRecordedMessages: () => Array<{ level: 'info' | 'warn' | 'error'; message: string; items: unknown[] }>;
  getOpenedExternalUris: () => vscode.Uri[];
  getCreatedWebviewPanels: () => Array<{ webview: { html: string; options: Record<string, unknown> } }>;
  resetVscodeMock: () => void;
};

const mockVscode = vscode as unknown as VscodeMockExtras;

function readRepoFile(...parts: string[]): string {
  const filePath = path.resolve(process.cwd(), ...parts);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

async function openMockCustomDoc(
  provider: MarkdownEditorProvider,
  uri: vscode.Uri,
  content: string,
): Promise<MarkdownDocument> {
  mockVscode.setMockFile(uri, content);
  const cts = new vscode.CancellationTokenSource();
  const doc = await provider.openCustomDocument(
    uri,
    { backupId: undefined, untitledDocumentData: undefined },
    cts.token,
  );
  const panel = mockVscode.createMockWebviewPanel('md-wysiwyg-editor.wysiwyg', 'doc.md');
  await provider.resolveCustomEditor(doc, panel as unknown as vscode.WebviewPanel, cts.token);
  (vscode.window.tabGroups.activeTabGroup as unknown as { activeTab: unknown }).activeTab = {
    input: new vscode.TabInputCustom(uri, 'md-wysiwyg-editor.wysiwyg'),
  } as unknown as vscode.Tab;
  return doc;
}

suite('document-export (TC-EXP-001–017 / TC-I31-015, 033, 034, 041)', () => {
  const packageJsonSrc = readRepoFile('package.json');

  setup(() => {
    mockVscode.resetVscodeMock();
  });

  teardown(() => {
    mockVscode.resetVscodeMock();
  });

  suite('TC-EXP-001: Command and menu registration', () => {
    test('package.json declares export commands and editor/title menu', () => {
      const pkg = JSON.parse(packageJsonSrc);
      const commands = pkg.contributes?.commands ?? [];
      const cmdIds = commands.map((c: { command: string }) => c.command);

      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportDocument'));
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportHtml'));
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportPdf'));
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportDocx'));
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportPptx'));

      const titleMenus = pkg.contributes?.menus?.['editor/title'] ?? [];
      assert.ok(
        titleMenus.some((m: { command: string }) => m.command === 'md-wysiwyg-editor.exportDocument'),
        'exportDocument must be in editor/title menu',
      );
    });

    test('TC-I31-015: registerExportCommands routes QuickPick and executes HTML/PDF/DOCX/PPTX paths', async () => {
      const ctx = mockVscode.createMockExtensionContext();
      const marpManager = new MarpPreviewManager(ctx);
      const provider = new MarkdownEditorProvider(ctx, marpManager);
      const disposables = registerExportCommands(ctx, provider);
      assert.strictEqual(disposables.length, 5);

      const srcUri = vscode.Uri.file('/tmp/export-runtime.md');
      const outHtmlUri = vscode.Uri.file('/tmp/export-runtime.html');
      mockVscode.setMockFile(srcUri, '# Export Runtime\n\nBody text.\n');

      // 1. exportDocument -> QuickPick HTML -> SaveDialog -> HTML file written
      mockVscode.setMockQuickPickHandler((items) =>
        items.find((i) => i.label.includes('HTML')),
      );
      mockVscode.setMockSaveDialogHandler(() => outHtmlUri);
      await vscode.commands.executeCommand('md-wysiwyg-editor.exportDocument', srcUri);

      const writtenHtml = mockVscode.getMockFileContent(outHtmlUri);
      assert.ok(writtenHtml?.includes('<h1>Export Runtime</h1>'), 'HTML export must write rendered HTML');
      assert.ok(writtenHtml?.includes('<!DOCTYPE html>'));

      // 2. exportPdf (non-Marp fallback) -> writes temp HTML in os.tmpdir() and opens external
      await vscode.commands.executeCommand('md-wysiwyg-editor.exportPdf', srcUri);
      const externals = mockVscode.getOpenedExternalUris();
      assert.ok(externals.length >= 1, 'PDF print fallback must open temp HTML externally');
      const printPath = externals[0].fsPath;
      assert.ok(
        printPath.startsWith(os.tmpdir()),
        `Print temp HTML must be created under os.tmpdir(), got ${printPath}`,
      );
      if (fs.existsSync(printPath)) {
        fs.unlinkSync(printPath);
      }

      // 3. exportDocx (Pandoc missing) -> shows Pandoc install guidance
      const origPath = process.env.PATH;
      process.env.PATH = '';
      try {
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportDocx', srcUri);
        assert.ok(
          mockVscode.getRecordedMessages().some((m) =>
            m.message.includes('Pandoc is required to export to DOCX'),
          ),
          'Missing Pandoc must show warning guidance',
        );
      } finally {
        process.env.PATH = origPath;
      }

      // 4. exportPptx (non-Marp) -> rejects with non-Marp guidance
      await vscode.commands.executeCommand('md-wysiwyg-editor.exportPptx', srcUri);
      assert.ok(
        mockVscode.getRecordedMessages().some((m) =>
          m.message.includes('PPTX export is available for Marp slide documents only'),
        ),
        'Non-Marp PPTX export must display Marp-only guidance',
      );

      disposables.forEach((d) => d.dispose());
    });
  });

  suite('TC-EXP-002: Standalone HTML generation with embedded styles', () => {
    test('converts basic markdown to HTML with doctype, styling, and elements', async () => {
      const md = '# Title\n\nParagraph text with **bold** and *italic*.\n\n| A | B |\n|---|---|\n| 1 | 2 |';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('<!DOCTYPE html>'), 'Must produce full HTML document');
      assert.ok(html.includes('<h1>Title</h1>'), 'Must render h1');
      assert.ok(html.includes('<strong>bold</strong>'), 'Must render bold');
      assert.ok(html.includes('<table>'), 'Must render table');
      assert.ok(html.includes('<style>'), 'Must include embedded style block');
    });

    test('inlines local images as Base64 data URIs', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-img-inline-'));
      const tempImgPath = path.join(tempDir, 'test-export-img.png');
      const dummyPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      fs.writeFileSync(tempImgPath, Buffer.from(dummyPngBase64, 'base64'));

      try {
        const md = '![Sample Image](./test-export-img.png)';
        const html = await convertMarkdownToStandaloneHtml(md, tempDir);
        assert.ok(html.includes('data:image/png;base64,'), 'Must inline local image as Base64');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  suite('TC-EXP-004 & TC-EXP-006: CLI & Marp detection', () => {
    test('checkCommandAvailable reports false for non-existent command', async () => {
      const avail = await checkCommandAvailable('non_existent_pandoc_command_xyz');
      assert.strictEqual(avail, false);
    });

    test('detects Marp documents correctly', () => {
      const marpDoc = '---\nmarp: true\n---\n# Slide 1';
      const normalDoc = '# Normal Document';

      assert.strictEqual(isMarpDocument(marpDoc), true);
      assert.strictEqual(isMarpDocument(normalDoc), false);
    });
  });

  suite('TC-I31-033 & TC-I31-034 & TC-I31-041: Dirty Gate, Custom Doc Buffer, Marp CLI security', () => {
    test('TC-I31-033: all 5 export commands enforce Dirty Gate (Save vs Cancel) when MarkdownDocument is dirty', async () => {
      const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'export-dirty-gate-'));
      const binDir = path.join(tmpWs, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });
      const fakeCli = '#!/usr/bin/env node\nprocess.exit(0);\n';
      fs.writeFileSync(path.join(binDir, 'marp'), fakeCli, { mode: 0o755 });
      fs.writeFileSync(path.join(binDir, 'pandoc'), fakeCli, { mode: 0o755 });

      const origPath = process.env.PATH;
      process.env.PATH = `${binDir}${path.delimiter}${origPath ?? ''}`;

      const ctx = mockVscode.createMockExtensionContext();
      const marpManager = new MarpPreviewManager(ctx);
      const provider = new MarkdownEditorProvider(ctx, marpManager);
      const disposables = registerExportCommands(ctx, provider);

      const mdPath = path.join(tmpWs, 'slides.md');
      const initialContent = '---\nmarp: true\n---\n# Initial\n';
      fs.writeFileSync(mdPath, initialContent);
      const docUri = vscode.Uri.file(mdPath);

      try {
        const doc = await openMockCustomDoc(provider, docUri, initialContent);
        // Make MarkdownDocument dirty
        doc.applyRawSource('---\nmarp: true\n---\n# Dirty Update\n', 'edit');
        assert.strictEqual(doc.isDirty, true);

        const commandsToCheck = [
          { cmd: 'md-wysiwyg-editor.exportHtml', outFile: path.join(tmpWs, 'out.html') },
          { cmd: 'md-wysiwyg-editor.exportPdf', outFile: path.join(tmpWs, 'out.pdf') },
          { cmd: 'md-wysiwyg-editor.exportDocx', outFile: path.join(tmpWs, 'out.docx') },
          { cmd: 'md-wysiwyg-editor.exportPptx', outFile: path.join(tmpWs, 'out.pptx') },
          { cmd: 'md-wysiwyg-editor.exportDocument', outFile: path.join(tmpWs, 'out-menu.html') },
        ];

        for (const { cmd, outFile } of commandsToCheck) {
          // Ensure dirty before each command
          doc.applyRawSource(`---\nmarp: true\n---\n# Dirty for ${cmd}\n`, 'edit');
          assert.strictEqual(doc.isDirty, true);

          let warningPrompts = 0;
          mockVscode.setMockQuickPickHandler((items) =>
            items.find((i) => i.label.includes('HTML')),
          );
          mockVscode.setMockSaveDialogHandler(() => vscode.Uri.file(outFile));
          mockVscode.setMockMessageHandler((level) => {
            if (level === 'warn') {
              warningPrompts += 1;
              return 'Cancel';
            }
            return undefined;
          });

          await vscode.commands.executeCommand(cmd);
          assert.ok(
            warningPrompts >= 1,
            `${cmd} must show Save/Cancel confirmation when document is dirty (AD-006 / C-1)`,
          );
          assert.strictEqual(
            mockVscode.getMockFileContent(vscode.Uri.file(outFile)),
            undefined,
            `${cmd} must NOT write output when Cancel is selected`,
          );
          assert.strictEqual(doc.isDirty, true, `${cmd} Cancel must leave document dirty`);
        }

        // Now choose Save on exportHtml -> saves document first and clears dirty
        const savedOutUri = vscode.Uri.file(path.join(tmpWs, 'saved.html'));
        mockVscode.setMockSaveDialogHandler(() => savedOutUri);
        mockVscode.setMockMessageHandler((level) => (level === 'warn' ? 'Save' : undefined));
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportHtml');
        assert.strictEqual(doc.isDirty, false, 'Save choice in Dirty Gate must save document');
      } finally {
        process.env.PATH = origPath;
        disposables.forEach((d) => d.dispose());
        fs.rmSync(tmpWs, { recursive: true, force: true });
      }
    });

    test('TC-I31-034: exportHtml, getDocumentText, and showMarpPreview prioritize MarkdownDocument buffer over disk', async () => {
      const ctx = mockVscode.createMockExtensionContext();
      const marpManager = new MarpPreviewManager(ctx);
      const provider = new MarkdownEditorProvider(ctx, marpManager);
      const exportDisposables = registerExportCommands(ctx, provider);
      const marpDisp = registerMarpPreviewCommand(ctx, marpManager);

      const docUri = vscode.Uri.file('/tmp/buffer-priority.md');
      const diskContent = '# Old Disk Content\n';
      const updatedContent = '---\nmarp: true\n---\n# Updated Buffer\n\n---\n\nSlide Two\n';

      try {
        const doc = await openMockCustomDoc(provider, docUri, diskContent);
        doc.applyRawSource(updatedContent, 'Raw edit');
        assert.strictEqual(doc.markdownText, updatedContent);
        (vscode.window as unknown as { activeTextEditor: undefined }).activeTextEditor = undefined;

        // 1. exportHtml reads updated buffer (with Save confirmed if dirty)
        const outHtmlUri = vscode.Uri.file('/tmp/buffer-priority.html');
        mockVscode.setMockSaveDialogHandler(() => outHtmlUri);
        mockVscode.setMockMessageHandler((level) => (level === 'warn' ? 'Save' : undefined));
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportHtml');
        const exported = mockVscode.getMockFileContent(outHtmlUri) ?? '';
        assert.ok(
          exported.includes('Updated Buffer') && !exported.includes('Old Disk Content'),
          `exportHtml must use MarkdownDocument buffer, got:\n${exported}`,
        );

        // Reset dirty divergence: edit buffer again without saving to disk
        const newerContent = '---\nmarp: true\n---\n# Unsaved Slide Title\n\n---\n\nUnsaved Slide 2\n';
        doc.applyRawSource(newerContent, 'Another edit');
        // Disk still has updatedContent, NOT newerContent
        mockVscode.setMockFile(docUri, diskContent);

        // 2. showMarpPreview reads MarkdownDocument buffer rather than disk
        await vscode.commands.executeCommand('md-wysiwyg-editor.showMarpPreview');
        const panels = mockVscode.getCreatedWebviewPanels();
        const marpPanel = panels.find((p) => p.webview.html.includes('marpit') || p.webview.html.includes('Unsaved') || p.webview.html.includes('Old Disk'));
        assert.ok(marpPanel, 'Marp Preview panel must be created');
        assert.ok(
          marpPanel!.webview.html.includes('Unsaved Slide Title') &&
            !marpPanel!.webview.html.includes('Old Disk Content'),
          'showMarpPreview must read MarkdownDocument.markdownText over stale disk file',
        );
      } finally {
        marpDisp.dispose();
        exportDisposables.forEach((d) => d.dispose());
      }
    });

    test('TC-I31-041: Marp CLI prefers local node_modules/.bin/marp, uses shell: false, and fails clearly offline', async () => {
      const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'marp-cli-local-'));
      const binDir = path.join(tmpWs, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });

      const argvLogPath = path.join(tmpWs, 'marp-argv.json');
      const localMarpPath = path.join(binDir, 'marp');
      fs.writeFileSync(
        localMarpPath,
        [
          '#!/usr/bin/env node',
          'const fs = require("fs");',
          `fs.writeFileSync(${JSON.stringify(argvLogPath)}, JSON.stringify(process.argv.slice(2)));`,
          'process.exit(0);',
        ].join('\n'),
        { mode: 0o755 },
      );

      // Put a decoy npx in PATH that fails if called instead of local marp
      const decoyBinDir = path.join(tmpWs, 'decoy-bin');
      fs.mkdirSync(decoyBinDir, { recursive: true });
      fs.writeFileSync(
        path.join(decoyBinDir, 'npx'),
        '#!/usr/bin/env node\nprocess.exit(1);\n',
        { mode: 0o755 },
      );

      const origPath = process.env.PATH;
      process.env.PATH = decoyBinDir;

      const ctx = mockVscode.createMockExtensionContext();
      const marpManager = new MarpPreviewManager(ctx);
      const provider = new MarkdownEditorProvider(ctx, marpManager);
      const disposables = registerExportCommands(ctx, provider);

      try {
        (vscode.workspace as unknown as { workspaceFolders: unknown }).workspaceFolders = [
          { uri: vscode.Uri.file(tmpWs), name: 'ws', index: 0 },
        ];

        // Filename containing shell metacharacters — must NOT execute shell injection
        const trickyMdPath = path.join(tmpWs, 'a;rm -rf.md');
        const outPptxPath = path.join(tmpWs, 'a;rm -rf.pptx');
        const marpMd = '---\nmarp: true\n---\n# Slide\n';
        fs.writeFileSync(trickyMdPath, marpMd);
        const docUri = vscode.Uri.file(trickyMdPath);
        mockVscode.setMockFile(docUri, marpMd);
        mockVscode.setMockSaveDialogHandler(() => vscode.Uri.file(outPptxPath));

        await vscode.commands.executeCommand('md-wysiwyg-editor.exportPptx', docUri);

        assert.ok(
          fs.existsSync(argvLogPath),
          'Local node_modules/.bin/marp must be prioritized over npx -y (AD-007)',
        );
        const recordedArgv = JSON.parse(fs.readFileSync(argvLogPath, 'utf8')) as string[];
        assert.ok(
          recordedArgv.includes(trickyMdPath),
          'Shell metacharacter filename must be passed literally as single argv (shell: false)',
        );

        // Now remove local marp so both local marp and npx are unavailable (offline)
        fs.unlinkSync(localMarpPath);
        await vscode.commands.executeCommand('md-wysiwyg-editor.exportPptx', docUri);
        assert.ok(
          mockVscode.getRecordedMessages().some((m) => m.level === 'error' || m.level === 'warn'),
          'Missing/offline Marp CLI must surface a clear error/warning notification',
        );
      } finally {
        process.env.PATH = origPath;
        disposables.forEach((d) => d.dispose());
        fs.rmSync(tmpWs, { recursive: true, force: true });
      }
    });
  });

  suite('Edge Cases & Image Handling', () => {
    test('TC-EXP-009: preserves external http/https and data URIs without alteration', async () => {
      const md = '![Remote](https://example.com/logo.png)\n![Data](data:image/png;base64,AAAA)';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('src="https://example.com/logo.png"'));
      assert.ok(html.includes('src="data:image/png;base64,AAAA"'));
    });

    test('TC-EXP-010: missing local image does not crash conversion and preserves tag', async () => {
      const md = '![Missing](./non_existent_img_9999.png)';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('non_existent_img_9999.png'));
    });

    test('TC-EXP-011: converts GFM strike and task lists in exported HTML', async () => {
      const md = '~~strike~~\n\n- [x] done task';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('<del>strike</del>') || html.includes('<s>strike</s>'));
      assert.ok(html.includes('type="checkbox"'));
    });

    test('TC-EXP-012: inlines local images with URL-encoded space (%20) in path', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-img-'));
      const imgPath = path.join(tempDir, 'my image.png');
      fs.writeFileSync(imgPath, Buffer.from('fake-png-content'));

      try {
        const md = '![Space Image](./my%20image.png)';
        const html = await convertMarkdownToStandaloneHtml(md, tempDir);
        assert.ok(html.includes('src="data:image/png;base64,'));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('TC-EXP-013: inlines local images with single-quoted src attributes', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-img-'));
      const imgPath = path.join(tempDir, 'single.png');
      fs.writeFileSync(imgPath, Buffer.from('fake-png-content'));

      try {
        const md = "<img src='single.png' alt='single quote'>";
        const html = await convertMarkdownToStandaloneHtml(md, tempDir);
        assert.ok(html.includes('data:image/png;base64,'));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('TC-EXP-014: extracts first H1 as document title in HTML head', async () => {
      const md = '# Antigravity Document\n\nSome body text.';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());
      assert.ok(html.includes('<title>Antigravity Document</title>'));
    });

    test('TC-EXP-015: getDocumentText reads from file when document not in memory', async () => {
      const fakeUri = vscode.Uri.file('/mock/workspace/test.md');
      mockVscode.setMockFile(fakeUri, '# Hello Mock File');

      const text = await getDocumentText(fakeUri);
      assert.strictEqual(text, '# Hello Mock File');
    });

    test('TC-EXP-016: blocks non-image files (.env, .pem, .txt) from being inlined as Base64', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-sec-'));
      const secretPath = path.join(tempDir, '.env');
      fs.writeFileSync(secretPath, 'SECRET_KEY=123456');

      try {
        const md = '![Secret](./.env)';
        const html = await convertMarkdownToStandaloneHtml(md, tempDir);
        assert.ok(!html.includes('data:image/'));
        assert.ok(html.includes('./.env'));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('strips YAML frontmatter from exported HTML body and uses frontmatter title fallback', async () => {
      const md = [
        '---',
        'title: "Frontmatter Title"',
        'author: Alice',
        '---',
        '',
        'Body paragraph without H1.',
      ].join('\n');
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('<title>Frontmatter Title</title>'));
      assert.ok(!html.includes('author: Alice'));
      assert.ok(!html.includes('<h2>'));
      assert.ok(html.includes('<p>Body paragraph without H1.</p>'));
    });
  });
});
