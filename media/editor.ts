import { Editor, Extension, Node, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Strike from '@tiptap/extension-strike';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { buildMermaidRenderSource } from '../src/utils/mermaid-render';
import {
  buildMermaidThemeConfig,
  handleThemeUpdated,
  MERMAID_DENSITY_FONT_SIZE,
  registerMermaidThemeRuntime,
  type MermaidThemeConfig,
} from '../src/utils/mermaid-theme';
import type { ThemeKind } from '../src/utils/theme-sync';

const MERMAID_MEASURE_FONT_STYLE_ID = 'mermaid-density-measure-font';

/** AD-004: Strike 既定 Mod-Shift-s は Save All と衝突するため無効化。 */
const StrikeWithoutShortcut = Strike.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

/** AD-004: Blockquote 既定 Mod-Shift-b は Run Build Task と衝突するため無効化。 */
const BlockquoteWithoutShortcut = Blockquote.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

type EditorMode = 'preview' | 'markdown' | 'raw';
type TableFormat = 'gfm' | 'html';

type TableContext = {
  inTable: boolean;
  tableIndex: number;
  tableFormat: TableFormat | null;
};


const vscode = acquireVsCodeApi();
const lowlight = createLowlight(common);

const MERMAID_DEBOUNCE_MS = 300;
const MERMAID_THEME_RERENDER_DEBOUNCE_MS = 300;
const RAW_SYNC_DEBOUNCE_MS = 200;
const RAW_UPDATE_DEBOUNCE_MS = 250;
/** Viewport zoom step / bounds — separate from density fontSize (AD-005). */
const MERMAID_VIEWPORT_ZOOM_STEP = 1.25;
const MERMAID_VIEWPORT_MIN_SCALE = 0.2;
const MERMAID_VIEWPORT_MAX_SCALE = 8;
/** Extra viewBox padding so Mermaid titleText is not clipped (AD-003). */
const MERMAID_TITLE_VIEWBOX_PAD = 24;
/** Extra horizontal pad — long centered titles need more than vertical (leading glyph clip). */
const MERMAID_TITLE_VIEWBOX_PAD_X = 36;
const mermaidTimers = new Map<string, ReturnType<typeof setTimeout>>();
const mermaidRerenderCallbacks = new Set<() => void>();
let mermaidThemeRerenderTimer: ReturnType<typeof setTimeout> | undefined;
/** ELK ローダは初回 layout:elk 要求時のみ動的 import（AD-007）。 */
let elkLayoutRegisterPromise: Promise<void> | undefined;

function getHostCspNonce(): string {
  return document.body?.getAttribute('data-csp-nonce') ?? '';
}

/**
 * Host-nonce CSS so mermaid.render measures labels at density typography (CSP).
 * Without this, HTML labels inherit editor line-height 1.6 / wrong font during measure.
 * Prefer Host nonce stylesheet; never loosen CSP for inline styles.
 */
function ensureMermaidMeasureFontCss(): void {
  let styleEl = document.getElementById(MERMAID_MEASURE_FONT_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = MERMAID_MEASURE_FONT_STYLE_ID;
    const nonce = getHostCspNonce();
    if (nonce) {
      styleEl.setAttribute('nonce', nonce);
    }
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = [
    `.nodeLabel, .edgeLabel, .label, .labelBkg, foreignObject div, foreignObject span {`,
    `  font-size: ${MERMAID_DENSITY_FONT_SIZE};`,
    // Literals required for measure contract (TC-MRV-026); keep in sync with MERMAID_DENSITY_*
    `  font-family: "trebuchet ms", verdana, arial, sans-serif;`,
    // !important beats Mermaid createText inline line-height: 1.5 during measure
    `  line-height: 1 !important;`,
    `}`,
  ].join('\n');
}

function sourceRequestsElkLayout(source: string): boolean {
  return (
    /(?:^|[\s,{])layout\s*:\s*['"]?elk\b/i.test(source) || /flowchart-elk/i.test(source)
  );
}

async function ensureElkLayoutRegistered(source: string): Promise<void> {
  if (!sourceRequestsElkLayout(source)) {
    return;
  }
  if (!elkLayoutRegisterPromise) {
    elkLayoutRegisterPromise = (async () => {
      try {
        // Host 注入 URI を優先（classic script の相対 import 解決を避ける）。
        // パッケージ名の dynamic import はソース契約（TC-014）と非 Webview フォールバック用。
        const chunkUri = document.body?.getAttribute('data-elk-chunk-uri');
        const elkModule = chunkUri
          ? await import(/* webpackIgnore: true */ chunkUri)
          : await import('@mermaid-js/layout-elk');
        const elkLayouts = (elkModule as { default?: unknown }).default ?? elkModule;
        mermaid.registerLayoutLoaders(elkLayouts as Parameters<typeof mermaid.registerLayoutLoaders>[0]);
      } catch (err) {
        // 再試行可能にするため失敗時は Promise を破棄（図単位エラーは呼び出し側）
        elkLayoutRegisterPromise = undefined;
        throw err;
      }
    })();
  }
  await elkLayoutRegisterPromise;
}

/**
 * Strip dangerous CSS constructs before Host-nonce reinjection (AD-002).
 * Does not pass through arbitrary user/Mermaid-source CSS via HTML string concat.
 */
function sanitizeMermaidPresentationCss(css: string): string {
  return css
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '(')
    .replace(/javascript\s*:/gi, '')
    .replace(/-moz-binding\s*:/gi, 'moz-binding-blocked:')
    .replace(/behavior\s*:/gi, 'behavior-blocked:');
}

/**
 * Extract Mermaid presentation <style> from render SVG; reinject under .mermaid-preview
 * with Host-identical CSP nonce (AD-002). SVG inline styles are CSP-blocked without nonce.
 */
function applyMermaidPresentationStyle(viewId: string, svg: string): string {
  const styleChunks: string[] = [];
  const svgWithoutStyles = svg.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    const cleaned = sanitizeMermaidPresentationCss(css);
    if (cleaned.trim()) {
      styleChunks.push(cleaned);
    }
    return '';
  });

  const styleId = `mermaid-presentation-${viewId}`;
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    const nonce = getHostCspNonce();
    if (nonce) {
      styleEl.setAttribute('nonce', nonce);
    }
    document.head.appendChild(styleEl);
  }

  // Scope reinjected rules under .mermaid-preview; keep fill:none safety for edge paths
  const scopedChunks = styleChunks.map((css) =>
    css.replace(/(^|})\s*([^{}@/][^{]*)\{/g, (_m, brace: string, selectors: string) => {
      const scoped = selectors
        .split(',')
        .map((sel) => {
          const trimmed = sel.trim();
          if (!trimmed) {
            return trimmed;
          }
          if (trimmed.startsWith('.mermaid-preview')) {
            return trimmed;
          }
          return `.mermaid-preview ${trimmed}`;
        })
        .join(', ');
      return `${brace} ${scoped}{`;
    }),
  );
  const safetyNet =
    '.mermaid-preview .edgePath .path, .mermaid-preview .edgePaths .path, .mermaid-preview .flowchart-link, .mermaid-preview path.flowchart-link { fill: none; }';
  styleEl.textContent = [...scopedChunks, safetyNet].join('\n');

  return svgWithoutStyles;
}

function initializeMermaidTheme(kind: ThemeKind): void {
  try {
    const config = buildMermaidThemeConfig(kind);
    mermaid.initialize({
      startOnLoad: false,
      theme: config.theme as any,
      themeVariables: config.themeVariables,
      securityLevel: 'strict',
      // Default-like hug→wrap (stock Mermaid defaults; explicit for contract)
      flowchart: {
        wrappingWidth: config.flowchart.wrappingWidth,
        padding: config.flowchart.padding,
      },
    });
  } catch (err) {
    console.error('Mermaid initialization failed:', err);
  }
}

ensureMermaidMeasureFontCss();
initializeMermaidTheme('dark');

function scheduleMermaidThemeRerender(): void {
  if (mermaidThemeRerenderTimer) {
    clearTimeout(mermaidThemeRerenderTimer);
  }
  mermaidThemeRerenderTimer = setTimeout(() => {
    for (const rerender of mermaidRerenderCallbacks) {
      rerender();
    }
  }, MERMAID_THEME_RERENDER_DEBOUNCE_MS);
}

registerMermaidThemeRuntime({
  initialize: (config: MermaidThemeConfig) => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: config.theme as any,
        themeVariables: config.themeVariables,
        securityLevel: 'strict',
        flowchart: {
          wrappingWidth: config.flowchart.wrappingWidth,
          padding: config.flowchart.padding,
        },
      });
    } catch (err) {
      console.error('Mermaid runtime initialization failed:', err);
    }
  },
  scheduleRerender: scheduleMermaidThemeRerender,
});

