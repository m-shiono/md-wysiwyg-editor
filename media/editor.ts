import { Editor, Extension, Node, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Strike from '@tiptap/extension-strike';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { buildMermaidRenderSource } from '../src/utils/mermaid-render';
import {
  buildMermaidThemeConfig,
  handleThemeUpdated,
  registerMermaidThemeRuntime,
  type MermaidThemeConfig,
} from '../src/utils/mermaid-theme';
import type { ThemeKind } from '../src/utils/theme-sync';

/** AD-004: Strike 既定 Mod-Shift-s は Save All と衝突するため無効化。 */
const StrikeWithoutShortcut = Strike.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

/** AD-004: Blockquote 既定 Mod-Shift-b は Run Build Task と衝突するため無効化。 */
const BlockquoteWithoutShortcut = Blockquote.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

type EditorMode = 'preview' | 'markdown' | 'raw';
type TableFormat = 'gfm' | 'html';

type TableContext = {
  inTable: boolean;
  tableIndex: number;
  tableFormat: TableFormat | null;
};


const vscode = acquireVsCodeApi();
const lowlight = createLowlight(common);

const MERMAID_DEBOUNCE_MS = 300;
const MERMAID_THEME_RERENDER_DEBOUNCE_MS = 300;
const RAW_SYNC_DEBOUNCE_MS = 200;
const RAW_UPDATE_DEBOUNCE_MS = 250;
const mermaidTimers = new Map<string, ReturnType<typeof setTimeout>>();
const mermaidRerenderCallbacks = new Set<() => void>();
let mermaidThemeRerenderTimer: ReturnType<typeof setTimeout> | undefined;

function initializeMermaidTheme(kind: ThemeKind): void {
  try {
    const config = buildMermaidThemeConfig(kind);
    mermaid.initialize({
      startOnLoad: false,
      theme: config.theme as any,
      themeVariables: config.themeVariables,
      securityLevel: 'strict',
    });
  } catch (err) {
    console.error('Mermaid initialization failed:', err);
  }
}

initializeMermaidTheme('dark');

function scheduleMermaidThemeRerender(): void {
  if (mermaidThemeRerenderTimer) {
    clearTimeout(mermaidThemeRerenderTimer);
  }
  mermaidThemeRerenderTimer = setTimeout(() => {
    for (const rerender of mermaidRerenderCallbacks) {
      rerender();
    }
  }, MERMAID_THEME_RERENDER_DEBOUNCE_MS);
}

registerMermaidThemeRuntime({
  initialize: (config: MermaidThemeConfig) => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: config.theme as any,
        themeVariables: config.themeVariables,
        securityLevel: 'strict',
      });
    } catch (err) {
      console.error('Mermaid runtime initialization failed:', err);
    }
  },
  scheduleRerender: scheduleMermaidThemeRerender,
});

interface TipTapDoc {
  type: string;
  content?: unknown[];
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

let editor: Editor | undefined;
let insertTableFormat: TableFormat = 'gfm';
let readonly = false;
let editorMode: EditorMode = 'markdown';
let previewSurface: 'tiptap' | 'marp' = 'tiptap';
let suppressUpdate = false;
let suppressRawUpdate = false;
/** True after the first successful initEditor — ready must not force a second full init. */
let isEditorInitialized = false;
let latestMarkdownText = '';
let rawSyncTimer: ReturnType<typeof setTimeout> | undefined;
let rawUpdateTimer: ReturnType<typeof setTimeout> | undefined;
/** Bumped on HTML→GFM convert so Host can drop pre-convert `update` messages. */
let updateEpoch = 0;
let gfmConvertPending = false;

const HtmlTableExtension = Extension.create({
  name: 'htmlTable',
  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          tableFormat: { default: 'gfm' },
          html: { default: null },
          gfmSource: { default: false },
          converted: { default: false },
          gfmSourceMarkdown: { default: null },
          gfmContentFingerprint: { default: null },
        },
      },
    ];
  },
});

