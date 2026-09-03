import type { ThemeKind } from './theme-sync';

const VS_CODE_THEME_VAR_KEYS: Record<string, string> = {
  background: '--vscode-editor-background',
  textColor: '--vscode-editor-foreground',
  primaryTextColor: '--vscode-editor-foreground',
  lineColor: '--vscode-panel-border',
  primaryBorderColor: '--vscode-panel-border',
  primaryColor: '--vscode-editorWidget-background',
  fontFamily: '--vscode-font-family',
};

export type MermaidThemeConfig = {
  theme: string;
  themeVariables: Record<string, string>;
  securityLevel: string;
};

export function buildMermaidThemeConfig(_kind: ThemeKind): MermaidThemeConfig {
  const themeVariables: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(VS_CODE_THEME_VAR_KEYS)) {
    themeVariables[key] = `var(${cssVar})`;
  }
  return {
    theme: 'base',
    themeVariables,
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
  runtime.initialize(buildMermaidThemeConfig(kind));
  runtime.scheduleRerender();
}