interface TipTapDoc {
  type: string;
  content?: unknown[];
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

let editor: Editor | undefined;
let insertTableFormat: TableFormat = 'gfm';
let readonly = false;
/** Must match Host DEFAULT_EDITOR_MODE / initial HTML body[data-mode] (AD-016). */
let editorMode: EditorMode = 'raw';
let previewSurface: 'tiptap' | 'marp' = 'tiptap';
let suppressUpdate = false;
let suppressRawUpdate = false;
/** True after the first successful initEditor — ready must not force a second full init. */
let isEditorInitialized = false;
let latestMarkdownText = '';
let rawSyncTimer: ReturnType<typeof setTimeout> | undefined;
let rawUpdateTimer: ReturnType<typeof setTimeout> | undefined;
/** Bumped on HTML→GFM convert so Host can drop pre-convert `update` messages. */
let updateEpoch = 0;
let gfmConvertPending = false;

const HtmlTableExtension = Extension.create({
  name: 'htmlTable',
  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          tableFormat: { default: 'gfm' },
          html: { default: null },
          gfmSource: { default: false },
          converted: { default: false },
          gfmSourceMarkdown: { default: null },
          gfmContentFingerprint: { default: null },
        },
      },
    ];
  },
});

const HtmlBlockNode = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      html: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-html-block]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-html-block': 'true', 'data-html': HTMLAttributes.html as string }];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-html-block', 'true');
      dom.innerHTML = DOMPurify.sanitize((node.attrs.html as string) ?? '');
      return { dom };
    };
  },
});

/**
 * CodeBlock with Mermaid NodeView so fence source stays a TipTap node and
 * ordinary text edits do not wipe the diagram via lossy HTML round-trip.
 */
const MermaidAwareCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node }) => {
      const language = (node.attrs.language as string) ?? '';
      if (language !== 'mermaid') {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        if (language) {
          code.classList.add(`language-${language}`);
        }
        pre.appendChild(code);
        return { dom: pre, contentDOM: code };
      }

      const dom = document.createElement('div');
      dom.classList.add('mermaid-block');
      dom.setAttribute('data-mermaid-node', 'true');

      const { toolbar, zoomInBtn, zoomOutBtn, fitBtn } = createMermaidViewportToolbar();
      dom.appendChild(toolbar);

      const viewport = document.createElement('div');
      viewport.classList.add('mermaid-viewport');

      const canvas = document.createElement('div');
      canvas.classList.add('mermaid-viewport-canvas');

      const preview = document.createElement('div');
      preview.classList.add('mermaid-preview');
      canvas.appendChild(preview);
      viewport.appendChild(canvas);
      dom.appendChild(viewport);

      const pre = document.createElement('pre');
      pre.classList.add('mermaid-source');
      const code = document.createElement('code');
      code.classList.add('language-mermaid');
      pre.appendChild(code);
      dom.appendChild(pre);

      const viewId = `mermaid-nv-${Math.random().toString(36).slice(2, 10)}`;
      let viewportScale = 1;
      const detachPan = attachMermaidViewportPan(viewport);

      const setViewportUiEnabled = (enabled: boolean): void => {
        toolbar.hidden = !enabled;
        toolbar.setAttribute('aria-hidden', enabled ? 'false' : 'true');
        zoomInBtn.disabled = !enabled;
        zoomOutBtn.disabled = !enabled;
        fitBtn.disabled = !enabled;
        if (!enabled) {
          // mermaid-error path — hide/disable viewport chrome (TC-017)
          viewport.setAttribute('aria-hidden', 'true');
        } else {
          viewport.removeAttribute('aria-hidden');
        }
      };

      const applyScale = (next: number): void => {
        viewportScale = clampMermaidViewportScale(next);
        applyViewportZoom(canvas, viewportScale);
      };

      const zoomIn = (): void => {
        applyScale(viewportScale * MERMAID_VIEWPORT_ZOOM_STEP);
      };

      const zoomOut = (): void => {
        applyScale(viewportScale / MERMAID_VIEWPORT_ZOOM_STEP);
      };

      zoomInBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        zoomIn();
      });
      zoomOutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        zoomOut();
      });
      fitBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Fit clears pan offset via fitToViewport → centerOnSmallerAxes (AD-007/008)
        viewportScale = fitToViewport(viewport, canvas, preview);
      });

      const renderPreview = (source: string): void => {
        const existing = mermaidTimers.get(viewId);
        if (existing) {
          clearTimeout(existing);
        }
        mermaidTimers.set(
          viewId,
          setTimeout(async () => {
            try {
              const renderSource = buildMermaidRenderSource(source);
              await ensureElkLayoutRegistered(renderSource);
              // Measure at density typography before render (CSP Host-nonce CSS)
              ensureMermaidMeasureFontCss();
              const { svg: renderedSvg } = await mermaid.render(
                `${viewId}-svg`,
                renderSource || ' ',
              );
              const svg = applyMermaidPresentationStyle(viewId, renderedSvg);
              preview.innerHTML = sanitizeMermaidSvg(svg);
              const svgEl = preview.querySelector('svg');
              if (svgEl) {
                ensureTitleVisible(svgEl as SVGSVGElement);
              }
              setViewportUiEnabled(true);
              // Contain into the frame, including scale > 1 so a small diagram fills the viewport.
              requestAnimationFrame(() => {
                viewportScale = fitToViewport(viewport, canvas, preview);
              });
            } catch (err) {
              preview.innerHTML = `<div class="mermaid-error">${escapeHtml(String(err))}</div>`;
              // mermaid-error → mermaid-viewport UI disabled / aria-hidden (TC-017)
              setViewportUiEnabled(false);
              applyViewportZoom(canvas, 1);
              viewportScale = 1;
              vscode.postMessage({ type: 'mermaidError', error: String(err) });
            }
          }, MERMAID_DEBOUNCE_MS),
        );
      };

      const rerenderFromDom = (): void => {
        renderPreview(code.textContent ?? '');
      };

      mermaidRerenderCallbacks.add(rerenderFromDom);
      renderPreview(node.textContent);

      return {
        dom,
        contentDOM: code,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'codeBlock') {
            return false;
          }
          if ((updatedNode.attrs.language as string) !== 'mermaid') {
            return false;
          }
          renderPreview(updatedNode.textContent);
          return true;
        },
        destroy: () => {
          mermaidRerenderCallbacks.delete(rerenderFromDom);
          detachPan();
          const existing = mermaidTimers.get(viewId);
          if (existing) {
            clearTimeout(existing);
          }
          mermaidTimers.delete(viewId);
          document.getElementById(`mermaid-presentation-${viewId}`)?.remove();
        },
      };
    };
  },
}).configure({ lowlight });