const HtmlBlockNode = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      html: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-html-block]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-html-block': 'true', 'data-html': HTMLAttributes.html as string }];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-html-block', 'true');
      dom.innerHTML = DOMPurify.sanitize((node.attrs.html as string) ?? '');
      return { dom };
    };
  },
});

/**
 * CodeBlock with Mermaid NodeView so fence source stays a TipTap node and
 * ordinary text edits do not wipe the diagram via lossy HTML round-trip.
 */
const MermaidAwareCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node }) => {
      const language = (node.attrs.language as string) ?? '';
      if (language !== 'mermaid') {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        if (language) {
          code.classList.add(`language-${language}`);
        }
        pre.appendChild(code);
        return { dom: pre, contentDOM: code };
      }

      const dom = document.createElement('div');
      dom.classList.add('mermaid-block');
      dom.setAttribute('data-mermaid-node', 'true');

      const preview = document.createElement('div');
      preview.classList.add('mermaid-preview');
      dom.appendChild(preview);

      const pre = document.createElement('pre');
      pre.classList.add('mermaid-source');
      const code = document.createElement('code');
      code.classList.add('language-mermaid');
      pre.appendChild(code);
      dom.appendChild(pre);

      const viewId = `mermaid-nv-${Math.random().toString(36).slice(2, 10)}`;

      const renderPreview = (source: string): void => {
        const existing = mermaidTimers.get(viewId);
        if (existing) {
          clearTimeout(existing);
        }
        mermaidTimers.set(
          viewId,
          setTimeout(async () => {
            try {
              const renderSource = buildMermaidRenderSource(source);
              const { svg } = await mermaid.render(`${viewId}-svg`, renderSource || ' ');
              preview.innerHTML = DOMPurify.sanitize(svg);
            } catch (err) {
              preview.innerHTML = `<div class="mermaid-error">${escapeHtml(String(err))}</div>`;
              vscode.postMessage({ type: 'mermaidError', error: String(err) });
            }
          }, MERMAID_DEBOUNCE_MS),
        );
      };

      const rerenderFromDom = (): void => {
        renderPreview(code.textContent ?? '');
      };

      mermaidRerenderCallbacks.add(rerenderFromDom);
      renderPreview(node.textContent);

      return {
        dom,
        contentDOM: code,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'codeBlock') {
            return false;
          }
          if ((updatedNode.attrs.language as string) !== 'mermaid') {
            return false;
          }
          renderPreview(updatedNode.textContent);
          return true;
        },
        destroy: () => {
          mermaidRerenderCallbacks.delete(rerenderFromDom);
          const existing = mermaidTimers.get(viewId);
          if (existing) {
            clearTimeout(existing);
          }
          mermaidTimers.delete(viewId);
        },
      };
    };
  },
}).configure({ lowlight });

/**
 * TipTap table schema requires rows. Host usually parses HTML tables into structure;
 * unparseable html-only tables keep attrs.html — map to htmlBlock so real HTML is not
 * replaced by a "(table)" placeholder.
 */
function prepareDocForEditor(doc: TipTapDoc): JSONContent {
  const content = (doc.content ?? []).map((raw) => {
    const node = raw as TipTapDoc;
    if (
      node.type === 'table' &&
      typeof node.attrs?.html === 'string' &&
      node.attrs.html.length > 0 &&
      (!node.content || node.content.length === 0)
    ) {
      return {
        type: 'htmlBlock',
        attrs: { html: node.attrs.html },
      };
    }
    return raw;
  });
  return { type: 'doc', content: content as JSONContent[] };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      // StarterKit 同梱の Strike / Blockquote はショートカット付きのため差し替え（AD-004）
      strike: false,
      blockquote: false,
    }),
    StrikeWithoutShortcut,
    BlockquoteWithoutShortcut,
    Link.configure({ openOnClick: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    MermaidAwareCodeBlock,
    Image.configure({ inline: true, allowBase64: false }),
    HtmlTableExtension,
    HtmlBlockNode,
  ];
}

function getRawEditor(): HTMLTextAreaElement | null {
  return document.getElementById('raw-editor') as HTMLTextAreaElement | null;
}

