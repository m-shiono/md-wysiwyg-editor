/**
 * mermaid-contrast-readable — HIP label survival, island light canvas, XSS, wide-surface unchanged.
 * Red until build-agent adds HIP + island light theme/CSS (media/editor.ts etc. unchanged here).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type { Config } from 'dompurify';

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

function loadCompiledUtil(moduleName: string): Record<string, unknown> {
  const jsPath = path.resolve(process.cwd(), `out/utils/${moduleName}.js`);
  if (!fs.existsSync(jsPath)) {
    return {};
  }
  return require(jsPath) as Record<string, unknown>;
}

function getUtilExport<T>(moduleName: string, exportName: string): T | undefined {
  const mod = loadCompiledUtil(moduleName);
  const fn = mod[exportName];
  return typeof fn === 'function' ? (fn as T) : undefined;
}

/** flowchart 相当: foreignObject 内 XHTML ラベル */
const FLOWCHART_LABEL_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<g class="node">',
  '<foreignObject width="80" height="40">',
  '<div xmlns="http://www.w3.org/1999/xhtml">Cause A</div>',
  '</foreignObject>',
  '</g>',
  '</svg>',
].join('');

const EMPTY_FOREIGN_OBJECT_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<foreignObject></foreignObject>',
  '</svg>',
].join('');

const TEXT_LABEL_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<text>Simple Approach</text>',
  '</svg>',
].join('');

const XSS_LABEL_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<foreignObject width="80" height="40">',
  '<div xmlns="http://www.w3.org/1999/xhtml">Cause A</div>',
  '</foreignObject>',
  '<script>alert(1)</script>',
  '<g onclick="evil()" onerror="evil()"></g>',
  '</svg>',
].join('');

/**
 * media/editor.ts の sanitizeMermaidSvg と同一 options で DOMPurify を実行する薄いラッパ。
 * 本番 export は禁止範囲のため、ソース上の options リテラルを評価して使う。
 */
