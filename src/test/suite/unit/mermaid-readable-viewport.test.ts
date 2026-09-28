/**
 * mermaid-readable-viewport — global fontSize 16px, label typography (trebuchet / line-height 1),
 * title visibility, natural scale 1 (Fit-only contain) / center / zoom-origin-center / pan / scroll / a11y,
 * density≠viewport, Default Preview exclusion, redux / HIP / strict / nonce / ELK regressions.
 * Intentional Red until build-agent lands mermaid-label-metrics (tests-only phase).
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
  flowchart?: { wrappingWidth: number; padding: number };
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

/**
 * Initial / re-render / themeUpdated contain the diagram in the frame.
 * Scale may exceed 1 so a small diagram grows to the limiting edges.
 */
function hasContainFillOnRenderContract(editorSrc: string): boolean {
  const callsFitAfterSuccess =
    /setViewportUiEnabled\(\s*true\s*\)[\s\S]{0,500}fitToViewport\s*\(/.test(editorSrc);
  const canScaleUp =
    /function\s+fitToViewport[\s\S]{0,1600}Math\.min\(\s*frameW\s*\//.test(editorSrc) &&
    !/Math\.min\(\s*1\s*,\s*frameW/.test(editorSrc);
  return callsFitAfterSuccess && canScaleUp;
}

/** Fit button (aria-label Fit) still performs contain / fit-to-viewport. */
function hasFitButtonContainContract(editorSrc: string): boolean {
  return (
    /fitBtn[\s\S]{0,250}fitToViewport/i.test(editorSrc) ||
    /aria-label\s*=\s*['"]Fit['"][\s\S]{0,500}fitToViewport/i.test(editorSrc) ||
    (/function\s+fitToViewport\b/.test(editorSrc) &&
      /fitBtn\.addEventListener\(\s*['"]click['"]/.test(editorSrc))
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

/** After debounce re-render, viewport contain-fits again (may scale above 1). */
function hasContainOnRerender(editorSrc: string): boolean {
  return (
    /debounce|renderMermaid|mermaid\.render|renderPreview/i.test(editorSrc) &&
    hasContainFillOnRenderContract(editorSrc)
  );
}

/** themeUpdated bulk re-render contain-fits the viewport again. */
function hasScaleOneOnThemeUpdated(editorSrc: string, themeSrc: string): boolean {
  const joined = `${editorSrc}\n${themeSrc}`;
  return /themeUpdated|handleThemeUpdated/i.test(joined) && hasContainFillOnRenderContract(editorSrc);
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

/**
 * Smaller axes are centered after natural scale 1 and after Fit contain (AD-006 / §5 7c).
 * Fit path should still call fitToViewport; centering helper may be shared.
 */
function hasCenterOnSmallerAxesContract(editorSrc: string, css: string): boolean {
  const joined = `${editorSrc}\n${css}`;
  const hasCenterHelper =
    /center(?:After)?Fit|centerMermaid(?:Viewport)?|centerOnSmallerAxes|centerViewportAxes/i.test(
      joined,
    ) ||
    /scrollLeft\s*=\s*Math\.(?:max|floor|round)\s*\([^;]*(?:\/\s*2|-\s*frame)/i.test(editorSrc) ||
    /scrollTop\s*=\s*Math\.(?:max|floor|round)\s*\([^;]*(?:\/\s*2|-\s*frame)/i.test(editorSrc) ||
    /justify-content\s*:\s*center/i.test(css) ||
    /\.mermaid-viewport(?:-canvas)?[^{]*\{[^}]*(?:margin\s*:\s*auto|place-content\s*:\s*center)/i.test(
      css,
    ) ||
    /translate\(\s*[^,)]+\/\s*2/i.test(editorSrc);
  return hasCenterHelper;
}

/** Measure Host-nonce CSS matches density typography (font-size / family / line-height). */
function hasMeasureLabelTypographyContract(editorSrc: string): boolean {
  const hasFontSize =
    /font-size:\s*\$\{MERMAID_DENSITY_FONT_SIZE\}|font-size:\s*16px/.test(editorSrc);
  const hasFontFamily =
    /font-family:\s*[^;]*trebuchet\s*ms/i.test(editorSrc) &&
    /font-family:\s*[^;]*verdana/i.test(editorSrc) &&
    /font-family:\s*[^;]*arial/i.test(editorSrc) &&
    /font-family:\s*[^;]*sans-serif/i.test(editorSrc);
  const hasLineHeight = /line-height:\s*1(?:\.0)?\s*!important\b/.test(editorSrc);
  return hasFontSize && hasFontFamily && hasLineHeight;
}

/** Zoom pivot / transform-origin is the viewport center, not top-left (AD-007). */
function hasZoomOriginViewportCenter(editorSrc: string, css: string): boolean {
  const joined = `${editorSrc}\n${css}`;
  const hasCenterOrigin =
    /transform-origin\s*:\s*(?:center|50%\s+50%|center\s+center)/i.test(joined) ||
    /transformOrigin\s*=\s*['"](?:center|50%)/i.test(editorSrc) ||
    /zoomOrigin|viewportCenter|pivot.*(?:center|viewport)/i.test(joined);
  const canvasPinnedTopLeft = /\.mermaid-viewport-canvas[^{]*\{[^}]*transform-origin\s*:\s*0\s+0/i.test(
    css,
  );
  return hasCenterOrigin && !canvasPinnedTopLeft;
}

/** Fit after pan restores the same centering path (scale-1 / Fit share centerOnSmallerAxes). */
function hasPanThenFitRecenterContract(editorSrc: string, css: string): boolean {
  const fitClearsPanOffset =
    /fitToViewport[\s\S]{0,400}scroll(?:Left|Top)\s*=/i.test(editorSrc) ||
    /fitBtn[\s\S]{0,200}fitToViewport/i.test(editorSrc) ||
    /fitToViewport[\s\S]{0,200}centerOnSmallerAxes/i.test(editorSrc);
  return (
    hasPanWithinFrameContract(editorSrc) &&
    hasFitAriaLabel(editorSrc) &&
    fitClearsPanOffset &&
    hasCenterOnSmallerAxesContract(editorSrc, css) &&
    hasFitButtonContainContract(editorSrc)
  );
}

suite('mermaid-readable-viewport', () => {
  // --- P0 ---

  test('TC-MRV-001: all kinds use themeVariables.fontSize 16px (not 12px/8px/13px)', () => {
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of KINDS) {
      const config = buildMermaidThemeConfig!(kind);
      assert.strictEqual(
        config.themeVariables?.fontSize,
        '16px',
        `kind ${kind}: themeVariables.fontSize must be '16px' (mermaid-readable-viewport)`,
      );
      assert.notStrictEqual(
        config.themeVariables?.fontSize,
        '12px',
        `kind ${kind}: legacy '12px' must not remain`,
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
      assert.notStrictEqual(
        config.themeVariables?.fontSize,
        '10px',
        `kind ${kind}: legacy '10px' must not remain`,
      );
      assert.strictEqual(
        config.flowchart?.wrappingWidth,
        200,
        `kind ${kind}: flowchart.wrappingWidth must be 200 (Default-like hug→wrap)`,
      );
      assert.strictEqual(
        config.flowchart?.padding,
        2,
        `kind ${kind}: flowchart.padding must be 2 (tight hug to glyphs)`,
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
      /fontSize\s*:\s*['"]16px['"]|MERMAID_DENSITY_FONT_SIZE\s*=\s*['"]16px['"]/.test(themeSrc),
      "density primary means must be themeVariables.fontSize '16px'",
    );
    assert.ok(
      !densityUsesCssScaleAsPrimary(css, editorSrc),
      'density must not rely on transform:scale / zoom as primary shrink (viewport transform is separate)',
    );
  });

  test('TC-003b: flowchart initialize passes wrappingWidth 200 and padding from config', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /wrappingWidth\s*:\s*config\.flowchart\.wrappingWidth|wrappingWidth\s*:\s*200/.test(editorSrc),
      'both mermaid.initialize paths must pass flowchart.wrappingWidth (200)',
    );
    assert.ok(
      /padding\s*:\s*config\.flowchart\.padding|padding\s*:\s*15/.test(editorSrc),
      'both mermaid.initialize paths must pass flowchart.padding from config',
    );
    // Both initializeMermaidTheme and registerMermaidThemeRuntime.initialize
    const initializeBlocks = editorSrc.match(/mermaid\.initialize\s*\(\s*\{[\s\S]*?\}\s*\)/g) ?? [];
    assert.ok(
      initializeBlocks.length >= 2,
      'expected both mermaid.initialize call sites',
    );
    for (const block of initializeBlocks) {
      assert.ok(
        /flowchart\s*:/.test(block) && /wrappingWidth/.test(block) && /padding/.test(block),
        'each mermaid.initialize must include flowchart wrappingWidth/padding',
      );
    }
  });

  test('TC-003c: Host-nonce measure CSS applies font-size 16px before mermaid.render', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /ensureMermaidMeasureFontCss/.test(editorSrc),
      'measure font CSS helper required before mermaid.render',
    );
    assert.ok(
      /ensureMermaidMeasureFontCss\s*\(\s*\)[\s\S]{0,200}mermaid\.render/.test(editorSrc),
      'ensureMermaidMeasureFontCss must run before mermaid.render',
    );
    assert.ok(
      /font-size:\s*\$\{MERMAID_DENSITY_FONT_SIZE\}|font-size:\s*16px/.test(editorSrc),
      'measure CSS must set font-size 16px on label context',
    );
    assert.ok(
      hasMeasureLabelTypographyContract(editorSrc),
      'measure CSS must set font-size 16px, font-family trebuchet ms/verdana/arial/sans-serif, line-height 1 !important',
    );
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(
      /MERMAID_DENSITY_FONT_SIZE\s*=\s*['"]16px['"]/.test(themeSrc),
      "MERMAID_DENSITY_FONT_SIZE must be '16px' so measure matches presentation",
    );
    assert.ok(
      /setAttribute\(\s*['"]nonce['"]/.test(editorSrc) &&
        /MERMAID_MEASURE_FONT_STYLE_ID|mermaid-density-measure-font/.test(editorSrc),
      'measure CSS must use Host-identical nonce (no style-src unsafe-inline)',
    );
    assert.ok(
      !/style-src[^;]*unsafe-inline/.test(readRepoFile('src/providers/markdown-editor-provider.ts')),
      "must not add style-src 'unsafe-inline'",
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

  test('TC-005: initial viewport contain-fits the frame and may scale above 1', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasContainFillOnRenderContract(editorSrc),
      'after successful render, Mermaid NodeView must contain-fit the frame (scale may exceed 1)',
    );
    assert.ok(
      hasFitButtonContainContract(editorSrc),
      'Fit button must still perform contain / fit-to-viewport',
    );
    assert.ok(
      hasScrollbarOverflowContract(readRepoFile('media/editor.css'), editorSrc),
      'overflow scroll must remain available when the natural-size diagram exceeds the frame',
    );
  });

  test('TC-MRV-006: zoom in/out changes viewport transform while fontSize stays 16px', () => {
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
        '16px',
        'zoom must not change density fontSize away from 16px',
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

  test('TC-010: contain-fit again after source change / debounce re-render', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      hasContainOnRerender(editorSrc),
      'after debounce re-render, Mermaid block viewport must contain-fit the frame again',
    );
  });

  test('TC-011: contain-fit again after themeUpdated bulk re-render', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(
      hasScaleOneOnThemeUpdated(editorSrc, themeSrc),
      'themeUpdated re-render path must contain-fit Mermaid viewports again',
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

  test('TC-MRV-019: per-diagram fontSize override remains allowed without breaking global 16px', () => {
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /fontSize\s*:\s*['"]16px['"]|MERMAID_DENSITY_FONT_SIZE\s*=\s*['"]16px['"]/.test(themeSrc),
      "global default remains '16px'",
    );
    // Mermaid native frontmatter / %%{init}%% is delegated — do not strip themeVariables
    assert.ok(
      !/stripThemeVariables|delete.*fontSize|forbid.*fontSize|block.*%%\{init/i.test(
        `${themeSrc}\n${editorSrc}`,
      ),
      'must not strip per-diagram themeVariables.fontSize overrides (native priority)',
    );
  });

  test('TC-MRV-020: related suites Expected align with global fontSize 16px', () => {
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
        !/fontSize[\s\S]{0,80}'12px'|fontSize[\s\S]{0,80}"12px"/.test(src),
        `${suitePath} must not still require fontSize '12px'`,
      );
      assert.ok(
        /fontSize[\s\S]{0,80}'16px'|fontSize[\s\S]{0,80}"16px"/.test(src),
        `${suitePath} must expect fontSize '16px'`,
      );
    }
    // Mermaid suites share doc/test/mermaid/testspec-mermaid.md after doc-reorg merge (AD-006/009)
    const relatedSpecs = [
      'doc/test/mermaid/testspec-mermaid.md',
      'doc/test/testspec-vsc-md-wysiwyg.md',
    ];
    for (const specPath of relatedSpecs) {
      const spec = readRepoFile(specPath);
      // TC-facing Expected should prefer 16px; allow historical changelog mentions of 8px/10px/12px/13px
      const matrixOrTc149 =
        /fontSize[^|\n]*16px|`16px`|'16px'|"16px"/.test(spec) ||
        /TC-149[\s\S]{0,200}16px/.test(spec);
      assert.ok(matrixOrTc149, `${specPath} Expected should align with global fontSize 16px`);
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

  // --- mermaid-label-metrics (TC-MRV-024–027) ---

  test('TC-MRV-024: natural scale and Fit center on axes smaller than the viewport', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const css = readRepoFile('media/editor.css');
    assert.ok(
      hasContainFillOnRenderContract(editorSrc),
      'initial / re-render / themeUpdated must contain-fit the frame (scale may exceed 1)',
    );
    assert.ok(
      hasFitButtonContainContract(editorSrc),
      'Fit button path must still contain / fit-to-viewport',
    );
    assert.ok(
      hasCenterOnSmallerAxesContract(editorSrc, css),
      'after natural scale 1 and Fit, only smaller axes must be centered (pixel-perfect not required)',
    );
    assert.ok(
      hasContainOnRerender(editorSrc) &&
        hasScaleOneOnThemeUpdated(editorSrc, readRepoFile('src/utils/mermaid-theme.ts')),
      're-render / themeUpdated must share the same contain-fit + centering contract',
    );
  });

  test('TC-MRV-025: zoom pivot is viewport center while fontSize stays 16px', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const css = readRepoFile('media/editor.css');
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    assert.ok(hasZoomControls(editorSrc), 'Zoom in / Zoom out required');
    assert.ok(
      hasZoomOriginViewportCenter(editorSrc, css),
      'zoom transform-origin / pivot must be viewport center, not top-left (AD-007)',
    );
    for (const kind of KINDS) {
      assert.strictEqual(
        buildMermaidThemeConfig!(kind).themeVariables?.fontSize,
        '16px',
        'zoom must leave density fontSize at 16px',
      );
    }
  });

  test('TC-MRV-026: Host-nonce measure CSS uses font-size 16px, trebuchet family, line-height 1', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const themeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    const buildMermaidThemeConfig = getUtilExport<(kind: string) => MermaidThemeConfig>(
      'mermaid-theme',
      'buildMermaidThemeConfig',
    );
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required');
    for (const kind of KINDS) {
      assert.strictEqual(
        buildMermaidThemeConfig!(kind).themeVariables?.fontSize,
        '16px',
        `kind ${kind}: themeVariables.fontSize must be '16px'`,
      );
      for (const value of Object.values(buildMermaidThemeConfig!(kind).themeVariables ?? {})) {
        assert.ok(!value.includes('var(--vscode-'), `kind ${kind}: no var(--vscode-*): ${value}`);
      }
    }
    assert.ok(
      /ensureMermaidMeasureFontCss/.test(editorSrc),
      'measure font CSS helper required before mermaid.render',
    );
    assert.ok(
      /ensureMermaidMeasureFontCss\s*\(\s*\)[\s\S]{0,200}mermaid\.render/.test(editorSrc),
      'ensureMermaidMeasureFontCss must run before mermaid.render',
    );
    assert.ok(
      /MERMAID_DENSITY_FONT_SIZE\s*=\s*['"]16px['"]/.test(themeSrc),
      "MERMAID_DENSITY_FONT_SIZE must be '16px'",
    );
    assert.ok(
      hasMeasureLabelTypographyContract(editorSrc),
      'measure CSS must set font-size 16px, font-family trebuchet ms/verdana/arial/sans-serif, line-height 1 !important',
    );
    assert.ok(
      /setAttribute\(\s*['"]nonce['"]/.test(editorSrc) &&
        /MERMAID_MEASURE_FONT_STYLE_ID|mermaid-density-measure-font/.test(editorSrc),
      'measure CSS must use Host-identical nonce (no style-src unsafe-inline)',
    );
    assert.ok(
      !/style-src[^;]*unsafe-inline/.test(readRepoFile('src/providers/markdown-editor-provider.ts')),
      "must not add style-src 'unsafe-inline'",
    );
  });

  test('TC-MRV-027: Fit after pan restores centered layout', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    const css = readRepoFile('media/editor.css');
    assert.ok(
      hasPanThenFitRecenterContract(editorSrc, css),
      'pan offset is allowed; next Fit must restore TC-MRV-024 centering (re-render uses scale 1, not Fit)',
    );
    assert.ok(hasZoomControls(editorSrc), 'zoom controls must remain after pan/Fit path');
    assert.ok(hasFitAriaLabel(editorSrc), "Fit control must keep aria-label (e.g. 'Fit')");
  });
});
