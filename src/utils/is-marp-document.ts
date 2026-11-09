import { splitYamlFrontmatter } from './yaml-frontmatter';

/** Detect Marp slide deck from YAML front matter (shared by Preview and panel). */
export function isMarpDocument(content: string): boolean {
  const { frontmatterBody: fm, body: afterFrontmatter } = splitYamlFrontmatter(content);
  if (fm === null) {
    return false;
  }
  if (/marp\s*:\s*true/i.test(fm)) {
    return true;
  }
  return /^---\s*$/m.test(afterFrontmatter);
}
