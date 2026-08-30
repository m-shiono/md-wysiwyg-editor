import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getMarkdownEditorProvider } from '../../../utils/editor-provider-hook';

const VIEW_TYPE = 'vsc-md-editor.wysiwyg';

suite('Table HTML→GFM convert integration', () => {
  test('TC-102/103: requestConvertToGfm updates markdownText; stale HTML update is dropped', async () => {
    const ext = vscode.extensions.getExtension('vsc-md-editor.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const provider = getMarkdownEditorProvider();
    assert.ok(provider, 'MarkdownEditorProvider should be registered');

    const md =
      '| a | a |\n| --- | --- |\n| x | y |\n\n' +
      '<table><tr><th>h</th></tr><tr><td>html-cell</td></tr></table>\n\n' +
      '| b | b |\n| --- | --- |\n| c | d |\n';

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-md-table-convert-'));
    const mdPath = path.join(tmpDir, 'table-convert.md');
    fs.writeFileSync(mdPath, md);
    const uri = vscode.Uri.file(mdPath);

    const originalShowWarning = vscode.window.showWarningMessage;
    vscode.window.showWarningMessage = (async () => '変換') as typeof vscode.window.showWarningMessage;

    try {
      await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);
      await sleep(3500);

      const doc = provider.getOpenDocumentForTest(uri);
      assert.ok(doc, 'open document should be tracked');
      assert.ok(doc.markdownText.includes('<table>'), 'precondition: HTML table in source');

      const htmlJson = doc.docJson;

      await provider.deliverWebviewMessageForTest(uri, {
        type: 'requestConvertToGfm',
        tableIndex: 1,
        docJson: htmlJson,
        epoch: 1,
      });

      assert.ok(
        !doc.markdownText.includes('<table>'),
        `markdownText must serialize GFM after convert; got:\n${doc.markdownText}`,
      );
      assert.ok(doc.markdownText.includes('html-cell'));

      await provider.deliverWebviewMessageForTest(uri, {
        type: 'update',
        docJson: htmlJson,
        epoch: 0,
      });

      assert.ok(
        !doc.markdownText.includes('<table>'),
        `stale HTML update must not restore <table>; got:\n${doc.markdownText}`,
      );
    } finally {
      vscode.window.showWarningMessage = originalShowWarning;
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
