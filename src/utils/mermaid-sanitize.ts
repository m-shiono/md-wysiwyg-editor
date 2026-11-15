import DOMPurify from 'dompurify';

const MERMAID_SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject'],
  ADD_ATTR: ['xmlns'],
  // foreignObject 内の XHTML ラベルを空シェルにしない（mermaid-contrast-readable P0）
  HTML_INTEGRATION_POINTS: { foreignobject: true },
};

type PurifyLike = {
  isSupported?: boolean;
  sanitize: (dirty: string, cfg?: Record<string, unknown>) => string;
};

/**
 * Sanitize Mermaid-rendered SVG for NodeView preview.
 * Default DOMPurify strips flowchart foreignObject HTML labels; keep those while still removing script/on*.
 */
export function sanitizeMermaidSvg(svg: string): string {
  const purify = DOMPurify as unknown as PurifyLike & ((win: unknown) => PurifyLike);
  if (typeof purify.sanitize === 'function' && purify.isSupported !== false) {
    return purify.sanitize(svg, MERMAID_SANITIZE_CONFIG);
  }
  const win = (globalThis as { window?: unknown }).window;
  if (typeof purify === 'function' && win) {
    return purify(win).sanitize(svg, MERMAID_SANITIZE_CONFIG);
  }
  return '';
}
