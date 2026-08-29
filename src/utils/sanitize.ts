const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'code',
  'pre',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'input',
  'span',
  'div',
  'hr',
  'svg',
  'g',
  'path',
  'text',
  'rect',
  'circle',
  'line',
  'polygon',
  'polyline',
  'defs',
  'marker',
]);

const ALLOWED_ATTR = new Set([
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'class',
  'type',
  'checked',
  'disabled',
  'colspan',
  'rowspan',
  'width',
  'height',
  'viewBox',
  'xmlns',
  'fill',
  'stroke',
  'd',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'points',
  'transform',
]);

/** Strip dangerous event-handler attributes explicitly. */
export function stripEventHandlers(html: string): string {
  return html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/**
 * Sanitize untrusted HTML for Extension Host / Marp preview.
 * Lightweight whitelist (no jsdom) — scripts and disallowed tags/attrs removed.
 */
export function sanitizeHtml(html: string): string {
  let result = stripEventHandlers(html);
  result = result.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  result = result.replace(/<\s*script\b[^>]*\/?\s*>/gi, '');
  result = result.replace(/<\s*\/?\s*([a-zA-Z][\w:-]*)\b([^>]*)>/g, (match, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    const isClose = match.startsWith('</');
    if (!ALLOWED_TAGS.has(name)) {
      return '';
    }
    if (isClose) {
      return `</${name}>`;
    }
    const selfClosing = /\/\s*$/.test(attrs);
    const cleanedAttrs = [...attrs.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .filter((m) => ALLOWED_ATTR.has(m[1].toLowerCase()))
      .map((m) => {
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        if (/^\s*javascript:/i.test(value)) {
          return '';
        }
        return ` ${m[1].toLowerCase()}="${value.replace(/"/g, '&quot;')}"`;
      })
      .join('');
    return `<${name}${cleanedAttrs}${selfClosing ? ' /' : ''}>`;
  });
  return result;
}
