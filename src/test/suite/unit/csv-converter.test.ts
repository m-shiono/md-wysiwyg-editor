import assert from 'assert';
import {
  parseCsvToMatrix,
  formatMatrixToCsv,
  csvToMarkdownTable,
  markdownTableToCsv,
  detectDelimiter,
} from '../../../utils/csv-converter';

suite('csv-converter (TC-CSV-001–006)', () => {
  suite('detectDelimiter', () => {
    test('detects tab delimiter when tabs are prevalent', () => {
      assert.strictEqual(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
    });

    test('detects comma delimiter when commas are prevalent', () => {
      assert.strictEqual(detectDelimiter('a,b,c\n1,2,3'), ',');
    });
  });

  suite('parseCsvToMatrix (TC-CSV-001, TC-CSV-002, TC-CSV-003)', () => {
    test('parses simple comma-separated CSV (TC-CSV-001)', () => {
      const csv = 'Name,Age,City\nAlice,30,Tokyo\nBob,25,Osaka';
      const matrix = parseCsvToMatrix(csv);
      assert.deepStrictEqual(matrix, [
        ['Name', 'Age', 'City'],
        ['Alice', '30', 'Tokyo'],
        ['Bob', '25', 'Osaka'],
      ]);
    });

    test('parses TSV (tab separated) text (TC-CSV-002)', () => {
      const tsv = 'Item\tPrice\tQty\nApple\t100\t5\nBanana\t200\t3';
      const matrix = parseCsvToMatrix(tsv);
      assert.deepStrictEqual(matrix, [
        ['Item', 'Price', 'Qty'],
        ['Apple', '100', '5'],
        ['Banana', '200', '3'],
      ]);
    });

    test('handles quotes with commas, newlines, and escaped double quotes (TC-CSV-003)', () => {
      const csv = '"Name, Full","Bio with\nNewline","Quote ""Hello"""\n"Doe, John","Developer","Said ""OK"""';
      const matrix = parseCsvToMatrix(csv);
      assert.strictEqual(matrix.length, 2);
      assert.strictEqual(matrix[0][0], 'Name, Full');
      assert.strictEqual(matrix[0][1], 'Bio with<br />Newline'); // 改行は <br /> に正規化
      assert.strictEqual(matrix[0][2], 'Quote "Hello"');
      assert.strictEqual(matrix[1][0], 'Doe, John');
      assert.strictEqual(matrix[1][2], 'Said "OK"');
    });

    test('normalizes uneven row lengths by padding empty strings (TC-CSV-006)', () => {
      const csv = 'A,B,C\n1,2\n3,4,5,6';
      const matrix = parseCsvToMatrix(csv);
      assert.strictEqual(matrix.length, 3);
      // All rows should have 4 columns (max)
      assert.deepStrictEqual(matrix[0], ['A', 'B', 'C', '']);
      assert.deepStrictEqual(matrix[1], ['1', '2', '', '']);
      assert.deepStrictEqual(matrix[2], ['3', '4', '5', '6']);
    });
  });

  suite('formatMatrixToCsv', () => {
    test('formats matrix back to CSV quoting appropriately', () => {
      const matrix = [
        ['Name', 'Bio'],
        ['Alice', 'Line 1<br />Line 2'],
        ['Bob, Jr.', 'Says "Hi"'],
      ];
      const csv = formatMatrixToCsv(matrix);
      assert.strictEqual(
        csv,
        'Name,Bio\nAlice,"Line 1\nLine 2"\n"Bob, Jr.","Says ""Hi"""'
      );
    });
  });

  suite('csvToMarkdownTable (TC-CSV-001, TC-CSV-006)', () => {
    test('converts CSV to aligned Markdown table', () => {
      const csv = 'Name,Age,City\nAlice,30,Tokyo\nBob,25,Osaka';
      const md = csvToMarkdownTable(csv);
      const lines = md.split('\n');
      assert.strictEqual(lines.length, 4); // Header, Delimiter, 2 data rows
      assert.strictEqual(lines[0].includes('Name'), true);
      assert.strictEqual(lines[1].includes('---'), true);
      assert.strictEqual(lines[2].includes('Alice'), true);
      assert.strictEqual(lines[3].includes('Bob'), true);
    });

    test('single line CSV creates a table with an empty delimiter and data row if needed or minimal table', () => {
      const csv = 'Header1,Header2';
      const md = csvToMarkdownTable(csv);
      const lines = md.split('\n');
      assert.strictEqual(lines.length >= 2, true);
    });
  });

  suite('markdownTableToCsv (TC-CSV-004, TC-CSV-005)', () => {
    test('converts standard Markdown table to CSV (TC-CSV-004)', () => {
      const md = `
| Name | Age | City |
| :--- | :---: | ---: |
| Alice | 30 | Tokyo |
| Bob | 25 | Osaka |
`.trim();
      const csv = markdownTableToCsv(md);
      const lines = csv.split('\n');
      assert.strictEqual(lines.length, 3);
      assert.strictEqual(lines[0], 'Name,Age,City');
      assert.strictEqual(lines[1], 'Alice,30,Tokyo');
      assert.strictEqual(lines[2], 'Bob,25,Osaka');
    });

    test('escapes cells containing commas, quotes, and unescapes pipes (TC-CSV-004, TC-CSV-005)', () => {
      const md = `
| Name | Note |
| --- | --- |
| Doe, John | Contains \\| pipe and "quotes" |
`.trim();
      const csv = markdownTableToCsv(md);
      const lines = csv.split('\n');
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], 'Name,Note');
      assert.strictEqual(lines[1], '"Doe, John","Contains | pipe and ""quotes"""');
    });

    test('replaces <br /> in Markdown table cells with actual newlines in quoted CSV cell', () => {
      const md = `
| Title | Desc |
| --- | --- |
| Item | Line 1<br />Line 2 |
`.trim();
      const csv = markdownTableToCsv(md);
      assert.strictEqual(csv.includes('"Line 1\nLine 2"'), true);
    });
  });
});
