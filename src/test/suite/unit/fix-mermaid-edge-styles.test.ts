/**
 * fix-mermaid-edge-styles — edge visibility (nonce reinject preferred / shrunk safety net),
 * redux kind theme map, no island light, HIP / CSP / source co-display / Preview RO regressions.
 * Theme/presentation canonical suite: mermaid-redux-elk-fidelity.
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

type MermaidThemeConfig = {
  theme: string;
  themeVariables: Record<string, string>;
  securityLevel: string;
};

/** 島セレクタブロックに明るい固定背景があるか */
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

function editorHasBrightFixedBackground(css: string): boolean {
  const editorBlocks = css.match(/#editor\b[^{]*\{[^}]+\}/g) ?? [];
  const bright =
    /background(?:-color)?\s*:\s*(?:#(?:fff(?:fff)?|f{3,8})|white|snow|ivory|#f[0-9a-fA-F]{5})/i;
  return editorBlocks.some((block) => bright.test(block));
}

/** `.mermaid-preview` スコープ近傍に fill:none（エッジフォールバック）があるか */
function hasMermaidPreviewEdgeFillNone(css: string): boolean {
  // 最小契約: mermaid-preview スコープと fill:none の共起（セレクタ集合は実装に追随）
  const hasScope = /\.mermaid-preview/.test(css);
  const hasFillNone = /fill\s*:\s*none/i.test(css);
  if (!hasScope || !hasFillNone) {
    return false;
  }
  // 同一ルールブロックまたは近傍コメント付きブロック内での共起を許容
  const scopedBlocks = css.match(/\.mermaid-preview[^{]*\{[^}]+\}/g) ?? [];
  if (scopedBlocks.some((block) => /fill\s*:\s*none/i.test(block))) {
    return true;
  }
  // `.mermaid-preview path` / `.mermaid-preview .edgePath` 等の子孫セレクタ
  const descendant = /\.mermaid-preview[^\n{]*\{[^}]*fill\s*:\s*none/i.test(css);
  return descendant;
}

function mermaidPreviewAppendedBeforeSource(editorSrc: string): boolean {
  const nodeViewMatch = editorSrc.match(
    /classList\.add\(['"]mermaid-block['"]\)[\s\S]*?return\s*\{[\s\S]*?dom,/,
  );
  const slice = nodeViewMatch?.[0] ?? editorSrc;
  const previewIdx = slice.indexOf("classList.add('mermaid-preview')");
  const previewIdxAlt = slice.indexOf('classList.add("mermaid-preview")');
  const sourceIdx = slice.indexOf("classList.add('mermaid-source')");
  const sourceIdxAlt = slice.indexOf('classList.add("mermaid-source")');
  const p = previewIdx >= 0 ? previewIdx : previewIdxAlt;
  const s = sourceIdx >= 0 ? sourceIdx : sourceIdxAlt;
  return p >= 0 && s >= 0 && p < s;
}

function extractSanitizeMermaidSvgOptions(editorSrc: string): Config {
  const match = editorSrc.match(
    /function\s+sanitizeMermaidSvg\s*\(\s*svg\s*:\s*string\s*\)\s*:\s*string\s*\{[\s\S]*?DOMPurify\.sanitize\(\s*svg\s*,\s*(\{[\s\S]*?\})\s*\)/,
  );
  assert.ok(match?.[1], 'sanitizeMermaidSvg DOMPurify options object must exist in media/editor.ts');
  return new Function(`return (${match[1]})`)() as Config;
}

function createDomPurify(): { sanitize: (dirty: string, cfg?: Config) => string } {
  const { JSDOM } = require('jsdom') as {
    JSDOM: new (html: string) => { window: object & { document: object } };
  };
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const { window } = dom;
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

const XSS_LABEL_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<foreignObject width="80" height="40">',
  '<div xmlns="http://www.w3.org/1999/xhtml">Cause A</div>',
  '</foreignObject>',
  '<script>alert(1)</script>',
  '<g onclick="evil()" onerror="evil()"></g>',
  '</svg>',
].join('');

const KIND_THEME_MAP: Record<'light' | 'dark' | 'highContrast', string> = {
  light: 'redux',
  dark: 'redux-dark',
  highContrast: 'redux-dark',
};

/** Host 同一 nonce 付き presentation `<style>` 再注入経路があるか */
function hasPresentationNonceReinject(editorSrc: string): boolean {
  const hasNonceAttr =
    /setAttribute\(\s*['"]nonce['"]/.test(editorSrc) ||
    /\.nonce\s*=/.test(editorSrc);
  const hasStyleInject =
    /createElement\(\s*['"]style['"]\s*\)/.test(editorSrc) ||
    /reinject.*[Ss]tyle|injectMermaid.*[Ss]tyle|applyMermaidPresentation/i.test(editorSrc);
  return hasNonceAttr && hasStyleInject;
}

suite('fix-mermaid-edge-styles', () => {
  // --- P0 ---

  test('TC-001: edge visibility via presentation reinject or shrunk safety net', () => {
    const css = readRepoFile('media/editor.css');
    const editorSrc = readRepoFile('media/editor.ts');
    const hasReinject = hasPresentationNonceReinject(editorSrc);
    const hasSafetyNet = hasMermaidPreviewEdgeFillNone(css);
    assert.ok(
      hasReinject || hasSafetyNet,
      'flowchart edges: prefer presentation nonce reinject; minimal fill:none safety net allowed (not mandatory vscode-foreground stroke)',
    );
    // ユーザー／Mermaid ソース由来の任意 CSS 注入経路がないこと（静的近似）
    assert.ok(
      !/insertAdjacentHTML\s*\(\s*['"]beforeend['"]\s*,\s*[^)]*style/i.test(editorSrc),
      'must not inject arbitrary style from Mermaid/user source',
    );
  });

  test('TC-002: Custom Editor CSP style-src has nonce and no unsafe-inline', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(/style-src/.test(providerSrc), 'Custom Editor must emit style-src');
    assert.ok(
      /style-src[^;]*nonce-/.test(providerSrc) ||
        /style-src\s+\$\{webview\.cspSource\}\s+'nonce-\$\{nonce\}'/.test(providerSrc),
      "style-src must allow nonce- (Host nonce)",
    );
    // Custom Editor の style-src 行に unsafe-inline が無いこと（Marp は対象外）
    const styleSrcLines = providerSrc
      .split('\n')
      .filter((line) => /style-src/.test(line) && !/marp/i.test(line));
    assert.ok(styleSrcLines.length > 0, 'Custom Editor style-src line required');
    for (const line of styleSrcLines) {
      assert.ok(
        !/unsafe-inline/.test(line),
        `Custom Editor style-src must not include 'unsafe-inline': ${line.trim()}`,
      );
    }
  });

  test('TC-003: light kind maps to Mermaid theme redux with strict', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('light');
    assert.strictEqual(config.theme, 'redux', "light kind must map to theme 'redux'");
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

  test('TC-004: dark kind maps to Mermaid theme redux-dark with strict', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('dark');
    assert.strictEqual(
      config.theme,
      'redux-dark',
      "dark kind must map to theme 'redux-dark' (not classic 'dark' / 'default')",
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

  test('TC-005: highContrast kind maps to Mermaid theme redux-dark with strict', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('highContrast');
    assert.strictEqual(
      config.theme,
      'redux-dark',
      "highContrast maps to theme 'redux-dark' (AD-004)",
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

  test('TC-006: mermaid island CSS does not force a light surface', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !islandSelectorHasLightSurface(css),
      '.mermaid-preview / .mermaid-block must not force a bright fixed surface (AD-005)',
    );
  });

  test('TC-007: HIP foreignobject remains enabled', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /HTML_INTEGRATION_POINTS\s*:\s*\{[\s\S]*?foreignobject\s*:\s*true/i.test(editorSrc),
      'HTML_INTEGRATION_POINTS: { foreignobject: true } required (AD-006)',
    );
  });

  test('TC-008: buildMermaidThemeConfig uses securityLevel strict for all kinds', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of ['light', 'dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(config.securityLevel, 'strict', `kind ${kind} must keep securityLevel strict`);
    }
  });

  test('TC-009: Mermaid NodeView DOM order is preview then source', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      mermaidPreviewAppendedBeforeSource(editorSrc),
      '.mermaid-preview must be appended before .mermaid-source',
    );
  });

  test('TC-010: Preview mermaid source is read-only', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /mode\s*===\s*['"]preview['"][\s\S]*?setEditable\(\s*false/.test(editorSrc) ||
        /setEditable\(\s*mode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'Preview must keep TipTap non-editable so mermaid-source edits do not reach Document',
    );
    assert.ok(
      /editable:\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc) ||
        /setEditable\(\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'editable only when markdown mode',
    );
  });

  // --- P1 ---

  test('TC-011: #editor wide surface has no new bright fixed background', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !editorHasBrightFixedBackground(css),
      '#editor must not gain a bright fixed background outside Mermaid island',
    );
  });

  test('TC-012: display-layer changes do not touch Document serialize APIs', () => {
    const serializerSrc = readRepoFile('src/serializers/markdown-serializer.ts');
    const documentSrc = readRepoFile('src/providers/markdown-document.ts');
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg|fill:\s*none|mermaid-preview/.test(serializerSrc),
      'markdown-serializer must not own Mermaid display CSS/sanitize',
    );
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg|fill:\s*none/.test(documentSrc),
      'markdown-document must not own Mermaid display CSS/sanitize',
    );
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(/buildMermaidThemeConfig/.test(themeSrc), 'theme helper stays in display-layer utils');
  });

  test('TC-013: themeUpdated re-init follows redux kind theme map', () => {
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(/handleThemeUpdated/.test(themeSrc), 'handleThemeUpdated must exist');
    assert.ok(
      /buildMermaidThemeConfig\(kind\)/.test(themeSrc),
      'themeUpdated must re-initialize via buildMermaidThemeConfig',
    );
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig);
    for (const kind of ['light', 'dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.theme,
        KIND_THEME_MAP[kind],
        `themeUpdated path: kind ${kind} → theme '${KIND_THEME_MAP[kind]}'`,
      );
      assert.strictEqual(config.securityLevel, 'strict');
    }
  });

  test('TC-014: related suites Expected align with redux kind map and no island', () => {
    // Mermaid suites share merged canonical testspec after doc-reorg (AD-006/009)
    const mermaidSpec = readRepoFile('doc/test/mermaid/testspec-mermaid.md');
    const wysiwyg = readRepoFile('doc/test/testspec-vsc-md-wysiwyg.md');

    assert.ok(
      /島ライト.*撤回|島ライト強制.*なし|no-island-light/i.test(mermaidSpec),
      'contrast-readable must withdraw island-light-required Expected',
    );
    assert.ok(
      /redux-dark|theme:\s*'redux'|→\s*`redux`/i.test(mermaidSpec),
      'contrast-readable must expect dark/HC → redux-dark',
    );
    assert.ok(
      /redux|kind-theme-redux|→\s*`redux`/i.test(mermaidSpec),
      'snap-style must expect redux kind map',
    );
    assert.ok(
      /島ライト.*撤回|島ライト強制.*なし|no-island-light/i.test(mermaidSpec),
      'snap-style must withdraw island-light-required Expected',
    );
    assert.ok(
      /TC-149[\s\S]*redux-dark|TC-149[\s\S]*'redux'|TC-149[\s\S]*→\s*`redux`/i.test(wysiwyg),
      'wysiwyg TC-149 must expect light→redux / dark|HC→redux-dark',
    );
    assert.ok(
      /nonce|redux-dark|layout-elk/i.test(mermaidSpec),
      'redux-elk-fidelity testspec must remain the presentation/ELK canonical suite',
    );

    const contrastSuite = readRepoFile('src/test/suite/unit/mermaid-contrast-readable.test.ts');
    const snapSuite = readRepoFile('src/test/suite/unit/mermaid-snap-style-with-source.test.ts');
    const previewQuality = readRepoFile('src/test/suite/unit/preview-mode-quality.test.ts');
    assert.ok(
      !/island light canvas must use theme 'default'/.test(contrastSuite),
      'contrast-readable suite must not assert old island default-everywhere',
    );
    assert.ok(
      !/must use theme 'default' \(AD-005\)/.test(snapSuite) &&
        !/light:\s*'default'|dark:\s*'dark'/.test(snapSuite),
      'snap-style suite must not assert classic default/dark map',
    );
    assert.ok(
      !/maps to default on light island|map to default theme|Mermaid theme 'dark'/.test(
        previewQuality,
      ),
      'preview-mode-quality TC-149 must not assert classic default/dark',
    );
  });

  test('TC-015: sanitize removes script and on* while keeping safe label', () => {
    const sanitized = runProductionSanitize(XSS_LABEL_SVG);
    assert.ok(!/<script\b/i.test(sanitized), 'script tags must be removed');
    assert.ok(!/\son\w+\s*=/i.test(sanitized), 'on* event attributes must be removed');
    assert.ok(/Cause A/.test(sanitized), 'safe foreignObject label text must remain (HIP)');
  });
});
