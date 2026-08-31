/** Detect Marp slide deck from YAML front matter (shared by Preview and panel). */
export function isMarpDocument(content: string): boolean {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return false;
  }
  const fm = fmMatch[1];
  if (/marp\s*:\s*true/i.test(fm)) {
    return true;
  }
  return /^---\s*$/m.test(content.slice(fmMatch[0].length));
}
