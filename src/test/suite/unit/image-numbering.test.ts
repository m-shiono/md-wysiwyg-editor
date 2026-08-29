import * as assert from 'assert';
import {
  formatImageFilename,
  getNextImageSequence,
  isSafeImagePath,
  mimeToExtension,
} from '../../../utils/image-numbering';

suite('Image numbering unit tests', () => {
  test('TC-044: next sequence is max plus one with gaps', () => {
    const next = getNextImageSequence(['image-0001.png', 'image-0003.png', 'other.txt']);
    assert.strictEqual(next, 4);
  });

  test('TC-044: first image is 0001', () => {
    assert.strictEqual(getNextImageSequence([]), 1);
    assert.strictEqual(formatImageFilename(1, 'png'), 'image-0001.png');
  });

  test('TC-045: mime maps to extension', () => {
    assert.strictEqual(mimeToExtension('image/png'), 'png');
    assert.strictEqual(mimeToExtension('image/jpeg'), 'jpg');
    assert.strictEqual(mimeToExtension('image/gif'), 'gif');
    assert.strictEqual(mimeToExtension('image/svg+xml'), 'svg');
  });

  test('TC-051: rejects path traversal', () => {
    assert.strictEqual(isSafeImagePath('file:///a/b.md', '../evil.png'), false);
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/image-0001.png'), true);
  });
});
