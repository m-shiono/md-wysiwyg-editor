import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_EDITOR_MODE,
  EditorModeState,
  resolveConfiguredEditorMode,
} from '../../../utils/editor-mode';

suite('default-editor-mode-config (TC-MODE-001–008)', () => {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  suite('TC-MODE-008: package.json configuration schema', () => {
    test('declares md-wysiwyg-editor.defaultMode configuration property', () => {
      const properties = pkg.contributes?.configuration?.properties;
      assert.ok(properties, 'contributes.configuration.properties must exist');
      const defaultModeProp = properties['md-wysiwyg-editor.defaultMode'];
      assert.ok(defaultModeProp, 'md-wysiwyg-editor.defaultMode must be defined');
      assert.strictEqual(defaultModeProp.type, 'string');
      assert.strictEqual(defaultModeProp.scope, 'resource');
      assert.deepStrictEqual(defaultModeProp.enum, ['source', 'visual', 'preview']);
      assert.strictEqual(defaultModeProp.default, 'visual');
      assert.ok(defaultModeProp.description, 'description must be provided');
    });
  });

  suite('TC-MODE-006: resolveConfiguredEditorMode mapping function', () => {
    test('maps "source" to "raw"', () => {
      assert.strictEqual(resolveConfiguredEditorMode('source'), 'raw');
    });

    test('maps "visual" to "markdown"', () => {
      assert.strictEqual(resolveConfiguredEditorMode('visual'), 'markdown');
    });

    test('maps "preview" to "preview"', () => {
      assert.strictEqual(resolveConfiguredEditorMode('preview'), 'preview');
    });

    test('TC-MODE-001: defaults to "markdown" when undefined or empty string', () => {
      assert.strictEqual(resolveConfiguredEditorMode(undefined), 'markdown');
      assert.strictEqual(resolveConfiguredEditorMode(''), 'markdown');
    });

    test('TC-MODE-005: falls back safely to "markdown" for invalid values', () => {
      assert.strictEqual(resolveConfiguredEditorMode('invalid-mode'), 'markdown');
      assert.strictEqual(resolveConfiguredEditorMode(null as unknown as string), 'markdown');
      assert.strictEqual(resolveConfiguredEditorMode(123 as unknown as string), 'markdown');
    });
  });

  suite('TC-MODE-001–005: EditorModeState initialization', () => {
    test('TC-MODE-001: EditorModeState defaults to DEFAULT_EDITOR_MODE ("markdown")', () => {
      assert.strictEqual(DEFAULT_EDITOR_MODE, 'markdown');
      const state = new EditorModeState();
      assert.strictEqual(state.mode, 'markdown');
    });

    test('TC-MODE-002: EditorModeState accepts initial mode "raw"', () => {
      const state = new EditorModeState('raw');
      assert.strictEqual(state.mode, 'raw');
    });

    test('TC-MODE-003: EditorModeState accepts initial mode "markdown"', () => {
      const state = new EditorModeState('markdown');
      assert.strictEqual(state.mode, 'markdown');
    });

    test('TC-MODE-004: EditorModeState accepts initial mode "preview"', () => {
      const state = new EditorModeState('preview');
      assert.strictEqual(state.mode, 'preview');
    });

    test('TC-MODE-007: manual mode switch does not affect state constructor defaults', () => {
      const state = new EditorModeState('markdown');
      state.setMode('raw');
      assert.strictEqual(state.mode, 'raw');
      const nextState = new EditorModeState();
      assert.strictEqual(nextState.mode, 'markdown');
    });
  });
});
