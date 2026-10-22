/**
 * TC-EXP-001–008: Document Export Support (document-export).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  convertMarkdownToStandaloneHtml,
  checkCommandAvailable,
  getDocumentText,
} from '../../../commands/export-document';
import { isMarpDocument } from '../../../utils/is-marp-document';

function readRepoFile(...parts: string[]): string {
  const filePath = path.resolve(process.cwd(), ...parts);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

suite('document-export (TC-EXP-001–008)', () => {
  const packageJsonSrc = readRepoFile('package.json');
  const extensionTsSrc = readRepoFile('src/extension.ts');
  const exportCmdSrc = readRepoFile('src/commands/export-document.ts');

  suite('TC-EXP-001: Command and menu registration', () => {
    test('package.json declares export commands', () => {
      const pkg = JSON.parse(packageJsonSrc);
      const commands = pkg.contributes?.commands ?? [];
      const cmdIds = commands.map((c: { command: string }) => c.command);

      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportDocument'), 'exportDocument command must exist');
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportHtml'), 'exportHtml command must exist');
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportPdf'), 'exportPdf command must exist');
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportDocx'), 'exportDocx command must exist');
      assert.ok(cmdIds.includes('md-wysiwyg-editor.exportPptx'), 'exportPptx command must exist');
    });

    test('package.json registers exportDocument in editor/title menu', () => {
      const pkg = JSON.parse(packageJsonSrc);
      const titleMenus = pkg.contributes?.menus?.['editor/title'] ?? [];
      const hasExportMenu = titleMenus.some(
        (m: { command: string }) => m.command === 'md-wysiwyg-editor.exportDocument',
      );
      assert.ok(hasExportMenu, 'exportDocument must be in editor/title menu');
    });

    test('extension.ts registers export commands on activate', () => {
      assert.ok(
        extensionTsSrc.includes('registerExportCommands'),
        'extension.ts must register export commands',
      );
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
      // Create a temporary dummy image
      const tempImgPath = path.join(process.cwd(), 'temporary', 'test-export-img.png');
      const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      fs.writeFileSync(tempImgPath, Buffer.from(dummyPngBase64, 'base64'));

      try {
        const md = '![Sample Image](./test-export-img.png)';
        const html = await convertMarkdownToStandaloneHtml(md, path.join(process.cwd(), 'temporary'));
        assert.ok(html.includes('data:image/png;base64,'), 'Must inline local image as Base64');
      } finally {
        if (fs.existsSync(tempImgPath)) {
          fs.unlinkSync(tempImgPath);
        }
      }
    });
  });

  suite('TC-EXP-004 & TC-EXP-005: DOCX export via Pandoc', () => {
    test('checkCommandAvailable reports false for non-existent command', async () => {
      const avail = await checkCommandAvailable('non_existent_pandoc_command_xyz');
      assert.strictEqual(avail, false);
    });

    test('export-document.ts provides installation guidance when Pandoc is missing', () => {
      assert.ok(
        exportCmdSrc.includes('Pandoc is required to export to DOCX'),
        'Must display install guidance when Pandoc is missing',
      );
    });
  });

  suite('TC-EXP-006 & TC-EXP-007: PPTX export for Marp documents', () => {
    test('detects Marp documents correctly', () => {
      const marpDoc = '---\nmarp: true\n---\n# Slide 1';
      const normalDoc = '# Normal Document';

      assert.strictEqual(isMarpDocument(marpDoc), true);
      assert.strictEqual(isMarpDocument(normalDoc), false);
    });

    test('export-document.ts guards non-Marp documents against PPTX export', () => {
      assert.ok(
        exportCmdSrc.includes('PPTX export is available for Marp slide documents only'),
        'Must guide user when non-Marp document requests PPTX export',
      );
    });
  });

  suite('Edge Cases & Image Handling', () => {
    test('TC-EXP-009: preserves external http/https and data URIs without alteration', async () => {
      const md = '![Remote](https://example.com/logo.png)\n![Data](data:image/png;base64,AAAA)';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('src="https://example.com/logo.png"'), 'Must keep https URL intact');
      assert.ok(html.includes('src="data:image/png;base64,AAAA"'), 'Must keep existing data URI intact');
    });

    test('TC-EXP-010: missing local image does not crash conversion and preserves tag', async () => {
      const md = '![Missing](./non_existent_img_9999.png)';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('non_existent_img_9999.png'), 'Must keep missing image reference without crash');
    });

    test('TC-EXP-011: converts GFM strike and task lists in exported HTML', async () => {
      const md = '~~strike~~\n\n- [x] done task';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());

      assert.ok(html.includes('<del>strike</del>') || html.includes('<s>strike</s>'), 'Must convert strike');
      assert.ok(html.includes('type="checkbox"'), 'Must convert task item to checkbox');
    });

    test('TC-EXP-012: inlines local images with URL-encoded space (%20) in path', async () => {
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'temp-img-'));
      const imgPath = path.join(tempDir, 'my image.png');
      fs.writeFileSync(imgPath, Buffer.from('fake-png-content'));

      try {
        const md = '![Space Image](./my%20image.png)';
        const html = await convertMarkdownToStandaloneHtml(md, tempDir);
        assert.ok(html.includes('src="data:image/png;base64,'), 'Must resolve and inline URL-encoded image path');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('TC-EXP-013: inlines local images with single-quoted src attributes', async () => {
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'temp-img-'));
      const imgPath = path.join(tempDir, 'single.png');
      fs.writeFileSync(imgPath, Buffer.from('fake-png-content'));

      try {
        const md = "<img src='single.png' alt='single quote'>";
        const html = await convertMarkdownToStandaloneHtml(md, tempDir);
        assert.ok(html.includes('data:image/png;base64,'), 'Must inline single-quoted img tag');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('TC-EXP-014: extracts first H1 as document title in HTML head', async () => {
      const md = '# Antigravity Document\n\nSome body text.';
      const html = await convertMarkdownToStandaloneHtml(md, process.cwd());
      assert.ok(html.includes('<title>Antigravity Document</title>'), 'Must extract first H1 as document title');
    });

    test('TC-EXP-015: getDocumentText reads from file when document not in memory', async () => {
      const fakeUri = {
        fsPath: '/mock/workspace/test.md',
        toString: () => 'file:///mock/workspace/test.md',
      } as unknown as import('vscode').Uri;

      (vscode as unknown as { setMockFile: (uri: import('vscode').Uri, content: string) => void }).setMockFile(
        fakeUri,
        '# Hello Mock File',
      );

      const text = await getDocumentText(fakeUri);
      assert.strictEqual(text, '# Hello Mock File', 'Must read file content correctly via workspace.fs');
    });

    test('TC-EXP-016: blocks non-image files (.env, .pem, .txt) from being inlined as Base64', async () => {
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'temp-sec-'));
      const secretPath = path.join(tempDir, '.env');
      fs.writeFileSync(secretPath, 'SECRET_KEY=123456');

      try {
        const md = '![Secret](./.env)';
        const html = await convertMarkdownToStandaloneHtml(md, tempDir);
        assert.ok(!html.includes('data:image/'), 'Non-image file must not be inlined as data URI');
        assert.ok(html.includes('./.env'), 'Original path must be preserved without inlining');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('TC-EXP-017: uses os.tmpdir for fallback print HTML instead of polluting workspace', () => {
      assert.ok(
        exportCmdSrc.includes('os.tmpdir()'),
        'export-document.ts must use os.tmpdir() for print temporary HTML',
      );
    });
  });
});



