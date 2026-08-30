import * as assert from 'assert';
import { shouldAcceptWebviewUpdate } from '../../../utils/webview-update-epoch';

suite('webview update epoch (HTML→GFM convert)', () => {
  test('TC-103: stale update with older epoch is dropped', () => {
    assert.strictEqual(shouldAcceptWebviewUpdate(undefined, 0), true);
    assert.strictEqual(shouldAcceptWebviewUpdate(0, 0), true);
    assert.strictEqual(shouldAcceptWebviewUpdate(1, 1), true);
    assert.strictEqual(shouldAcceptWebviewUpdate(0, 1), false);
    assert.strictEqual(shouldAcceptWebviewUpdate(undefined, 1), false);
    assert.strictEqual(shouldAcceptWebviewUpdate(2, 1), true);
  });
});
