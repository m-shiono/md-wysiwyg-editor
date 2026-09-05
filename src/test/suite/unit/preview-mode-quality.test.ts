/**
 * TC-013 (themeUpdated extension), TC-143–151: preview-mode-quality contracts (TDD Red).
 * Production theme sync / Mermaid theme / Preview CSS may be absent until build-agent Green.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { docToJson, parseMarkdown, serializeMarkdown } from '../../../serializers/markdown-serializer';

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

/** Valid Mermaid frontmatter fixture (TC-143) — not temporary/test.md (RK-005). */
const MERMAID_FRONTMATTER_INNER = [
  '---',
  'title: Valid Flowchart',
  '---',
  'flowchart TD',
  '    Start[Start] --> End[End]',
].join('\n');

const MERMAID_FRONTMATTER_DOC = [
  '# Mermaid frontmatter sample',
  '',
  '```mermaid',
  MERMAID_FRONTMATTER_INNER,
  '```',
  '',
].join('\n');

suite('preview-mode-quality (TC-013, TC-143–151)', () => {
  // --- Mermaid frontmatter full render (TC-143) ---

  test('TC-143: buildMermaidRenderSource passes full fence text including YAML frontmatter to render', () => {
    const buildMermaidRenderSource = getUtilExport<(source: string) => string>(
      'mermaid-render',
      'buildMermaidRenderSource',
    );
    assert.ok(buildMermaidRenderSource, 'buildMermaidRenderSource export required (TC-143 AD-003)');

    const renderSource = buildMermaidRenderSource!(MERMAID_FRONTMATTER_INNER);
    assert.ok(renderSource.startsWith('---'), 'render source must start with YAML frontmatter delimiter');
    assert.ok(
      renderSource.includes('title: Valid Flowchart'),
      'render source must include frontmatter title line',
    );
    assert.ok(renderSource.includes('flowchart TD'), 'render source must include diagram body');
    assert.strictEqual(
      renderSource,
      MERMAID_FRONTMATTER_INNER,
      'Webview must not strip frontmatter before mermaid.render',
    );
  });

  test('TC-143: serialize round-trip preserves mermaid fence with frontmatter for save', () => {
    const doc = parseMarkdown(MERMAID_FRONTMATTER_DOC);
    const serialized = serializeMarkdown(doc);
    assert.ok(serialized.includes('title: Valid Flowchart'), 'saved markdown must keep frontmatter title');
    assert.ok(serialized.includes('flowchart TD'), 'saved markdown must keep diagram body');
    assert.ok(serialized.includes('```mermaid'), 'saved markdown must keep mermaid fence');
  });

  // --- themeUpdated postMessage contract (TC-013 extension, TC-144) ---

  test('TC-013: Webview uses var(--vscode-*) tokens for theme-aware styling', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      css.includes('var(--vscode-editor-background)') ||
        css.includes('var(--vscode-foreground)'),
      'editor.css must reference VS Code theme CSS variables',
    );
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'editor.css must not use hardcoded hex colors');
  });

  test('TC-013: Host sends themeUpdated on Webview init/ready and color theme change', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      /onDidChangeActiveColorTheme/.test(providerSrc),
      'provider must listen for VS Code color theme changes',
    );
    assert.ok(/themeUpdated/.test(providerSrc), 'provider must post themeUpdated to Webview');

    const mapColorThemeKind = getUtilExport<
      (kind: number) => 'light' | 'dark' | 'highContrast'
    >('theme-sync', 'mapColorThemeKind');
    assert.ok(mapColorThemeKind, 'mapColorThemeKind export required (TC-013)');

    const buildThemeUpdatedMessage = getUtilExport<
      (kind: 'light' | 'dark' | 'highContrast') => { type: 'themeUpdated'; kind: string }
    >('theme-sync', 'buildThemeUpdatedMessage');
    assert.ok(buildThemeUpdatedMessage, 'buildThemeUpdatedMessage export required (TC-013)');

    const message = buildThemeUpdatedMessage!('dark');
    assert.strictEqual(message.type, 'themeUpdated');
    assert.strictEqual(message.kind, 'dark');
    assert.strictEqual(Object.keys(message).length, 2, 'payload must contain type and kind only');
  });

  test('TC-144: WebviewOutboundMessage defines themeUpdated with kind enum only', () => {
    const messagesSrc = readRepoFile('src/webviews/messages.ts');
    assert.ok(
      /type:\s*['"]themeUpdated['"]/.test(messagesSrc),
      'WebviewOutboundMessage must include themeUpdated',
    );
    assert.ok(
      /kind:\s*['"]light['"]/.test(messagesSrc) &&
        /['"]dark['"]/.test(messagesSrc) &&
        /highContrast/.test(messagesSrc),
      'themeUpdated kind must be light | dark | highContrast',
    );
    assert.ok(
      !/themeUpdated[\s\S]*html:/.test(messagesSrc),
      'themeUpdated must not carry arbitrary HTML payload',
    );
  });

  // --- Mermaid re-render on theme change (TC-145) ---

  test('TC-145: themeUpdated handler refreshes mermaid.initialize and re-renders NodeViews', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /case\s+['"]themeUpdated['"]/.test(editorSrc),
      'Webview must handle themeUpdated postMessage',
    );
    assert.ok(
      /mermaid\.initialize/.test(editorSrc),
      'Webview must call mermaid.initialize for theme sync',
    );
    assert.ok(
      /rerenderAllMermaid|refreshAllMermaid|scheduleMermaidThemeRerender/.test(editorSrc),
      'Webview must re-render all Mermaid NodeViews after theme change',
    );

    const handleThemeUpdated = getUtilExport<
      (kind: 'light' | 'dark' | 'highContrast') => void
    >('mermaid-theme', 'handleThemeUpdated');
    assert.ok(handleThemeUpdated, 'handleThemeUpdated export required (TC-145 AD-005)');
  });

  // --- Mermaid initialization and error isolation (TC-150) ---

  test('TC-150: Mermaid initialization and theme updates are wrapped in try-catch', () => {
    const mermaidThemeSrc = readRepoFile('src/utils/mermaid-theme.ts');
    assert.ok(
      /try\s*\{[\s\S]*runtime\.initialize[\s\S]*\}[\s\S]*catch/.test(mermaidThemeSrc) ||
        /try\s*\{[\s\S]*mermaid\.initialize[\s\S]*\}[\s\S]*catch/.test(mermaidThemeSrc),
      'Mermaid initialization must be wrapped in try-catch for error isolation (TC-150)',
    );
  });

  // --- Preview readability CSS (TC-146–148) ---

  test('TC-146: Preview mode sets body line-height 1.6 for readability', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      /body\[data-mode=['"]preview['"]\][\s\S]*line-height:\s*1\.6/.test(css),
      'Preview scope must set line-height 1.6',
    );
  });

  test('TC-147: Preview ProseMirror RO uses opacity 1 for contrast', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      /body\[data-mode=['"]preview['"]\][\s\S]*\.ProseMirror[\s\S]*opacity:\s*1\b/.test(css),
      'Preview-scoped ProseMirror must use opacity 1',
    );
  });

  test('TC-148: Preview readability CSS does not override Markdown or Raw modes', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      /body\[data-mode=['"]preview['"]\][\s\S]*line-height:\s*1\.6/.test(css),
      'line-height 1.6 must live under preview scope',
    );
    assert.ok(
      !/body\[data-mode=['"]markdown['"]\][\s\S]*line-height:\s*1\.6/.test(css),
      'Markdown mode must not inherit preview line-height override',
    );
    assert.ok(
      !/body\[data-mode=['"]raw['"]\][\s\S]*line-height:\s*1\.6/.test(css),
      'Raw mode must not inherit preview line-height override',
    );
    assert.ok(
      !/body\[data-mode=['"]markdown['"]\][\s\S]*\.ProseMirror[\s\S]*opacity:\s*1\b/.test(css),
      'Markdown mode must not get preview-only ProseMirror opacity override',
    );
  });

  // --- Mermaid built-in theme mapping (TC-149) ---

  test('TC-149: buildMermaidThemeConfig maps VS Code kind to island-safe Mermaid themes and excludes var()', () => {
    const buildMermaidThemeConfig = getUtilExport<
      (kind: 'light' | 'dark' | 'highContrast') => {
        theme: string;
        themeVariables: Record<string, string>;
        securityLevel: string;
      }
    >('mermaid-theme', 'buildMermaidThemeConfig');
    assert.ok(buildMermaidThemeConfig, 'buildMermaidThemeConfig export required (TC-149 AD-004)');

    // 島ライトキャンバス方針（mermaid-contrast-readable UD-001=B）: dark/HC も default
    const darkConfig = buildMermaidThemeConfig!('dark');
    assert.strictEqual(
      darkConfig.theme,
      'default',
      'dark kind maps to default on light island (not Mermaid dark)',
    );

    const highContrastConfig = buildMermaidThemeConfig!('highContrast');
    assert.strictEqual(
      highContrastConfig.theme,
      'default',
      'highContrast kind maps to default on light island',
    );

    const lightConfig = buildMermaidThemeConfig!('light');
    assert.strictEqual(lightConfig.theme, 'default', 'light kind should map to default theme');

    // Test themeVariables exclusion of var()
    [darkConfig, highContrastConfig, lightConfig].forEach(config => {
      if (config.themeVariables) {
        Object.values(config.themeVariables).forEach(val => {
          assert.ok(!val.includes('var(--vscode-'), `themeVariables must NOT contain var(): ${val}`);
        });
      }
    });

    assert.strictEqual(darkConfig.securityLevel, 'strict');
  });

  // --- Display layer does not mutate Document (TC-151) ---

  test('TC-151: theme and preview display projection leaves Document fields unchanged', () => {
    const applyThemeDisplayOnly = getUtilExport<
      (
        markdownText: string,
        docJson: string,
        kind: 'light' | 'dark' | 'highContrast',
      ) => { markdownText: string; docJson: string }
    >('theme-sync', 'applyThemeDisplayOnly');
    assert.ok(applyThemeDisplayOnly, 'applyThemeDisplayOnly export required (TC-150 AD-002)');

    const doc = parseMarkdown(MERMAID_FRONTMATTER_DOC);
    const markdownText = serializeMarkdown(doc);
    const docJson = docToJson(doc);

    for (const kind of ['light', 'dark', 'highContrast'] as const) {
      const result = applyThemeDisplayOnly!(markdownText, docJson, kind);
      assert.strictEqual(
        result.markdownText,
        markdownText,
        `theme ${kind} must not alter markdownText`,
      );
      assert.strictEqual(result.docJson, docJson, `theme ${kind} must not alter docJson`);
    }

    const reserialized = serializeMarkdown(doc);
    assert.ok(
      reserialized.includes('title: Valid Flowchart'),
      'serialize after display-layer ops must keep mermaid frontmatter',
    );
  });
});
