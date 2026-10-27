/**
 * Passes Mermaid fence inner text to `mermaid.render` without stripping YAML frontmatter (AD-003).
 * Normalizes CRLF newlines to LF to prevent Mermaid parser syntax errors across platforms.
 */
export function buildMermaidRenderSource(source: string): string {
  return source.replace(/\r\n/g, '\n');
}
