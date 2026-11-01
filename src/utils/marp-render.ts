import { Marp } from '@marp-team/marp-core';
import katexPlugin from '@marp-team/marp-core/plugins/katex';
import hljs from 'highlight.js/lib/common';
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

export interface MarpRenderOptions {
  /**
   * Base URI of the bundled KaTeX fonts (media/fonts) as seen from the webview.
   * When omitted, no @font-face rules are emitted, so no external font request
   * is made (webview CSP only allows local fonts).
   */
  katexFontPath?: string;
}

/**
 * Token colours for highlight.js output (GitHub light palette).
 * marp-core v4 shipped these in its theme CSS; v5 dropped highlight.js entirely.
 * Class-based on purpose: sanitizeHtml() strips inline `style` attributes.
 */
const HLJS_CSS = [
  '.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}',
  '.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}',
  '.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#005cc5}',
  '.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#032f62}',
  '.hljs-built_in,.hljs-symbol{color:#e36209}',
  '.hljs-comment,.hljs-code,.hljs-formula{color:#6a737d}',
  '.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#22863a}',
  '.hljs-subst{color:#24292e}',
  '.hljs-section{color:#005cc5;font-weight:700}',
  '.hljs-bullet{color:#735c0f}',
  '.hljs-emphasis{color:#24292e;font-style:italic}',
  '.hljs-strong{color:#24292e;font-weight:700}',
  '.hljs-addition{color:#22863a;background-color:#f0fff4}',
  '.hljs-deletion{color:#b31d28;background-color:#ffeef0}',
].join('');

function highlightCode(code: string, lang: string): string {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
  } catch {
    // fall through to unhighlighted output
  }
  return ''; // markdown-it escapes the code itself
}

/**
 * marp-core v5 no longer bundles math or syntax highlighting; opt in explicitly
 * to keep v4 behaviour. KaTeX fonts are served from the extension (not the
 * jsDelivr CDN) because the webview CSP only allows local fonts.
 */
function createMarp(options: MarpRenderOptions): Marp {
  return new Marp({ markdown: { highlight: highlightCode } }).use(
    katexPlugin({ fontPath: options.katexFontPath ?? false }),
  );
}

/** Render sanitized Marp body fragment (style + slides) from markdownText. */
export function renderMarpPreviewFragment(
  markdownText: string,
  options: MarpRenderOptions = {},
): string | undefined {
  if (!isMarpDocument(markdownText)) {
    return undefined;
  }
  const marp = createMarp(options);
  const { html, css } = marp.render(markdownText);
  const sanitized = sanitizeHtml(html);
  const safeCss = sanitizeCss(css) + HLJS_CSS;
  return `<style>${safeCss}</style>${sanitized}`;
}
