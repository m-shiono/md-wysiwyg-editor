export type ClassifiedLink =
  | { kind: 'anchor'; slug: string }
  | { kind: 'external'; url: string }
  | { kind: 'relative'; path: string; fragment?: string }
  | { kind: 'unsafe'; reason: string };

const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);
const SCHEME_PREFIX_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*:)/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Classify a Markdown link href into anchor, safe external URL, relative path, or unsafe.
 */
export function classifyLinkHref(href: string): ClassifiedLink {
  const trimmed = href.trim();
  if (!trimmed) {
    return { kind: 'unsafe', reason: 'Empty href' };
  }
  if (CONTROL_CHAR_RE.test(trimmed)) {
    return { kind: 'unsafe', reason: 'Control characters in href' };
  }
  if (trimmed.startsWith('//')) {
    return { kind: 'unsafe', reason: 'Protocol-relative URL blocked' };
  }

  if (trimmed.startsWith('#')) {
    const rawSlug = trimmed.slice(1);
    const slug = safeDecodeURIComponent(rawSlug).trim();
    if (!slug) {
      return { kind: 'unsafe', reason: 'Empty anchor fragment' };
    }
    return { kind: 'anchor', slug };
  }

  const schemeMatch = trimmed.match(SCHEME_PREFIX_RE);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (ALLOWED_EXTERNAL_SCHEMES.has(scheme)) {
      return { kind: 'external', url: trimmed };
    }
    return { kind: 'unsafe', reason: `Disallowed URI scheme: ${scheme}` };
  }

  // Relative file path (strip optional ?query and #fragment)
  const hashIdx = trimmed.indexOf('#');
  const withoutFragment = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const fragment =
    hashIdx >= 0 ? safeDecodeURIComponent(trimmed.slice(hashIdx + 1)) : undefined;
  const queryIdx = withoutFragment.indexOf('?');
  const rawPath = queryIdx >= 0 ? withoutFragment.slice(0, queryIdx) : withoutFragment;
  const decodedPath = safeDecodeURIComponent(rawPath).trim();
  if (!decodedPath) {
    return { kind: 'unsafe', reason: 'Empty relative path' };
  }
  return fragment ? { kind: 'relative', path: decodedPath, fragment } : { kind: 'relative', path: decodedPath };
}

/**
 * Resolve a relative link path against the document's parent directory preserving URI scheme/authority.
 */
export function resolveRelativeLinkTarget<T extends { scheme: string }>(
  documentUri: T,
  relativePath: string,
  joinPath: (base: T, ...pathSegments: string[]) => T,
): T | null {
  if (documentUri.scheme === 'untitled') {
    return null;
  }
  const parentUri = joinPath(documentUri, '..');
  return joinPath(parentUri, relativePath);
}
