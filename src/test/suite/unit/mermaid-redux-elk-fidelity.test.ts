/**
 * mermaid-redux-elk-fidelity — redux kind map, presentation nonce reinject, ELK opt-in,
 * Host CSS edge fallback shrink, HIP / strict / source co-display / Preview RO regressions.
 * Intentional Red until build-agent lands production (tests-only phase).
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
  layout?: string;
};

const REDUX_KIND_THEME_MAP: Record<'light' | 'dark' | 'highContrast', string> = {
  light: 'redux',
  dark: 'redux-dark',
  highContrast: 'redux-dark',
};

const XSS_LABEL_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<foreignObject width="80" height="40">',
  '<div xmlns="http://www.w3.org/1999/xhtml">Cause A</div>',
  '</foreignObject>',
  '<script>alert(1)</script>',
  '<g onclick="evil()" onerror="evil()"></g>',
  '</svg>',
].join('');

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

/** Host 同一 nonce 付き presentation `<style>` 再注入経路があるか */
function hasPresentationNonceReinject(editorSrc: string): boolean {
  const hasNonceAttr =
    /setAttribute\(\s*['"]nonce['"]/.test(editorSrc) ||
    /\.nonce\s*=/.test(editorSrc) ||
    /nonce\s*:\s*/.test(editorSrc);
  const hasStyleInject =
    /createElement\(\s*['"]style['"]\s*\)/.test(editorSrc) ||
    /reinject.*[Ss]tyle|injectMermaid.*[Ss]tyle|applyMermaidPresentation/i.test(editorSrc);
  const scopesPreview =
    /\.mermaid-preview/.test(editorSrc) || /mermaid-preview/.test(editorSrc);
  return hasNonceAttr && hasStyleInject && scopesPreview;
}

/** 永続必須の vscode-foreground stroke が「唯一正」として残っていないか（安全網コメント付きなら可） */
function hostCssEdgeFallbackIsShrunkOrAbsent(css: string): boolean {
  const edgeStrokeBlocks = css.match(
    /\.mermaid-preview[^{]*\{[^}]*stroke\s*:\s*var\(--vscode-foreground\)[^}]*\}/gi,
  );
  if (!edgeStrokeBlocks || edgeStrokeBlocks.length === 0) {
    return true;
  }
  // 残存する場合は近傍コメントが安全網限定である必要
  const safetyNetComment =
    /安全網|safety\s*net|欠落時|presentation\s*(CSS|style).*missing|fallback.*only/i.test(css);
  return safetyNetComment;
}

function hasElkRegistration(sources: string[]): boolean {
  const joined = sources.join('\n');
  return (
    /@mermaid-js\/layout-elk/.test(joined) ||
    /registerLayoutLoaders/.test(joined)
  );
}

function hasElkLazyImport(sources: string[]): boolean {
  const joined = sources.join('\n');
  return (
    /import\s*\(\s*['"]@mermaid-js\/layout-elk['"]\s*\)/.test(joined) ||
    /registerLayoutLoaders/.test(joined)
  );
}

suite('mermaid-redux-elk-fidelity', () => {
  // --- P0 ---

  test('TC-001: light kind maps to Mermaid theme redux with strict', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('light');
    assert.strictEqual(config.theme, 'redux', "light kind must map to theme 'redux' (not classic 'default')");
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

  test('TC-002: dark kind maps to Mermaid theme redux-dark with strict', () => {
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

  test('TC-003: highContrast kind maps to Mermaid theme redux-dark with strict', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('highContrast');
    assert.strictEqual(
      config.theme,
      'redux-dark',
      "highContrast maps to theme 'redux-dark' (AD-004; dedicated HC palette not required)",
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

  test('TC-004: Mermaid presentation style is reinjected with Host-identical nonce', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasPresentationNonceReinject(editorSrc),
      'render presentation <style> must be reinjected with Host-identical nonce under .mermaid-preview scope (AD-002)',
    );
    assert.ok(
      !/insertAdjacentHTML\s*\(\s*['"]beforeend['"]\s*,\s*[^)]*style/i.test(editorSrc),
      'must not pass through arbitrary user/Mermaid-source CSS',
    );
    assert.ok(
      !/style-src[^;]*unsafe-inline/.test(editorSrc),
      "'unsafe-inline' must not be used as reinject substitute",
    );
  });

  test('TC-005: Custom Editor CSP style-src has nonce and no unsafe-inline', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(/style-src/.test(providerSrc), 'Custom Editor must emit style-src');
    assert.ok(
      /style-src[^;]*nonce-/.test(providerSrc) ||
        /style-src\s+\$\{webview\.cspSource\}\s+'nonce-\$\{nonce\}'/.test(providerSrc),
      "style-src must allow nonce- (Host nonce)",
    );
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

  test('TC-006: flowchart edges stay visible after reinject (fill:none not vscode-foreground-only)', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const css = readRepoFile('media/editor.css');
    const reinjectHasFillNone =
      hasPresentationNonceReinject(editorSrc) &&
      (/fill\s*:\s*none/i.test(editorSrc) || /fill:\s*none/i.test(css));
    const safetyNetFillNone =
      /\.mermaid-preview[^\n{]*\{[^}]*fill\s*:\s*none/i.test(css) ||
      /\.mermaid-preview[\s\S]{0,200}fill\s*:\s*none/i.test(css);
    assert.ok(
      reinjectHasFillNone || safetyNetFillNone,
      'edges must not paint as black blobs: fill:none via presentation reinject (preferred) or minimal safety net',
    );
    // 永続必須の全面 vscode-foreground stroke を唯一正としない
    const onlyVscodeForegroundStroke =
      /stroke\s*:\s*var\(--vscode-foreground\)/i.test(css) &&
      !hasPresentationNonceReinject(editorSrc) &&
      !/安全網|safety\s*net|欠落時/i.test(css);
    assert.ok(
      !onlyVscodeForegroundStroke,
      'must not treat persistent stroke: var(--vscode-foreground) as the sole edge-visibility contract',
    );
  });

  test('TC-007: layout: elk fences render after registerLayoutLoaders', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    const pkg = readRepoFile('package.json');
    assert.ok(
      hasElkRegistration([editorSrc, themeSrc, pkg]),
      '@mermaid-js/layout-elk / registerLayoutLoaders must be present (AD-005)',
    );
    // フェンス全文を strip せず render に渡す（layout: elk を落とさない）
    assert.ok(
      /mermaid\.render\s*\(/.test(editorSrc),
      'mermaid.render path must exist for ELK opt-in fences',
    );
    assert.ok(
      !/strip.*layout|remove.*layout:\s*elk|layout:\s*elk[\s\S]{0,80}replace/i.test(editorSrc),
      'must not strip layout: elk from fence before render',
    );
  });

  test('TC-008: global initialize does not force layout elk', () => {
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    const editorSrc = readRepoFile('media/editor.ts');
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of ['light', 'dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.ok(
        config.layout !== 'elk',
        `buildMermaidThemeConfig(${kind}) must not force layout: 'elk' (AD-006)`,
      );
    }
    assert.ok(
      !/initialize\s*\(\s*\{[^}]*layout\s*:\s*['"]elk['"]/s.test(themeSrc) &&
        !/initialize\s*\(\s*\{[^}]*layout\s*:\s*['"]elk['"]/s.test(editorSrc),
      'global mermaid.initialize must not force layout: elk',
    );
  });

  test('TC-009: Host CSS edge fallback is shrunk or safety-net-only', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      hostCssEdgeFallbackIsShrunkOrAbsent(css),
      'persistent stroke: var(--vscode-foreground) must be absent or marked as safety-net-only (AD-003)',
    );
    assert.ok(
      !islandSelectorHasLightSurface(css),
      'island light surface must remain absent',
    );
  });

  test('TC-010: HIP foreignobject remains enabled', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /HTML_INTEGRATION_POINTS\s*:\s*\{[\s\S]*?foreignobject\s*:\s*true/i.test(editorSrc),
      'HTML_INTEGRATION_POINTS: { foreignobject: true } required (AD-008)',
    );
  });

  test('TC-011: buildMermaidThemeConfig uses securityLevel strict for all kinds', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of ['light', 'dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(config.securityLevel, 'strict', `kind ${kind} must keep securityLevel strict`);
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

  test('TC-012: Mermaid NodeView DOM order is preview then source', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      mermaidPreviewAppendedBeforeSource(editorSrc),
      '.mermaid-preview must be appended before .mermaid-source',
    );
  });

  test('TC-013: Preview mermaid source is read-only', () => {
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

  test('TC-014: ELK layout loader uses lazy / dynamic import', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(
      hasElkLazyImport([editorSrc, themeSrc]),
      '@mermaid-js/layout-elk must be dynamically imported or registered on first ELK demand (AD-007)',
    );
    // トップレベル静的 import のみでの肥大化を避ける
    assert.ok(
      !/^import\s+.+from\s+['"]@mermaid-js\/layout-elk['"]/m.test(editorSrc),
      'media/editor.ts must not statically import @mermaid-js/layout-elk at top level',
    );
  });

  test('TC-015: ELK register failure is isolated to the diagram', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    const joined = `${editorSrc}\n${themeSrc}`;
    assert.ok(
      /registerLayoutLoaders|layout-elk/.test(joined),
      'ELK registration path must exist before isolation can be asserted',
    );
    assert.ok(
      /try\s*\{[\s\S]*?(registerLayoutLoaders|layout-elk)[\s\S]*?\}\s*catch/s.test(joined),
      'ELK loader register/import must be try-catch isolated (AD-007/012)',
    );
  });

  test('TC-016: themeUpdated re-init follows redux kind map', () => {
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
        REDUX_KIND_THEME_MAP[kind],
        `themeUpdated path: kind ${kind} → theme '${REDUX_KIND_THEME_MAP[kind]}'`,
      );
      assert.strictEqual(config.securityLevel, 'strict');
    }
  });

  test('TC-017: display-layer changes do not touch Document serialize APIs', () => {
    const serializerSrc = readRepoFile('src/serializers/markdown-serializer.ts');
    const documentSrc = readRepoFile('src/providers/markdown-document.ts');
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg|registerLayoutLoaders|layout-elk/.test(
        serializerSrc,
      ),
      'markdown-serializer must not own Mermaid display/ELK',
    );
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg|registerLayoutLoaders|layout-elk/.test(
        documentSrc,
      ),
      'markdown-document must not own Mermaid display/ELK',
    );
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(/buildMermaidThemeConfig/.test(themeSrc), 'theme helper stays in display-layer utils');
  });

  test('TC-018: related suites Expected align with redux map and no mandatory vscode-foreground stroke', () => {
    // Mermaid suites share merged canonical testspec after doc-reorg (AD-006/009)
    const mermaidSpec = readRepoFile('doc/test/mermaid/testspec-mermaid.md');
    const wysiwyg = readRepoFile('doc/test/testspec-vsc-md-wysiwyg.md');

    assert.ok(
      /redux-dark|theme:\s*'redux'|→\s*`redux`/i.test(mermaidSpec),
      'contrast-readable must expect redux kind map',
    );
    assert.ok(
      /redux-dark|kind-theme-redux|→\s*`redux`/i.test(mermaidSpec),
      'snap-style must expect redux kind map',
    );
    assert.ok(
      /TC-149[\s\S]*redux-dark|TC-149[\s\S]*'redux'|TC-149[\s\S]*→\s*`redux`/i.test(wysiwyg),
      'wysiwyg TC-149 must expect light→redux / dark|HC→redux-dark',
    );
    assert.ok(
      /永続必須.*vscode-foreground|唯一正としない|安全網|Host CSS 縮小/i.test(mermaidSpec),
      'edge-styles must not treat vscode-foreground stroke as sole mandatory contract',
    );

    const edgeSuite = readRepoFile('src/test/suite/unit/fix-mermaid-edge-styles.test.ts');
    const contrastSuite = readRepoFile('src/test/suite/unit/mermaid-contrast-readable.test.ts');
    const snapSuite = readRepoFile('src/test/suite/unit/mermaid-snap-style-with-source.test.ts');
    const previewQuality = readRepoFile('src/test/suite/unit/preview-mode-quality.test.ts');

    assert.ok(
      !/assert\.strictEqual\(\s*config\.theme,\s*'default'/.test(edgeSuite) &&
        !/assert\.strictEqual\(\s*config\.theme,\s*'dark'/.test(edgeSuite),
      'edge-styles suite must not assert classic default/dark themes',
    );
    assert.ok(
      !/theme 'default'|theme 'dark' \(standard kind map/.test(contrastSuite),
      'contrast-readable suite must not assert classic default/dark',
    );
    assert.ok(
      !/light:\s*'default'|dark:\s*'dark'/.test(snapSuite),
      'snap-style suite must not assert classic kind map',
    );
    assert.ok(
      !/maps to Mermaid theme 'dark'|map to default theme/.test(previewQuality),
      'preview-mode-quality TC-149 must not assert classic default/dark',
    );
  });

  test('TC-019: sanitize removes script and on* while keeping safe label', () => {
    const sanitized = runProductionSanitize(XSS_LABEL_SVG);
    assert.ok(!/<script\b/i.test(sanitized), 'script tags must be removed');
    assert.ok(!/\son\w+\s*=/i.test(sanitized), 'on* event attributes must be removed');
    assert.ok(/Cause A/.test(sanitized), 'safe foreignObject label text must remain (HIP)');
  });

  test('TC-020: mermaid island CSS does not force a light surface', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !islandSelectorHasLightSurface(css),
      '.mermaid-preview / .mermaid-block must not force a bright fixed surface',
    );
  });
});
