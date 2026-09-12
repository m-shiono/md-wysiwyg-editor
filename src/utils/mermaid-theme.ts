import type { ThemeKind } from './theme-sync';

/** Global Mermaid density — Default Markdown Preview–like (product choice B). */
export const MERMAID_DENSITY_FONT_SIZE = '12px';

/** Stock Mermaid flowchart hug→wrap (Mermaid defaults; explicit for contract/tests). */
export const MERMAID_FLOWCHART_LAYOUT = {
  wrappingWidth: 200,
  padding: 15,
} as const;

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
        themeVariables: { fontSize: MERMAID_DENSITY_FONT_SIZE },
        securityLevel: 'strict',
        flowchart,
      };
    case 'dark':
    case 'highContrast':
      return {
        theme: 'redux-dark',
        themeVariables: { fontSize: MERMAID_DENSITY_FONT_SIZE },
        securityLevel: 'strict',
        flowchart,
      };
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return {
        theme: 'redux',
        themeVariables: { fontSize: MERMAID_DENSITY_FONT_SIZE },
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
