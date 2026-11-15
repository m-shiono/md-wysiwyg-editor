/**
 * mermaid-contrast-readable — HIP label survival, redux kind theme map, XSS, wide-surface unchanged.
 * Island-light + classic default/dark withdrawn (mermaid-redux-elk-fidelity / fix-mermaid-edge-styles).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseMarkdown, serializeMarkdown } from '../../../serializers/markdown-serializer';
import {
  getUtilExport,
  readRepoFile,
} from '../../helpers/test-utils';
import { mountJsdomGlobals } from '../../helpers/webview-jsdom-harness';

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
 * Resolve production sanitizeMermaidSvg directly without new Function() or regex extraction.
 * build-agent should export sanitizeMermaidSvg from src/utils/mermaid-sanitize.ts (or out/utils/mermaid-sanitize.js).
 */
function loadDirectSanitizeMermaidSvg(): (svg: string) => string {
  const fromUtils = getUtilExport<(svg: string) => string>('mermaid-sanitize', 'sanitizeMermaidSvg');
  if (fromUtils) {
    return fromUtils;
  }
  const mediaDistPath = path.resolve(process.cwd(), 'media/mermaid-sanitize.js');
  if (fs.existsSync(mediaDistPath)) {
    const mod = require(mediaDistPath) as Record<string, unknown>;
    if (typeof mod.sanitizeMermaidSvg === 'function') {
      return mod.sanitizeMermaidSvg as (svg: string) => string;
    }
  }
  assert.fail(
    'TC-I31-022: sanitizeMermaidSvg must be exported directly (e.g. src/utils/mermaid-sanitize.ts) for JSDOM runtime testing without new Function()',
  );
}

function runDirectSanitize(svg: string): string {
  const dom = mountJsdomGlobals();
  try {
    const sanitize = loadDirectSanitizeMermaidSvg();
    return sanitize(svg);
  } finally {
    dom.dispose();
  }
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
  test('TC-001 / TC-I31-022: direct sanitizeMermaidSvg keeps foreignObject inner label HTML (Cause A)', () => {
    const sanitized = runDirectSanitize(FLOWCHART_LABEL_SVG);

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

  test('TC-002 / TC-I31-022: direct sanitizeMermaidSvg preserves nested foreignObject XHTML elements (HIP)', () => {
    const nestedSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="120" height="50"><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Nested <strong>Label</strong></span></div></foreignObject></svg>';
    const sanitized = runDirectSanitize(nestedSvg);
    assert.ok(/<foreignObject/i.test(sanitized), 'foreignObject must remain');
    assert.ok(/Nested/.test(sanitized) && /Label/.test(sanitized), 'nested XHTML label must remain');
  });

  test('TC-003 / TC-I31-022: direct sanitizeMermaidSvg removes script and on* while keeping safe label', () => {
    const sanitized = runDirectSanitize(XSS_LABEL_SVG);

    assert.ok(!/<script\b/i.test(sanitized), 'script tags must be removed');
    assert.ok(!/\son\w+\s*=/i.test(sanitized), 'on* event attributes must be removed');
    assert.ok(/Cause A/.test(sanitized), 'safe foreignObject label text must remain');
  });

  test('TC-004: dark and highContrast map to Mermaid theme redux-dark', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');

    for (const kind of ['dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.theme,
        'redux-dark',
        `kind ${kind}: must use theme 'redux-dark' (classic 'dark' / forced 'default' is Fail)`,
      );
      assert.strictEqual(config.securityLevel, 'strict', 'securityLevel strict must remain');
      assert.strictEqual(
        config.themeVariables?.fontSize,
        '16px',
        `kind ${kind}: themeVariables.fontSize must be '16px' (mermaid-display-density)`,
      );
      for (const value of Object.values(config.themeVariables ?? {})) {
        assert.ok(!value.includes('var(--vscode-'), `themeVariables must not use var(--vscode-*): ${value}`);
      }
    }
  });

  test('TC-005: mermaid island CSS does not force a light surface', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !islandSelectorHasLightSurface(css),
      '.mermaid-preview / .mermaid-block must not force a bright fixed surface (island light withdrawn)',
    );
  });

  test('TC-006: #editor wide surface has no new bright fixed background', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !editorHasBrightFixedBackground(css),
      '#editor must not gain a bright fixed background (UD-001=B; island-only)',
    );
  });

  test('TC-007: light kind keeps Mermaid theme redux', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('light');
    assert.strictEqual(config.theme, 'redux', 'light kind must map to theme redux');
    assert.strictEqual(config.securityLevel, 'strict');
    assert.strictEqual(
      config.themeVariables?.fontSize,
      '16px',
      "themeVariables.fontSize must be '16px' (mermaid-display-density)",
    );
    for (const value of Object.values(config.themeVariables ?? {})) {
      assert.ok(!value.includes('var(--vscode-'), `themeVariables must not use var(--vscode-*): ${value}`);
    }
  });

  test('TC-008 / TC-I31-022: empty foreignObject shell sanitizes without throw', () => {
    let sanitized = '';
    assert.doesNotThrow(() => {
      sanitized = runDirectSanitize(EMPTY_FOREIGN_OBJECT_SVG);
    });
    assert.ok(/foreignObject/i.test(sanitized) || sanitized.length >= 0, 'must complete without crash');
  });

  test('TC-009 / TC-I31-022: TC-152 foreignObject-preserving sanitize contract holds directly', () => {
    const sanitized = runDirectSanitize(FLOWCHART_LABEL_SVG);
    assert.ok(
      /<foreignObject/i.test(sanitized) && /Cause A/.test(sanitized),
      'TC-152: foreignObject-preserving sanitize path required',
    );
  });

  test('TC-010: display-layer mermaid changes do not alter Document serialization', () => {
    const md = '```mermaid\ngraph TD\nA[Cause A] --> B\n```\n';
    const doc = parseMarkdown(md);
    const out = serializeMarkdown(doc);
    assert.ok(out.includes('```mermaid'), 'mermaid fence preserved');
    assert.ok(out.includes('A[Cause A] --> B'), 'mermaid source preserved verbatim');
    assert.ok(!/<foreignObject|<svg/i.test(out), 'serializer must not emit rendered SVG');
  });

  test('TC-011: highContrast maps to Mermaid theme redux-dark like dark kind', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('highContrast');
    assert.strictEqual(
      config.theme,
      'redux-dark',
      "highContrast must map to theme 'redux-dark' (same as dark kind; AD-004)",
    );
    assert.strictEqual(config.securityLevel, 'strict');
    assert.strictEqual(
      config.themeVariables?.fontSize,
      '16px',
      "themeVariables.fontSize must be '16px' (mermaid-display-density)",
    );
    for (const value of Object.values(config.themeVariables ?? {})) {
      assert.ok(!value.includes('var(--vscode-'), `themeVariables must not use var(--vscode-*): ${value}`);
    }
  });

  test('TC-012 / TC-I31-022: sanitize keeps SVG text label Simple Approach', () => {
    const sanitized = runDirectSanitize(TEXT_LABEL_SVG);
    assert.ok(/Simple Approach/.test(sanitized), 'SVG <text> label must survive sanitize');
  });
});
