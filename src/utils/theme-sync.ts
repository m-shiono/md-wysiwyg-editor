export type ThemeKind = 'light' | 'dark' | 'highContrast';

/** VS Code ColorThemeKind: Light=1, Dark=2, HighContrast=3, HighContrastLight=4 */
export function mapColorThemeKind(kind: number): ThemeKind {
  if (kind === 3 || kind === 4) {
    return 'highContrast';
  }
  if (kind === 2) {
    return 'dark';
  }
  return 'light';
}

export function buildThemeUpdatedMessage(
  kind: ThemeKind,
): { type: 'themeUpdated'; kind: ThemeKind } {
  return { type: 'themeUpdated', kind };
}

/** Display-layer theme sync must not mutate Document fields (AD-002 / TC-150). */
export function applyThemeDisplayOnly(
  markdownText: string,
  docJson: string,
  _kind: ThemeKind,
): { markdownText: string; docJson: string } {
  return { markdownText, docJson };
}
