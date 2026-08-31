import { Marp } from '@marp-team/marp-core';
import { sanitizeHtml } from './sanitize';
import { isMarpDocument } from './is-marp-document';

/** Strip CSS constructs that can break out of a style tag or execute expressions. */
function sanitizeCss(css: string): string {
  return css
    .replace(/<\/style/gi, '')
    .replace(/<script/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/@import/gi, '');
}

/** Render sanitized Marp body fragment (style + slides) from markdownText. */
export function renderMarpPreviewFragment(markdownText: string): string | undefined {
  if (!isMarpDocument(markdownText)) {
    return undefined;
  }
  const marp = new Marp();
  const { html, css } = marp.render(markdownText);
  const sanitized = sanitizeHtml(html);
  const safeCss = sanitizeCss(css);
  return `<style>${safeCss}</style>${sanitized}`;
}
