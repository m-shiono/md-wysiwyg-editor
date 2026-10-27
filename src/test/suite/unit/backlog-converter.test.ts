import assert from 'assert';
import {
  markdownTableToBacklogTable,
  backlogTableToMarkdownTable,
  markdownToBacklog,
  backlogToMarkdown,
} from '../../../utils/backlog-converter';

suite('backlog-converter (TC-BL-001–006)', () => {
  suite('Table conversions (TC-BL-001, TC-BL-002)', () => {
    test('converts Markdown table to Backlog table with |h and alignments (TC-BL-001)', () => {
      const mdTable = `
| Name | Age | Department |
| :--- | :---: | ---: |
| Alice | 30 | Engineering |
| Bob | 25 | Sales |
`.trim();
      const backlogTable = markdownTableToBacklogTable(mdTable);
      const lines = backlogTable.split('\n');
      assert.strictEqual(lines.length, 3);
      assert.strictEqual(lines[0], '|Name|Age|Department|h');
      assert.strictEqual(lines[1], '|LEFT:Alice|CENTER:30|RIGHT:Engineering|');
      assert.strictEqual(lines[2], '|LEFT:Bob|CENTER:25|RIGHT:Sales|');
    });

    test('converts Backlog table to Markdown table restoring alignments (TC-BL-002)', () => {
      const backlogTable = `
|Name|Age|Department|h
|LEFT:Alice|CENTER:30|RIGHT:Engineering|
|LEFT:Bob|CENTER:25|RIGHT:Sales|
`.trim();
      const mdTable = backlogTableToMarkdownTable(backlogTable);
      const lines = mdTable.split('\n');
      assert.strictEqual(lines.length, 4); // Header, Delimiter, 2 data rows
      assert.strictEqual(lines[0].includes('Name'), true);
      // Verify delimiter row has left, center, right alignments
      const delimiterCells = lines[1].split('|').map((s) => s.trim()).filter((s) => s.length > 0);
      assert.strictEqual(delimiterCells.length, 3);
      assert.strictEqual(delimiterCells[0].startsWith(':') && !delimiterCells[0].endsWith(':'), true); // left
      assert.strictEqual(delimiterCells[1].startsWith(':') && delimiterCells[1].endsWith(':'), true); // center
      assert.strictEqual(!delimiterCells[2].startsWith(':') && delimiterCells[2].endsWith(':'), true); // right
      assert.strictEqual(lines[2].includes('Alice'), true);
      assert.strictEqual(lines[3].includes('Bob'), true);
    });

    test('handles Backlog table without explicit alignments', () => {
      const backlogTable = `
|Header 1|Header 2|h
|Value 1|Value 2|
`.trim();
      const mdTable = backlogTableToMarkdownTable(backlogTable);
      const lines = mdTable.split('\n');
      assert.strictEqual(lines.length, 3);
      assert.strictEqual(lines[1].includes('---'), true);
    });
  });

  suite('Document formatting conversions (TC-BL-003, TC-BL-004, TC-BL-005, TC-BL-006)', () => {
    test('converts headings (TC-BL-003)', () => {
      const md = '# H1 Title\n## H2 Title\n### H3 Title';
      const bl = markdownToBacklog(md);
      assert.strictEqual(bl, '* H1 Title\n** H2 Title\n*** H3 Title');

      const backToMd = backlogToMarkdown(bl);
      assert.strictEqual(backToMd, md);
    });

    test('converts bullet and numbered lists with nesting (TC-BL-003)', () => {
      const md = '- Item 1\n  - Item 1.1\n    - Item 1.1.1\n1. Step 1\n  1. Step 1.1';
      const bl = markdownToBacklog(md);
      assert.strictEqual(bl, '- Item 1\n-- Item 1.1\n--- Item 1.1.1\n+ Step 1\n++ Step 1.1');

      const backToMd = backlogToMarkdown(bl);
      assert.strictEqual(backToMd.includes('- Item 1'), true);
      assert.strictEqual(backToMd.includes('  - Item 1.1'), true);
      assert.strictEqual(backToMd.includes('1. Step 1'), true);
    });

    test('converts fenced code blocks preserving language (TC-BL-004)', () => {
      const md = '```typescript\nconst x = 1;\n```';
      const bl = markdownToBacklog(md);
      assert.strictEqual(bl, '{code:typescript}\nconst x = 1;\n{/code}');

      const backToMd = backlogToMarkdown(bl);
      assert.strictEqual(backToMd, md);
    });

    test('converts text decorations, blockquotes, and links (TC-BL-005)', () => {
      const md = '**bold** and ~~strike~~ and [Google](https://google.com)\n> quote line';
      const bl = markdownToBacklog(md);
      assert.strictEqual(bl.includes("''bold''"), true);
      assert.strictEqual(bl.includes('%%strike%%'), true);
      assert.strictEqual(bl.includes('[[Google>https://google.com]]'), true);
      assert.strictEqual(bl.includes('>>\nquote line\n<<'), true);

      const backToMd = backlogToMarkdown(bl);
      assert.strictEqual(backToMd.includes('**bold**'), true);
      assert.strictEqual(backToMd.includes('~~strike~~'), true);
      assert.strictEqual(backToMd.includes('[Google](https://google.com)'), true);
      assert.strictEqual(backToMd.includes('> quote line'), true);
    });

    test('converts composite document containing both markdown and table (TC-BL-006)', () => {
      const md = `
# System Overview

Here is the data:

| Name | Role |
| :--- | ---: |
| Alice | Admin |

\`\`\`json
{ "status": 200 }
\`\`\`
`.trim();

      const bl = markdownToBacklog(md);
      assert.strictEqual(bl.includes('* System Overview'), true);
      assert.strictEqual(bl.includes('|Name|Role|h'), true);
      assert.strictEqual(bl.includes('{code:json}'), true);

      const backToMd = backlogToMarkdown(bl);
      assert.strictEqual(backToMd.includes('# System Overview'), true);
      assert.match(backToMd, /\|\s*Name\s*\|\s*Role\s*\|/);
      assert.strictEqual(backToMd.includes('```json'), true);
    });
  });
});
