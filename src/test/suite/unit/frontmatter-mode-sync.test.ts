import * as assert from 'assert';
import { readRepoFile } from '../../helpers/test-utils';

suite('frontmatter mode-sync (Webview contract)', () => {
  test('leaving markdown mode flushes frontmatter edits before UI switch', () => {
    const src = readRepoFile('media/editor.ts');
    assert.ok(
      src.includes('function flushFrontmatterEditsBeforeModeLeave'),
      'flush helper must exist',
    );
    assert.ok(
      /previousMode === "markdown" && mode !== "markdown"/.test(src),
      'setModeUi must flush when leaving markdown',
    );
    assert.ok(
      src.includes('flushFrontmatterEditsBeforeModeLeave()'),
      'flush must be invoked from setModeUi',
    );
    assert.ok(
      src.includes('node.type.name !== "frontmatter"'),
      'flush must sync every frontmatter node from DOM',
    );
  });

  test('frontmatter sync compares against live document attrs', () => {
    const src = readRepoFile('media/editor.ts');
    assert.ok(
      src.includes('tiptapEditor.state.doc.nodeAt(pos)'),
      'syncAttrs must read current node text from ProseMirror state',
    );
  });
});
