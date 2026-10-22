import assert from 'assert';
import {
  handleListAutoContinue,
  handleListIndent,
  toggleTaskList,
  toggleFormatting,
  handleSmartUrlPaste,
  extractHeadings,
  generateTableOfContents,
  updateOrInsertTableOfContents,
} from '../../../utils/editor-assist';

suite('editor-assist (TC-AST-001–007)', () => {
  suite('handleListAutoContinue (TC-AST-001 & TC-AST-002)', () => {
    test('continues bullet list on Enter (TC-AST-001)', () => {
      const doc = '- First item';
      const result = handleListAutoContinue(doc, doc.length);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '- First item\n- ');
      assert.strictEqual(result.newSelectionStart, result.updatedText.length);
    });

    test('increments ordered list number on Enter (TC-AST-001)', () => {
      const doc = '1. First item';
      const result = handleListAutoContinue(doc, doc.length);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '1. First item\n2. ');
    });

    test('preserves indentation for nested list items', () => {
      const doc = '  - Nested item';
      const result = handleListAutoContinue(doc, doc.length);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '  - Nested item\n  - ');
    });

    test('continues task list with empty checkbox [ ] (TC-AST-001)', () => {
      const doc = '- [x] Done item';
      const result = handleListAutoContinue(doc, doc.length);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '- [x] Done item\n- [ ] ');
    });

    test('terminates list when pressing Enter on empty item (TC-AST-002)', () => {
      const doc = '- Item 1\n- ';
      const result = handleListAutoContinue(doc, doc.length);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '- Item 1\n');
    });
  });

  suite('handleListIndent (TC-AST-003)', () => {
    test('indents list item with 2 spaces on Tab', () => {
      const doc = '- Item';
      const result = handleListIndent(doc, 2, 'indent');
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '  - Item');
    });

    test('outdents list item by removing leading 2 spaces on Shift+Tab', () => {
      const doc = '  - Item';
      const result = handleListIndent(doc, 4, 'outdent');
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '- Item');
    });
  });

  suite('toggleTaskList (TC-AST-004)', () => {
    test('toggles unchecked [ ] to checked [x]', () => {
      const doc = '- [ ] Task';
      const result = toggleTaskList(doc, 3);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '- [x] Task');
    });

    test('toggles checked [x] to unchecked [ ]', () => {
      const doc = '- [x] Task';
      const result = toggleTaskList(doc, 3);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '- [ ] Task');
    });

    test('converts regular bullet to task item', () => {
      const doc = '- Task';
      const result = toggleTaskList(doc, 2);
      assert.ok(result !== null);
      assert.strictEqual(result.updatedText, '- [ ] Task');
    });
  });

  suite('toggleFormatting (TC-AST-005)', () => {
    test('wraps selected text with bold (**)', () => {
      const doc = 'Hello world';
      const result = toggleFormatting(doc, 6, 11, '**');
      assert.strictEqual(result.updatedText, 'Hello **world**');
    });

    test('unwraps bold (**) if already wrapped', () => {
      const doc = 'Hello **world**';
      const result = toggleFormatting(doc, 6, 15, '**');
      assert.strictEqual(result.updatedText, 'Hello world');
    });

    test('inserts pair of delimiters if collapsed cursor', () => {
      const doc = 'Hello ';
      const result = toggleFormatting(doc, 6, 6, '**');
      assert.strictEqual(result.updatedText, 'Hello ****');
      assert.strictEqual(result.newSelectionStart, 8); // between ** and **
    });
  });

  suite('handleSmartUrlPaste (TC-AST-006)', () => {
    test('formats as [selectedText](url) when URL is pasted over selection', () => {
      const res = handleSmartUrlPaste('GitHub', 'https://github.com');
      assert.strictEqual(res, '[GitHub](https://github.com)');
    });

    test('returns null if pasted text is not a URL', () => {
      const res = handleSmartUrlPaste('Hello', 'plain text');
      assert.strictEqual(res, null);
    });

    test('returns null if selected text is empty', () => {
      const res = handleSmartUrlPaste('', 'https://github.com');
      assert.strictEqual(res, null);
    });

    test('returns null if selected text contains newlines', () => {
      const res = handleSmartUrlPaste('Line 1\nLine 2', 'https://github.com');
      assert.strictEqual(res, null);
    });

    test('replaces existing URL if selection is already a markdown link', () => {
      const res = handleSmartUrlPaste('[GitHub](https://old.com)', 'https://new.com');
      assert.strictEqual(res, '[GitHub](https://new.com)');
    });
  });

  suite('TOC Generation (TC-AST-007)', () => {
    const doc = `
# Title
## Section 1
### Detail
## Section 2
`.trim();

    test('extracts headings with levels and slugs', () => {
      const headings = extractHeadings(doc);
      assert.strictEqual(headings.length, 4);
      assert.strictEqual(headings[0].text, 'Title');
      assert.strictEqual(headings[0].slug, 'title');
      assert.strictEqual(headings[1].text, 'Section 1');
      assert.strictEqual(headings[1].slug, 'section-1');
    });

    test('cleans markdown formatting and links in heading text', () => {
      const markupDoc = `
# [Home Page](https://example.com)
## **Important** \`Code\` Note
## 日本語のセクション
`.trim();
      const headings = extractHeadings(markupDoc);
      assert.strictEqual(headings[0].text, 'Home Page');
      assert.strictEqual(headings[0].slug, 'home-page');
      assert.strictEqual(headings[1].text, 'Important Code Note');
      assert.strictEqual(headings[1].slug, 'important-code-note');
      assert.strictEqual(headings[2].text, '日本語のセクション');
      assert.strictEqual(headings[2].slug, '日本語のセクション');
    });

    test('generates markdown list structure for TOC', () => {
      const toc = generateTableOfContents(doc);
      assert.ok(toc.includes('- [Title](#title)'));
      assert.ok(toc.includes('  - [Section 1](#section-1)'));
      assert.ok(toc.includes('    - [Detail](#detail)'));
    });

    test('inserts or updates TOC block', () => {
      const result = updateOrInsertTableOfContents(doc);
      assert.ok(result.startsWith('<!-- TOC -->'));
      assert.ok(result.includes('<!-- /TOC -->'));

      // Update existing
      const updated = updateOrInsertTableOfContents(result);
      assert.strictEqual(updated, result);
    });
  });
});
