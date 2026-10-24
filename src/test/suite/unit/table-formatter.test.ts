import assert from 'assert';
import {
  calculateStringWidth,
  formatMarkdownTable,
  findTableBlockAtCursor,
  navigateTable,
} from '../../../utils/table-formatter';

suite('table-formatter (TC-TAB-001–009)', () => {
  suite('calculateStringWidth (TC-TAB-003)', () => {
    test('calculates ASCII half-width characters as 1', () => {
      assert.strictEqual(calculateStringWidth('Hello World'), 11);
      assert.strictEqual(calculateStringWidth('12345'), 5);
      assert.strictEqual(calculateStringWidth('|---|'), 5);
    });

    test('calculates full-width Japanese characters as 2', () => {
      assert.strictEqual(calculateStringWidth('こんにちは'), 10);
      assert.strictEqual(calculateStringWidth('漢字とかな'), 10);
      assert.strictEqual(calculateStringWidth('テスト123'), 9); // 3 full-width (6) + 3 ASCII (3) = 9
    });

    test('calculates emojis and SIP ideographs (surrogate pairs) as 2', () => {
      // 🍣 is U+1F363 (width 2)
      assert.strictEqual(calculateStringWidth('🍣寿司'), 6);
      // 𠮷 is U+20BB7 (width 2)
      assert.strictEqual(calculateStringWidth('𠮷野家'), 6);
    });

    test('ignores zero-width characters', () => {
      // zero-width space U+200B
      assert.strictEqual(calculateStringWidth('a\u200Bb'), 2);
    });
  });

  suite('formatMarkdownTable (TC-TAB-001 & TC-TAB-002)', () => {
    const unformattedTable = `
|Name|Age|City|
|---|---|---|
|Alice|24|Tokyo|
|Super Long Name|30|New York|
`.trim();

    test('formats table with fixed-length padding (aligned) (TC-TAB-001)', () => {
      const aligned = formatMarkdownTable(unformattedTable, 'aligned');
      const lines = aligned.split('\n');
      assert.strictEqual(lines.length, 4);
      // All lines should have pipes at exactly identical positions
      const pipePositions = (line: string) => {
        const positions: number[] = [];
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '|') positions.push(i);
        }
        return positions;
      };
      const firstLinePipes = pipePositions(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        assert.deepStrictEqual(pipePositions(lines[i]), firstLinePipes);
      }
    });

    test('formats table with minimal 1-space padding (compact) (TC-TAB-002)', () => {
      const compact = formatMarkdownTable(unformattedTable, 'compact');
      const lines = compact.split('\n');
      assert.strictEqual(lines[0], '| Name | Age | City |');
      assert.strictEqual(lines[1], '| --- | --- | --- |');
      assert.strictEqual(lines[2], '| Alice | 24 | Tokyo |');
      assert.strictEqual(lines[3], '| Super Long Name | 30 | New York |');
    });

    test('preserves alignment colons (:---, :---:, ---:)', () => {
      const alignTable = `
| Left | Center | Right |
| :--- | :---: | ---: |
| A | B | C |
`.trim();
      const formatted = formatMarkdownTable(alignTable, 'aligned');
      const lines = formatted.split('\n');
      assert.ok(/:---+/.test(lines[1]));
      assert.ok(/:---+:/.test(lines[1]));
      assert.ok(/---+:/.test(lines[1]));
    });

    test('does not split cell on pipe inside inline code span', () => {
      const codeTable = `
| Command | Result |
| --- | --- |
| \`cat file | grep text\` | success |
`.trim();
      const formatted = formatMarkdownTable(codeTable, 'compact');
      const lines = formatted.split('\n');
      assert.strictEqual(lines[2], '| `cat file | grep text` | success |');
    });

    test('handles escaped pipes without splitting cell (TC-TAB-011)', () => {
      const escapedTable = `
| Syntax | Description |
| --- | --- |
| A \\| B | escaped pipe symbol |
`.trim();
      const formatted = formatMarkdownTable(escapedTable, 'compact');
      const lines = formatted.split('\n');
      assert.strictEqual(lines[2], '| A \\| B | escaped pipe symbol |');
    });

    test('handles uneven columns and normalizes row lengths safely (TC-TAB-010)', () => {
      const unevenTable = `
| Col1 | Col2 | Col3 |
| --- | --- |
| Val1 |
| A | B | C | D |
`.trim();
      // Should not throw and should normalize table width
      assert.doesNotThrow(() => {
        const formatted = formatMarkdownTable(unevenTable, 'aligned');
        const lines = formatted.split('\n');
        assert.ok(lines.length >= 4);
        // Each formatted line must start and end with pipe
        for (const line of lines) {
          assert.ok(line.startsWith('|') && line.endsWith('|'));
        }
      });
    });
  });


  suite('findTableBlockAtCursor & navigateTable (TC-TAB-005–009)', () => {
    const sampleDoc = `
# Title

Some intro text.

| H1 | H2 | H3 |
| --- | --- | --- |
| A1 | A2 | A3 |
| B1 | B2 | B3 |

Some footer text.
`.trim();

    test('finds table block correctly when cursor is inside table', () => {
      const cursorOffset = sampleDoc.indexOf('A2');
      const block = findTableBlockAtCursor(sampleDoc, cursorOffset);
      assert.ok(block !== null);
      assert.strictEqual(block.cursorRow, 2); // header=0, delimiter=1, row1=2
      assert.strictEqual(block.cursorCol, 1); // 0-indexed column (A2 is col 1)
      assert.strictEqual(block.columnCount, 3);
    });

    test('returns null when cursor is outside table (TC-TAB-009)', () => {
      const cursorOffset = sampleDoc.indexOf('Some intro text.');
      const block = findTableBlockAtCursor(sampleDoc, cursorOffset);
      assert.strictEqual(block, null);
    });

    test('navigates to next cell on Tab (TC-TAB-006)', () => {
      const cursorOffset = sampleDoc.indexOf('A1');
      const result = navigateTable(sampleDoc, cursorOffset, 'next', 'aligned');
      assert.ok(result !== null);
      // New cursor should be at A2 cell
      const newCellText = result.updatedText.slice(result.newCursorOffset, result.newCursorOffset + 2);
      assert.strictEqual(newCellText, 'A2');
    });

    test('navigates to previous cell on Shift+Tab (TC-TAB-007)', () => {
      const cursorOffset = sampleDoc.indexOf('A2');
      const result = navigateTable(sampleDoc, cursorOffset, 'prev', 'aligned');
      assert.ok(result !== null);
      // New cursor should be at A1 cell
      const newCellText = result.updatedText.slice(result.newCursorOffset, result.newCursorOffset + 2);
      assert.strictEqual(newCellText, 'A1');
    });

    test('automatically adds a new row when pressing Tab at the last cell (TC-TAB-008)', () => {
      const cursorOffset = sampleDoc.indexOf('B3');
      const result = navigateTable(sampleDoc, cursorOffset, 'next', 'aligned');
      assert.ok(result !== null);
      // Result should have 5 table lines now (header + delimiter + row1 + row2 + row3)
      assert.ok(result.updatedText.includes('| B1'));
      const lines = result.updatedText.split('\n');
      const tableLines = lines.filter((l) => l.trim().startsWith('|'));
      assert.strictEqual(tableLines.length, 5);
    });

    test('preserves exact cursor position in cell when direction is stay', () => {
      const doc = `| Name | Age |\n| --- | --- |\n| Alice | 24 |`;
      // Cursor right after 'Ali' in 'Alice'
      const cursorOffset = doc.indexOf('Ali') + 3;
      const result = navigateTable(doc, cursorOffset, 'stay', 'aligned');
      assert.ok(result !== null);
      // New cursor must still be right after 'Ali'
      const textBefore = result.updatedText.slice(0, result.newCursorOffset);
      assert.ok(textBefore.endsWith('Ali'), `Cursor must remain after 'Ali'. Preceding: ${JSON.stringify(textBefore)}`);
      const textAfter = result.updatedText.slice(result.newCursorOffset);
      assert.ok(textAfter.startsWith('ce'), `Text after cursor must start with 'ce'. Got: ${JSON.stringify(textAfter)}`);
    });
  });
});

