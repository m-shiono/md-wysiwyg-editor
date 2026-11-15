/**
 * JSDOM Webview runtime harness for testing real MarkdownEditorProvider HTML +
 * media/editor.js bundle + TipTap / NodeViews / FindWidget / ContextMenu.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

export interface DomElementLike {
  id: string;
  tagName: string;
  className: string;
  textContent: string | null;
  innerHTML: string;
  value?: string;
  selectionStart?: number;
  selectionEnd?: number;
  style: Record<string, string>;
  dataset: Record<string, string>;
  classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    toggle: (token: string, force?: boolean) => boolean;
    contains: (token: string) => boolean;
  };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  querySelector: (selector: string) => DomElementLike | null;
  querySelectorAll: (selector: string) => DomElementLike[];
  closest: (selector: string) => DomElementLike | null;
  addEventListener: (type: string, listener: (ev: unknown) => void, options?: unknown) => void;
  dispatchEvent: (event: unknown) => boolean;
  click: () => void;
  focus: () => void;
  blur: () => void;
  setSelectionRange?: (start: number, end: number) => void;
  getBoundingClientRect: () => { left: number; top: number; right: number; bottom: number; width: number; height: number };
}

export interface DomDocumentLike {
  body: DomElementLike;
  activeElement: DomElementLike | null;
  getElementById: (id: string) => DomElementLike | null;
  querySelector: (selector: string) => DomElementLike | null;
  querySelectorAll: (selector: string) => DomElementLike[];
  addEventListener: (type: string, listener: (ev: unknown) => void, options?: unknown) => void;
  dispatchEvent: (event: unknown) => boolean;
}

export interface DomWindowLike {
  document: DomDocumentLike;
  Event: new (type: string, init?: Record<string, unknown>) => unknown;
  KeyboardEvent: new (type: string, init?: Record<string, unknown>) => { defaultPrevented: boolean } & Record<string, unknown>;
  MouseEvent: new (type: string, init?: Record<string, unknown>) => { defaultPrevented: boolean } & Record<string, unknown>;
  MessageEvent: new (type: string, init?: Record<string, unknown>) => unknown;
  dispatchEvent: (event: unknown) => boolean;
  close: () => void;
}

export interface WebviewHarness {
  window: DomWindowLike;
  document: DomDocumentLike;
  postedMessages: Array<Record<string, unknown>>;
  sendHostMessage: (message: Record<string, unknown>) => void;
  dispatchKeydown: (
    target: DomElementLike | DomDocumentLike,
    init: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean },
  ) => { defaultPrevented: boolean };
  dispose: () => void;
}

function defaultWebviewHtmlSkeleton(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>MD WYSIWYG Editor</title></head>
<body data-readonly="false" data-mode="markdown" data-csp-nonce="test-nonce" data-elk-chunk-uri="" data-mermaid-chunk-uri="" data-table-pipe-alignment="aligned">
  <div id="mode-toolbar" role="toolbar" aria-label="Editor mode">
    <span class="mode-segment-group" role="group" aria-label="Mode selection">
      <button type="button" data-mode="markdown" class="active">Visual</button>
      <button type="button" data-mode="raw">Source</button>
    </span>
    <button type="button" data-mode="preview">Preview</button>
    <button type="button" data-action="native-preview" title="Open Default Markdown Preview" aria-label="Open Default Markdown Preview">Default Preview</button>
  </div>
  <div id="toolbar" role="toolbar" aria-label="Formatting">
    <button type="button" data-cmd="bold" aria-pressed="false">B</button>
    <button type="button" data-cmd="italic" aria-pressed="false">I</button>
    <button type="button" data-cmd="strike" aria-pressed="false">S</button>
    <button type="button" data-cmd="inlineCode" aria-pressed="false">\`</button>
    <button type="button" data-cmd="heading" data-level="1" aria-pressed="false">H1</button>
    <button type="button" data-cmd="heading" data-level="2" aria-pressed="false">H2</button>
    <button type="button" data-cmd="heading" data-level="3" aria-pressed="false">H3</button>
    <button type="button" data-cmd="heading" data-level="4" aria-pressed="false">H4</button>
    <button type="button" data-cmd="heading" data-level="5" aria-pressed="false">H5</button>
    <button type="button" data-cmd="heading" data-level="6" aria-pressed="false">H6</button>
    <button type="button" data-cmd="bulletList" aria-pressed="false">List</button>
    <button type="button" data-cmd="orderedList" aria-pressed="false">1. List</button>
    <button type="button" data-cmd="taskList" aria-pressed="false">Task</button>
    <button type="button" data-cmd="blockquote" aria-pressed="false">Quote</button>
    <button type="button" data-cmd="link" aria-pressed="false">Link</button>
    <button type="button" data-cmd="codeBlock" aria-pressed="false">Code</button>
    <button type="button" data-cmd="horizontalRule">―</button>
    <button type="button" data-cmd="insertToc">TOC</button>
    <div id="table-menu" class="toolbar-dropdown">
      <button type="button" id="table-menu-btn">Table</button>
      <div id="table-menu-panel" class="toolbar-dropdown-panel hidden" role="menu">
        <button type="button" data-table-op="insert" role="menuitem">Insert table</button>
        <button type="button" data-table-op="addRowAfter" role="menuitem">Add row below</button>
        <button type="button" data-table-op="convertToGfm" role="menuitem">Convert to GFM pipe table</button>
      </div>
    </div>
  </div>
  <div id="link-input-bar" class="hidden"><input type="url" id="link-url-input" /></div>
  <div id="find-widget" class="hidden" role="dialog" aria-label="Find and Replace">
    <div class="find-widget-row find-row">
      <button type="button" id="find-toggle-replace" class="find-icon-btn" aria-expanded="false"><span class="codicon-arrow">▸</span></button>
      <div class="find-input-wrapper">
        <input type="text" id="find-input" />
        <div class="find-options-group">
          <button type="button" class="find-opt-btn" data-option="matchCase" aria-pressed="false">Aa</button>
          <button type="button" class="find-opt-btn" data-option="matchWholeWord" aria-pressed="false">\\b</button>
          <button type="button" class="find-opt-btn" data-option="useRegex" aria-pressed="false">.*</button>
        </div>
      </div>
      <span id="find-count">No results</span>
      <button type="button" data-action="find-prev">▲</button>
      <button type="button" data-action="find-next">▼</button>
      <button type="button" data-action="find-close">✕</button>
    </div>
    <div id="replace-row" class="find-widget-row replace-row hidden">
      <input type="text" id="replace-input" />
      <button type="button" data-action="replace-one">Replace</button>
      <button type="button" data-action="replace-all">Replace All</button>
    </div>
  </div>
  <div id="table-warning" class="hidden"></div>
  <div id="raw-parse-banner" class="hidden"></div>
  <div id="preview-marp-root" class="hidden"></div>
  <div id="editor"></div>
  <div id="raw-editor-container" class="hidden">
    <div id="raw-search-backdrop"></div>
    <textarea id="raw-editor"></textarea>
  </div>
  <div id="table-context-menu" class="context-menu hidden" role="menu">
    <button type="button" data-table-op="addRowBefore" role="menuitem">Add row above</button>
    <button type="button" data-table-op="addRowAfter" role="menuitem">Add row below</button>
    <button type="button" data-table-op="moveRowUp" role="menuitem">Move row up</button>
    <button type="button" data-table-op="moveRowDown" role="menuitem">Move row down</button>
    <button type="button" data-table-op="duplicateRow" role="menuitem">Duplicate row</button>
    <button type="button" data-table-op="deleteRow" role="menuitem">Delete row</button>
    <button type="button" data-table-op="addColumnBefore" role="menuitem">Add column left</button>
    <button type="button" data-table-op="addColumnAfter" role="menuitem">Add column right</button>
    <button type="button" data-table-op="moveColumnLeft" role="menuitem">Move column left</button>
    <button type="button" data-table-op="moveColumnRight" role="menuitem">Move column right</button>
    <button type="button" data-table-op="deleteColumn" role="menuitem">Delete column</button>
    <button type="button" data-table-op="alignLeft" role="menuitem">Align Left</button>
    <button type="button" data-table-op="alignCenter" role="menuitem">Align Center</button>
    <button type="button" data-table-op="alignRight" role="menuitem">Align Right</button>
    <button type="button" data-table-op="deleteTable" role="menuitem">Delete table</button>
  </div>
  <div id="image-popover" class="image-popover hidden">
    <button type="button" data-preset="25%">25%</button>
    <button type="button" data-preset="50%">50%</button>
    <button type="button" data-preset="75%">75%</button>
    <button type="button" data-preset="100%">100%</button>
    <button type="button" data-align="left">Align left</button>
    <button type="button" data-align="center">Align center</button>
    <button type="button" data-align="right">Align right</button>
    <input type="text" id="image-alt-input" />
    <button type="button" data-action="zoom">Zoom</button>
  </div>
  <div id="image-lightbox" class="hidden">
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-content">
      <button type="button" class="lightbox-close">×</button>
      <img class="lightbox-image" src="" alt="" />
      <div class="lightbox-caption"></div>
    </div>
  </div>
</body>
</html>`;
}

function installDomShims(win: Record<string, unknown>): void {
  const zeroRect = { left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, x: 0, y: 0 };
  const RangeCtor = win.Range as { prototype: Record<string, unknown> } | undefined;
  if (RangeCtor?.prototype) {
    RangeCtor.prototype.getClientRects = () => [zeroRect];
    RangeCtor.prototype.getBoundingClientRect = () => zeroRect;
  }
  const ElementCtor = win.Element as { prototype: Record<string, unknown> } | undefined;
  if (ElementCtor?.prototype) {
    ElementCtor.prototype.getBoundingClientRect = () => zeroRect;
    ElementCtor.prototype.scrollIntoView = () => undefined;
    ElementCtor.prototype.scrollTo = () => undefined;
  }
  const doc = win.document as Record<string, unknown>;
  if (doc && typeof doc.elementFromPoint !== 'function') {
    doc.elementFromPoint = () => null;
  }
  if (typeof win.ResizeObserver === 'undefined') {
    win.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
  if (typeof win.requestAnimationFrame !== 'function') {
    win.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(0), 0);
    win.cancelAnimationFrame = (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
  }
  if (typeof win.innerWidth !== 'number') {
    win.innerWidth = 1024;
    win.innerHeight = 768;
  }
}

/**
 * Boot media/editor.js inside an isolated JSDOM realm with optional custom HTML
 * (e.g. HTML captured from MarkdownEditorProvider) and send initial `init` message.
 */
