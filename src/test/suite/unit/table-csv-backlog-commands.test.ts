import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...parts: string[]): string {
  const filePath = path.resolve(process.cwd(), ...parts);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

suite('table-csv-backlog-commands (TC-CMD-001–005)', () => {
  const packageJsonSrc = readRepoFile('package.json');
  const extensionTsSrc = readRepoFile('src/extension.ts');
  const commandsSrc = readRepoFile('src/commands/table-csv-backlog.ts');

  test('package.json declares CSV and Backlog commands', () => {
    const pkg = JSON.parse(packageJsonSrc);
    const commands = pkg.contributes?.commands ?? [];
    const cmdIds = commands.map((c: { command: string }) => c.command);

    assert.ok(cmdIds.includes('md-wysiwyg-editor.convertCsvToMarkdownTable'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.convertMarkdownTableToCsv'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.copyTableAsCsv'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.copyAsBacklog'));
    assert.ok(cmdIds.includes('md-wysiwyg-editor.pasteBacklogAsMarkdown'));
  });

  test('package.json registers editor/context menus for Markdown files', () => {
    const pkg = JSON.parse(packageJsonSrc);
    const contextMenus = pkg.contributes?.menus?.['editor/context'] ?? [];
    const contextCmds = contextMenus.map((m: { command: string }) => m.command);

    assert.ok(contextCmds.includes('md-wysiwyg-editor.convertCsvToMarkdownTable'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.convertMarkdownTableToCsv'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.copyTableAsCsv'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.copyAsBacklog'));
    assert.ok(contextCmds.includes('md-wysiwyg-editor.pasteBacklogAsMarkdown'));
  });

  test('extension.ts registers table CSV & Backlog commands', () => {
    assert.ok(
      extensionTsSrc.includes('registerTableCsvBacklogCommands'),
      'extension.ts must register table CSV & Backlog commands'
    );
  });

  test('table-csv-backlog.ts defines command implementations', () => {
    assert.ok(commandsSrc.includes('registerTableCsvBacklogCommands'));
    assert.ok(commandsSrc.includes('csvToMarkdownTable'));
    assert.ok(commandsSrc.includes('markdownTableToCsv'));
    assert.ok(commandsSrc.includes('markdownToBacklog'));
    assert.ok(commandsSrc.includes('backlogToMarkdown'));
  });
});
