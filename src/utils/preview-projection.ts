import {
  rewriteImageSrcForDisplay,
  rewriteImageUrisInDocJson,
  rewriteImageUrisInHtml,
  type MdFileUri,
  type WebviewUriResolver,
} from './image-uri-rewrite';
import { renderMarpPreviewFragment } from './marp-render';
import { isMarpDocument } from './is-marp-document';
import type { WebviewOutboundMessage } from '../webviews/messages';

export type PreviewSurface = 'tiptap' | 'marp';

/** Host → Webview docJson projection with image URI rewrite (display only). */
export function projectDocJsonForDisplay(
  docJson: string,
  mdUri: MdFileUri,
  webview: WebviewUriResolver,
): string {
  return rewriteImageUrisInDocJson(docJson, mdUri, webview);
}

/** Apply display-only image URI rewrite to outbound Host → Webview messages. */
export function applyDisplayUriRewrite(
  message: WebviewOutboundMessage,
  mdUri: MdFileUri,
  webview: WebviewUriResolver,
): WebviewOutboundMessage {
  switch (message.type) {
    case 'init':
      return {
        ...message,
        docJson: projectDocJsonForDisplay(message.docJson, mdUri, webview),
      };
    case 'docUpdated':
      if (typeof message.docJson === 'string') {
        return {
          ...message,
          docJson: projectDocJsonForDisplay(message.docJson, mdUri, webview),
        };
      }
      return message;
    case 'previewMarpHtml':
      return {
        ...message,
        html: rewriteImageUrisInHtml(message.html, mdUri, webview),
      };
    case 'imageInserted':
      return {
        ...message,
        relativePath: rewriteImageSrcForDisplay(message.relativePath, mdUri, webview),
      };
    default:
      return message;
  }
}

export function resolvePreviewSurface(editorMode: string, markdownText: string): PreviewSurface {
  if (editorMode === 'preview' && isMarpDocument(markdownText)) {
    return 'marp';
  }
  return 'tiptap';
}

/** Build Host → Webview projection messages for Preview mode refresh. */
export function buildPreviewProjectionMessages(
  editorMode: string,
  docJson: string,
  markdownText: string,
): WebviewOutboundMessage[] {
  if (editorMode !== 'preview') {
    return [];
  }
  if (resolvePreviewSurface(editorMode, markdownText) === 'marp') {
    const html = renderMarpPreviewFragment(markdownText) ?? '';
    return [{ type: 'previewMarpHtml', html }];
  }
  return [{ type: 'docUpdated', docJson, markdownText }];
}