/**
 * TipTap table schema requires rows. Host usually parses HTML tables into structure;
 * unparseable html-only tables keep attrs.html — map to htmlBlock so real HTML is not
 * replaced by a "(table)" placeholder.
 */
function prepareDocForEditor(doc: TipTapDoc): JSONContent {
  const content = (doc.content ?? []).map((raw) => {
    const node = raw as TipTapDoc;
    if (
      node.type === 'table' &&
      typeof node.attrs?.html === 'string' &&
      node.attrs.html.length > 0 &&
      (!node.content || node.content.length === 0)
    ) {
      return {
        type: 'htmlBlock',
        attrs: { html: node.attrs.html },
      };
    }
    return raw;
  });
  return { type: 'doc', content: content as JSONContent[] };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitize Mermaid-rendered SVG for NodeView preview.
 * Default DOMPurify strips flowchart foreignObject HTML labels; keep those while still removing script/on*.
 */
function sanitizeMermaidSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true, html: true },
    ADD_TAGS: ['foreignObject'],
    ADD_ATTR: ['xmlns'],
    // foreignObject 内の XHTML ラベルを空シェルにしない（mermaid-contrast-readable P0）
    HTML_INTEGRATION_POINTS: { foreignobject: true },
  });
}

type SvgBounds = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Text horizontal/vertical extent — getBBox plus getComputedTextLength.
 * text-anchor middle/end can under-report left extent via getBBox alone (AD-003).
 */
function getSvgTextExtent(
  el: SVGGraphicsElement,
): { left: number; right: number; top: number; bottom: number } | null {
  if (typeof el.getBBox !== 'function') {
    return null;
  }
  try {
    const tb = el.getBBox();
    let left = tb.x;
    let right = tb.x + tb.width;
    const top = tb.y;
    const bottom = tb.y + tb.height;

    const textEl = el as SVGTextContentElement;
    if (typeof textEl.getComputedTextLength === 'function') {
      const textLen = textEl.getComputedTextLength();
      if (Number.isFinite(textLen) && textLen > 0) {
        let anchor =
          el.getAttribute('text-anchor') ||
          (typeof getComputedStyle === 'function'
            ? getComputedStyle(el).getPropertyValue('text-anchor')
            : '') ||
          'start';
        anchor = anchor.trim() || 'start';

        let anchorX: number;
        const xAttr = el.getAttribute('x');
        const xNum = xAttr !== null && xAttr !== '' ? Number(xAttr) : NaN;
        if (Number.isFinite(xNum)) {
          anchorX = xNum;
        } else if (anchor === 'middle') {
          anchorX = tb.x + tb.width / 2;
        } else if (anchor === 'end') {
          anchorX = tb.x + tb.width;
        } else {
          anchorX = tb.x;
        }

        if (anchor === 'middle') {
          left = Math.min(left, anchorX - textLen / 2);
          right = Math.max(right, anchorX + textLen / 2);
        } else if (anchor === 'end') {
          left = Math.min(left, anchorX - textLen);
          right = Math.max(right, anchorX);
        } else {
          left = Math.min(left, anchorX);
          right = Math.max(right, anchorX + textLen);
        }
      }
    }

    return { left, right, top, bottom };
  } catch {
    // getBBox / getComputedTextLength can throw for detached / display:none nodes
    return null;
  }
}

function expandBoundsForSvgText(el: SVGGraphicsElement, bounds: SvgBounds): void {
  const extent = getSvgTextExtent(el);
  if (!extent) {
    return;
  }
  bounds.minX = Math.min(bounds.minX, extent.left);
  bounds.minY = Math.min(bounds.minY, extent.top);
  bounds.maxX = Math.max(bounds.maxX, extent.right);
  bounds.maxY = Math.max(bounds.maxY, extent.bottom);
}

