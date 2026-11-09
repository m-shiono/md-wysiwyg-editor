import * as assert from 'assert';
import { isMarpDocument } from '../../../utils/is-marp-document';

suite('is-marp-document (splitYamlFrontmatter integration)', () => {
  test('returns true when front matter contains marp: true', () => {
    assert.strictEqual(
      isMarpDocument('---\nmarp: true\n---\n\n# Slide\n'),
      true,
    );
    assert.strictEqual(
      isMarpDocument('---\nmarp: true\n---'),
      true,
      'closing fence without trailing newline',
    );
  });

  test('returns false for SKILL-style YAML front matter without marp', () => {
    assert.strictEqual(
      isMarpDocument('---\nname: skill\ndescription: test\n---\n\n## Body\n'),
      false,
    );
  });

  test('returns true for slide-style --- separators in body when marp flag absent', () => {
    const deck = ['---', 'theme: default', '---', '', '# One', '', '---', '', '# Two', ''].join(
      '\n',
    );
    assert.strictEqual(isMarpDocument(deck), true);
  });

  test('returns false when document has no leading front matter fence', () => {
    assert.strictEqual(isMarpDocument('# Plain\n'), false);
    assert.strictEqual(isMarpDocument('---\nnot a fence at EOF'), false);
  });

  test('handles CRLF in front matter and body', () => {
    const crlf = '---\r\nmarp: true\r\n---\r\n\r\n# S\r\n';
    assert.strictEqual(isMarpDocument(crlf), true);
  });

  test('strip BOM then detect marp front matter', () => {
    assert.strictEqual(isMarpDocument('\uFEFF---\nmarp: true\n---\n# x\n'), true);
  });
});
