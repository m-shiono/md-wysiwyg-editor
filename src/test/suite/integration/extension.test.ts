import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getExtensionContext } from '../../../utils/extension-context';
import { getOutputChannel, OUTPUT_CHANNEL_NAME } from '../../../utils/logger';
import { getReadonlyKey, isReadonly, setReadonly } from '../../../utils/readonly-state';
import { NO_MARP_MESSAGE } from '../../../utils/marp-constants';
import { getWebviewCspContent } from '../../../utils/csp';

suite('Extension integration tests', () => {
  vscode.window.showInformationMessage('Start vsc-md-editor tests.');

  test('TC-001: extension activates and commands register', async () => {
    const ext = vscode.extensions.getExtension('vsc-md-editor.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('vsc-md-editor.toggleReadonly'));
    assert.ok(commands.includes('vsc-md-editor.showMarpPreview'));
    assert.ok(commands.includes('vsc-md-editor.openWithWysiwyg'));
    assert.ok(commands.includes('vsc-md-editor.reloadExtension'));
  });

  test('TC-025/TC-026: readonly toggle via workspaceState', async () => {
    const ext = vscode.extensions.getExtension('vsc-md-editor.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();

    const context = getExtensionContext();
    assert.ok(context, 'extension context should be set after activate');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-md-test-'));
    const mdPath = path.join(tmpDir, 'readonly-test.md');
    fs.writeFileSync(mdPath, '# RO Test\n');
    const uri = vscode.Uri.file(mdPath);

    await setReadonly(context, uri, false);
    assert.strictEqual(isReadonly(context, uri), false);

    await setReadonly(context, uri, true);
    assert.strictEqual(isReadonly(context, uri), true);

    await setReadonly(context, uri, false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('TC-028: readonly key format', () => {
    const uri = vscode.Uri.file('/tmp/test.md');
    assert.ok(getReadonlyKey(uri).startsWith('readonly:'));
  });

  test('TC-057: webview CSP uses default-src none', () => {
    const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-abc'" />`;
    const csp = getWebviewCspContent(html);
    assert.ok(csp?.includes("default-src 'none'"));
  });

  test('TC-062: output channel exists with correct name', async () => {
    const ext = vscode.extensions.getExtension('vsc-md-editor.vsc-md-editor');
    assert.ok(ext);
    await ext.activate();
    const channel = getOutputChannel();
    assert.strictEqual(channel.name, OUTPUT_CHANNEL_NAME);
  });

  test('TC-042: non-Marp guidance message constant', () => {
    assert.strictEqual(NO_MARP_MESSAGE, 'No Marp slides detected');
  });

  test('TC-003: open custom editor with sample markdown', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-md-open-'));
    const mdPath = path.join(tmpDir, 'sample.md');
    fs.writeFileSync(mdPath, '# Sample\n\nParagraph.\n');
    const uri = vscode.Uri.file(mdPath);

    await vscode.commands.executeCommand('vscode.openWith', uri, 'vsc-md-editor.wysiwyg');
    await sleep(2000);

    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const customTab = tabs.find(
      (t) => t.input instanceof vscode.TabInputCustom && t.input.viewType === 'vsc-md-editor.wysiwyg',
    );
    assert.ok(customTab, 'Custom editor tab should open');

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