function expandBoundsFromBBox(el: SVGGraphicsElement, bounds: SvgBounds): boolean {
  if (typeof el.getBBox !== 'function') {
    return false;
  }
  try {
    const b = el.getBBox();
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) {
      return false;
    }
    if (!(b.width > 0 || b.height > 0)) {
      return false;
    }
    bounds.minX = Math.min(bounds.minX, b.x);
    bounds.minY = Math.min(bounds.minY, b.y);
    bounds.maxX = Math.max(bounds.maxX, b.x + b.width);
    bounds.maxY = Math.max(bounds.maxY, b.y + b.height);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer Mermaid `.titleText`; else title-like text above diagram content (not node labels).
 */
function findMermaidTitleElements(svgRoot: SVGSVGElement): SVGGraphicsElement[] {
  const byClass = Array.from(
    svgRoot.querySelectorAll('.titleText, g.title > text, text.title'),
  ) as SVGGraphicsElement[];
  if (byClass.length > 0) {
    return byClass;
  }

  const shapeBounds: SvgBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  let hasShapes = false;
  svgRoot
    .querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, foreignObject')
    .forEach((node) => {
      if (expandBoundsFromBBox(node as SVGGraphicsElement, shapeBounds)) {
        hasShapes = true;
      }
    });
  if (!hasShapes) {
    return [];
  }

  const above: { el: SVGGraphicsElement; top: number }[] = [];
  svgRoot.querySelectorAll('text').forEach((node) => {
    const el = node as SVGGraphicsElement;
    const extent = getSvgTextExtent(el);
    if (!extent) {
      return;
    }
    // Title sits above diagram content; node labels overlap the shape band
    if (extent.bottom <= shapeBounds.minY + 2) {
      above.push({ el, top: extent.top });
    }
  });
  if (above.length === 0) {
    return [];
  }
  above.sort((a, b) => a.top - b.top);
  const topY = above[0].top;
  // Only the topmost band (diagram title), not every label above a subgraph
  return above.filter((item) => item.top <= topY + 4).map((item) => item.el);
}

function computeDiagramContentBounds(
  svgRoot: SVGSVGElement,
  titleEls: SVGGraphicsElement[],
): SvgBounds | null {
  const titleSet = new Set<Element>(titleEls);
  const bounds: SvgBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  let found = false;

  const isUnderTitle = (node: Element): boolean => {
    for (const title of titleEls) {
      if (title === node || title.contains(node)) {
        return true;
      }
    }
    return false;
  };

  svgRoot
    .querySelectorAll(
      'path, rect, circle, ellipse, polygon, polyline, line, foreignObject, text, .label, .node',
    )
    .forEach((node) => {
      if (titleSet.has(node) || isUnderTitle(node)) {
        return;
      }
      const el = node as SVGGraphicsElement;
      if (el.tagName.toLowerCase() === 'text') {
        const extent = getSvgTextExtent(el);
        if (!extent) {
          return;
        }
        bounds.minX = Math.min(bounds.minX, extent.left);
        bounds.minY = Math.min(bounds.minY, extent.top);
        bounds.maxX = Math.max(bounds.maxX, extent.right);
        bounds.maxY = Math.max(bounds.maxY, extent.bottom);
        found = true;
        return;
      }
      if (expandBoundsFromBBox(el, bounds)) {
        found = true;
      }
    });

  return found ? bounds : null;
}

/** Shift title right via x (respects text-anchor) or transform translate. */
function shiftSvgTextByX(el: SVGGraphicsElement, deltaX: number): void {
  if (!(deltaX > 0) || !Number.isFinite(deltaX)) {
    return;
  }

  const xAttr = el.getAttribute('x');
  const xNum = xAttr !== null && xAttr !== '' ? Number(xAttr) : NaN;
  if (Number.isFinite(xNum)) {
    el.setAttribute('x', String(xNum + deltaX));
  } else {
    const existing = el.getAttribute('transform')?.trim() ?? '';
    el.setAttribute(
      'transform',
      existing ? `translate(${deltaX},0) ${existing}` : `translate(${deltaX},0)`,
    );
  }

  el.querySelectorAll('tspan').forEach((tspan) => {
    const tx = tspan.getAttribute('x');
    if (tx === null || tx === '') {
      return;
    }
    const n = Number(tx);
    if (Number.isFinite(n)) {
      tspan.setAttribute('x', String(n + deltaX));
    }
  });
}

/**
 * If title hangs left of diagram content, shift it right so title left >= diagram left.
 * Prefer position shift over only growing left viewBox pad (zoom clip of leading glyphs).
 */
function alignMermaidTitleToDiagram(svgRoot: SVGSVGElement): void {
  const titles = findMermaidTitleElements(svgRoot);
  if (titles.length === 0) {
    return;
  }
  const content = computeDiagramContentBounds(svgRoot, titles);
  if (!content || !Number.isFinite(content.minX)) {
    return;
  }

  for (const title of titles) {
    const extent = getSvgTextExtent(title);
    if (!extent) {
      continue;
    }
    const deltaX = content.minX - extent.left;
    if (deltaX > 0.5) {
      shiftSvgTextByX(title, deltaX);
    }
  }
}

/**
 * Expand SVG viewBox / overflow so Mermaid title text is fully visible (AD-003).
 * Aligns title so it does not hang left of diagram content, then pads viewBox.
 * Display-layer only — does not touch Document / serialize.
 */
function ensureTitleVisible(svgRoot: SVGSVGElement): void {
  try {
    svgRoot.style.overflow = 'visible';
    alignMermaidTitleToDiagram(svgRoot);

    const bbox = svgRoot.getBBox();
    if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0) {
      return;
    }
    const bounds: SvgBounds = {
      minX: bbox.x,
      minY: bbox.y,
      maxX: bbox.x + bbox.width,
      maxY: bbox.y + bbox.height,
    };
    // Include title / titleText nodes that may sit above the diagram bbox
    const titles = findMermaidTitleElements(svgRoot);
    if (titles.length > 0) {
      titles.forEach((node) => expandBoundsForSvgText(node, bounds));
    } else {
      svgRoot.querySelectorAll('text, .titleText').forEach((node) => {
        expandBoundsForSvgText(node as SVGGraphicsElement, bounds);
      });
    }
    const padY = MERMAID_TITLE_VIEWBOX_PAD;
    const padX = MERMAID_TITLE_VIEWBOX_PAD_X;
    const vbX = bounds.minX - padX;
    const vbY = bounds.minY - padY;
    const vbW = Math.max(1, bounds.maxX - bounds.minX + padX * 2);
    const vbH = Math.max(1, bounds.maxY - bounds.minY + padY * 2);
    svgRoot.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    // Keep width/height consistent with padded viewBox so fit math stays correct
    if (!svgRoot.getAttribute('width') || svgRoot.getAttribute('width') === '100%') {
      svgRoot.setAttribute('width', String(vbW));
    }
    if (!svgRoot.getAttribute('height') || svgRoot.getAttribute('height') === '100%') {
      svgRoot.setAttribute('height', String(vbH));
    }
  } catch {
    // SVG not in DOM yet or getBBox unavailable — overflow:visible CSS still helps
    svgRoot.style.overflow = 'visible';
  }
}

function clampMermaidViewportScale(scale: number): number {
  return Math.min(
    MERMAID_VIEWPORT_MAX_SCALE,
    Math.max(MERMAID_VIEWPORT_MIN_SCALE, scale),
  );
}

function applyViewportZoom(canvas: HTMLElement, scale: number): void {
  canvas.style.transform = `scale(${scale})`;
}

/**
 * After natural scale 1 / Fit contain: center axes where the diagram is smaller
 * than the frame (flex CSS); when layout overflows, scroll to mid so
 * transform-origin center aligns with the viewport. Clears pan offsets.
 */
function centerOnSmallerAxes(viewport: HTMLElement): void {
  const frameW = Math.max(1, viewport.clientWidth);
  const frameH = Math.max(1, viewport.clientHeight);
  viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - frameW) / 2);
  viewport.scrollTop = Math.max(0, (viewport.scrollHeight - frameH) / 2);
}

/**
 * Fit diagram SVG into the mermaid-viewport frame (contain).
 * Scale may be greater than 1 so a diagram smaller than the frame grows to touch
 * the limiting edges. The other axis stays centered; all four edges meet only
 * when the diagram and frame share an aspect ratio.
 */
function fitToViewport(
  viewport: HTMLElement,
  canvas: HTMLElement,
  preview: HTMLElement,
): number {
  const svg = preview.querySelector('svg');
  if (!svg) {
    applyViewportZoom(canvas, 1);
    centerOnSmallerAxes(viewport);
    return 1;
  }
  // Reset transform to measure natural size
  applyViewportZoom(canvas, 1);
  const frameW = Math.max(1, viewport.clientWidth - 8);
  const frameH = Math.max(1, viewport.clientHeight - 8);
  const naturalW =
    (svg as SVGSVGElement).width?.baseVal?.value ||
    svg.getBoundingClientRect().width ||
    1;
  const naturalH =
    (svg as SVGSVGElement).height?.baseVal?.value ||
    svg.getBoundingClientRect().height ||
    1;
  const scale = clampMermaidViewportScale(
    Math.min(frameW / Math.max(1, naturalW), frameH / Math.max(1, naturalH)),
  );
  applyViewportZoom(canvas, scale);
  centerOnSmallerAxes(viewport);
  return scale;
}

