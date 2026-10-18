/**
 * TC-160–165: Table context menu in Visual mode (table-context-menu).
 * Strict TDD Red — Webview HTML, CSS, and editor.ts implementation will satisfy these tests.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

suite('table-context-menu (TC-160–165)', () => {
  const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
  const editorTsSrc = readRepoFile('media/editor.ts');
  const editorCssSrc = readRepoFile('media/editor.css');

  suite('TC-160: HTML structure and initial state', () => {
    test('HTML includes #table-context-menu with role="menu" and class hidden', () => {
      assert.ok(
        providerSrc.includes('id="table-context-menu"'),
        '#table-context-menu element must exist in markdown-editor-provider',
      );
      assert.ok(
        /<div\s+id="table-context-menu"[^>]*class="[^"]*hidden[^"]*"/.test(providerSrc),
        '#table-context-menu must have hidden class',
      );
      assert.ok(
        /<div\s+id="table-context-menu"[^>]*role="menu"/.test(providerSrc),
        '#table-context-menu must have role="menu"',
      );
    });

    test('contains all required row and column operations in English', () => {
      const match = providerSrc.match(/<div id="table-context-menu"[\s\S]*?<\/div>/);
      assert.ok(match, '#table-context-menu block must be extracted');
      const menuHtml = match[0];

      const expectedOps = [
        { op: 'addRowBefore', label: 'Add row above' },
        { op: 'addRowAfter', label: 'Add row below' },
        { op: 'deleteRow', label: 'Delete row' },
        { op: 'addColumnBefore', label: 'Add column left' },
        { op: 'addColumnAfter', label: 'Add column right' },
        { op: 'deleteColumn', label: 'Delete column' },
        { op: 'deleteTable', label: 'Delete table' },
      ];

      for (const { op, label } of expectedOps) {
        assert.ok(
          menuHtml.includes(`data-table-op="${op}"`),
          `Context menu must include data-table-op="${op}"`,
        );
        assert.ok(
          menuHtml.includes(label),
          `Context menu item for ${op} must have label "${label}"`,
        );
      }
    });

    test('has separators between row ops, column ops, and table deletion', () => {
      const match = providerSrc.match(/<div id="table-context-menu"[\s\S]*?<\/div>/);
      assert.ok(match, '#table-context-menu block must be extracted');
      const menuHtml = match[0];
      const separatorCount = (menuHtml.match(/class="[^"]*toolbar-dropdown-sep[^"]*"|<hr/g) || []).length;
      assert.ok(separatorCount >= 2, 'Must have at least 2 separators in context menu');
    });
  });

  suite('TC-161 & TC-162: Event handling and operations binding in editor.ts', () => {
    test('registers contextmenu listener for table cell targets', () => {
      assert.ok(
        editorTsSrc.includes('"contextmenu"') || editorTsSrc.includes("'contextmenu'"),
        'editor.ts must register contextmenu event listener',
      );
      assert.ok(
        editorTsSrc.includes('closest("td, th")') ||
        editorTsSrc.includes("closest('td, th')") ||
        editorTsSrc.includes('target.tagName === "TD"') ||
        editorTsSrc.includes('target.closest("table")'),
        'contextmenu handler must target table cells / table',
      );
    });

    test('dispatches operations to handleTableOperation on click', () => {
      assert.ok(
        editorTsSrc.includes('handleTableOperation'),
        'handleTableOperation must be used for executing table operations',
      );
      assert.ok(
        editorTsSrc.includes('closeTableContextMenu') ||
        editorTsSrc.includes('tableContextMenu'),
        'context menu close/open helpers must exist in editor.ts',
      );
    });
  });

  suite('TC-163: Menu dismissal conditions', () => {
    test('handles Escape key to close context menu', () => {
      assert.ok(
        editorTsSrc.includes('"Escape"') || editorTsSrc.includes("'Escape'"),
        'editor.ts must handle Escape key to close the context menu',
      );
    });

    test('closes on external click or window blur/resize/scroll', () => {
      assert.ok(
        editorTsSrc.includes('closeTableContextMenu') ||
        editorTsSrc.includes('table-context-menu'),
        'editor.ts must dismiss context menu on external events',
      );
    });
  });

  suite('TC-164 & TC-165: Guards for Readonly and Non-Markdown modes', () => {
    test('guards against opening context menu when readonly is true or editorMode is not markdown', () => {
      assert.ok(
        editorTsSrc.includes('readonly') && editorTsSrc.includes('editorMode'),
        'editor.ts must check readonly and editorMode before opening context menu',
      );
    });
  });

  suite('Styling in editor.css', () => {
    test('defines fixed/absolute positioning and styling for #table-context-menu', () => {
      assert.ok(
        editorCssSrc.includes('#table-context-menu') ||
        editorCssSrc.includes('.table-context-menu'),
        'editor.css must define styling for #table-context-menu',
      );
    });
  });
});