function getLinkInputBar(): HTMLElement | null {
  return document.getElementById('link-input-bar');
}

function getLinkUrlInput(): HTMLInputElement | null {
  return document.getElementById('link-url-input') as HTMLInputElement | null;
}

function hideLinkInputBar(): void {
  getLinkInputBar()?.classList.add('hidden');
}

function showLinkInputBar(): void {
  if (!editor || readonly || editorMode !== 'markdown') {
    return;
  }
  editor.chain().focus().extendMarkRange('link').run();
  const href = (editor.getAttributes('link').href as string) ?? '';
  const bar = getLinkInputBar();
  const input = getLinkUrlInput();
  if (!bar || !input) {
    return;
  }
  input.value = href;
  bar.classList.remove('hidden');
  input.focus();
  input.select();
}

function applyLinkFromInput(): void {
  if (!editor || readonly || editorMode !== 'markdown') {
    hideLinkInputBar();
    return;
  }
  const input = getLinkUrlInput();
  if (!input) {
    return;
  }
  const url = input.value.trim();
  if (url) {
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  } else {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  }
  hideLinkInputBar();
  editor.commands.focus();
}

function attachLinkInputHandlers(): void {
  const input = getLinkUrlInput();
  if (!input || input.dataset.bound === '1') {
    return;
  }
  input.dataset.bound = '1';
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLinkFromInput();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      hideLinkInputBar();
      editor?.commands.focus();
    }
  });
}

function isRawFocused(): boolean {
  const raw = getRawEditor();
  return !!raw && document.activeElement === raw;
}

function syncRawTextFromHost(text: string, immediate = false): void {
  latestMarkdownText = text;
  // Host 正本の full sync（変換・undo 等）は Raw フォーカス中でも反映する。
  if (isRawFocused() && !immediate) {
    return;
  }
  const apply = (): void => {
    const raw = getRawEditor();
    if (!raw || isRawFocused()) {
      return;
    }
    if (raw.value !== text) {
      suppressRawUpdate = true;
      raw.value = text;
      suppressRawUpdate = false;
    }
  };
  if (immediate) {
    if (rawSyncTimer) {
      clearTimeout(rawSyncTimer);
      rawSyncTimer = undefined;
    }
    apply();
    return;
  }
  if (rawSyncTimer) {
    clearTimeout(rawSyncTimer);
  }
  rawSyncTimer = setTimeout(apply, RAW_SYNC_DEBOUNCE_MS);
}

function scheduleRawTextUpdate(text: string): void {
  syncRawTextFromHost(text, false);
}

function getEditorRoot(): HTMLElement | null {
  return document.querySelector('#editor');
}

function applyPreviewMarpHtml(html: string): void {
  const marpRoot = document.getElementById('preview-marp-root');
  const editorEl = getEditorRoot();
  previewSurface = 'marp';
  if (marpRoot) {
    marpRoot.innerHTML = html;
    marpRoot.classList.remove('hidden');
  }
  if (editorEl) {
    editorEl.classList.add('hidden');
  }
}

function applyPreviewTipTap(): void {
  const marpRoot = document.getElementById('preview-marp-root');
  const editorEl = getEditorRoot();
  previewSurface = 'tiptap';
  if (marpRoot) {
    marpRoot.innerHTML = '';
    marpRoot.classList.add('hidden');
  }
  if (editorEl) {
    editorEl.classList.remove('hidden');
  }
}