function createMermaidViewportToolbar(): {
  toolbar: HTMLElement;
  zoomInBtn: HTMLButtonElement;
  zoomOutBtn: HTMLButtonElement;
  fitBtn: HTMLButtonElement;
} {
  const toolbar = document.createElement('div');
  toolbar.classList.add('mermaid-viewport-toolbar');
  // Native <button aria-label="…"> for keyboard reachability (AD-011 / TC-007)
  toolbar.innerHTML = [
    '<button type="button" aria-label="Zoom out">−</button>',
    '<button type="button" aria-label="Zoom in">+</button>',
    '<button type="button" aria-label="Fit">Fit</button>',
  ].join('');

  const buttons = toolbar.querySelectorAll('button');
  const zoomOutBtn = buttons[0] as HTMLButtonElement;
  const zoomInBtn = buttons[1] as HTMLButtonElement;
  const fitBtn = buttons[2] as HTMLButtonElement;
  return { toolbar, zoomInBtn, zoomOutBtn, fitBtn };
}

/**
 * Spec Gap RK-004 resolution: pan starts with primary-button drag inside
 * `.mermaid-viewport`, adjusting native scrollLeft/scrollTop. No modifier key
 * or middle-button is required. Source text lives outside the frame so Preview
 * RO selection conflicts are avoided. Viewport ops never post Document edits.
 */
function attachMermaidViewportPan(viewport: HTMLElement): () => void {
  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let originScrollLeft = 0;
  let originScrollTop = 0;
  let activePointerId: number | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }
    isPanning = true;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    originScrollLeft = viewport.scrollLeft;
    originScrollTop = viewport.scrollTop;
    viewport.classList.add('is-panning');
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!isPanning || activePointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    viewport.scrollLeft = originScrollLeft - dx;
    viewport.scrollTop = originScrollTop - dy;
  };

  const endPan = (event: PointerEvent): void => {
    if (!isPanning || activePointerId !== event.pointerId) {
      return;
    }
    isPanning = false;
    activePointerId = null;
    viewport.classList.remove('is-panning');
    try {
      viewport.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', endPan);
  viewport.addEventListener('pointercancel', endPan);

  return () => {
    viewport.removeEventListener('pointerdown', onPointerDown);
    viewport.removeEventListener('pointermove', onPointerMove);
    viewport.removeEventListener('pointerup', endPan);
    viewport.removeEventListener('pointercancel', endPan);
  };
}

function getEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      // StarterKit 同梱の Strike / Blockquote はショートカット付きのため差し替え（AD-004）
      strike: false,
      blockquote: false,
    }),
    StrikeWithoutShortcut,
    BlockquoteWithoutShortcut,
    Link.configure({ openOnClick: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    MermaidAwareCodeBlock,
    Image.configure({ inline: true, allowBase64: false }),
    HtmlTableExtension,
    HtmlBlockNode,
  ];
}

function getRawEditor(): HTMLTextAreaElement | null {
  return document.getElementById('raw-editor') as HTMLTextAreaElement | null;
}

function getLinkInputBar(): HTMLElement | null {
  return document.getElementById('link-input-bar');
}

function getLinkUrlInput(): HTMLInputElement | null {
  return document.getElementById('link-url-input') as HTMLInputElement | null;
}

function hideLinkInputBar(): void {
  getLinkInputBar()?.classList.add('hidden');
}

function showLinkInputBar(): void {
  if (!editor || readonly || editorMode !== 'markdown') {
    return;
  }
  editor.chain().focus().extendMarkRange('link').run();
  const href = (editor.getAttributes('link').href as string) ?? '';
  const bar = getLinkInputBar();
  const input = getLinkUrlInput();
  if (!bar || !input) {
    return;
  }
  input.value = href;
  bar.classList.remove('hidden');
  input.focus();
  input.select();
}

function applyLinkFromInput(): void {
  if (!editor || readonly || editorMode !== 'markdown') {
    hideLinkInputBar();
    return;
  }
  const input = getLinkUrlInput();
  if (!input) {
    return;
  }
  const url = input.value.trim();
  if (url) {
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  } else {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  }
  hideLinkInputBar();
  editor.commands.focus();
}

function attachLinkInputHandlers(): void {
  const input = getLinkUrlInput();
  if (!input || input.dataset.bound === '1') {
    return;
  }
  input.dataset.bound = '1';
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLinkFromInput();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      hideLinkInputBar();
      editor?.commands.focus();
    }
  });
}

function isRawFocused(): boolean {
  const raw = getRawEditor();
  return !!raw && document.activeElement === raw;
}

function syncRawTextFromHost(text: string, immediate = false): void {
  latestMarkdownText = text;
  // Host 正本の full sync（変換・undo 等）は Raw フォーカス中でも反映する。
  if (isRawFocused() && !immediate) {
    return;
  }
  const apply = (): void => {
    const raw = getRawEditor();
    if (!raw || isRawFocused()) {
      return;
    }
    if (raw.value !== text) {
      suppressRawUpdate = true;
      raw.value = text;
      suppressRawUpdate = false;
    }
  };
  if (immediate) {
    if (rawSyncTimer) {
      clearTimeout(rawSyncTimer);
      rawSyncTimer = undefined;
    }
    apply();
    return;
  }
  if (rawSyncTimer) {
    clearTimeout(rawSyncTimer);
  }
  rawSyncTimer = setTimeout(apply, RAW_SYNC_DEBOUNCE_MS);
}

function scheduleRawTextUpdate(text: string): void {
  syncRawTextFromHost(text, false);
}

function getEditorRoot(): HTMLElement | null {
  return document.querySelector('#editor');
}

function applyPreviewMarpHtml(html: string): void {
  const marpRoot = document.getElementById('preview-marp-root');
  const editorEl = getEditorRoot();
  previewSurface = 'marp';
  if (marpRoot) {
    marpRoot.innerHTML = html;
    marpRoot.classList.remove('hidden');
  }
  if (editorEl) {
    editorEl.classList.add('hidden');
  }
}

function applyPreviewTipTap(): void {
  const marpRoot = document.getElementById('preview-marp-root');
  const editorEl = getEditorRoot();
  previewSurface = 'tiptap';
  if (marpRoot) {
    marpRoot.innerHTML = '';
    marpRoot.classList.add('hidden');
  }
  if (editorEl) {
    editorEl.classList.remove('hidden');
  }
}