export function bootEditorWebviewInJsdom(options?: {
  html?: string;
  initMessage?: {
    docJson: string;
    markdownText: string;
    readonly?: boolean;
    uri?: string;
    editorMode?: 'preview' | 'markdown' | 'raw';
  };
}): WebviewHarness {
  const { JSDOM } = require('jsdom') as {
    JSDOM: new (html: string, cfg?: Record<string, unknown>) => {
      window: DomWindowLike & Record<string, unknown>;
      getInternalVMContext: () => vm.Context;
    };
  };

  const rawHtml = options?.html ?? defaultWebviewHtmlSkeleton();
  // Strip external script/link tags so JSDOM does not attempt network loads
  const cleanHtml = rawHtml
    .replace(/<script\b[^>]*src=[^>]*><\/script>/gi, '')
    .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '');

  const dom = new JSDOM(cleanHtml, {
    url: 'https://localhost/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  installDomShims(dom.window);

  const postedMessages: Array<Record<string, unknown>> = [];
  let webviewState: unknown = undefined;

  dom.window.acquireVsCodeApi = () => ({
    postMessage: (msg: Record<string, unknown>) => {
      postedMessages.push(msg);
    },
    getState: () => webviewState,
    setState: (state: unknown) => {
      webviewState = state;
    },
  });

  const editorBundlePath = path.resolve(process.cwd(), 'media', 'editor.js');
  const editorBundleCode = fs.readFileSync(editorBundlePath, 'utf8');
  vm.runInContext(editorBundleCode, dom.getInternalVMContext(), {
    filename: editorBundlePath,
  });

  const sendHostMessage = (message: Record<string, unknown>): void => {
    const ev = new dom.window.MessageEvent('message', { data: message });
    dom.window.dispatchEvent(ev);
  };

  if (options?.initMessage) {
    sendHostMessage({
      type: 'init',
      docJson: options.initMessage.docJson,
      markdownText: options.initMessage.markdownText,
      readonly: options.initMessage.readonly ?? false,
      uri: options.initMessage.uri ?? 'file:///tmp/test.md',
      editorMode: options.initMessage.editorMode ?? 'markdown',
    });
  }

  return {
    window: dom.window,
    document: dom.window.document,
    postedMessages,
    sendHostMessage,
    dispatchKeydown(target, init) {
      const ev = new dom.window.KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...init,
      });
      target.dispatchEvent(ev);
      return ev;
    },
    dispose() {
      dom.window.close();
    },
  };
}

