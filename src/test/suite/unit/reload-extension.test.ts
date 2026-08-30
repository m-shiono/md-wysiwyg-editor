import * as assert from 'assert';
import * as vscode from 'vscode';
import { reloadExtensionHost } from '../../../commands/reload-extension';

suite('reloadExtensionHost', () => {
  test('TC-085: reloadExtensionHost runs reload window command when confirmed', async () => {
    const executed: string[] = [];
    const originalShowWarning = vscode.window.showWarningMessage;
    const originalExecute = vscode.commands.executeCommand;

    vscode.window.showWarningMessage = (async () => 'Reload Plugin') as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await reloadExtensionHost();
      assert.deepStrictEqual(executed, ['workbench.action.reloadWindow']);
    } finally {
      vscode.window.showWarningMessage = originalShowWarning;
      vscode.commands.executeCommand = originalExecute;
    }
  });

  test('TC-085: reloadExtensionHost does nothing when cancelled', async () => {
    const executed: string[] = [];
    const originalShowWarning = vscode.window.showWarningMessage;
    const originalExecute = vscode.commands.executeCommand;

    vscode.window.showWarningMessage = (async () => undefined) as typeof vscode.window.showWarningMessage;
    vscode.commands.executeCommand = (async (command: string) => {
      executed.push(command);
      return undefined;
    }) as typeof vscode.commands.executeCommand;

    try {
      await reloadExtensionHost();
      assert.strictEqual(executed.length, 0);
    } finally {
      vscode.window.showWarningMessage = originalShowWarning;
      vscode.commands.executeCommand = originalExecute;
    }
  });
});
