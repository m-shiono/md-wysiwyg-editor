import type { ThemeKind } from './theme-sync';

export type MermaidThemeConfig = {
  theme: string;
  themeVariables: Record<string, string>;
  securityLevel: string;
};

export function buildMermaidThemeConfig(kind: ThemeKind): MermaidThemeConfig {
  // 標準 kind マップ（fix-mermaid-edge-styles AD-004）— 島ライト強制は撤回済み
  switch (kind) {
    case 'light':
      return {
        theme: 'default',
        themeVariables: {},
        securityLevel: 'strict',
      };
    case 'dark':
    case 'highContrast':
      return {
        theme: 'dark',
        themeVariables: {},
        securityLevel: 'strict',
      };
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return {
        theme: 'default',
        themeVariables: {},
        securityLevel: 'strict',
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
