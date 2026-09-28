import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getMarkdownEditorProvider } from '../../../utils/editor-provider-hook';

const VIEW_TYPE = 'md-wysiwyg-editor.wysiwyg';

function tipTapDocJson(paragraphText: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: paragraphText }] }],
  });
}

suite('Three-mode integration (AD-016)', () => {
  test('TC-080/082 integration: Preview RO, Markdown/Raw edit, Document sync', async () => {
    const ext = vscode.extensions.getExtension('mshiono.md-wysiwyg-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider();
    assert.ok(provider, 'MarkdownEditorProvider should be registered');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-wysiwyg-modes-'));
    const mdPath = path.join(tmpDir, 'modes-integration.md');
    fs.writeFileSync(mdPath, '# Title\n\nInitial body\n');
    const uri = vscode.Uri.file(mdPath);

    await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);
    await sleep(3500);

    assert.strictEqual(provider.getEditorMode(uri), 'raw', 'initial mode must be raw');

    const doc = provider.getOpenDocumentForTest(uri);
    assert.ok(doc, 'open document should be tracked');
    assert.ok(doc.markdownText.includes('Initial body'));

    // Preview: content updates must be rejected (strict RO at Host).
    await provider.deliverWebviewMessageForTest(uri, { type: 'setMode', editorMode: 'preview' });
    assert.strictEqual(provider.getEditorMode(uri), 'preview');

    const snapshotBeforePreviewEdit = doc.docJson;
    await provider.deliverWebviewMessageForTest(uri, {
      type: 'update',
      docJson: tipTapDocJson('Preview hack'),
    });
    assert.strictEqual(
      doc.docJson,
      snapshotBeforePreviewEdit,
      'Preview must not accept update messages',
    );

    // Markdown edit updates Document and Raw projection source.
    await provider.deliverWebviewMessageForTest(uri, { type: 'setMode', editorMode: 'markdown' });
    await provider.deliverWebviewMessageForTest(uri, {
      type: 'update',
      docJson: tipTapDocJson('Edited in Markdown'),
    });
    assert.ok(
      doc.markdownText.includes('Edited in Markdown'),
      'Markdown edit must update Document',
    );

    // Raw edit updates Document (Preview projection source).
    await provider.deliverWebviewMessageForTest(uri, { type: 'setMode', editorMode: 'raw' });
    await provider.deliverWebviewMessageForTest(uri, {
      type: 'updateRaw',
      markdown: '# Title\n\nEdited in Raw\n',
    });
    assert.ok(doc.markdownText.includes('Edited in Raw'), 'Raw edit must update Document');

    // Preview switch re-projects Document (mode + docJson outbound).
    await provider.deliverWebviewMessageForTest(uri, { type: 'setMode', editorMode: 'preview' });
    assert.strictEqual(provider.getEditorMode(uri), 'preview');
    assert.ok(doc.docJson.includes('Edited in Raw'), 'Preview source doc must match Document');

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