function setModeUi(mode: EditorMode): void {
  editorMode = mode;
  document.body.setAttribute('data-mode', mode);

  document.querySelectorAll('#mode-toolbar button[data-mode]').forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.toggle('active', el.getAttribute('data-mode') === mode);
  });

  const editorEl = getEditorRoot();
  const rawEl = getRawEditor();
  const formatToolbar = document.getElementById('toolbar');
  const marpRoot = document.getElementById('preview-marp-root');

  if (mode !== 'preview') {
    if (marpRoot) {
      marpRoot.innerHTML = '';
      marpRoot.classList.add('hidden');
    }
    previewSurface = 'tiptap';
  } else if (previewSurface === 'marp') {
    if (marpRoot) {
      marpRoot.classList.remove('hidden');
    }
  } else if (marpRoot) {
    marpRoot.innerHTML = '';
    marpRoot.classList.add('hidden');
  }

  if (editorEl) {
    const hideEditor = mode === 'raw' || (mode === 'preview' && previewSurface === 'marp');
    editorEl.classList.toggle('hidden', hideEditor);
    editorEl.setAttribute('aria-readonly', String(mode === 'preview'));
  }
  if (rawEl) {
    rawEl.classList.toggle('hidden', mode !== 'raw');
  }
  if (formatToolbar) {
    // Format toolbar only for Markdown WYSIWYG (and hidden when file RO).
    formatToolbar.classList.toggle('hidden', mode !== 'markdown');
  }
  if (mode !== 'markdown' || readonly) {
    hideLinkInputBar();
  }

  const canEdit = !readonly && (mode === 'markdown' || mode === 'raw');
  // emitUpdate=false — UI-only; must not post Host update / dirty on open or mode switch.
  editor?.setEditable(mode === 'markdown' && canEdit, false);
  if (mode === 'preview') {
    editor?.setEditable(false, false);
    editor?.commands.blur();
  }
  if (rawEl) {
    rawEl.readOnly = !canEdit || mode !== 'raw';
  }
}

/** Flush pending Raw debounce before leaving Raw so edits are not dropped. */
function flushPendingRawUpdate(): void {
  if (!rawUpdateTimer) {
    return;
  }
  clearTimeout(rawUpdateTimer);
  rawUpdateTimer = undefined;
  if (readonly) {
    return;
  }
  const raw = getRawEditor();
  if (!raw) {
    return;
  }
  // Host accepts late updateRaw when !readonly (even if UI already left Raw).
  vscode.postMessage({ type: 'updateRaw', markdown: raw.value });
}

function applyMode(mode: EditorMode, notifyHost: boolean): void {
  if (editorMode === 'raw' && mode !== 'raw') {
    flushPendingRawUpdate();
  }
  setModeUi(mode);
  if (mode === 'raw') {
    const raw = getRawEditor();
    if (raw) {
      suppressRawUpdate = true;
      raw.value = latestMarkdownText;
      suppressRawUpdate = false;
    }
  }
  if (notifyHost) {
    vscode.postMessage({ type: 'setMode', editorMode: mode });
  }
}

function initEditor(initialDoc: TipTapDoc): void {
  // Guard against double init without destroy (ready + duplicate init).
  if (editor) {
    editor.destroy();
    editor = undefined;
  }

  suppressUpdate = true;
  try {
    const content = prepareDocForEditor(initialDoc);

    editor = new Editor({
      element: document.getElementById('editor')!,
      extensions: getEditorExtensions(),
      content,
      editable: !readonly && editorMode === 'markdown',
      onUpdate: ({ editor: ed }) => {
        if (suppressUpdate || gfmConvertPending || readonly || editorMode !== 'markdown') {
          return;
        }
        const json = ed.getJSON();
        vscode.postMessage({ type: 'update', docJson: JSON.stringify(json), epoch: updateEpoch });
        checkTableLimitsFromEditor(ed);
      },
    });

    isEditorInitialized = true;
    attachToolbarHandlers();
    attachLinkInputHandlers();
    attachModeToolbarHandlers();
    attachTableMenuHandlers();
    updateFormatToolbarPressedState();
    editor.on('selectionUpdate', () => updateFormatToolbarPressedState());
    editor.on('transaction', () => updateFormatToolbarPressedState());
    attachPasteHandler();
    attachRawEditorHandlers();
    attachPreviewGuard();
    updateTableMenuButtonStyle();
    setModeUi(editorMode);
  } finally {
    suppressUpdate = false;
  }
}

function applyExternalDoc(doc: TipTapDoc, options?: { force?: boolean }): void {
  if (!editor) {
    return;
  }
  // TC-067: skip re-apply during active Markdown typing unless Host pushes full docJson.
  if (editorMode === 'markdown' && editor.isFocused && !options?.force) {
    return;
  }
  suppressUpdate = true;
  editor.commands.setContent(prepareDocForEditor(doc));
  suppressUpdate = false;
  updateTableMenuState();
}

/** Block keyboard/paste/drop edits while Preview is active (strict RO). Scroll is allowed. */
function attachPreviewGuard(): void {
  const editorEl = getEditorRoot();
  if (!editorEl || editorEl.dataset.previewGuard === '1') {
    return;
  }
  editorEl.dataset.previewGuard = '1';

  const blockWhenPreview = (event: Event): void => {
    if (editorMode !== 'preview') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  editorEl.addEventListener('keydown', blockWhenPreview, true);
  editorEl.addEventListener('beforeinput', blockWhenPreview, true);
  editorEl.addEventListener('paste', blockWhenPreview, true);
  editorEl.addEventListener('drop', blockWhenPreview, true);
}

function attachModeToolbarHandlers(): void {
  document.querySelectorAll('#mode-toolbar button[data-mode]').forEach((btn) => {
    const clone = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(clone, btn);
    clone.addEventListener('click', () => {
      const mode = clone.getAttribute('data-mode') as EditorMode | null;
      if (!mode || mode === editorMode) {
        return;
      }
      // Mode switch alone — no content mutation; Host does not write disk.
      applyMode(mode, true);
    });
  });
  // Re-bind after mode-button clones so Default Preview keeps its click handler.
  attachNativePreviewHandler();
}

/** Non-mode Default Preview — must not call applyMode / change editorMode. */
function attachNativePreviewHandler(): void {
  const btn = document.querySelector(
    '#mode-toolbar button[data-action="native-preview"]',
  ) as HTMLElement | null;
  if (!btn) {
    return;
  }
  // Clone to drop stale listeners if siblings were replaced and this node was rebound.
  const clone = btn.cloneNode(true) as HTMLElement;
  delete clone.dataset.bound;
  btn.parentNode?.replaceChild(clone, btn);
  clone.dataset.bound = '1';
  clone.addEventListener('click', () => {
    vscode.postMessage({ type: 'openNativePreview' });
  });
}

function attachRawEditorHandlers(): void {
  const raw = getRawEditor();
  if (!raw || raw.dataset.bound === '1') {
    return;
  }
  raw.dataset.bound = '1';
  raw.addEventListener('input', () => {
    if (suppressRawUpdate || readonly || editorMode !== 'raw') {
      return;
    }
    const value = raw.value;
    if (rawUpdateTimer) {
      clearTimeout(rawUpdateTimer);
    }
    rawUpdateTimer = setTimeout(() => {
      vscode.postMessage({ type: 'updateRaw', markdown: value });
    }, RAW_UPDATE_DEBOUNCE_MS);
  });
}

function attachToolbarHandlers(): void {
  document.querySelectorAll('#toolbar button').forEach((btn) => {
    // Avoid stacking handlers across re-inits.
    const clone = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(clone, btn);
    clone.addEventListener('click', () => {
      if (!editor || readonly || editorMode !== 'markdown') {
        return;
      }
      const cmd = clone.getAttribute('data-cmd');
      switch (cmd) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'strike':
          editor.chain().focus().toggleStrike().run();
          break;
        case 'inlineCode':
          editor.chain().focus().toggleCode().run();
          break;
        case 'heading': {
          const level = parseInt(clone.getAttribute('data-level') ?? '1', 10) as
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6;
          editor.chain().focus().toggleHeading({ level }).run();
          break;
        }
        case 'bulletList':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'orderedList':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'taskList':
          editor.chain().focus().toggleTaskList().run();
          break;
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'link':
          showLinkInputBar();
          break;
        case 'codeBlock':
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case 'horizontalRule':
          editor.chain().focus().setHorizontalRule().run();
          break;
      }
      updateFormatToolbarPressedState();
    });
  });
}

