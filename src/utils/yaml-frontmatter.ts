/** Matches a leading YAML front matter fence (`---` … `---`). */
export const YAML_FRONTMATTER_FENCE_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;

export interface SplitYamlFrontmatterResult {
  frontmatterBody: string | null;
  body: string;
}

/**
 * Splits document-leading YAML front matter from the Markdown body.
 * Only the opening fence at the start of the file is considered (Marp slide `---` in body is untouched).
 */
export function splitYamlFrontmatter(markdown: string): SplitYamlFrontmatterResult {
  const text = markdown.replace(/^\uFEFF/, '');
  const match = text.match(YAML_FRONTMATTER_FENCE_RE);
  if (!match) {
    return { frontmatterBody: null, body: markdown };
  }
  const frontmatterBody = match[1];
  let body = text.slice(match[0].length);
  if (body.startsWith('\r\n')) {
    body = body.slice(2);
  } else if (body.startsWith('\n')) {
    body = body.slice(1);
  }
  return { frontmatterBody, body };
}

/** Rejoins front matter inner text and body into a Markdown document string. */
export function joinYamlFrontmatter(frontmatterBody: string, body: string): string {
  const trimmedBody = body.replace(/^\uFEFF/, '');
  const prefix = `---\n${frontmatterBody}\n---\n\n`;
  if (trimmedBody.length === 0) {
    return prefix.replace(/\n\n$/, '\n');
  }
  return prefix + trimmedBody;
}
