/**
 * Passes Mermaid fence inner text to `mermaid.render` without stripping YAML frontmatter (AD-003).
 */
export function buildMermaidRenderSource(source: string): string {
  return source;
}
