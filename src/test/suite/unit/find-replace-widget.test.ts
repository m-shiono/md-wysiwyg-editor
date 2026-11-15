import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { bootEditorWebviewInJsdom, mountJsdomGlobals } from '../../helpers/webview-jsdom-harness';

interface SearchQueryLike {
  term: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
}

interface SearchResultLike {
  total: number;
  current: number;
}

interface SearchAdapterLike {
  find(query: SearchQueryLike, jumpToMatch?: boolean): SearchResultLike;
  next(): SearchResultLike;
  previous(): SearchResultLike;
  replace(replaceText: string): boolean;
  replaceAll(replaceText: string): number;
  clear(): void;
}

interface FindWidgetLike {
  setAdapter(adapter: SearchAdapterLike | null): void;
  setContext(mode: 'preview' | 'markdown' | 'raw', readonly: boolean): void;
  open(options?: { showReplace?: boolean; initialQuery?: string }): void;
  close(): void;
  isOpen(): boolean;
  next(): void;
  previous(): void;
  replace(): void;
  replaceAll(): void;
  toggleReplace(open: boolean): void;
}

interface FindWidgetModule {
  compileRegex: (query: SearchQueryLike) => RegExp | null;
  RawSearchAdapter: new (textarea: unknown) => SearchAdapterLike;
  MarpSearchAdapter: new (container: unknown) => SearchAdapterLike;
  FindWidget: new () => FindWidgetLike;
}

function loadFindWidgetModule(): FindWidgetModule {
  return require('../../../../media/find-widget') as FindWidgetModule;
}

