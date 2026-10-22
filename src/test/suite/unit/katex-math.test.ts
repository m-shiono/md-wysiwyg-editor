/**
 * TC-MATH-001–006: KaTeX Math Rendering Support (katex-math-rendering).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import katex from 'katex';

function readRepoFile(...parts: string[]): string {
  const filePath = path.resolve(process.cwd(), ...parts);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

suite('katex-math-rendering (TC-MATH-001–006)', () => {
  const packageJsonSrc = readRepoFile('package.json');
  const editorTsSrc = readRepoFile('media/editor.ts');
  const editorCssSrc = readRepoFile('media/editor.css');

  suite('TC-MATH-001: Package dependency and import', () => {
    test('package.json declares katex dependency', () => {
      const pkg = JSON.parse(packageJsonSrc);
      assert.ok(pkg.dependencies?.katex, 'katex must be in dependencies');
    });

    test('editor.ts imports katex', () => {
      assert.ok(
        editorTsSrc.includes('import katex from "katex"') || editorTsSrc.includes("import katex from 'katex'"),
        'editor.ts must import katex',
      );
    });
  });

  suite('TC-MATH-002: Math NodeView structure', () => {
    test('handles both math and latex code blocks', () => {
      assert.ok(
        editorTsSrc.includes('language === "math"') && editorTsSrc.includes('language === "latex"'),
        'editor.ts must handle math and latex languages',
      );
    });

    test('creates .math-block with .math-preview and .math-source', () => {
      assert.ok(
        editorTsSrc.includes('math-block') &&
          editorTsSrc.includes('math-preview') &&
          editorTsSrc.includes('math-source'),
        'NodeView must contain math-block, math-preview, and math-source',
      );
    });
  });

  suite('TC-MATH-003 & TC-MATH-004: KaTeX rendering & error fallback', () => {
    test('renders valid LaTeX expressions with katex.renderToString', () => {
      const latex = 'E = mc^2';
      const html = katex.renderToString(latex, { displayMode: true, throwOnError: false });
      assert.ok(html.includes('class="katex"'), 'Output must contain katex class');
      assert.ok(html.includes('class="katex-html"'), 'Output must contain katex-html element');
    });

    test('gracefully handles syntax error when throwOnError is false', () => {
      const invalidLatex = '\\invalidCommand{foo}';
      const html = katex.renderToString(invalidLatex, { displayMode: true, throwOnError: false });
      assert.ok(html.includes('katex-error') || html.includes('color:'), 'Output must handle error safely');
    });

    test('editor.ts configures katex with throwOnError: false', () => {
      assert.ok(
        editorTsSrc.includes('throwOnError: false'),
        'editor.ts must set throwOnError: false for resilience',
      );
    });
  });

  suite('TC-MATH-005 & TC-MATH-006: Sanitization & Preview mode styling', () => {
    test('editor.ts invokes DOMPurify.sanitize on math output', () => {
      assert.ok(
        editorTsSrc.includes('DOMPurify.sanitize(html'),
        'editor.ts must sanitize math HTML using DOMPurify',
      );
    });

    test('editor.css hides .math-source in Preview mode', () => {
      assert.ok(
        editorCssSrc.includes("body[data-mode='preview'] .math-source") &&
          editorCssSrc.includes('display: none;'),
        'Preview mode must hide .math-source in CSS',
      );
    });
  });

  suite('Edge Cases & Complex Formulas', () => {
    test('TC-MATH-007: renders complex multi-line and advanced formulas correctly', () => {
      const complex = '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi} \\quad \\sum_{k=1}^n k = \\frac{n(n+1)}{2}';
      const html = katex.renderToString(complex, { displayMode: true, throwOnError: false });
      assert.ok(html.includes('class="katex"'), 'Must render integrals and summations');
    });

    test('TC-MATH-008: handles empty and whitespace-only math blocks gracefully', () => {
      const empty = '   \n  \t  ';
      assert.strictEqual(empty.trim(), '');
      // editor.ts handles !source.trim() by clearing preview without katex call
      assert.ok(editorTsSrc.includes('!source.trim()') && editorTsSrc.includes('preview.innerHTML = ""'));
    });

    test('TC-MATH-009: renders text macros with Unicode/Japanese safely', () => {
      const withText = 'f(x) = x^2 \\quad \\text{（二次関数）}';
      const html = katex.renderToString(withText, { displayMode: true, throwOnError: false });
      assert.ok(html.includes('class="katex"'));
    });

    test('TC-MATH-010: handles case-insensitive language identifiers (Math, LaTeX)', () => {
      assert.ok(
        editorTsSrc.includes('((node.attrs.language as string) ?? "").toLowerCase()'),
        'Must lowercase language attribute on node initialization',
      );
      assert.ok(
        editorTsSrc.includes('((updatedNode.attrs.language as string) ?? "").toLowerCase()'),
        'Must lowercase language attribute on node update',
      );
    });

    test('TC-MATH-011: configures katex with displayMode: true', () => {
      assert.ok(
        editorTsSrc.includes('displayMode: true'),
        'editor.ts must configure KaTeX with displayMode: true for block rendering',
      );
    });

    test('TC-MATH-012: markdown-editor-provider.ts links katex.min.css in Webview head', () => {
      const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
      assert.ok(
        providerSrc.includes('katex.min.css'),
        'Provider must resolve and link katex.min.css in Webview head',
      );
    });
  });
});


