import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isBuiltinSwitchToSameMdFile } from '../../../utils/editor-switch-guard';

const WYSIWYG_VIEW_TYPE = 'vsc-md-editor.wysiwyg';

type MockTab = { input: unknown };

function packageJsonPath(): string {
  return path.resolve(process.cwd(), 'package.json');
}

suite('Editor switch guard (Pattern A)', () => {
  test('TC-083: detects built-in text editor on same .md URI', () => {
    const uri = vscode.Uri.file('/tmp/switch-test.md');
    const tab: MockTab = {
      input: new vscode.TabInputText(uri),
    };
    assert.strictEqual(
      isBuiltinSwitchToSameMdFile(uri, tab as vscode.Tab, WYSIWYG_VIEW_TYPE),
      true,
    );
  });

  test('TC-083: detects non-wysiwyg custom editor on same .md URI', () => {
    const uri = vscode.Uri.file('/tmp/switch-test.md');
    const tab: MockTab = {
      input: new vscode.TabInputCustom(uri, 'markdown.preview.editor'),
    };
    assert.strictEqual(
      isBuiltinSwitchToSameMdFile(uri, tab as vscode.Tab, WYSIWYG_VIEW_TYPE),
      true,
    );
  });

  test('TC-083: returns false when wysiwyg tab still active', () => {
    const uri = vscode.Uri.file('/tmp/switch-test.md');
    const tab: MockTab = {
      input: new vscode.TabInputCustom(uri, WYSIWYG_VIEW_TYPE),
    };
    assert.strictEqual(
      isBuiltinSwitchToSameMdFile(uri, tab as vscode.Tab, WYSIWYG_VIEW_TYPE),
      false,
    );
  });

  test('TC-083: returns false for different URI or missing tab', () => {
    const uri = vscode.Uri.file('/tmp/switch-test.md');
    const other = vscode.Uri.file('/tmp/other.md');
    const tab: MockTab = {
      input: new vscode.TabInputText(other),
    };
    assert.strictEqual(
      isBuiltinSwitchToSameMdFile(uri, tab as vscode.Tab, WYSIWYG_VIEW_TYPE),
      false,
    );
    assert.strictEqual(isBuiltinSwitchToSameMdFile(uri, undefined, WYSIWYG_VIEW_TYPE), false);
  });

  test('TC-084: package.json registers openWithWysiwyg command and configuration', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath(), 'utf8')) as {
      contributes: {
        commands: Array<{ command: string }>;
        configuration: { properties: Record<string, unknown> };
        menus: { 'editor/title': Array<{ command: string; when: string }> };
      };
    };

    const commands = pkg.contributes.commands.map((c) => c.command);
    assert.ok(commands.includes('vsc-md-editor.openWithWysiwyg'));

    assert.ok(
      pkg.contributes.configuration.properties['vsc-md-editor.autoRestoreOnBuiltinSwitch'],
    );

    const titleMenu = pkg.contributes.menus['editor/title'];
    const openMenu = titleMenu.find((m) => m.command === 'vsc-md-editor.openWithWysiwyg');
    assert.ok(openMenu);
    assert.ok(openMenu.when.includes('resourceExtname == .md'));
    assert.ok(openMenu.when.includes('activeCustomEditorId != vsc-md-editor.wysiwyg'));
  });
});
