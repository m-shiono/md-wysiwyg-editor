import type { ThemeKind } from './theme-sync';

export type MermaidThemeConfig = {
  theme: string;
  themeVariables: Record<string, string>;
  securityLevel: string;
};

export function buildMermaidThemeConfig(kind: ThemeKind): MermaidThemeConfig {
  const theme = kind === 'dark' || kind === 'highContrast' ? 'dark' : 'default';
  return {
    theme,
    themeVariables: {},
    securityLevel: 'strict',
  };
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
  } catch (err) {
    // runtime.initialize might fail in webview context; isolate it
  }
  runtime.scheduleRerender();
}