function setModeUi(mode: EditorMode): void {
  editorMode = mode;
  document.body.setAttribute('data-mode', mode);

  document.querySelectorAll('#mode-toolbar button[data-mode]').forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.toggle('active', el.getAttribute('data-mode') === mode);
  });

  const editorEl = getEditorRoot();
  const rawEl = getRawEditor();
  const formatToolbar = document.getElementById('toolbar');
  const marpRoot = document.getElementById('preview-marp-root');

  if (mode !== 'preview') {
    if (marpRoot) {
      marpRoot.innerHTML = '';
      marpRoot.classList.add('hidden');
    }
    previewSurface = 'tiptap';
  } else if (previewSurface === 'marp') {
    if (marpRoot) {
      marpRoot.classList.remove('hidden');
    }
  } else if (marpRoot) {
    marpRoot.innerHTML = '';
    marpRoot.classList.add('hidden');
  }

  if (editorEl) {
    const hideEditor = mode === 'raw' || (mode === 'preview' && previewSurface === 'marp');
    editorEl.classList.toggle('hidden', hideEditor);
    editorEl.setAttribute('aria-readonly', String(mode === 'preview'));
  }
  if (rawEl) {
    rawEl.classList.toggle('hidden', mode !== 'raw');
  }
  if (formatToolbar) {
    // Format toolbar only for Markdown WYSIWYG (and hidden when file RO).
    formatToolbar.classList.toggle('hidden', mode !== 'markdown');
  }
  if (mode !== 'markdown' || readonly) {
    hideLinkInputBar();
  }

  const canEdit = !readonly && (mode === 'markdown' || mode === 'raw');
  // emitUpdate=false — UI-only; must not post Host update / dirty on open or mode switch.
  editor?.setEditable(mode === 'markdown' && canEdit, false);
  if (mode === 'preview') {
    editor?.setEditable(false, false);
    editor?.commands.blur();
  }
  if (rawEl) {
    rawEl.readOnly = !canEdit || mode !== 'raw';
  }
}

/** Flush pending Raw debounce before leaving Raw so edits are not dropped. */
function flushPendingRawUpdate(): void {
  if (!rawUpdateTimer) {
    return;
  }
  clearTimeout(rawUpdateTimer);
  rawUpdateTimer = undefined;
  if (readonly) {
    return;
  }
  const raw = getRawEditor();
  if (!raw) {
    return;
  }
  // Host accepts late updateRaw when !readonly (even if UI already left Raw).
  vscode.postMessage({ type: 'updateRaw', markdown: raw.value });
}

function applyMode(mode: EditorMode, notifyHost: boolean): void {
  if (editorMode === 'raw' && mode !== 'raw') {
    flushPendingRawUpdate();
  }
  setModeUi(mode);
  if (mode === 'raw') {
    const raw = getRawEditor();
    if (raw) {
      suppressRawUpdate = true;
      raw.value = latestMarkdownText;
      suppressRawUpdate = false;
    }
  }
  if (notifyHost) {
    vscode.postMessage({ type: 'setMode', editorMode: mode });
  }
}

function initEditor(initialDoc: TipTapDoc): void {
  // Guard against double init without destroy (ready + duplicate init).
  if (editor) {
    editor.destroy();
    editor = undefined;
  }

  suppressUpdate = true;
  try {
    const content = prepareDocForEditor(initialDoc);

    editor = new Editor({
      element: document.getElementById('editor')!,
      extensions: getEditorExtensions(),
      content,
      editable: !readonly && editorMode === 'markdown',
      onUpdate: ({ editor: ed }) => {
        if (suppressUpdate || gfmConvertPending || readonly || editorMode !== 'markdown') {
          return;
        }
        const json = ed.getJSON();
        vscode.postMessage({ type: 'update', docJson: JSON.stringify(json), epoch: updateEpoch });
        checkTableLimitsFromEditor(ed);
      },
    });

    isEditorInitialized = true;
    attachToolbarHandlers();
    attachLinkInputHandlers();
    attachModeToolbarHandlers();
    attachTableMenuHandlers();
    updateFormatToolbarPressedState();
    editor.on('selectionUpdate', () => updateFormatToolbarPressedState());
    editor.on('transaction', () => updateFormatToolbarPressedState());
    attachPasteHandler();
    attachRawEditorHandlers();
    attachPreviewGuard();
    updateTableMenuButtonStyle();
    setModeUi(editorMode);
  } finally {
    suppressUpdate = false;
  }
}