function extractSanitizeMermaidSvgOptions(editorSrc: string): Config {
  const match = editorSrc.match(
    /function\s+sanitizeMermaidSvg\s*\(\s*svg\s*:\s*string\s*\)\s*:\s*string\s*\{[\s\S]*?DOMPurify\.sanitize\(\s*svg\s*,\s*(\{[\s\S]*?\})\s*\)/,
  );
  assert.ok(match?.[1], 'sanitizeMermaidSvg DOMPurify options object must exist in media/editor.ts');
  // 本番 options リテラルのみ評価（ソースと 1:1）
  return new Function(`return (${match[1]})`)() as Config;
}

function createDomPurify(): { sanitize: (dirty: string, cfg?: Config) => string } {
  const { JSDOM } = require('jsdom') as {
    JSDOM: new (html: string) => { window: object & { document: object } };
  };
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const { window } = dom;
  // DOMPurify CJS は load 時に global window を参照する
  (globalThis as { window?: unknown }).window = window;
  (globalThis as { document?: unknown }).document = window.document;
  const createDOMPurify = require('dompurify') as (
    win: object,
  ) => { sanitize: (dirty: string, cfg?: Config) => string };
  return createDOMPurify(window);
}

function runProductionSanitize(svg: string): string {
  const editorSrc = readRepoFile('media/editor.ts');
  const options = extractSanitizeMermaidSvgOptions(editorSrc);
  const purify = createDomPurify();
  return purify.sanitize(svg, options);
}

function hasHipForeignObject(editorSrc: string): boolean {
  return /HTML_INTEGRATION_POINTS\s*:\s*\{[\s\S]*?foreignobject\s*:\s*true/i.test(editorSrc);
}

/** 島セレクタブロックに明るい背景があるか（hex / named / rgb） */
function islandSelectorHasLightSurface(css: string): boolean {
  const blocks = css.match(
    /\.mermaid-(?:preview|block)\s*(?:,\s*\.mermaid-(?:preview|block)\s*)*\{[^}]+\}/g,
  );
  if (!blocks) {
    return false;
  }
  const lightBg =
    /background(?:-color)?\s*:\s*(?:#(?:fff(?:fff)?|f{3,8}|[fFeE][0-9a-fA-F]{5})|white|snow|ivory|rgb\(\s*2[0-9]{2}\s*,)/i;
  return blocks.some((block) => lightBg.test(block));
}

/** #editor に明るい固定背景を新設していないこと */
function editorHasBrightFixedBackground(css: string): boolean {
  const editorBlocks = css.match(/#editor\b[^{]*\{[^}]+\}/g) ?? [];
  const bright =
    /background(?:-color)?\s*:\s*(?:#(?:fff(?:fff)?|f{3,8})|white|snow|ivory|#f[0-9a-fA-F]{5})/i;
  return editorBlocks.some((block) => bright.test(block));
}

type MermaidThemeConfig = {
  theme: string;
  themeVariables: Record<string, string>;
  securityLevel: string;
};

suite('mermaid-contrast-readable', () => {
  test('TC-001: sanitize keeps foreignObject inner label HTML (Cause A)', () => {
    const sanitized = runProductionSanitize(FLOWCHART_LABEL_SVG);

    assert.ok(/foreignObject/i.test(sanitized), 'foreignObject shell must remain');
    assert.ok(
      /Cause A/.test(sanitized),
      'label text Cause A must survive inside foreignObject (HIP required; empty shell is Fail)',
    );
    assert.ok(
      /<(div|span)\b/i.test(sanitized),
      'label element (div or span) must remain inside foreignObject',
    );
    assert.ok(
      !/<foreignObject[^>]*>\s*<\/foreignObject>/i.test(sanitized) || /Cause A/.test(sanitized),
      'empty foreignObject-only shell without label is Fail',
    );
  });

  test('TC-002: sanitizeMermaidSvg options require HTML_INTEGRATION_POINTS.foreignobject', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasHipForeignObject(editorSrc),
      'DOMPurify options must include HTML_INTEGRATION_POINTS: { foreignobject: true } (ADD_TAGS alone is Fail)',
    );
    assert.ok(
      /ADD_TAGS\s*:\s*\[[^\]]*foreignObject/.test(editorSrc),
      'ADD_TAGS must still include foreignObject',
    );
  });

  test('TC-003: sanitize removes script and on* while keeping safe label', () => {
    const sanitized = runProductionSanitize(XSS_LABEL_SVG);

    assert.ok(!/<script\b/i.test(sanitized), 'script tags must be removed');
    assert.ok(!/\son\w+\s*=/i.test(sanitized), 'on* event attributes must be removed');
    assert.ok(/Cause A/.test(sanitized), 'safe foreignObject label text must remain');
  });

  test('TC-004: dark and highContrast use island light Mermaid theme default', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');

    for (const kind of ['dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.theme,
        'default',
        `kind ${kind}: island light canvas must use theme 'default' (or light), not 'dark'`,
      );
      assert.notStrictEqual(config.theme, 'dark', `kind ${kind}: must not use theme dark on light island`);
      assert.strictEqual(config.securityLevel, 'strict', 'securityLevel strict must remain');
      for (const value of Object.values(config.themeVariables ?? {})) {
        assert.ok(!value.includes('var(--vscode-'), `themeVariables must not use var(--vscode-*): ${value}`);
      }
    }
  });

  test('TC-005: mermaid island CSS defines scoped light surface background', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      islandSelectorHasLightSurface(css),
      '.mermaid-preview / .mermaid-block must define a scoped light surface background',
    );
  });

  test('TC-006: #editor wide surface has no new bright fixed background', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !editorHasBrightFixedBackground(css),
      '#editor must not gain a bright fixed background (UD-001=B; island-only)',
    );
  });

  test('TC-007: light kind keeps Mermaid theme default', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('light');
    assert.strictEqual(config.theme, 'default', 'light kind must map to theme default');
    assert.strictEqual(config.securityLevel, 'strict');
  });

  test('TC-008: empty foreignObject shell sanitizes without throw', () => {
    let sanitized = '';
    assert.doesNotThrow(() => {
      sanitized = runProductionSanitize(EMPTY_FOREIGN_OBJECT_SVG);
    });
    assert.ok(/foreignObject/i.test(sanitized) || sanitized.length >= 0, 'must complete without crash');
  });

  test('TC-009: TC-152 regression suite contract still holds', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const usesBareMermaidSanitize =
      /preview\.innerHTML\s*=\s*DOMPurify\.sanitize\(\s*svg\s*\)\s*;/.test(editorSrc);
    assert.ok(!usesBareMermaidSanitize, 'must not use bare DOMPurify.sanitize(svg)');
    const preservesViaHelper =
      /preview\.innerHTML\s*=\s*sanitizeMermaidSvg\(\s*svg\s*\)\s*;/.test(editorSrc);
    const preservesViaSanitizeOptions =
      /preview\.innerHTML\s*=\s*DOMPurify\.sanitize\(\s*svg\s*,[\s\S]*?foreignObject[\s\S]*?\)\s*;/.test(
        editorSrc,
      );
    assert.ok(
      preservesViaHelper || preservesViaSanitizeOptions,
      'TC-152: foreignObject-preserving sanitize path required',
    );
  });

  test('TC-010: display-layer mermaid changes do not touch Document serialize APIs', () => {
    const serializerSrc = readRepoFile('src/serializers/markdown-serializer.ts');
    const documentSrc = readRepoFile('src/providers/markdown-document.ts');
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg|mermaid-preview/.test(serializerSrc),
      'markdown-serializer must not own Mermaid display sanitize/CSS',
    );
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg/.test(documentSrc),
      'markdown-document must not own Mermaid SVG sanitize',
    );
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(/sanitizeMermaidSvg/.test(editorSrc), 'sanitize stays in Webview display layer');
  });

  test('TC-011: highContrast uses same island light theme policy as dark', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('highContrast');
    assert.strictEqual(
      config.theme,
      'default',
      'highContrast island must use light theme default, not dark on bright canvas',
    );
    assert.notStrictEqual(config.theme, 'dark');
    assert.strictEqual(config.securityLevel, 'strict');
  });

  test('TC-012: sanitize keeps SVG text label Simple Approach', () => {
    const sanitized = runProductionSanitize(TEXT_LABEL_SVG);
    assert.ok(/Simple Approach/.test(sanitized), 'SVG <text> label must survive sanitize');
  });
});
