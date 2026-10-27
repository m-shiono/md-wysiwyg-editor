import * as vscode from 'vscode';
import { csvToMarkdownTable, markdownTableToCsv } from '../utils/csv-converter';
import {
  markdownToBacklog,
  backlogToMarkdown,
  markdownTableToBacklogTable,
} from '../utils/backlog-converter';
import { findTableBlockAtCursor } from '../utils/table-formatter';

/**
 * Register CSV / Backlog format conversion commands.
 */
export function registerTableCsvBacklogCommands(
  _context: vscode.ExtensionContext
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // 1. Convert CSV / TSV to Markdown Table
  disposables.push(
    vscode.commands.registerCommand(
      'md-wysiwyg-editor.convertCsvToMarkdownTable',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);
        if (!text || text.trim().length === 0) {
          vscode.window.showWarningMessage(
            'Please select CSV or TSV text to convert into a Markdown table.'
          );
          return;
        }

        const mdTable = csvToMarkdownTable(text);
        if (!mdTable) {
          vscode.window.showErrorMessage('Failed to convert CSV/TSV to Markdown table.');
          return;
        }

        await editor.edit((editBuilder) => {
          editBuilder.replace(selection, mdTable);
        });
      }
    )
  );

  // 2. Convert Markdown Table to CSV
  disposables.push(
    vscode.commands.registerCommand(
      'md-wysiwyg-editor.convertMarkdownTableToCsv',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const document = editor.document;
        const selection = editor.selection;

        let tableText = '';
        let targetRange: vscode.Range;

        if (!selection.isEmpty) {
          tableText = document.getText(selection);
          targetRange = selection;
        } else {
          const offset = document.offsetAt(selection.active);
          const block = findTableBlockAtCursor(document.getText(), offset);
          if (!block) {
            vscode.window.showWarningMessage(
              'No Markdown table found at cursor position.'
            );
            return;
          }
          tableText = block.tableText;
          targetRange = new vscode.Range(
            document.positionAt(block.startOffset),
            document.positionAt(block.endOffset)
          );
        }

        const csvText = markdownTableToCsv(tableText);
        await editor.edit((editBuilder) => {
          editBuilder.replace(targetRange, csvText);
        });
      }
    )
  );

  // 3. Copy Table as CSV
  disposables.push(
    vscode.commands.registerCommand(
      'md-wysiwyg-editor.copyTableAsCsv',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const document = editor.document;
        const selection = editor.selection;

        let tableText = '';
        if (!selection.isEmpty) {
          tableText = document.getText(selection);
        } else {
          const offset = document.offsetAt(selection.active);
          const block = findTableBlockAtCursor(document.getText(), offset);
          if (!block) {
            vscode.window.showWarningMessage(
              'No Markdown table found at cursor position.'
            );
            return;
          }
          tableText = block.tableText;
        }

        const csvText = markdownTableToCsv(tableText);
        await vscode.env.clipboard.writeText(csvText);
        vscode.window.showInformationMessage('Table copied as CSV');
      }
    )
  );

  // 4. Copy as Backlog Format (Selection, Table at cursor, or full document)
  disposables.push(
    vscode.commands.registerCommand(
      'md-wysiwyg-editor.copyAsBacklog',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const document = editor.document;
        const selection = editor.selection;

        let backlogText = '';

        if (!selection.isEmpty) {
          const text = document.getText(selection);
          backlogText = markdownToBacklog(text);
        } else {
          const offset = document.offsetAt(selection.active);
          const block = findTableBlockAtCursor(document.getText(), offset);
          if (block) {
            backlogText = markdownTableToBacklogTable(block.tableText);
          } else {
            backlogText = markdownToBacklog(document.getText());
          }
        }

        await vscode.env.clipboard.writeText(backlogText);
        vscode.window.showInformationMessage('Copied as Backlog format');
      }
    )
  );

  // 5. Paste Backlog as Markdown
  disposables.push(
    vscode.commands.registerCommand(
      'md-wysiwyg-editor.pasteBacklogAsMarkdown',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const clipText = await vscode.env.clipboard.readText();
        if (!clipText || clipText.trim().length === 0) {
          vscode.window.showWarningMessage('Clipboard is empty.');
          return;
        }

        const mdText = backlogToMarkdown(clipText);
        await editor.edit((editBuilder) => {
          editBuilder.replace(editor.selection, mdText);
        });
      }
    )
  );

  return disposables;
}
