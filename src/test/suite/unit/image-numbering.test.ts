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

  test('TC-177: rejects advanced path traversal variants and non-image extensions', () => {
    // Intermediate directory traversal
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/sub/../../secret.png'), false);
    // URL-encoded directory traversal
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/%2e%2e/evil.png'), false);
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/..%2fevil.png'), false);
    // Windows backslash separator
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img\\..\\evil.png'), false);
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img\\image-0001.png'), false);
    // Absolute paths
    assert.strictEqual(isSafeImagePath('file:///a/b.md', '/etc/passwd'), false);
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'C:\\secret.png'), false);
    // Disallowed / sensitive file extensions
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/image-0001.env'), false);
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/image-0001.sh'), false);
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/image-0001.exe'), false);
    assert.strictEqual(isSafeImagePath('file:///a/b.md', 'img/image-0001'), false);
  });
});

