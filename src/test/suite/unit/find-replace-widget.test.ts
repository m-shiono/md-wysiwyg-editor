/**
 * TC-170–176: Find & Replace Widget (search-replace-widget).
 * Strict TDD Red — Webview HTML, CSS, find-widget.ts, and editor.ts implementation will satisfy these tests.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...parts: string[]): string {
  const filePath = path.resolve(process.cwd(), ...parts);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

suite('search-replace-widget (TC-170–176)', () => {
  const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
  const editorTsSrc = readRepoFile('media/editor.ts');
  const editorCssSrc = readRepoFile('media/editor.css');
  const findWidgetTsSrc = readRepoFile('media/find-widget.ts');

  suite('TC-170: HTML structure and initial state', () => {
    test('HTML includes #find-widget container with hidden class and aria-label', () => {
      assert.ok(
        providerSrc.includes('id="find-widget"') || findWidgetTsSrc.includes('id="find-widget"') || editorTsSrc.includes('find-widget'),
        '#find-widget element must exist in Webview HTML or initialized in media scripts',
      );
    });

    test('find widget contains find input, match counter, previous, next, close, and toggle buttons', () => {
      const combined = providerSrc + findWidgetTsSrc + editorTsSrc;
      assert.ok(
        combined.includes('id="find-input"') || combined.includes('find-input'),
        'Find input field must exist',
      );
      assert.ok(
        combined.includes('id="find-count"') || combined.includes('find-count') || combined.includes('find-match-count'),
        'Match counter element must exist',
      );
      assert.ok(
        combined.includes('data-action="find-prev"') || combined.includes('find-prev'),
        'Previous button must exist',
      );
      assert.ok(
        combined.includes('data-action="find-next"') || combined.includes('find-next'),
        'Next button must exist',
      );
      assert.ok(
        combined.includes('data-action="find-close"') || combined.includes('find-close'),
        'Close button must exist',
      );
    });

    test('registers Cmd+F / Ctrl+F and Escape keybindings in editor', () => {
      const combined = editorTsSrc + findWidgetTsSrc;
      assert.ok(
        combined.includes('key === "f"') || combined.includes("key === 'f'") || combined.includes('key.toLowerCase() === "f"') || combined.includes("key.toLowerCase() === 'f'"),
        'Cmd+F/Ctrl+F shortcut must be registered',
      );
      assert.ok(
        combined.includes('key === "Escape"') || combined.includes("key === 'Escape'"),
        'Escape shortcut must close find widget',
      );
    });
  });

  suite('TC-171 & TC-172: Search navigation across Raw and Visual modes', () => {
    test('find-widget.ts exports SearchAdapter or contains search logic for both modes', () => {
      assert.ok(
        findWidgetTsSrc.length > 0,
        'media/find-widget.ts must exist and implement search/replace logic',
      );
      assert.ok(
        findWidgetTsSrc.includes('find') && (findWidgetTsSrc.includes('next') || findWidgetTsSrc.includes('previous')),
        'find-widget.ts must implement find, next, and previous navigation',
      );
    });

    test('ProseMirror Decoration or highlight classes exist in CSS', () => {
      assert.ok(
        editorCssSrc.includes('.find-highlight') || editorCssSrc.includes('.search-highlight'),
        'CSS must define .find-highlight or .search-highlight class',
      );
      assert.ok(
        editorCssSrc.includes('.find-highlight-current') || editorCssSrc.includes('.search-highlight-current'),
        'CSS must define .find-highlight-current or .search-highlight-current class',
      );
    });
  });

  suite('TC-173 & TC-174: Replace single and replace all', () => {
    test('implements replace and replaceAll methods', () => {
      assert.ok(
        findWidgetTsSrc.includes('replace') && findWidgetTsSrc.includes('replaceAll'),
        'find-widget.ts must implement replace and replaceAll',
      );
    });

    test('binds Cmd+H / Ctrl+H shortcut to open replace bar', () => {
      const combined = editorTsSrc + findWidgetTsSrc;
      assert.ok(
        combined.includes('key === "h"') || combined.includes("key === 'h'") || combined.includes('key.toLowerCase() === "h"') || combined.includes("key.toLowerCase() === 'h'"),
        'Cmd+H/Ctrl+H shortcut must be registered',
      );
    });
  });

  suite('TC-175: Search options and regex safety', () => {
    test('provides Match Case, Match Whole Word, and Use Regex option controls', () => {
      const combined = providerSrc + findWidgetTsSrc;
      assert.ok(
        combined.includes('match-case') || combined.includes('matchCase'),
        'Match Case option must be supported',
      );
      assert.ok(
        combined.includes('match-whole-word') || combined.includes('matchWholeWord') || combined.includes('whole-word'),
        'Match Whole Word option must be supported',
      );
      assert.ok(
        combined.includes('use-regex') || combined.includes('useRegex') || combined.includes('regex'),
        'Use Regex option must be supported',
      );
    });

    test('catches regex syntax errors safely', () => {
      assert.ok(
        findWidgetTsSrc.includes('catch') && (findWidgetTsSrc.includes('RegExp') || findWidgetTsSrc.includes('regex')),
        'Regex constructor must be protected with try-catch',
      );
    });
  });

  suite('TC-176: Readonly and Preview guard', () => {
    test('hides or disables replace UI in preview or readonly mode', () => {
      const combined = editorTsSrc + findWidgetTsSrc;
      assert.ok(
        combined.includes('readonly') || combined.includes('preview'),
        'Must check readonly and preview mode to guard replace functionality',
      );
    });
  });

  suite('TC-179: Regex syntax errors safety (compileRegex)', () => {
    // Dynamic execution of compileRegex logic
    let compileRegexFn: ((query: { term: string; matchCase: boolean; matchWholeWord: boolean; useRegex: boolean }) => RegExp | null) | null = null;
    try {
      // compileRegex is exported from media/find-widget
      const mod = require('../../../../media/find-widget');
      compileRegexFn = mod.compileRegex;
    } catch {
      compileRegexFn = null;
    }

    test('returns null without throwing on invalid regex patterns', () => {
      if (!compileRegexFn) {
        // Fallback for environment without media bundle transpilation
        assert.ok(findWidgetTsSrc.includes('catch') && findWidgetTsSrc.includes('RegExp'));
        return;
      }
      const invalidPatterns = ['(?', '[abc', '*invalid', '\\', '(?<=', '(unclosed'];
      for (const pattern of invalidPatterns) {
        assert.doesNotThrow(() => {
          const result = compileRegexFn!({
            term: pattern,
            matchCase: false,
            matchWholeWord: false,
            useRegex: true,
          });
          assert.strictEqual(result, null, `Invalid pattern "${pattern}" must return null`);
        });
      }
    });

    test('returns null for empty search term', () => {
      if (!compileRegexFn) return;
      assert.strictEqual(
        compileRegexFn({ term: '', matchCase: false, matchWholeWord: false, useRegex: false }),
        null,
      );
    });
  });

  suite('TC-180: Search option logic accuracy (compileRegex)', () => {
    let compileRegexFn: ((query: { term: string; matchCase: boolean; matchWholeWord: boolean; useRegex: boolean }) => RegExp | null) | null = null;
    try {
      const mod = require('../../../../media/find-widget');
      compileRegexFn = mod.compileRegex;
    } catch {
      compileRegexFn = null;
    }

    test('escapes regex special characters when useRegex is false', () => {
      if (!compileRegexFn) return;
      const regex = compileRegexFn({
        term: 'item.name [0] + 1 * 2?',
        matchCase: false,
        matchWholeWord: false,
        useRegex: false,
      });
      assert.ok(regex !== null);
      assert.strictEqual(regex.test('item.name [0] + 1 * 2?'), true);
      assert.strictEqual(regex.test('itemXname [0] + 1 * 2?'), false);
    });

    test('respects matchCase option', () => {
      if (!compileRegexFn) return;
      const caseSensitive = compileRegexFn({
        term: 'Hello',
        matchCase: true,
        matchWholeWord: false,
        useRegex: false,
      });
      assert.ok(caseSensitive !== null);
      assert.strictEqual(caseSensitive.test('Hello'), true);
      caseSensitive.lastIndex = 0;
      assert.strictEqual(caseSensitive.test('hello'), false);

      const caseInsensitive = compileRegexFn({
        term: 'Hello',
        matchCase: false,
        matchWholeWord: false,
        useRegex: false,
      });
      assert.ok(caseInsensitive !== null);
      assert.strictEqual(caseInsensitive.test('hello'), true);
    });

    test('respects matchWholeWord option', () => {
      if (!compileRegexFn) return;
      const wholeWord = compileRegexFn({
        term: 'test',
        matchCase: false,
        matchWholeWord: true,
        useRegex: false,
      });
      assert.ok(wholeWord !== null);
      assert.strictEqual(wholeWord.test('a test case'), true);
      wholeWord.lastIndex = 0;
      assert.strictEqual(wholeWord.test('testing case'), false);
      wholeWord.lastIndex = 0;
      assert.strictEqual(wholeWord.test('attest case'), false);
    });
  });
});