function setToolbarPressed(btn: Element, pressed: boolean): void {
  btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  btn.classList.toggle('pressed', pressed);
}

/** Sync aria-pressed / pressed class with TipTap selection (AD-012). HR is insert-only. */
function updateFormatToolbarPressedState(): void {
  if (!editor) {
    return;
  }
  document.querySelectorAll('#toolbar button[data-cmd]').forEach((btn) => {
    const cmd = btn.getAttribute('data-cmd');
    if (!cmd || cmd === 'horizontalRule') {
      return;
    }
    if (cmd === 'heading') {
      const level = parseInt(btn.getAttribute('data-level') ?? '0', 10);
      setToolbarPressed(btn, editor!.isActive('heading', { level }));
      return;
    }
    const activeMap: Record<string, boolean> = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      inlineCode: editor.isActive('code'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList: editor.isActive('taskList'),
      blockquote: editor.isActive('blockquote'),
      link: editor.isActive('link'),
      codeBlock: editor.isActive('codeBlock'),
    };
    if (cmd in activeMap) {
      setToolbarPressed(btn, activeMap[cmd] ?? false);
    }
  });
}

function inferTableFormatFromAttrs(attrs: Record<string, unknown>): TableFormat {
  if (attrs.tableFormat === 'gfm' || attrs.tableFormat === 'html') {
    return attrs.tableFormat;
  }
  if (attrs.gfmSource === true) {
    return 'gfm';
  }
  if (typeof attrs.html === 'string' && attrs.html.length > 0) {
    return 'html';
  }
  if (attrs.gfmSource === false || attrs.converted === true) {
    return 'html';
  }
  return 'gfm';
}

function getTableContext(ed: Editor): TableContext {
  if (!ed.isActive('table')) {
    return { inTable: false, tableIndex: -1, tableFormat: null };
  }

  const $from = ed.state.selection.$from;
  let tableDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth < 0) {
    return { inTable: false, tableIndex: -1, tableFormat: null };
  }

  const tableAttrs = ed.getAttributes('table') as Record<string, unknown>;
  const tableFormat = inferTableFormatFromAttrs(tableAttrs);

  // Index among top-level doc blocks only — must match convertTableToGfmAtIndex(doc.content).
  const currentPos = $from.before(tableDepth);
  let tableIndex = 0;
  let matched = false;
  ed.state.doc.forEach((node, offset) => {
    if (matched || node.type.name !== 'table') {
      return;
    }
    if (offset === currentPos) {
      matched = true;
      return;
    }
    tableIndex += 1;
  });

  if (!matched) {
    return { inTable: false, tableIndex: -1, tableFormat: null };
  }

  return { inTable: true, tableIndex, tableFormat };
}

function updateTableMenuButtonStyle(): void {
  const btn = document.getElementById('table-menu-btn');
  if (!btn) {
    return;
  }
  btn.classList.toggle('table-format-html', insertTableFormat === 'html');
}

function closeTableMenuPanel(): void {
  document.getElementById('table-menu-panel')?.classList.add('hidden');
}

function openTableMenuPanel(): void {
  updateTableMenuState();
  document.getElementById('table-menu-panel')?.classList.remove('hidden');
}

function updateTableMenuState(): void {
  const panel = document.getElementById('table-menu-panel');
  if (!panel) {
    return;
  }

  const disabled = readonly || editorMode !== 'markdown';
  const ctx = editor ? getTableContext(editor) : { inTable: false, tableIndex: -1, tableFormat: null };

  panel.querySelectorAll('[data-table-op]').forEach((item) => {
    const el = item as HTMLButtonElement;
    const op = el.getAttribute('data-table-op');
    let isDisabled = disabled;

    if (op === 'insert') {
      isDisabled = disabled;
    } else if (
      op === 'addRowBefore' ||
      op === 'addRowAfter' ||
      op === 'deleteRow' ||
      op === 'addColumnBefore' ||
      op === 'addColumnAfter' ||
      op === 'deleteColumn' ||
      op === 'deleteTable' ||
      op === 'convertToGfm' ||
      op === 'convertToHtml'
    ) {
      isDisabled = disabled || !ctx.inTable;
      if (!isDisabled && op === 'convertToGfm' && ctx.tableFormat === 'gfm') {
        isDisabled = true;
      }
      if (!isDisabled && op === 'convertToHtml' && ctx.tableFormat === 'html') {
        isDisabled = true;
      }
    } else if (op === 'setDefaultGfm' || op === 'setDefaultHtml') {
      isDisabled = disabled;
    }

    el.disabled = isDisabled;
    el.classList.toggle('menu-checked', false);

    if (op === 'convertToGfm' && ctx.inTable && ctx.tableFormat === 'gfm') {
      el.classList.add('menu-checked');
    }
    if (op === 'convertToHtml' && ctx.inTable && ctx.tableFormat === 'html') {
      el.classList.add('menu-checked');
    }
    if (op === 'setDefaultGfm' && insertTableFormat === 'gfm') {
      el.classList.add('menu-checked');
    }
    if (op === 'setDefaultHtml' && insertTableFormat === 'html') {
      el.classList.add('menu-checked');
    }
  });
}

function postDocUpdate(): void {
  if (!editor || readonly || editorMode !== 'markdown' || gfmConvertPending) {
    return;
  }
  const json = editor.getJSON();
  vscode.postMessage({ type: 'update', docJson: JSON.stringify(json), epoch: updateEpoch });
  checkTableLimitsFromEditor(editor);
}

