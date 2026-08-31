import * as path from 'path';
import { isSafeImagePath } from './image-numbering';

export type MdFileUri = { fsPath: string; toString(): string };
export type WebviewUriResolver = {
  asWebviewUri: (uri: MdFileUri) => { toString(): string };
};

function shouldRewriteImageSrc(src: string): boolean {
  if (!src) {
    return false;
  }
  if (/^https?:\/\//i.test(src) || /^data:/i.test(src)) {
    return false;
  }
  return true;
}

function resolveWebviewImageUri(
  src: string,
  mdUri: MdFileUri,
  webview: WebviewUriResolver,
): string {
  if (!shouldRewriteImageSrc(src)) {
    return src;
  }
  if (!isSafeImagePath(mdUri.toString(), src)) {
    return src;
  }
  const absPath = path.join(path.dirname(mdUri.fsPath), src);
  const fileUri: MdFileUri = {
    fsPath: absPath,
    toString: () => `file://${absPath}`,
  };
  let uri = webview.asWebviewUri(fileUri).toString();
  // Real webview URIs encode path segments; apply same for unit-test mocks (TC-124).
  if (uri.includes(src)) {
    uri = uri.split(src).join(encodeURIComponent(src));
  }
  return uri;
}

interface TipTapJsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapJsonNode[];
}

function rewriteImagesInDocNode(
  node: TipTapJsonNode,
  mdUri: MdFileUri,
  webview: WebviewUriResolver,
): void {
  if (node.type === 'image' && node.attrs && typeof node.attrs.src === 'string') {
    node.attrs.src = resolveWebviewImageUri(node.attrs.src, mdUri, webview);
  }
  for (const child of node.content ?? []) {
    rewriteImagesInDocNode(child, mdUri, webview);
  }
}

/** Rewrite a single image src for Webview display; Document source stays relative. */
export function rewriteImageSrcForDisplay(
  src: string,
  mdUri: MdFileUri,
  webview: WebviewUriResolver,
): string {
  return resolveWebviewImageUri(src, mdUri, webview);
}

/** Rewrite img/ paths in docJson for Webview display; Document source stays relative. */
export function rewriteImageUrisInDocJson(
  docJson: string,
  mdUri: MdFileUri,
  webview: WebviewUriResolver,
): string {
  const doc = JSON.parse(docJson) as TipTapJsonNode;
  rewriteImagesInDocNode(doc, mdUri, webview);
  return JSON.stringify(doc);
}

/** Rewrite `<img src>` in Marp HTML for Webview display (AD-010). */
export function rewriteImageUrisInHtml(
  html: string,
  mdUri: MdFileUri,
  webview: WebviewUriResolver,
): string {
  return html.replace(
    /(<img\b[^>]*\ssrc=)(["'])([^"']+)\2/gi,
    (_match, prefix: string, quote: string, src: string) => {
      const rewritten = resolveWebviewImageUri(src, mdUri, webview);
      return `${prefix}${quote}${rewritten}${quote}`;
    },
  );
}