/**
 * Install JSDOM window/document globals temporarily for Node-imported modules
 * like media/find-widget.ts, and return a cleanup callback.
 */
export function mountJsdomGlobals(html?: string): {
  window: DomWindowLike & Record<string, unknown>;
  document: DomDocumentLike;
  dispose: () => void;
} {
  const { JSDOM } = require('jsdom') as {
    JSDOM: new (html: string, cfg?: Record<string, unknown>) => {
      window: DomWindowLike & Record<string, unknown>;
    };
  };
  const dom = new JSDOM(html ?? defaultWebviewHtmlSkeleton(), {
    url: 'https://localhost/',
    pretendToBeVisual: true,
  });
  installDomShims(dom.window);

  const keys = [
    'window',
    'document',
    'navigator',
    'Element',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'HTMLButtonElement',
    'Node',
    'NodeFilter',
    'Range',
    'Event',
    'KeyboardEvent',
    'MouseEvent',
    'MessageEvent',
    'ResizeObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  const g = globalThis as Record<string, unknown>;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const key of keys) {
    saved.set(key, Object.getOwnPropertyDescriptor(g, key));
    if (key in dom.window) {
      Object.defineProperty(g, key, {
        value: dom.window[key],
        configurable: true,
        writable: true,
        enumerable: true,
      });
    }
  }

  return {
    window: dom.window,
    document: dom.window.document,
    dispose() {
      dom.window.close();
      for (const key of keys) {
        const desc = saved.get(key);
        if (desc) {
          Object.defineProperty(g, key, desc);
        } else {
          delete g[key];
        }
      }
    },
  };
}