function handleTableOperation(op: string): void {
  if (!editor || readonly || editorMode !== 'markdown') {
    return;
  }

  closeTableMenuPanel();

  switch (op) {
    case 'insert':
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      editor.chain().focus().updateAttributes('table', { tableFormat: insertTableFormat }).run();
      postDocUpdate();
      break;
    case 'addRowBefore':
      editor.chain().focus().addRowBefore().run();
      postDocUpdate();
      break;
    case 'addRowAfter':
      editor.chain().focus().addRowAfter().run();
      postDocUpdate();
      break;
    case 'deleteRow':
      editor.chain().focus().deleteRow().run();
      postDocUpdate();
      break;
    case 'addColumnBefore':
      editor.chain().focus().addColumnBefore().run();
      postDocUpdate();
      break;
    case 'addColumnAfter':
      editor.chain().focus().addColumnAfter().run();
      postDocUpdate();
      break;
    case 'deleteColumn':
      editor.chain().focus().deleteColumn().run();
      postDocUpdate();
      break;
    case 'deleteTable':
      editor.chain().focus().deleteTable().run();
      postDocUpdate();
      break;
    case 'convertToHtml': {
      const ctx = getTableContext(editor);
      if (!ctx.inTable || ctx.tableFormat === 'html') {
        return;
      }
      editor.chain().focus().updateAttributes('table', { tableFormat: 'html' }).run();
      postDocUpdate();
      break;
    }
    case 'convertToGfm': {
      const ctx = getTableContext(editor);
      if (!ctx.inTable || ctx.tableFormat === 'gfm') {
        return;
      }
      // Confirm on Host. Do not postDocUpdate first — that HTML snapshot races the convert.
      gfmConvertPending = true;
      updateEpoch += 1;
      vscode.postMessage({
        type: 'requestConvertToGfm',
        tableIndex: ctx.tableIndex,
        docJson: JSON.stringify(editor.getJSON()),
        epoch: updateEpoch,
      });
      break;
    }
    case 'setDefaultGfm':
      insertTableFormat = 'gfm';
      updateTableMenuButtonStyle();
      updateTableMenuState();
      break;
    case 'setDefaultHtml':
      insertTableFormat = 'html';
      updateTableMenuButtonStyle();
      updateTableMenuState();
      break;
    default:
      break;
  }
}

function attachTableMenuHandlers(): void {
  const btn = document.getElementById('table-menu-btn');
  const panel = document.getElementById('table-menu-panel');
  if (!btn || !panel || btn.dataset.bound === '1') {
    return;
  }
  btn.dataset.bound = '1';

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (readonly || editorMode !== 'markdown') {
      return;
    }
    if (panel.classList.contains('hidden')) {
      openTableMenuPanel();
    } else {
      closeTableMenuPanel();
    }
  });

  panel.querySelectorAll('[data-table-op]').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      const op = (item as HTMLElement).getAttribute('data-table-op');
      if (op) {
        handleTableOperation(op);
      }
    });
  });

  if (!document.body.dataset.tableMenuBound) {
    document.body.dataset.tableMenuBound = '1';
    document.addEventListener('click', () => closeTableMenuPanel());
    editor?.on('selectionUpdate', () => {
      if (!panel.classList.contains('hidden')) {
        updateTableMenuState();
      }
    });
  }
}

let pasteHandlerAttached = false;
function attachPasteHandler(): void {
  if (pasteHandlerAttached) {
    return;
  }
  pasteHandlerAttached = true;
  document.addEventListener('paste', (event) => {
    if (readonly || editorMode !== 'markdown' || !event.clipboardData) {
      return;
    }
    const items = event.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] ?? '';
          vscode.postMessage({ type: 'pasteImage', mime: item.type, dataBase64: base64 });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  });
}

function checkTableLimitsFromEditor(ed: Editor): void {
  const json = ed.getJSON();
  let maxRows = 0;
  let maxCols = 0;
  for (const node of json.content ?? []) {
    if (node.type === 'table') {
      const rows = node.content?.length ?? 0;
      const cols = node.content?.[0]?.content?.length ?? 0;
      maxRows = Math.max(maxRows, rows);
      maxCols = Math.max(maxCols, cols);
    }
  }
  if (maxRows > 0 || maxCols > 0) {
    vscode.postMessage({ type: 'checkTableLimits', rows: maxRows, cols: maxCols });
  }
}

function setRawParseBanner(failed: boolean, message?: string): void {
  const el = document.getElementById('raw-parse-banner');
  if (!el) {
    return;
  }
  if (failed) {
    el.textContent = message ?? 'Raw Markdown parse failed. Save is blocked until fixed.';
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
    el.textContent = '';
  }
}

window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      readonly = message.readonly;
      document.body.setAttribute('data-readonly', String(readonly));
      latestMarkdownText = message.markdownText ?? '';
      editorMode = (message.editorMode as EditorMode) ?? 'raw';
      // ready must not force a second full init if already initialized —
      // apply content refresh instead of destroying a live editing session.
      if (isEditorInitialized && editor) {
        editor.setEditable(!readonly && editorMode === 'markdown', false);
        applyExternalDoc(JSON.parse(message.docJson));
        scheduleRawTextUpdate(latestMarkdownText);
        setModeUi(editorMode);
        break;
      }
      initEditor(JSON.parse(message.docJson));
      scheduleRawTextUpdate(latestMarkdownText);
      // Ensure UI matches Host mode after init (DEFAULT may be raw before first paint).
      setModeUi(editorMode);
      break;
    case 'docUpdated':
      latestMarkdownText = message.markdownText ?? latestMarkdownText;
      if (typeof message.docJson !== 'string') {
        // Markdown-originated sync (TC-067): markdownText only.
        scheduleRawTextUpdate(latestMarkdownText);
        break;
      }
      if (editorMode === 'preview') {
        applyPreviewTipTap();
      }
      // Host-initiated full doc (table convert, Raw parse, revert, undo/redo).
      gfmConvertPending = false;
      syncRawTextFromHost(latestMarkdownText, true);
      applyExternalDoc(JSON.parse(message.docJson), { force: true });
      break;
    case 'previewMarpHtml':
      if (editorMode === 'preview' && typeof message.html === 'string') {
        applyPreviewMarpHtml(message.html);
      }
      break;
    case 'convertToGfmCancelled':
      gfmConvertPending = false;
      break;
    case 'modeChanged':
      if (message.editorMode && message.editorMode !== editorMode) {
        applyMode(message.editorMode as EditorMode, false);
      }
      break;
    case 'rawParseFailed':
      setRawParseBanner(!!message.failed, message.message);
      break;
    case 'readonlyChanged':
      readonly = message.readonly;
      document.body.setAttribute('data-readonly', String(readonly));
      setModeUi(editorMode);
      break;
    case 'tableLimitWarning': {
      const el = document.getElementById('table-warning');
      if (el) {
        if (message.exceeded) {
          el.textContent = message.message ?? 'Table size warning';
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
      break;
    }
    case 'imageInserted':
      if (editor && !readonly && editorMode === 'markdown') {
        editor.chain().focus().setImage({ src: message.relativePath, alt: message.relativePath }).run();
        vscode.postMessage({ type: 'update', docJson: JSON.stringify(editor.getJSON()) });
      }
      break;
    case 'themeUpdated':
      if (message.kind === 'light' || message.kind === 'dark' || message.kind === 'highContrast') {
        handleThemeUpdated(message.kind);
      }
      break;
  }
});

vscode.postMessage({ type: 'ready' });