function applyExternalDoc(doc: TipTapDoc, options?: { force?: boolean }): void {
  if (!editor) {
    return;
  }
  // TC-067: skip re-apply during active Markdown typing unless Host pushes full docJson.
  if (editorMode === 'markdown' && editor.isFocused && !options?.force) {
    return;
  }
  suppressUpdate = true;
  editor.commands.setContent(prepareDocForEditor(doc));
  suppressUpdate = false;
  updateTableMenuState();
}

/** Block keyboard/paste/drop edits while Preview is active (strict RO). Scroll is allowed. */
function attachPreviewGuard(): void {
  const editorEl = getEditorRoot();
  if (!editorEl || editorEl.dataset.previewGuard === '1') {
    return;
  }
  editorEl.dataset.previewGuard = '1';

  const blockWhenPreview = (event: Event): void => {
    if (editorMode !== 'preview') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  editorEl.addEventListener('keydown', blockWhenPreview, true);
  editorEl.addEventListener('beforeinput', blockWhenPreview, true);
  editorEl.addEventListener('paste', blockWhenPreview, true);
  editorEl.addEventListener('drop', blockWhenPreview, true);
}

function attachModeToolbarHandlers(): void {
  document.querySelectorAll('#mode-toolbar button[data-mode]').forEach((btn) => {
    const clone = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(clone, btn);
    clone.addEventListener('click', () => {
      const mode = clone.getAttribute('data-mode') as EditorMode | null;
      if (!mode || mode === editorMode) {
        return;
      }
      // Mode switch alone — no content mutation; Host does not write disk.
      applyMode(mode, true);
    });
  });
}

function attachRawEditorHandlers(): void {
  const raw = getRawEditor();
  if (!raw || raw.dataset.bound === '1') {
    return;
  }
  raw.dataset.bound = '1';
  raw.addEventListener('input', () => {
    if (suppressRawUpdate || readonly || editorMode !== 'raw') {
      return;
    }
    const value = raw.value;
    if (rawUpdateTimer) {
      clearTimeout(rawUpdateTimer);
    }
    rawUpdateTimer = setTimeout(() => {
      vscode.postMessage({ type: 'updateRaw', markdown: value });
    }, RAW_UPDATE_DEBOUNCE_MS);
  });
}

function attachToolbarHandlers(): void {
  document.querySelectorAll('#toolbar button').forEach((btn) => {
    // Avoid stacking handlers across re-inits.
    const clone = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(clone, btn);
    clone.addEventListener('click', () => {
      if (!editor || readonly || editorMode !== 'markdown') {
        return;
      }
      const cmd = clone.getAttribute('data-cmd');
      switch (cmd) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'strike':
          editor.chain().focus().toggleStrike().run();
          break;
        case 'inlineCode':
          editor.chain().focus().toggleCode().run();
          break;
        case 'heading': {
          const level = parseInt(clone.getAttribute('data-level') ?? '1', 10) as
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6;
          editor.chain().focus().toggleHeading({ level }).run();
          break;
        }
        case 'bulletList':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'orderedList':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'taskList':
          editor.chain().focus().toggleTaskList().run();
          break;
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'link':
          showLinkInputBar();
          break;
        case 'codeBlock':
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case 'horizontalRule':
          editor.chain().focus().setHorizontalRule().run();
          break;
      }
      updateFormatToolbarPressedState();
    });
  });
}

function setToolbarPressed(btn: Element, pressed: boolean): void {
  btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  btn.classList.toggle('pressed', pressed);
}

/** Sync aria-pressed / pressed class with TipTap selection (AD-012). HR is insert-only. */
function updateFormatToolbarPressedState(): void {
  if (!editor) {
    return;
  }
  document.querySelectorAll('#toolbar button[data-cmd]').forEach((btn) => {
    const cmd = btn.getAttribute('data-cmd');
    if (!cmd || cmd === 'horizontalRule') {
      return;
    }
    if (cmd === 'heading') {
      const level = parseInt(btn.getAttribute('data-level') ?? '0', 10);
      setToolbarPressed(btn, editor!.isActive('heading', { level }));
      return;
    }
    const activeMap: Record<string, boolean> = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      inlineCode: editor.isActive('code'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList: editor.isActive('taskList'),
      blockquote: editor.isActive('blockquote'),
      link: editor.isActive('link'),
      codeBlock: editor.isActive('codeBlock'),
    };
    if (cmd in activeMap) {
      setToolbarPressed(btn, activeMap[cmd] ?? false);
    }
  });
}

