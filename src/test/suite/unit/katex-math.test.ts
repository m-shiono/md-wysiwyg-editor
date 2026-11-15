import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { bootEditorWebviewInJsdom } from '../../helpers/webview-jsdom-harness';

suite('KaTeX Math Block Tests (JSDOM runtime)', () => {
  test('TC-I31-021a: package.json includes katex and media/editor.css defines math-block styles', () => {
    const pkgRaw = fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> };
    assert.ok(pkg.dependencies?.katex, 'package.json must depend on katex');

    const css = fs.readFileSync(path.resolve(process.cwd(), 'media/editor.css'), 'utf8');
    assert.ok(css.includes('.math-block'), 'media/editor.css must define .math-block styles');
  });

  test('TC-I31-021b: MathBlock renders KaTeX for math/LaTeX/latex blocks, handles syntax errors gracefully, and blocks XSS', () => {
    const docJson = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'codeBlock', attrs: { language: 'math' }, content: [{ type: 'text', text: 'E = mc^2' }] },
        { type: 'codeBlock', attrs: { language: 'LaTeX' }, content: [{ type: 'text', text: '\\frac{1}{' }] },
        { type: 'codeBlock', attrs: { language: 'latex' }, content: [{ type: 'text', text: '<img src=x onerror=alert(1)><script>alert(2)</script>' }] },
        { type: 'codeBlock', attrs: { language: 'math' } },
      ],
    });

    const harness = bootEditorWebviewInJsdom({
      initMessage: {
        docJson,
        markdownText: '```math\nE = mc^2\n```',
        readonly: false,
        editorMode: 'markdown',
      },
    });
    try {
      const blocks = harness.document.getElementById('editor')!.querySelectorAll('.math-block');
      assert.strictEqual(blocks.length, 4, 'All math/LaTeX/tex codeBlocks should mount .math-block');

      const firstPreview = blocks[0].querySelector('.math-preview')!;
      assert.ok(firstPreview.querySelector('.katex'), 'Valid math should render .katex output');
      assert.ok(blocks[0].querySelector('.math-source')?.textContent?.includes('E = mc^2'));

      const secondPreview = blocks[1].querySelector('.math-preview')!;
      assert.ok(secondPreview.querySelector('.katex-error'), 'Invalid LaTeX command should render .katex-error via throwOnError: false');

      const xssPreview = blocks[2].querySelector('.math-preview')!;
      assert.strictEqual(xssPreview.querySelectorAll('script').length, 0);
      assert.strictEqual(xssPreview.innerHTML.includes('onerror'), false);

      const emptyPreview = blocks[3].querySelector('.math-preview')!;
      assert.ok(emptyPreview, 'Empty math block should still render preview container cleanly');
    } finally {
      harness.dispose();
    }
  });
});
