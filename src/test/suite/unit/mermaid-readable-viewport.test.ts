/**
 * mermaid-readable-viewport — global fontSize 10px, title visibility,
 * Editor Preview / Rich Editor viewport fit / zoom / pan / scroll / re-fit / a11y,
 * density≠viewport, Default Preview exclusion, redux / HIP / strict / nonce / ELK regressions.
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

const KINDS = ['light', 'dark', 'highContrast'] as const;

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

/** Density must not rely on CSS scale/zoom on .mermaid-preview as the primary shrink. */
function densityUsesCssScaleAsPrimary(css: string, editorSrc: string): boolean {
  const previewScale =
    /\.mermaid-preview[^{]*\{[^}]*(?:transform\s*:\s*scale\(|zoom\s*:)/i.test(css) ||
    /\.mermaid-block[^{]*\{[^}]*(?:transform\s*:\s*scale\(|zoom\s*:)/i.test(css);
  // Viewport zoom may use transform — only flag if density comments / fontSize path is absent
  // and scale is applied as a fixed shrink without viewport helpers.
  const hasViewportZoomApi =
    /fitToViewport|fitMermaidViewport|mermaid-viewport|zoomIn|zoomOut|aria-label=['"]Zoom/i.test(
      editorSrc,
    );
  return previewScale && !hasViewportZoomApi;
}

/** Title visibility contract: overflow / viewBox / padding, plus title align/shift to diagram. */
function hasTitleVisibilityContract(editorSrc: string, css: string): boolean {
  const joined = `${editorSrc}\n${css}`;
  const hasPadOrOverflow =
    /title.*(overflow|viewBox|padding|clip)|overflow.*visible|viewBox.*(title|pad)|mermaid.*title.*(visible|clip|padding)/i.test(
      joined,
    ) ||
    /ensureTitleVisible|titleNotClipped|mermaidTitlePadding|adjustMermaidViewBox/i.test(joined);
  const hasAlignOrShift =
    /alignMermaidTitleToDiagram|shiftSvgTextByX|title.*(?:align|shift)|diagram.*(?:left|content).*title|titleLeft|alignTitle/i.test(
      editorSrc,
    );
  return hasPadOrOverflow && hasAlignOrShift;
}

/** Initial fit / contain / fit-to-viewport helpers present. */
function hasInitialFitContract(editorSrc: string, css: string): boolean {
  const joined = `${editorSrc}\n${css}`;
  return (
    /fitToViewport|fitMermaid|fit-to-viewport|contain.*viewport|object-fit\s*:\s*contain|mermaid.*\bfit\b/i.test(
      joined,
    ) && /mermaid-(?:viewport|preview|block)/i.test(joined)
  );
}

/** Zoom in / out controls (or API) with viewport transform separate from fontSize. */
function hasZoomControls(editorSrc: string): boolean {
  const hasLabels =
    /aria-label\s*=\s*['"]Zoom in['"]/i.test(editorSrc) &&
    /aria-label\s*=\s*['"]Zoom out['"]/i.test(editorSrc);
  const hasApi =
    /zoomIn|zoomOut|mermaidZoom|applyViewportZoom|viewportScale/i.test(editorSrc);
  return hasLabels || hasApi;
}

function hasFitAriaLabel(editorSrc: string): boolean {
  return (
    /aria-label\s*=\s*['"]Fit['"]/i.test(editorSrc) ||
    /aria-label\s*=\s*['"]Fit to viewport['"]/i.test(editorSrc)
  );
}

/** Pan within frame without mandating a specific modifier key. */
function hasPanWithinFrameContract(editorSrc: string): boolean {
  return (
    /mermaid.*pan|panMermaid|onPointerDown|pointerdown|mousedown.*drag|isPanning|viewportPan/i.test(
      editorSrc,
    ) && /mermaid-(?:viewport|preview|block)/i.test(editorSrc)
  );
}

function hasScrollbarOverflowContract(css: string, editorSrc: string): boolean {
  const joined = `${css}\n${editorSrc}`;
  return (
    /mermaid-(?:viewport|preview)[^{]*\{[^}]*overflow\s*:\s*(?:auto|scroll)/i.test(joined) ||
    /overflow\s*:\s*(?:auto|scroll)[\s\S]{0,80}mermaid-(?:viewport|preview)/i.test(joined) ||
    /classList\.add\(['"]mermaid-viewport['"]\)/.test(editorSrc)
  );
}

function hasRefitOnRerender(editorSrc: string): boolean {
  return (
    /reFit|refit|fitToViewport|fitMermaidViewport/i.test(editorSrc) &&
    /debounce|renderMermaid|mermaid\.render/i.test(editorSrc)
  );
}

function hasRefitOnThemeUpdated(editorSrc: string, themeSrc: string): boolean {
  const joined = `${editorSrc}\n${themeSrc}`;
  return (
    /themeUpdated|handleThemeUpdated/i.test(joined) &&
    /reFit|refit|fitToViewport|fitMermaidViewport/i.test(joined)
  );
}

function hasViewportUiInNodeView(editorSrc: string): boolean {
  return (
    /mermaid-viewport|Zoom in|zoomIn|fitToViewport/i.test(editorSrc) &&
    /mermaid-block|addNodeView/i.test(editorSrc)
  );
}

function nativePreviewPathHasMermaidViewportUi(
  providerSrc: string,
  editorSrc: string,
  commandsSrc: string,
): boolean {
  // native-preview command / Default Preview must not embed Mermaid viewport chrome
  const nativeSlices = [providerSrc, editorSrc, commandsSrc]
    .map((src) => {
      const matches = src.match(
        /native-preview[\s\S]{0,500}|openNativePreview[\s\S]{0,500}|markdown\.showPreview[\s\S]{0,400}/gi,
      );
      return matches ? matches.join('\n') : '';
    })
    .join('\n');
  return /mermaid-viewport|aria-label=['"]Zoom|fitToViewport|zoomIn/i.test(nativeSlices);
}

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

function hasElkRegistration(sources: string[]): boolean {
  const joined = sources.join('\n');
  return /@mermaid-js\/layout-elk/.test(joined) || /registerLayoutLoaders/.test(joined);
}

suite('mermaid-readable-viewport', () => {
  // --- P0 ---

  test('TC-001: all kinds use themeVariables.fontSize 10px (not 8px/13px)', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of KINDS) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.themeVariables?.fontSize,
        '10px',
        `kind ${kind}: themeVariables.fontSize must be '10px' (mermaid-readable-viewport)`,
      );
      assert.notStrictEqual(
        config.themeVariables?.fontSize,
        '13px',
        `kind ${kind}: legacy '13px' must not remain`,
      );
      assert.notStrictEqual(
        config.themeVariables?.fontSize,
        '8px',
        `kind ${kind}: legacy '8px' must not remain`,
      );
    }
  });

  test('TC-002: themeVariables must not use var(--vscode-...)', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of KINDS) {
      const config = buildMermaidThemeConfig!(kind);
      for (const value of Object.values(config.themeVariables ?? {})) {
        assert.ok(
          !value.includes('var(--vscode-'),
          `kind ${kind}: themeVariables must not use var(--vscode-*): ${value}`,
        );
      }
    }
  });

  test('TC-003: density must not use CSS scale/zoom as primary means', () => {
    const css = readRepoFile('media/editor.css');
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(
      /fontSize\s*:\s*['"]10px['"]/.test(themeSrc),
      "density primary means must be themeVariables.fontSize '10px'",
    );
    assert.ok(
      !densityUsesCssScaleAsPrimary(css, editorSrc),
      'density must not rely on transform:scale / zoom as primary shrink (viewport transform is separate)',
    );
  });

  test('TC-004: title visibility contract keeps full title without clip', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const css = readRepoFile('media/editor.css');
    assert.ok(
      hasTitleVisibilityContract(editorSrc, css),
      'display-layer must adjust viewBox / overflow / padding and align/shift title so it does not hang left of diagram content (AD-003)',
    );
    assert.ok(
      /ensureTitleVisible/.test(editorSrc) && /alignMermaidTitleToDiagram/.test(editorSrc),
      'ensureTitleVisible path must align/shift Mermaid title relative to diagram content',
    );
    const serializerSrc = readRepoFile('src/serializers/markdown-serializer.ts');
    const documentSrc = readRepoFile('src/providers/markdown-document.ts');
    assert.ok(
      !/ensureTitleVisible|titleNotClipped|adjustMermaidViewBox|alignMermaidTitleToDiagram/i.test(
        serializerSrc,
      ),
      'title visibility must not live in markdown-serializer (docJson/markdownText untouched)',
    );
    assert.ok(
      !/ensureTitleVisible|titleNotClipped|adjustMermaidViewBox|alignMermaidTitleToDiagram/i.test(
        documentSrc,
      ),
      'title visibility must not live in markdown-document',
    );
  });

  test('TC-005: initial viewport fits diagram within frame', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const css = readRepoFile('media/editor.css');
    assert.ok(
      hasInitialFitContract(editorSrc, css),
      'after successful render, Mermaid NodeView must fit-to-viewport / contain (AD-004)',
    );
  });

  test('TC-006: zoom in/out changes viewport transform while fontSize stays 10px', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    assert.ok(hasZoomControls(editorSrc), 'Zoom in / Zoom out controls or API required (AD-005)');
    for (const kind of KINDS) {
      assert.strictEqual(
        buildMermaidThemeConfig!(kind).themeVariables?.fontSize,
        '10px',
        'zoom must not change density fontSize away from 10px',
      );
    }
    assert.ok(
      /transform|viewportScale|scale\(/i.test(editorSrc),
      'zoom must use viewport transform (or equivalent), separate from fontSize density',
    );
  });

  test('TC-007: zoom/fit controls are keyboard-reachable with aria-label', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(hasZoomControls(editorSrc), 'Zoom in / Zoom out required');
    assert.ok(hasFitAriaLabel(editorSrc), "Fit control must expose aria-label (e.g. 'Fit')");
    assert.ok(
      /<button|createElement\(\s*['"]button['"]\)/.test(editorSrc) &&
        /aria-label\s*=\s*['"]Zoom/i.test(editorSrc),
      'zoom/fit must be keyboard-reachable native buttons (or equivalent) with aria-label (AD-011)',
    );
    const css = readRepoFile('media/editor.css');
    assert.ok(
      /mermaid.*(--vscode-|var\(--vscode-)/i.test(css) ||
        /mermaid-viewport|mermaid-zoom/i.test(editorSrc),
      'viewport control contrast should follow --vscode-* tokens',
    );
  });

  test('TC-008: pan within frame is possible without mandatory modifier lock', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasPanWithinFrameContract(editorSrc),
      'frame pan/drag handler (or equivalent) required (AD-006); gesture may vary',
    );
    // Spec Gap RK-004: do not require a specific modifier / middle-button
    assert.ok(
      !/mustHold(?:Alt|Ctrl|Meta|Shift)|requireMiddleButton|panRequiresModifier\s*=\s*true/i.test(
        editorSrc,
      ),
      'must not hard-require a single modifier/middle-button as the only pan path',
    );
    assert.ok(
      /editable:\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc) ||
        /setEditable\(\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'pan must remain a view-only gesture (Preview RO / editable only in markdown)',
    );
  });

  test('TC-009: scrollbars (or overflow scroll) when zoomed beyond frame', () => {
    const css = readRepoFile('media/editor.css');
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasScrollbarOverflowContract(css, editorSrc),
      'zoomed diagrams must allow overflow auto/scroll (or mermaid-viewport equivalent) (AD-006)',
    );
  });

  test('TC-010: re-fit after source change / debounce re-render', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasRefitOnRerender(editorSrc),
      'after debounce re-render, Mermaid block viewport must re-fit (AD-007)',
    );
  });

  test('TC-011: re-fit after themeUpdated bulk re-render', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(
      hasRefitOnThemeUpdated(editorSrc, themeSrc),
      'themeUpdated re-render path must re-fit Mermaid viewports (§5 正常系 9)',
    );
  });

  test('TC-012: Preview viewport ops do not edit Document', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /mode\s*===\s*['"]preview['"][\s\S]*?setEditable\(\s*false/.test(editorSrc) ||
        /setEditable\(\s*mode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'Preview must keep TipTap non-editable (AD-009)',
    );
    assert.ok(
      /editable:\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc) ||
        /setEditable\(\s*!readonly\s*&&\s*editorMode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'editable only when markdown mode — zoom/pan must not dirty Document',
    );
    // Viewport handlers must not post Document edit payloads
    assert.ok(
      !/zoomIn[\s\S]{0,200}postMessage[\s\S]{0,80}(docJson|markdownText|edit)/i.test(editorSrc),
      'zoom/pan handlers must not post Document edit messages',
    );
  });

  test('TC-013: Default Preview (native-preview) has no Mermaid viewport UI', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    const editorSrc = readRepoFile('media/editor.ts');
    let commandsSrc = '';
    const commandsPath = path.resolve(process.cwd(), 'src/commands');
    if (fs.existsSync(commandsPath)) {
      for (const name of fs.readdirSync(commandsPath)) {
        if (name.endsWith('.ts')) {
          commandsSrc += readRepoFile('src/commands', name);
        }
      }
    }
    assert.ok(
      !nativePreviewPathHasMermaidViewportUi(providerSrc, editorSrc, commandsSrc),
      'native-preview / Default Preview must not embed Mermaid zoom/pan/Fit UI (AD-002)',
    );
  });

  test('TC-014: redux kind map and securityLevel strict regression', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of KINDS) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.theme,
        REDUX_KIND_THEME_MAP[kind],
        `kind ${kind} → theme '${REDUX_KIND_THEME_MAP[kind]}' (not classic default/dark)`,
      );
      assert.strictEqual(config.securityLevel, 'strict');
      assert.notStrictEqual(config.theme, 'default');
      assert.notStrictEqual(config.theme, 'dark');
    }
  });

  test('TC-015: HIP foreignobject and securityLevel strict regression', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /HTML_INTEGRATION_POINTS\s*:\s*\{[\s\S]*?foreignobject\s*:\s*true/i.test(editorSrc),
      'HTML_INTEGRATION_POINTS: { foreignobject: true } required (AD-008)',
    );
    const options = extractSanitizeMermaidSvgOptions(editorSrc);
    const hip = (options as Config & { HTML_INTEGRATION_POINTS?: { foreignobject?: boolean } })
      .HTML_INTEGRATION_POINTS;
    assert.ok(hip?.foreignobject === true, 'sanitize options must enable foreignobject HIP');
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig);
    for (const kind of KINDS) {
      assert.strictEqual(buildMermaidThemeConfig!(kind).securityLevel, 'strict');
    }
  });

  test('TC-016: nonce reinject and ELK opt-in (no global elk) regression', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      hasPresentationNonceReinject(editorSrc),
      'Host-identical nonce presentation <style> reinject under .mermaid-preview required',
    );
    const styleSrcLines = providerSrc
      .split('\n')
      .filter((line) => /style-src/.test(line) && !/marp/i.test(line));
    assert.ok(styleSrcLines.length > 0, 'Custom Editor style-src line required');
    for (const line of styleSrcLines) {
      assert.ok(!/unsafe-inline/.test(line), `style-src must not include 'unsafe-inline': ${line}`);
    }
    assert.ok(
      hasElkRegistration([editorSrc, themeSrc]),
      '@mermaid-js/layout-elk / registerLayoutLoaders must remain available (opt-in)',
    );
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig);
    for (const kind of KINDS) {
      assert.ok(
        buildMermaidThemeConfig!(kind).layout !== 'elk',
        `buildMermaidThemeConfig(${kind}) must not force layout: 'elk'`,
      );
    }
  });

  // --- P1 ---

  test('TC-017: syntax error shows mermaid-error and hides or disables viewport UI', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(/mermaid-error/.test(editorSrc), 'invalid mermaid must render .mermaid-error');
    assert.ok(
      hasViewportUiInNodeView(editorSrc),
      'viewport UI must exist so error path can hide/disable it',
    );
    assert.ok(
      /mermaid-error[\s\S]{0,400}(mermaid-viewport|zoom|disabled|hidden|aria-hidden)/i.test(
        editorSrc,
      ) ||
        /(mermaid-viewport|zoomControls)[\s\S]{0,400}mermaid-error/i.test(editorSrc) ||
        /hideViewport|disableViewport|viewport.*disabled/i.test(editorSrc),
      'on syntax error, viewport UI must be hidden or disabled',
    );
  });

  test('TC-018: viewport UX present for preview and markdown Mermaid NodeView', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasViewportUiInNodeView(editorSrc),
      'Mermaid NodeView (shared by preview + markdown) must include viewport UX (AD-002)',
    );
    // raw mode is out of scope; island lives on Markdown/Preview surface
    assert.ok(
      /editorMode|data-mode/.test(editorSrc),
      'editorMode plumbing must remain so viewport stays on preview/markdown surfaces',
    );
  });

  test('TC-019: per-diagram fontSize override remains allowed without breaking global 10px', () => {
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /fontSize\s*:\s*['"]10px['"]/.test(themeSrc),
      "global default remains '10px'",
    );
    // Mermaid native frontmatter / %%{init}%% is delegated — do not strip themeVariables
    assert.ok(
      !/stripThemeVariables|delete.*fontSize|forbid.*fontSize|block.*%%\{init/i.test(
        `${themeSrc}\n${editorSrc}`,
      ),
      'must not strip per-diagram themeVariables.fontSize overrides (native priority)',
    );
  });

  test('TC-020: related suites Expected align with global fontSize 10px', () => {
    const relatedSuites = [
      'src/test/suite/unit/mermaid-redux-elk-fidelity.test.ts',
      'src/test/suite/unit/fix-mermaid-edge-styles.test.ts',
      'src/test/suite/unit/mermaid-contrast-readable.test.ts',
      'src/test/suite/unit/mermaid-snap-style-with-source.test.ts',
      'src/test/suite/unit/preview-mode-quality.test.ts',
    ];
    for (const suitePath of relatedSuites) {
      const src = readRepoFile(suitePath);
      assert.ok(
        !/fontSize[\s\S]{0,40}'13px'|fontSize[\s\S]{0,40}"13px"/.test(src),
        `${suitePath} must not still require fontSize '13px'`,
      );
      assert.ok(
        /fontSize[\s\S]{0,80}'10px'|fontSize[\s\S]{0,80}"10px"/.test(src),
        `${suitePath} must expect fontSize '10px'`,
      );
    }
    const relatedSpecs = [
      'doc/testspec-mermaid-redux-elk-fidelity.md',
      'doc/testspec-fix-mermaid-edge-styles.md',
      'doc/testspec-mermaid-contrast-readable.md',
      'doc/testspec-mermaid-snap-style-with-source.md',
      'doc/testspec-vsc-md-wysiwyg.md',
    ];
    for (const specPath of relatedSpecs) {
      const spec = readRepoFile(specPath);
      // TC-facing Expected should prefer 10px; allow historical changelog mentions of 8px/13px
      const matrixOrTc149 =
        /fontSize[^|\n]*10px|`10px`|'10px'|"10px"/.test(spec) ||
        /TC-149[\s\S]{0,200}10px/.test(spec);
      assert.ok(matrixOrTc149, `${specPath} Expected should align with global fontSize 10px`);
    }
  });

  test('TC-021: Mermaid NodeView DOM order is preview then source', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      mermaidPreviewAppendedBeforeSource(editorSrc),
      '.mermaid-preview must be appended before .mermaid-source',
    );
  });

  test('TC-022: viewport state is not session-persisted', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    const joined = `${editorSrc}\n${providerSrc}`;
    assert.ok(
      !/workspaceState\.(?:get|update)\([^)]*mermaid.*(?:zoom|viewport|pan)/i.test(joined) &&
        !/globalState\.(?:get|update)\([^)]*mermaid.*(?:zoom|viewport|pan)/i.test(joined) &&
        !/configuration\.(?:get|update)\([^)]*mermaid.*(?:zoom|viewport|pan)/i.test(joined),
      'MVP must not persist Mermaid viewport zoom/pan in settings / workspaceState (AD-007)',
    );
  });

  test('TC-023: display-layer viewport changes do not touch Document serialize APIs', () => {
    const serializerSrc = readRepoFile('src/serializers/markdown-serializer.ts');
    const documentSrc = readRepoFile('src/providers/markdown-document.ts');
    assert.ok(
      !/fitToViewport|mermaid-viewport|zoomIn|HTML_INTEGRATION_POINTS|sanitizeMermaidSvg/.test(
        serializerSrc,
      ),
      'markdown-serializer must not own Mermaid viewport/display',
    );
    assert.ok(
      !/fitToViewport|mermaid-viewport|zoomIn|HTML_INTEGRATION_POINTS|sanitizeMermaidSvg/.test(
        documentSrc,
      ),
      'markdown-document must not own Mermaid viewport/display',
    );
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(/buildMermaidThemeConfig/.test(themeSrc), 'theme helper stays in display-layer utils');
  });
});
