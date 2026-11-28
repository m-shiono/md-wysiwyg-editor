import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  computeLineColumnFromOffset,
  countDocumentStats,
  estimateVisualLineNumber,
  formatStatusBarText,
  formatStatusBarTooltip,
} from '../../../utils/document-stats';
import { MarkdownEditorProvider } from '../../../providers/markdown-editor-provider';
import { MarpPreviewManager } from '../../../commands/marp-preview';
import type * as vscodeMockTypes from '../../mocks/vscode';

type VscodeTestShim = typeof vscode & typeof vscodeMockTypes;
const mockVscode = vscode as unknown as VscodeTestShim;

function makeCancellationToken(): vscode.CancellationToken {
  return new vscode.CancellationTokenSource().token;
}

suite('line-numbers-and-stats', () => {
  setup(() => {
    mockVscode.resetVscodeMock();
  });

  test('TC-STATS-001: countDocumentStats handles empty string', () => {
    const stats = countDocumentStats('');
    assert.strictEqual(stats.charCount, 0);
    assert.strictEqual(stats.wordCount, 0);
    assert.strictEqual(stats.lineCount, 1);
    assert.strictEqual(stats.selectedCharCount, 0);
    assert.strictEqual(stats.selectedWordCount, 0);
  });

  test('TC-STATS-002: countDocumentStats counts mixed English and Japanese', () => {
    const stats = countDocumentStats('Hello 世界\nテスト test');
    // 'Hello 世界' (8) + 'テスト test' (8) = 16 chars excluding newline
    assert.strictEqual(stats.charCount, 16);
    // Hello(1) + 世(1) + 界(1) + テ(1) + ス(1) + ト(1) + test(1) = 7 words
    assert.strictEqual(stats.wordCount, 7);
    assert.strictEqual(stats.lineCount, 2);
  });

  test('TC-STATS-003: countDocumentStats handles surrogate pairs and CRLF', () => {
    const stats = countDocumentStats('👍a\r\nb');
    assert.strictEqual(stats.charCount, 3);
    assert.strictEqual(stats.wordCount, 2);
    assert.strictEqual(stats.lineCount, 2);
  });

  test('TC-STATS-004: countDocumentStats counts selected text separately', () => {
    const stats = countDocumentStats('Hello world\n日本語テスト', 'world\n日本');
    assert.strictEqual(stats.selectedCharCount, 7);
    assert.strictEqual(stats.selectedWordCount, 3);
  });

  test('TC-STATS-005: computeLineColumnFromOffset computes 1-based line and column with clamping', () => {
    const text = 'abc\r\n日本語\nend';
    assert.deepStrictEqual(computeLineColumnFromOffset(text, -5), {
      line: 1,
      column: 1,
      lineCount: 3,
    });
    assert.deepStrictEqual(computeLineColumnFromOffset(text, 2), {
      line: 1,
      column: 3,
      lineCount: 3,
    });
    // Start of line 2 after \r\n (index 5)
    assert.deepStrictEqual(computeLineColumnFromOffset(text, 5), {
      line: 2,
      column: 1,
      lineCount: 3,
    });
    // After '日本' (index 7)
    assert.deepStrictEqual(computeLineColumnFromOffset(text, 7), {
      line: 2,
      column: 3,
      lineCount: 3,
    });
    assert.deepStrictEqual(computeLineColumnFromOffset(text, 999), {
      line: 3,
      column: 4,
      lineCount: 3,
    });
  });

  test('TC-STATS-006: estimateVisualLineNumber matches anchor text and falls back to ratio', () => {
    const md = '# Title\n\nFirst paragraph\n\n## Second\n\nTail text';
    assert.strictEqual(estimateVisualLineNumber(md, 'Second', 2, 4), 5);
    assert.strictEqual(estimateVisualLineNumber(md, 'nonexistent-anchor', 3, 4), 7);
    assert.strictEqual(estimateVisualLineNumber('', '', 0, 1), 1);
  });

  test('TC-STATS-007: formatStatusBarText and Tooltip format all modes with/without selection', () => {
    const base = countDocumentStats('one two\nthree', 'two');
    base.line = 2;
    base.column = 4;

    const rawText = formatStatusBarText(base, 'raw');
    assert.ok(rawText.includes('Ln 2, Col 4'));
    assert.ok(rawText.includes('12 chars (3 sel)'));
    assert.ok(rawText.includes('3 words (1 sel)'));

    const visualText = formatStatusBarText(base, 'markdown');
    assert.ok(visualText.includes('Ln 2 / 2'));

    const previewText = formatStatusBarText(base, 'preview');
    assert.ok(previewText.includes('2 lines'));

    const tooltip = formatStatusBarTooltip(base, 'raw');
    assert.ok(tooltip.includes('MD WYSIWYG Editor (Source)'));
    assert.ok(tooltip.includes('Selected: 3 chars, 1 words'));
  });

  test('TC-STATS-008 & TC-STATS-009: Provider updates StatusBarItem without dirtying and hides on dispose', async () => {
    const uri = vscode.Uri.file('/tmp/stats-test.md');
    mockVscode.setMockFile(uri, '# Heading\n\nHello 世界');
    const ctx = mockVscode.createMockExtensionContext(process.cwd());
    mockVscode.setMockConfiguration('md-wysiwyg-editor', { defaultMode: 'source' });

    const marpManager = new MarpPreviewManager(ctx as unknown as vscode.ExtensionContext);
    const provider = new MarkdownEditorProvider(
      ctx as unknown as vscode.ExtensionContext,
      marpManager,
    );

    const statusItems = mockVscode.__getStatusBarItems();
    assert.strictEqual(statusItems.length, 1);
    const statusItem = statusItems[0];

    const doc = await provider.openCustomDocument(
      uri,
      { backupId: undefined, untitledDocumentData: undefined },
      makeCancellationToken(),
    );
    const panel = mockVscode.window.createWebviewPanel(
      MarkdownEditorProvider.viewType,
      'stats-test.md',
      vscode.ViewColumn.One,
    ) as unknown as vscodeMockTypes.MockWebviewPanel;
    await provider.resolveCustomEditor(
      doc,
      panel as unknown as vscode.WebviewPanel,
      makeCancellationToken(),
    );

    panel.webview.simulateReceiveMessage({ type: 'ready' });
    await new Promise((r) => setTimeout(r, 15));

    panel.webview.simulateReceiveMessage({
      type: 'cursorStatus',
      mode: 'raw',
      line: 3,
      column: 7,
      selectedText: '世界',
    });
    await new Promise((r) => setTimeout(r, 15));

    assert.strictEqual(statusItem.visible, true);
    assert.ok(statusItem.text.includes('Ln 3, Col 7'));
    assert.ok(statusItem.text.includes('(2 sel)'));
    assert.strictEqual(doc.isDirty, false);

    // TC-STATS-010: HTML structure has #raw-line-numbers and #raw-editor-main
    assert.ok(panel.webview.html.includes('id="raw-line-numbers"'));
    assert.ok(panel.webview.html.includes('id="raw-editor-main"'));

    // Hide on panel deactivate / dispose
    panel.setActive(false);
    assert.strictEqual(statusItem.visible, false);

    panel.setActive(true);
    assert.strictEqual(statusItem.visible, true);

    panel.dispose();
    assert.strictEqual(statusItem.visible, false);
  });

  test('updateRaw refreshes StatusBarItem character and word counts immediately', async () => {
    const uri = vscode.Uri.file('/tmp/stats-update-raw.md');
    mockVscode.setMockFile(uri, 'Hi');
    const ctx = mockVscode.createMockExtensionContext(process.cwd());
    mockVscode.setMockConfiguration('md-wysiwyg-editor', { defaultMode: 'source' });

    const marpManager = new MarpPreviewManager(ctx as unknown as vscode.ExtensionContext);
    const provider = new MarkdownEditorProvider(
      ctx as unknown as vscode.ExtensionContext,
      marpManager,
    );
    const statusItem = mockVscode.__getStatusBarItems()[0];
    const doc = await provider.openCustomDocument(
      uri,
      { backupId: undefined, untitledDocumentData: undefined },
      makeCancellationToken(),
    );
    const panel = mockVscode.window.createWebviewPanel(
      MarkdownEditorProvider.viewType,
      'stats-update-raw.md',
      vscode.ViewColumn.One,
    ) as unknown as vscodeMockTypes.MockWebviewPanel;
    await provider.resolveCustomEditor(
      doc,
      panel as unknown as vscode.WebviewPanel,
      makeCancellationToken(),
    );

    panel.webview.simulateReceiveMessage({ type: 'ready' });
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(statusItem.text.includes('2 chars'));

    panel.webview.simulateReceiveMessage({
      type: 'updateRaw',
      markdown: 'Hello world',
    });
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(statusItem.text.includes('11 chars'));
    assert.ok(statusItem.text.includes('2 words'));
    panel.dispose();
  });
});
