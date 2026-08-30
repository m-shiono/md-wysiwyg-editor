import * as assert from 'assert';
import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MarkdownDocument } from '../../../providers/markdown-document';
import { convertTableToGfmAtIndex } from '../../../utils/table-convert';
import { docToJson, parseMarkdown, serializeMarkdown } from '../../../serializers/markdown-serializer';

type VscodeTestShim = typeof vscode & {
  setMockFile: (uri: vscode.Uri, content: string) => void;
  clearMockFiles: () => void;
};

const mockVscode = vscode as VscodeTestShim;

suite('MarkdownDocument content-change signaling', () => {
  teardown(() => {
    mockVscode.clearMockFiles();
  });

  async function openDoc(markdown: string): Promise<MarkdownDocument> {
    const uri = vscode.Uri.file('/tmp/regression-edit-display.md');
    mockVscode.setMockFile(uri, markdown);
    const doc = await MarkdownDocument.create(uri, undefined);
    assert.ok(doc, 'document should open');
    return doc!;
  }

  test('TC-067: webview-originated update does not fire onDidContentChange', async () => {
    const doc = await openDoc('# Title\n\nHello\n');
    let contentChangeCount = 0;
    let dirtyChangeCount = 0;
    doc.onDidContentChange(() => {
      contentChangeCount += 1;
    });
    doc.onDidChange(() => {
      dirtyChangeCount += 1;
    });

    const next = parseMarkdown('# Title\n\nHello world\n');
    doc.updateFromJson(docToJson(next), 'Edit', { syncWebview: false });

    assert.strictEqual(contentChangeCount, 0, 'webview update must not echo setContent path');
    assert.ok(dirtyChangeCount >= 1, 'dirty edit event must still fire');
    assert.ok(doc.markdownText.includes('Hello world'));
    doc.dispose();
  });

  test('TC-068: default update and undo notify onDidContentChange', async () => {
    const doc = await openDoc('# Title\n\nHello\n');
    let contentChangeCount = 0;
    doc.onDidContentChange(() => {
      contentChangeCount += 1;
    });

    let undoFn: (() => PromiseLike<void> | void) | undefined;
    doc.onDidChange((event) => {
      undoFn = event.undo;
    });

    const next = parseMarkdown('# Title\n\nExternal sync\n');
    doc.updateDoc(next, 'Edit');
    assert.strictEqual(contentChangeCount, 1, 'default update must notify webview sync listeners');

    assert.ok(undoFn, 'undo handler should be registered');
    await undoFn!();
    assert.strictEqual(contentChangeCount, 2, 'undo must notify webview sync listeners');
    doc.dispose();
  });

  test('TC-101: updateDoc after html-to-gfm updates markdownText for Raw projection', async () => {
    const testMdPath = join(__dirname, '../../../../../temporary/test.md');
    let md: string;
    try {
      md = readFileSync(testMdPath, 'utf8');
    } catch {
      md =
        '| a | a |\n| --- | --- |\n| x | y |\n\n' +
        '<table><tr><th>h</th></tr><tr><td>html-cell</td></tr></table>\n\n' +
        '| b | b |\n| --- | --- |\n| c | d |\n';
    }

    const doc = await openDoc(md);
    const htmlIndex = doc.doc.content
      .filter((n) => n.type === 'table')
      .findIndex((t) => t.attrs?.tableFormat === 'html');
    assert.strictEqual(htmlIndex, 1, 'HTML table index must be 1 in test.md layout');

    assert.ok(doc.markdownText.includes('<table>'), 'precondition: Raw source contains HTML table');

    doc.updateDoc(convertTableToGfmAtIndex(doc.doc, htmlIndex), 'Convert table to GFM');

    assert.ok(
      !doc.markdownText.includes('<table>'),
      `markdownText must lose HTML table after convert; got:\n${doc.markdownText}`,
    );
    assert.ok(doc.markdownText.includes('html-cell') || doc.markdownText.includes('あああ'));
    doc.dispose();
  });
});

suite('Mermaid model survival across ordinary edits', () => {
  test('TC-069: mermaid fence survives paragraph text change round-trip', () => {
    const md = '# Doc\n\nBefore edit.\n\n```mermaid\ngraph TD; A-->B\n```\n';
    const doc = parseMarkdown(md);
    const paragraph = doc.content.find((n) => n.type === 'paragraph');
    assert.ok(paragraph, 'paragraph node should exist');
    paragraph!.content = [{ type: 'text', text: 'After ordinary edit.' }];

    const serialized = serializeMarkdown(doc);
    assert.ok(serialized.includes('```mermaid'), 'mermaid fence must remain');
    assert.ok(serialized.includes('graph TD; A-->B'), 'mermaid source must remain');
    assert.ok(serialized.includes('After ordinary edit.'));
  });
});
