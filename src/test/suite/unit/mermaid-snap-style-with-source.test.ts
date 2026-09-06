/**
 * mermaid-snap-style-with-source — Preview/Markdown source co-display + redux kind theme map.
 * Island-light + classic default/dark withdrawn (mermaid-redux-elk-fidelity / fix-mermaid-edge-styles).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

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

/** Preview 専用の .mermaid-source 非表示ルール（撤廃対象 AD-003） */
function hasPreviewMermaidSourceHideRule(css: string): boolean {
  return /body\[data-mode=['"]preview['"]\][\s\S]*?\.mermaid-source[\s\S]*?display\s*:\s*none/.test(
    css,
  );
}

function hasPreviewMermaidPreviewHideRule(css: string): boolean {
  return /body\[data-mode=['"]preview['"]\][\s\S]*?\.mermaid-preview[\s\S]*?display\s*:\s*none/.test(
    css,
  );
}

function hasMarkdownMermaidSourceHideRule(css: string): boolean {
  return /body\[data-mode=['"]markdown['"]\][\s\S]*?\.mermaid-source[\s\S]*?display\s*:\s*none/.test(
    css,
  );
}

/** 島セレクタブロックに明るい背景があるか（contrast-readable と同趣旨） */
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

/** NodeView 構築順: mermaid-preview 追加が mermaid-source より先 */
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

type MermaidThemeConfig = {
  theme: string;
  themeVariables: Record<string, string>;
  securityLevel: string;
};

suite('mermaid-snap-style-with-source', () => {
  // --- P0 ---

  test('TC-001: Preview shows mermaid-source and mermaid-preview (no hide CSS)', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !hasPreviewMermaidSourceHideRule(css),
      'Preview must not hide .mermaid-source via display:none (AD-001/003; old hide rule must be removed)',
    );
    assert.ok(
      !hasPreviewMermaidPreviewHideRule(css),
      'Preview must not hide .mermaid-preview',
    );
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(editorSrc.includes('mermaid-source'), 'NodeView must render mermaid-source');
    assert.ok(editorSrc.includes('mermaid-preview'), 'NodeView must render mermaid-preview');
  });

  test('TC-002: Preview-only mermaid-source hide CSS rule is absent', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !hasPreviewMermaidSourceHideRule(css),
      "body[data-mode='preview'] .mermaid-source { display: none } must not exist (AD-003)",
    );
    // 同等: visibility:hidden / 専用 hide クラスも禁止の近似
    assert.ok(
      !/body\[data-mode=['"]preview['"]\]\s+\.mermaid-source\s*\{[^}]*visibility\s*:\s*hidden/.test(
        css,
      ),
      'Preview must not hide .mermaid-source via visibility:hidden',
    );
  });

  test('TC-003: Mermaid NodeView DOM order is preview then source', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      mermaidPreviewAppendedBeforeSource(editorSrc),
      '.mermaid-preview must be appended before .mermaid-source (figure above source; AD-002)',
    );
  });

  test('TC-004: Markdown keeps mermaid-source and mermaid-preview visible with preview→source order', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !hasMarkdownMermaidSourceHideRule(css),
      'Markdown must not hide .mermaid-source',
    );
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(editorSrc.includes('mermaid-source'), 'NodeView must render mermaid-source');
    assert.ok(editorSrc.includes('mermaid-preview'), 'NodeView must render mermaid-preview');
    assert.ok(
      mermaidPreviewAppendedBeforeSource(editorSrc),
      'Markdown Mermaid block order must be preview → source',
    );
  });

  test('TC-005: VS Code kinds map to Mermaid redux themes with strict', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');

    const expected: Record<string, string> = {
      light: 'redux',
      dark: 'redux-dark',
      highContrast: 'redux-dark',
    };
    for (const kind of ['light', 'dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.theme,
        expected[kind],
        `kind ${kind} must map to theme '${expected[kind]}' (redux kind map)`,
      );
      assert.strictEqual(config.securityLevel, 'strict', 'securityLevel strict must remain');
      assert.strictEqual(
        config.themeVariables?.fontSize,
        '8px',
        `kind ${kind}: themeVariables.fontSize must be '8px' (mermaid-display-density)`,
      );
      for (const value of Object.values(config.themeVariables ?? {})) {
        assert.ok(!value.includes('var(--vscode-'), `themeVariables must not use var(--vscode-*): ${value}`);
      }
    }
  });

  test('TC-006: mermaid island CSS does not force a light surface', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !islandSelectorHasLightSurface(css),
      '.mermaid-preview / .mermaid-block must not force a bright fixed surface (AD-005 withdrawn)',
    );
  });

  test('TC-007: Preview syntax error keeps mermaid-source visible', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !hasPreviewMermaidSourceHideRule(css),
      'Preview must not hide .mermaid-source on syntax error (AD-010)',
    );
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /mermaid-error/.test(editorSrc),
      'invalid mermaid must render .mermaid-error in preview area',
    );
    // エラー経路でソース DOM を外さない（append 後に remove していない）
    assert.ok(
      /classList\.add\(['"]mermaid-source['"]\)/.test(editorSrc),
      'mermaid-source element must remain in NodeView',
    );
  });

  test('TC-008: Preview mermaid source is read-only (Document not updated from source edits)', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    // Preview では setEditable(false) — ソース contentDOM への編集が Document に乗らない
    assert.ok(
      /mode\s*===\s*['"]preview['"][\s\S]*?setEditable\(\s*false/.test(editorSrc) ||
        /setEditable\(\s*mode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'Preview must keep TipTap non-editable so mermaid-source edits do not reach Document (AD-004)',
    );
    assert.ok(
      /editable:\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc) ||
        /setEditable\(\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'editable only when markdown mode',
    );
  });

  test('TC-009: HIP foreignobject and securityLevel strict remain', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /HTML_INTEGRATION_POINTS\s*:\s*\{[\s\S]*?foreignobject\s*:\s*true/i.test(editorSrc),
      'HTML_INTEGRATION_POINTS: { foreignobject: true } required (AD-008)',
    );
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    const config = buildMermaidThemeConfig!('light');
    assert.strictEqual(config.securityLevel, 'strict');
  });

  // --- P1 ---

  test('TC-010: #editor wide surface has no new bright fixed background', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !editorHasBrightFixedBackground(css),
      '#editor must not gain a bright fixed background outside Mermaid island (AD-006)',
    );
  });

  test('TC-011: display-layer mermaid changes do not touch Document serialize APIs', () => {
    const serializerSrc = readRepoFile('src/serializers/markdown-serializer.ts');
    const documentSrc = readRepoFile('src/providers/markdown-document.ts');
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg|mermaid-preview|mermaid-source/.test(
        serializerSrc,
      ),
      'markdown-serializer must not own Mermaid display CSS/DOM',
    );
    assert.ok(
      !/HTML_INTEGRATION_POINTS|sanitizeMermaidSvg|body\[data-mode/.test(documentSrc),
      'markdown-document must not own Mermaid display sanitize/CSS',
    );
    const editorCss = readRepoFile('media/editor.css');
    assert.ok(
      /\.mermaid-(?:preview|source|block)/.test(editorCss),
      'Mermaid display styling stays in Webview CSS layer',
    );
  });

  test('TC-012: themeUpdated path follows redux kind map and strict', () => {
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(
      /handleThemeUpdated/.test(themeSrc),
      'handleThemeUpdated must exist for themeUpdated path (AD-013)',
    );
    assert.ok(
      /buildMermaidThemeConfig\(kind\)/.test(themeSrc),
      'themeUpdated must re-initialize via buildMermaidThemeConfig',
    );
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig);
    const expected: Record<string, string> = {
      light: 'redux',
      dark: 'redux-dark',
      highContrast: 'redux-dark',
    };
    for (const kind of ['light', 'dark', 'highContrast'] as const) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.theme,
        expected[kind],
        `themeUpdated: kind ${kind} → '${expected[kind]}'`,
      );
      assert.strictEqual(config.securityLevel, 'strict');
    }
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /case\s+['"]themeUpdated['"]/.test(editorSrc) && /handleThemeUpdated/.test(editorSrc),
      'Webview must wire themeUpdated to handleThemeUpdated',
    );
  });

  test('TC-013: wysiwyg TC-130–132 Expected align with source-visible contract', () => {
    const wysiwyg = readRepoFile('doc/testspec-vsc-md-wysiwyg.md');
    assert.ok(
      /TC-130[\s\S]*?両方が表示|TC-130[\s\S]*?source.*visible|TC-130[\s\S]*?ソース併記/i.test(
        wysiwyg,
      ),
      'TC-130 Expected must require source visible (not hidden)',
    );
    assert.ok(
      !/\|\s*TC-130\s*\|[^\n]*非表示/.test(wysiwyg) ||
        /旧.*非表示.*撤回/.test(wysiwyg),
      'TC-130 must not keep old Preview-hide Expected without withdrawal note',
    );
    assert.ok(
      /TC-132[\s\S]*?表示したまま|TC-132[\s\S]*?source\s*\*\*表示|TC-132[\s\S]*?source \*\*visible/i.test(
        wysiwyg,
      ),
      'TC-132 Expected must keep source visible on error',
    );
    // テストコード側も旧「hides」断言を残さない
    const richEmbed = readRepoFile('src/test/suite/unit/preview-rich-embed.test.ts');
    assert.ok(
      !/TC-130:[\s\S]*?hides mermaid-source/.test(richEmbed),
      'preview-rich-embed TC-130 title/assert must not expect hide',
    );
    assert.ok(
      !/TC-132:[\s\S]*?source stays hidden/.test(richEmbed),
      'preview-rich-embed TC-132 must not expect source hidden',
    );
  });

  test('TC-014: HIP strict and no-island regression still hold', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /HTML_INTEGRATION_POINTS\s*:\s*\{[\s\S]*?foreignobject\s*:\s*true/i.test(editorSrc),
      'HIP foreignobject must remain (contrast-readable regression)',
    );
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig);
    assert.strictEqual(buildMermaidThemeConfig!('light').securityLevel, 'strict');
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !islandSelectorHasLightSurface(css),
      'island light surface must not be forced (fix-mermaid-edge-styles AD-005)',
    );
    const suitePath = path.resolve(
      process.cwd(),
      'src/test/suite/unit/mermaid-contrast-readable.test.ts',
    );
    assert.ok(fs.existsSync(suitePath), 'mermaid-contrast-readable suite must still exist');
  });
});