function inferTableFormatFromAttrs(attrs: Record<string, unknown>): TableFormat {
  if (attrs.tableFormat === 'gfm' || attrs.tableFormat === 'html') {
    return attrs.tableFormat;
  }
  if (attrs.gfmSource === true) {
    return 'gfm';
  }
  if (typeof attrs.html === 'string' && attrs.html.length > 0) {
    return 'html';
  }
  if (attrs.gfmSource === false || attrs.converted === true) {
    return 'html';
  }
  return 'gfm';
}

function getTableContext(ed: Editor): TableContext {
  if (!ed.isActive('table')) {
    return { inTable: false, tableIndex: -1, tableFormat: null };
  }

  const $from = ed.state.selection.$from;
  let tableDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth < 0) {
    return { inTable: false, tableIndex: -1, tableFormat: null };
  }

  const tableAttrs = ed.getAttributes('table') as Record<string, unknown>;
  const tableFormat = inferTableFormatFromAttrs(tableAttrs);

  // Index among top-level doc blocks only — must match convertTableToGfmAtIndex(doc.content).
  const currentPos = $from.before(tableDepth);
  let tableIndex = 0;
  let matched = false;
  ed.state.doc.forEach((node, offset) => {
    if (matched || node.type.name !== 'table') {
      return;
    }
    if (offset === currentPos) {
      matched = true;
      return;
    }
    tableIndex += 1;
  });

  if (!matched) {
    return { inTable: false, tableIndex: -1, tableFormat: null };
  }

  return { inTable: true, tableIndex, tableFormat };
}

function updateTableMenuButtonStyle(): void {
  const btn = document.getElementById('table-menu-btn');
  if (!btn) {
    return;
  }
  btn.classList.toggle('table-format-html', insertTableFormat === 'html');
}

function closeTableMenuPanel(): void {
  document.getElementById('table-menu-panel')?.classList.add('hidden');
}

function openTableMenuPanel(): void {
  updateTableMenuState();
  document.getElementById('table-menu-panel')?.classList.remove('hidden');
}

function updateTableMenuState(): void {
  const panel = document.getElementById('table-menu-panel');
  if (!panel) {
    return;
  }

  const disabled = readonly || editorMode !== 'markdown';
  const ctx = editor ? getTableContext(editor) : { inTable: false, tableIndex: -1, tableFormat: null };

  panel.querySelectorAll('[data-table-op]').forEach((item) => {
    const el = item as HTMLButtonElement;
    const op = el.getAttribute('data-table-op');
    let isDisabled = disabled;

    if (op === 'insert') {
      isDisabled = disabled;
    } else if (
      op === 'addRowBefore' ||
      op === 'addRowAfter' ||
      op === 'deleteRow' ||
      op === 'addColumnBefore' ||
      op === 'addColumnAfter' ||
      op === 'deleteColumn' ||
      op === 'deleteTable' ||
      op === 'convertToGfm' ||
      op === 'convertToHtml'
    ) {
      isDisabled = disabled || !ctx.inTable;
      if (!isDisabled && op === 'convertToGfm' && ctx.tableFormat === 'gfm') {
        isDisabled = true;
      }
      if (!isDisabled && op === 'convertToHtml' && ctx.tableFormat === 'html') {
        isDisabled = true;
      }
    } else if (op === 'setDefaultGfm' || op === 'setDefaultHtml') {
      isDisabled = disabled;
    }

    el.disabled = isDisabled;
    el.classList.toggle('menu-checked', false);

    if (op === 'convertToGfm' && ctx.inTable && ctx.tableFormat === 'gfm') {
      el.classList.add('menu-checked');
    }
    if (op === 'convertToHtml' && ctx.inTable && ctx.tableFormat === 'html') {
      el.classList.add('menu-checked');
    }
    if (op === 'setDefaultGfm' && insertTableFormat === 'gfm') {
      el.classList.add('menu-checked');
    }
    if (op === 'setDefaultHtml' && insertTableFormat === 'html') {
      el.classList.add('menu-checked');
    }
  });
}

