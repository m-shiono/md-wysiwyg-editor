import type { ThemeKind } from './theme-sync';

/** Global Mermaid density — Default Markdown Preview / Mermaid default (~16px). */
export const MERMAID_DENSITY_FONT_SIZE = '16px';

/** Mermaid default theme label family (Default Preview parity). */
export const MERMAID_DENSITY_FONT_FAMILY =
  '"trebuchet ms", verdana, arial, sans-serif';

/**
 * Label line-height — must not inherit editor Preview body 1.6.
 * Mermaid createText sets inline line-height 1.5; we override with !important to 1
 * so measure and paint match and the empty band under glyphs disappears.
 */
export const MERMAID_DENSITY_LINE_HEIGHT = '1';

/** Flowchart hug→wrap. Padding is tighter than Mermaid stock 15 so glyphs sit closer to the node border. */
export const MERMAID_FLOWCHART_LAYOUT = {
  wrappingWidth: 200,
  padding: 2,
} as const;

/** Shared density themeVariables (fontSize / family / line-height). */
function densityThemeVariables(): Record<string, string> {
  return {
    fontSize: MERMAID_DENSITY_FONT_SIZE,
    fontFamily: MERMAID_DENSITY_FONT_FAMILY,
    // Mermaid paints via themeVariables; CSS measure/preview also set line-height 1.2
    lineHeight: MERMAID_DENSITY_LINE_HEIGHT,
  };
}

export type MermaidThemeConfig = {
  theme: string;
  themeVariables: Record<string, string>;
  securityLevel: string;
  flowchart: {
    wrappingWidth: number;
    padding: number;
  };
};

export function buildMermaidThemeConfig(kind: ThemeKind): MermaidThemeConfig {
  // redux kind マップ（mermaid-redux-elk-fidelity AD-004）— classic default/dark は撤回
  const flowchart = {
    wrappingWidth: MERMAID_FLOWCHART_LAYOUT.wrappingWidth,
    padding: MERMAID_FLOWCHART_LAYOUT.padding,
  };
  switch (kind) {
    case 'light':
      return {
        theme: 'redux',
        themeVariables: densityThemeVariables(),
        securityLevel: 'strict',
        flowchart,
      };
    case 'dark':
    case 'highContrast':
      return {
        theme: 'redux-dark',
        themeVariables: densityThemeVariables(),
        securityLevel: 'strict',
        flowchart,
      };
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return {
        theme: 'redux',
        themeVariables: densityThemeVariables(),
        securityLevel: 'strict',
        flowchart,
      };
    }
  }
}

type MermaidThemeRuntime = {
  initialize: (config: MermaidThemeConfig) => void;
  scheduleRerender: () => void;
};

let runtime: MermaidThemeRuntime | undefined;

/** Webview registers live mermaid.initialize + NodeView rerender hooks (AD-005). */
export function registerMermaidThemeRuntime(next: MermaidThemeRuntime): void {
  runtime = next;
}

export function handleThemeUpdated(kind: ThemeKind): void {
  if (!runtime) {
    return;
  }
  try {
    runtime.initialize(buildMermaidThemeConfig(kind));
  } catch {
    // runtime.initialize might fail in webview context; isolate it
  }
  runtime.scheduleRerender();
}
