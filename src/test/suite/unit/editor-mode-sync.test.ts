import * as assert from 'assert';
import { buildModeSwitchMessages, shouldProjectDocJsonOnModeSwitch } from '../../../utils/editor-mode-sync';

suite('Editor mode sync projection (AD-016)', () => {
  const docJson = '{"type":"doc","content":[]}';
  const markdownText = '# Title\n\nHello\n';

  test('TC-080: Preview mode switch re-projects docJson from Document', () => {
    assert.strictEqual(shouldProjectDocJsonOnModeSwitch('preview'), true);
    const messages = buildModeSwitchMessages('preview', docJson, markdownText);
    assert.strictEqual(messages.length, 2);
    assert.deepStrictEqual(messages[0], { type: 'modeChanged', editorMode: 'preview' });
    assert.deepStrictEqual(messages[1], {
      type: 'docUpdated',
      docJson,
      markdownText,
    });
  });

  test('TC-080: Markdown mode switch re-projects docJson from Document', () => {
    assert.strictEqual(shouldProjectDocJsonOnModeSwitch('markdown'), true);
    const messages = buildModeSwitchMessages('markdown', docJson, markdownText);
    assert.ok(messages.some((m) => m.type === 'docUpdated' && 'docJson' in m && m.docJson === docJson));
  });

  test('TC-081: Raw mode switch projects markdownText only', () => {
    assert.strictEqual(shouldProjectDocJsonOnModeSwitch('raw'), false);
    const messages = buildModeSwitchMessages('raw', docJson, markdownText);
    assert.strictEqual(messages.length, 2);
    assert.deepStrictEqual(messages[1], { type: 'docUpdated', markdownText });
    assert.ok(!('docJson' in messages[1]!));
  });
});
