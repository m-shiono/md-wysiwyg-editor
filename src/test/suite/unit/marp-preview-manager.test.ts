import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarpPreviewManager, registerMarpPreviewCommand } from '../../../commands/marp-preview';
import { NO_MARP_MESSAGE } from '../../../utils/marp-constants';
import { getWebviewCspContent } from '../../../utils/csp';

type VscodeMockExtras = typeof vscode & {
  createMockExtensionContext: (extPath?: string) => vscode.ExtensionContext;
  getCreatedWebviewPanels: () => Array<{
    viewType: string;
    title: string;
    webview: {
      html: string;
      options: { enableScripts?: boolean; localResourceRoots?: vscode.Uri[] };
      cspSource: string;
    };
    dispose: () => void;
  }>;
  setMockFile: (uri: vscode.Uri, content: string) => void;
  resetVscodeMock: () => void;
};

const vscodeExt = vscode as unknown as VscodeMockExtras;

suite('MarpPreviewManager Tests (TC-I31-023 / TC-I31-029)', () => {
  setup(() => {
    vscodeExt.resetVscodeMock();
  });

  teardown(() => {
    vscodeExt.resetVscodeMock();
  });

  test('TC-I31-023: MarpPreviewManager shows Marp slides, updates content, handles non-Marp guidance, and disposes', async () => {
    const ctx = vscodeExt.createMockExtensionContext('/tmp/ext');
    const manager = new MarpPreviewManager(ctx);
    const mdUri = vscode.Uri.file('/tmp/slides/deck.md');

    const marpMd = '---\nmarp: true\n---\n\n# Slide One\n\n---\n\n# Slide Two\n';
    await manager.show(mdUri, marpMd);

    const panels = vscodeExt.getCreatedWebviewPanels();
    assert.strictEqual(panels.length, 1);
    const panel = panels[0];
    assert.strictEqual(panel.title, 'Marp Preview — deck.md');
    assert.ok(panel.webview.html.includes('Slide One'));
    assert.ok(panel.webview.html.includes('Slide Two'));

    // Updating with different content for active URI refreshes HTML
    await manager.updatePreview(mdUri, '---\nmarp: true\n---\n\n# Slide Updated\n');
    assert.ok(panel.webview.html.includes('Slide Updated'));

    // Updating a different URI does not overwrite current preview
    await manager.updatePreview(vscode.Uri.file('/tmp/slides/other.md'), '---\nmarp: true\n---\n\n# Wrong\n');
    assert.ok(panel.webview.html.includes('Slide Updated'));

    // Non-Marp markdown displays NO_MARP_MESSAGE guidance without throwing
    await manager.show(mdUri, '# Plain Markdown\n\nNo marp frontmatter.');
    assert.ok(panel.webview.html.includes(NO_MARP_MESSAGE));

    // Disposing resets panel so a subsequent show creates a fresh panel
    panel.dispose();
    await manager.show(mdUri, marpMd);
    assert.strictEqual(vscodeExt.getCreatedWebviewPanels().length, 2);
  });

  test('TC-I31-023b: registerMarpPreviewCommand executes for active markdown file', async () => {
    const ctx = vscodeExt.createMockExtensionContext('/tmp/ext');
    const manager = new MarpPreviewManager(ctx);
    const disposable = registerMarpPreviewCommand(ctx, manager);
    try {
      const mdUri = vscode.Uri.file('/tmp/deck-cmd/preso.md');
      const content = '---\nmarp: true\n---\n\n# Command Slide\n';
      vscodeExt.setMockFile(mdUri, content);
      (vscode.window as unknown as { tabGroups: { activeTabGroup: { activeTab: unknown } } })
        .tabGroups.activeTabGroup.activeTab = {
          label: 'preso.md',
          input: new vscode.TabInputCustom(mdUri, 'md-wysiwyg-editor.markdownEditor'),
        };

      await vscode.commands.executeCommand('md-wysiwyg-editor.showMarpPreview');
      const panels = vscodeExt.getCreatedWebviewPanels();
      assert.strictEqual(panels.length, 1);
      assert.ok(panels[0].webview.html.includes('Command Slide'));
    } finally {
      disposable.dispose();
    }
  });

  test('TC-I31-029: MarpPreviewManager enforces enableScripts false, localResourceRoots media+img, and CSP img-src cspSource', async () => {
    const ctx = vscodeExt.createMockExtensionContext('/tmp/ext');
    const manager = new MarpPreviewManager(ctx);
    const mdUri = vscode.Uri.file('/tmp/workspace/notes/deck.md');
    const marpWithImage = '---\nmarp: true\n---\n\n# Slide\n\n![diagram](img/diagram.png)\n';

    await manager.show(mdUri, marpWithImage);
    const panels = vscodeExt.getCreatedWebviewPanels();
    assert.strictEqual(panels.length, 1);
    const { options, html, cspSource } = panels[0].webview;

    assert.strictEqual(options.enableScripts, false, 'Marp Preview must keep enableScripts: false');

    const roots = (options.localResourceRoots ?? []).map((u) => u.fsPath);
    assert.ok(roots.some((r) => r.endsWith('/media')), 'localResourceRoots must include extension media/');
    assert.ok(
      roots.some((r) => r.includes('/tmp/workspace/notes/img')),
      'TC-I31-029: localResourceRoots must include document img/ directory so local Marp images load',
    );

    const csp = getWebviewCspContent(html) ?? '';
    assert.ok(csp.includes("default-src 'none'"), 'CSP must restrict default-src to none');
    assert.ok(
      csp.includes(`img-src`) && csp.includes(cspSource),
      `TC-I31-029: CSP img-src must allow webview.cspSource (${cspSource}), got: ${csp}`,
    );
    assert.ok(html.includes(encodeURIComponent('img/diagram.png')) || html.includes('vscode-cdn.net'));
  });
});
