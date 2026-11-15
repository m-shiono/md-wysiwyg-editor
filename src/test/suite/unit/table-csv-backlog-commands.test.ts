/**
 * TC-CMD-001–005 / TC-I31-016 / TC-I31-017: CSV / Backlog command registration and runtime execution.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerTableCsvBacklogCommands } from '../../../commands/table-csv-backlog';

type VscodeMockExtras = typeof vscode & {
  createMockExtensionContext: (extPath?: string) => vscode.ExtensionContext;
  createMockTextEditor: (
    uri: vscode.Uri,
    initialText: string,
    selection?: vscode.Selection,
  ) => {
    document: { uri: vscode.Uri; getText: () => string };
    selection: vscode.Selection;
  };
  getRecordedMessages: () => Array<{ level: 'info' | 'warn' | 'error'; message: string }>;
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

suite('table-csv-backlog-commands (TC-CMD-001–005 / TC-I31-016–017)', () => {
  const packageJsonSrc = readRepoFile('package.json');

  setup(() => {
    mockVscode.resetVscodeMock();
  });

  teardown(() => {
    mockVscode.resetVscodeMock();
  });

  test('package.json declares CSV and Backlog commands and editor/context menus', () => {
    const pkg = JSON.parse(packageJsonSrc);
    const commands = pkg.contributes?.commands ?? [];
    const cmdIds = commands.map((c: { command: string }) => c.command);

    assert.ok(cmdIds.includes('md-wysiwyg-editor.convertCsvToMarkdownTable'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.convertMarkdownTableToCsv'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.copyTableAsCsv'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.copyAsBacklog'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.pasteBacklogAsMarkdown'));

    const contextMenus = pkg.contributes?.menus?.['editor/context'] ?? [];
    const contextCmds = contextMenus.map((m: { command: string }) => m.command);
    assert.ok(contextCmds.includes('md-wysiwyg-editor.convertCsvToMarkdownTable'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.convertMarkdownTableToCsv'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.copyTableAsCsv'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.copyAsBacklog'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.pasteBacklogAsMarkdown'));
  });

  test('TC-I31-016: registerTableCsvBacklogCommands executes all 5 commands against activeTextEditor', async () => {
    const ctx = mockVscode.createMockExtensionContext();
    const disposables = registerTableCsvBacklogCommands(ctx);
    assert.strictEqual(disposables.length, 5);

    const uri = vscode.Uri.file('/tmp/csv-backlog.md');

    // 1. convertCsvToMarkdownTable
    const csvEditor = mockVscode.createMockTextEditor(
      uri,
      'Name,Role\nAlice,Dev\n',
      new vscode.Selection(0, 0, 1, 9),
    );
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = csvEditor;
    await vscode.commands.executeCommand('md-wysiwyg-editor.convertCsvToMarkdownTable');
    assert.ok(
      csvEditor.document.getText().includes('| Name') &&
        csvEditor.document.getText().includes('| Alice'),
      `Expected Markdown table replacement, got:\n${csvEditor.document.getText()}`,
    );

    // 2. convertMarkdownTableToCsv
    const mdTable = '| Name | Role |\n| --- | --- |\n| Bob | QA |\n';
    const mdEditor = mockVscode.createMockTextEditor(
      uri,
      mdTable,
      new vscode.Selection(0, 0, 0, 0),
    );
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = mdEditor;
    await vscode.commands.executeCommand('md-wysiwyg-editor.convertMarkdownTableToCsv');
    assert.strictEqual(mdEditor.document.getText().trim(), 'Name,Role\nBob,QA');

    // 3. copyTableAsCsv
    const copyEditor = mockVscode.createMockTextEditor(
      uri,
      mdTable,
      new vscode.Selection(0, 0, 0, 0),
    );
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = copyEditor;
    await vscode.commands.executeCommand('md-wysiwyg-editor.copyTableAsCsv');
    assert.strictEqual((await vscode.env.clipboard.readText()).trim(), 'Name,Role\nBob,QA');

    // 4. copyAsBacklog
    const backlogEditor = mockVscode.createMockTextEditor(
      uri,
      '# Heading\n\n- item\n',
      new vscode.Selection(0, 0, 0, 0),
    );
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = backlogEditor;
    await vscode.commands.executeCommand('md-wysiwyg-editor.copyAsBacklog');
    const backlogClip = await vscode.env.clipboard.readText();
    assert.ok(backlogClip.includes('* Heading'), `Expected Backlog heading, got:\n${backlogClip}`);

    // 5. pasteBacklogAsMarkdown
    await vscode.env.clipboard.writeText('* BacklogTitle\n- listItem');
    const pasteEditor = mockVscode.createMockTextEditor(
      uri,
      '',
      new vscode.Selection(0, 0, 0, 0),
    );
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = pasteEditor;
    await vscode.commands.executeCommand('md-wysiwyg-editor.pasteBacklogAsMarkdown');
    assert.ok(
      pasteEditor.document.getText().includes('# BacklogTitle'),
      `Expected Markdown heading from Backlog paste, got:\n${pasteEditor.document.getText()}`,
    );

    disposables.forEach((d) => d.dispose());
  });

  test('TC-I31-017: UD-001 Option A shows guidance notice when Custom Editor is active instead of silent no-op', async () => {
    const ctx = mockVscode.createMockExtensionContext();
    const disposables = registerTableCsvBacklogCommands(ctx);

    const uri = vscode.Uri.file('/tmp/custom-active.md');
    (vscode.window as unknown as { activeTextEditor: undefined }).activeTextEditor = undefined;
    (vscode.window.tabGroups.activeTabGroup as unknown as { activeTab: unknown }).activeTab = {
      input: new vscode.TabInputCustom(uri, 'md-wysiwyg-editor.wysiwyg'),
    } as unknown as vscode.Tab;

    const cmds = [
      'md-wysiwyg-editor.convertCsvToMarkdownTable',
      'md-wysiwyg-editor.convertMarkdownTableToCsv',
      'md-wysiwyg-editor.copyTableAsCsv',
      'md-wysiwyg-editor.pasteBacklogAsMarkdown',
    ];

    for (const cmd of cmds) {
      const beforeCount = mockVscode.getRecordedMessages().length;
      await vscode.commands.executeCommand(cmd);
      const added = mockVscode.getRecordedMessages().slice(beforeCount);
      assert.ok(
        added.some((m) => m.level === 'info' || m.level === 'warn'),
        `${cmd} must display guidance notification (not silent no-op) when Custom Editor is active`,
      );
    }

    // copyAsBacklog: either copies MarkdownDocument full text OR shows guidance notice (never silent no-op)
    const beforeBacklog = mockVscode.getRecordedMessages().length;
    await vscode.env.clipboard.writeText('');
    await vscode.commands.executeCommand('md-wysiwyg-editor.copyAsBacklog');
    const backlogMsgs = mockVscode.getRecordedMessages().slice(beforeBacklog);
    const clip = await vscode.env.clipboard.readText();
    assert.ok(
      backlogMsgs.some((m) => m.level === 'info' || m.level === 'warn') || clip.length > 0,
      'copyAsBacklog must not silently no-op when Custom Editor is active',
    );

    disposables.forEach((d) => d.dispose());
  });
});