function postDocUpdate(): void {
  if (!editor || readonly || editorMode !== 'markdown' || gfmConvertPending) {
    return;
  }
  const json = editor.getJSON();
  vscode.postMessage({ type: 'update', docJson: JSON.stringify(json), epoch: updateEpoch });
  checkTableLimitsFromEditor(editor);
}

function handleTableOperation(op: string): void {
  if (!editor || readonly || editorMode !== 'markdown') {
    return;
  }

  closeTableMenuPanel();

  switch (op) {
    case 'insert':
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      editor.chain().focus().updateAttributes('table', { tableFormat: insertTableFormat }).run();
      postDocUpdate();
      break;
    case 'addRowBefore':
      editor.chain().focus().addRowBefore().run();
      postDocUpdate();
      break;
    case 'addRowAfter':
      editor.chain().focus().addRowAfter().run();
      postDocUpdate();
      break;
    case 'deleteRow':
      editor.chain().focus().deleteRow().run();
      postDocUpdate();
      break;
    case 'addColumnBefore':
      editor.chain().focus().addColumnBefore().run();
      postDocUpdate();
      break;
    case 'addColumnAfter':
      editor.chain().focus().addColumnAfter().run();
      postDocUpdate();
      break;
    case 'deleteColumn':
      editor.chain().focus().deleteColumn().run();
      postDocUpdate();
      break;
    case 'deleteTable':
      editor.chain().focus().deleteTable().run();
      postDocUpdate();
      break;
    case 'convertToHtml': {
      const ctx = getTableContext(editor);
      if (!ctx.inTable || ctx.tableFormat === 'html') {
        return;
      }
      editor.chain().focus().updateAttributes('table', { tableFormat: 'html' }).run();
      postDocUpdate();
      break;
    }
    case 'convertToGfm': {
      const ctx = getTableContext(editor);
      if (!ctx.inTable || ctx.tableFormat === 'gfm') {
        return;
      }
      // Confirm on Host. Do not postDocUpdate first — that HTML snapshot races the convert.
      gfmConvertPending = true;
      updateEpoch += 1;
      vscode.postMessage({
        type: 'requestConvertToGfm',
        tableIndex: ctx.tableIndex,
        docJson: JSON.stringify(editor.getJSON()),
        epoch: updateEpoch,
      });
      break;
    }
    case 'setDefaultGfm':
      insertTableFormat = 'gfm';
      updateTableMenuButtonStyle();
      updateTableMenuState();
      break;
    case 'setDefaultHtml':
      insertTableFormat = 'html';
      updateTableMenuButtonStyle();
      updateTableMenuState();
      break;
    default:
      break;
  }
}

function attachTableMenuHandlers(): void {
  const btn = document.getElementById('table-menu-btn');
  const panel = document.getElementById('table-menu-panel');
  if (!btn || !panel || btn.dataset.bound === '1') {
    return;
  }
  btn.dataset.bound = '1';

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (readonly || editorMode !== 'markdown') {
      return;
    }
    if (panel.classList.contains('hidden')) {
      openTableMenuPanel();
    } else {
      closeTableMenuPanel();
    }
  });

  panel.querySelectorAll('[data-table-op]').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      const op = (item as HTMLElement).getAttribute('data-table-op');
      if (op) {
        handleTableOperation(op);
      }
    });
  });

  if (!document.body.dataset.tableMenuBound) {
    document.body.dataset.tableMenuBound = '1';
    document.addEventListener('click', () => closeTableMenuPanel());
    editor?.on('selectionUpdate', () => {
      if (!panel.classList.contains('hidden')) {
        updateTableMenuState();
      }
    });
  }
}