suite('Find & Replace Widget Tests (JSDOM runtime)', () => {
  test('TC-I31-018a: compileRegex handles literal, case, whole-word, valid regex, and invalid regex', () => {
    const { compileRegex } = loadFindWidgetModule();

    assert.strictEqual(compileRegex({ term: '', matchCase: false, matchWholeWord: false, useRegex: false }), null);

    const escaped = compileRegex({ term: 'a+b(c)', matchCase: false, matchWholeWord: false, useRegex: false });
    assert.ok(escaped);
    assert.strictEqual('x a+b(c) y'.match(escaped)?.length, 1);
    assert.strictEqual('x aaabc y'.match(escaped), null);

    const caseSensitive = compileRegex({ term: 'Alpha', matchCase: true, matchWholeWord: false, useRegex: false });
    assert.ok(caseSensitive);
    assert.strictEqual('Alpha alpha ALPHA'.match(caseSensitive)?.length, 1);

    const wholeWord = compileRegex({ term: 'cat', matchCase: false, matchWholeWord: true, useRegex: false });
    assert.ok(wholeWord);
    assert.strictEqual('cat scatter caterpillar cat'.match(wholeWord)?.length, 2);

    const validRegex = compileRegex({ term: 'foo\\d+', matchCase: true, matchWholeWord: false, useRegex: true });
    assert.ok(validRegex);
    assert.strictEqual('foo1 bar foo23'.match(validRegex)?.length, 2);

    const invalidRegex = compileRegex({ term: '[unclosed', matchCase: false, matchWholeWord: false, useRegex: true });
    assert.strictEqual(invalidRegex, null);
  });

  test('TC-I31-018b: RawSearchAdapter + FindWidget executes find, next/prev wrap, replace, replaceAll, and close', () => {
    const dom = mountJsdomGlobals();
    try {
      const { RawSearchAdapter, FindWidget } = loadFindWidgetModule();
      const textarea = dom.document.getElementById('raw-editor') as unknown as {
        value: string;
        selectionStart: number;
        selectionEnd: number;
        clientWidth: number;
        clientHeight: number;
        scrollTop: number;
        scrollLeft: number;
        setSelectionRange: (s: number, e: number) => void;
        addEventListener: (t: string, cb: () => void) => void;
        removeEventListener: (t: string, cb: () => void) => void;
        dispatchEvent: (e: unknown) => boolean;
      };
      textarea.value = 'Alpha beta alpha ALPHA';
      textarea.setSelectionRange(0, 0);

      const adapter = new RawSearchAdapter(textarea);
      const widget = new FindWidget();
      widget.setContext('raw', false);
      widget.setAdapter(adapter);
      widget.open({ showReplace: true, initialQuery: 'alpha' });

      assert.strictEqual(widget.isOpen(), true);
      const countLabel = dom.document.getElementById('find-count');
      assert.strictEqual(countLabel?.textContent, '1 of 3');

      widget.next();
      assert.strictEqual(countLabel?.textContent, '2 of 3');
      widget.next();
      assert.strictEqual(countLabel?.textContent, '3 of 3');
      widget.next();
      assert.strictEqual(countLabel?.textContent, '1 of 3');

      widget.previous();
      assert.strictEqual(countLabel?.textContent, '3 of 3');

      const replaceInput = dom.document.getElementById('replace-input') as unknown as { value: string };
      replaceInput.value = 'Omega';
      widget.replace();
      assert.strictEqual(textarea.value, 'Alpha beta alpha Omega');

      replaceInput.value = 'Gamma';
      widget.replaceAll();
      assert.strictEqual(textarea.value, 'Gamma beta Gamma Omega');

      widget.close();
      assert.strictEqual(widget.isOpen(), false);
      assert.strictEqual(countLabel?.textContent, 'No results');
      assert.strictEqual(dom.document.getElementById('raw-search-backdrop')?.innerHTML, '');
    } finally {
      dom.dispose();
    }
  });

  test('TC-I31-018c: MarpSearchAdapter highlights preview text and guards replace in preview/readonly', () => {
    const dom = mountJsdomGlobals();
    try {
      const { MarpSearchAdapter, FindWidget } = loadFindWidgetModule();
      const previewRoot = dom.document.getElementById('preview-marp-root')!;
      previewRoot.innerHTML = '<section><h1>Slide One</h1><p>Slide content</p></section>';

      const adapter = new MarpSearchAdapter(previewRoot);
      const widget = new FindWidget();
      widget.setContext('preview', false);
      widget.setAdapter(adapter);
      widget.open({ showReplace: true, initialQuery: 'Slide' });

      const marks = previewRoot.querySelectorAll('mark.find-highlight');
      assert.strictEqual(marks.length, 2);
      assert.strictEqual(dom.document.getElementById('find-count')?.textContent, '1 of 2');
      assert.strictEqual(dom.document.getElementById('replace-row')?.classList.contains('hidden'), true);
      assert.strictEqual(adapter.replace('Nope'), false);
      assert.strictEqual(adapter.replaceAll('Nope'), 0);

      widget.close();
      assert.strictEqual(previewRoot.querySelectorAll('mark.find-highlight').length, 0);
    } finally {
      dom.dispose();
    }
  });

  test('TC-I31-018d: FindWidget hides replace toggle in readonly and searches TipTap visual DOM via media/editor.js', () => {
    const docJson = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'needle in visual editor needle' }] },
      ],
    });
    const harness = bootEditorWebviewInJsdom({
      initMessage: {
        docJson,
        markdownText: 'needle in visual editor needle',
        readonly: false,
        editorMode: 'markdown',
      },
    });
    try {
      const editorEl = harness.document.getElementById('editor')!;
      harness.dispatchKeydown(editorEl, { key: 'f', ctrlKey: true });

      const widget = harness.document.getElementById('find-widget')!;
      assert.strictEqual(widget.classList.contains('hidden'), false);

      const findInput = harness.document.getElementById('find-input')!;
      findInput.value = 'needle';
      findInput.dispatchEvent(new harness.window.Event('input', { bubbles: true }));
      assert.strictEqual(harness.document.getElementById('find-count')?.textContent, '1 of 2');

      harness.sendHostMessage({ type: 'readonlyChanged', readonly: true });
      const toggleReplaceBtn = harness.document.getElementById('find-toggle-replace')!;
      assert.strictEqual(toggleReplaceBtn.style.display, 'none');
    } finally {
      harness.dispose();
    }
  });

  test('TC-I31-018e: editor.css defines find highlight classes', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'media/editor.css'), 'utf8');
    assert.ok(css.includes('.find-highlight'), 'media/editor.css must style .find-highlight');
    assert.ok(css.includes('.find-highlight-current'), 'media/editor.css must style .find-highlight-current');
  });
});