let pasteHandlerAttached = false;
function attachPasteHandler(): void {
  if (pasteHandlerAttached) {
    return;
  }
  pasteHandlerAttached = true;
  document.addEventListener('paste', (event) => {
    if (readonly || editorMode !== 'markdown' || !event.clipboardData) {
      return;
    }
    const items = event.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] ?? '';
          vscode.postMessage({ type: 'pasteImage', mime: item.type, dataBase64: base64 });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  });
}

function checkTableLimitsFromEditor(ed: Editor): void {
  const json = ed.getJSON();
  let maxRows = 0;
  let maxCols = 0;
  for (const node of json.content ?? []) {
    if (node.type === 'table') {
      const rows = node.content?.length ?? 0;
      const cols = node.content?.[0]?.content?.length ?? 0;
      maxRows = Math.max(maxRows, rows);
      maxCols = Math.max(maxCols, cols);
    }
  }
  if (maxRows > 0 || maxCols > 0) {
    vscode.postMessage({ type: 'checkTableLimits', rows: maxRows, cols: maxCols });
  }
}

function setRawParseBanner(failed: boolean, message?: string): void {
  const el = document.getElementById('raw-parse-banner');
  if (!el) {
    return;
  }
  if (failed) {
    el.textContent = message ?? 'Raw Markdown parse failed. Save is blocked until fixed.';
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
    el.textContent = '';
  }
}

window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      readonly = message.readonly;
      document.body.setAttribute('data-readonly', String(readonly));
      latestMarkdownText = message.markdownText ?? '';
      editorMode = (message.editorMode as EditorMode) ?? 'markdown';
      // ready must not force a second full init if already initialized —
      // apply content refresh instead of destroying a live editing session.
      if (isEditorInitialized && editor) {
        editor.setEditable(!readonly && editorMode === 'markdown', false);
        applyExternalDoc(JSON.parse(message.docJson));
        scheduleRawTextUpdate(latestMarkdownText);
        setModeUi(editorMode);
        break;
      }
      initEditor(JSON.parse(message.docJson));
      scheduleRawTextUpdate(latestMarkdownText);
      break;
    case 'docUpdated':
      latestMarkdownText = message.markdownText ?? latestMarkdownText;
      if (typeof message.docJson !== 'string') {
        // Markdown-originated sync (TC-067): markdownText only.
        scheduleRawTextUpdate(latestMarkdownText);
        break;
      }
      if (editorMode === 'preview') {
        applyPreviewTipTap();
      }
      // Host-initiated full doc (table convert, Raw parse, revert, undo/redo).
      gfmConvertPending = false;
      syncRawTextFromHost(latestMarkdownText, true);
      applyExternalDoc(JSON.parse(message.docJson), { force: true });
      break;
    case 'previewMarpHtml':
      if (editorMode === 'preview' && typeof message.html === 'string') {
        applyPreviewMarpHtml(message.html);
      }
      break;
    case 'convertToGfmCancelled':
      gfmConvertPending = false;
      break;
    case 'modeChanged':
      if (message.editorMode && message.editorMode !== editorMode) {
        applyMode(message.editorMode as EditorMode, false);
      }
      break;
    case 'rawParseFailed':
      setRawParseBanner(!!message.failed, message.message);
      break;
    case 'readonlyChanged':
      readonly = message.readonly;
      document.body.setAttribute('data-readonly', String(readonly));
      setModeUi(editorMode);
      break;
    case 'tableLimitWarning': {
      const el = document.getElementById('table-warning');
      if (el) {
        if (message.exceeded) {
          el.textContent = message.message ?? 'Table size warning';
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
      break;
    }
    case 'imageInserted':
      if (editor && !readonly && editorMode === 'markdown') {
        editor.chain().focus().setImage({ src: message.relativePath, alt: message.relativePath }).run();
        vscode.postMessage({ type: 'update', docJson: JSON.stringify(editor.getJSON()) });
      }
      break;
    case 'themeUpdated':
      if (message.kind === 'light' || message.kind === 'dark' || message.kind === 'highContrast') {
        handleThemeUpdated(message.kind);
      }
      break;
  }
});

vscode.postMessage({ type: 'ready' });
