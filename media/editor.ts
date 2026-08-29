import { Editor, Extension, Node, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();
const lowlight = createLowlight(common);

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

const MERMAID_DEBOUNCE_MS = 300;
const mermaidTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface TipTapDoc {
  type: string;
  content?: unknown[];
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

let editor: Editor | undefined;
let readonly = false;
let suppressUpdate = false;
/** True after the first successful initEditor — ready must not force a second full init. */
let isEditorInitialized = false;

const HtmlTableExtension = Extension.create({
  name: 'htmlTable',
  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          html: { default: null },
          gfmSource: { default: false },
          converted: { default: false },
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
              const { svg } = await mermaid.render(`${viewId}-svg`, source || ' ');
              preview.innerHTML = DOMPurify.sanitize(svg);
            } catch (err) {
              preview.innerHTML = `<div class="mermaid-error">${escapeHtml(String(err))}</div>`;
              vscode.postMessage({ type: 'mermaidError', error: String(err) });
            }
          }, MERMAID_DEBOUNCE_MS),
        );
      };

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
 * TipTap table schema requires rows; HTML-only tables from the serializer use
 * attrs.html with empty content — map those to htmlBlock for the editor.
 */
function prepareDocForEditor(doc: TipTapDoc): JSONContent {
  const content = (doc.content ?? []).map((raw) => {
    const node = raw as TipTapDoc;
    if (
      node.type === 'table' &&
      node.attrs?.html &&
      (!node.content || node.content.length === 0)
    ) {
      return {
        type: 'htmlBlock',
        attrs: { html: node.attrs.html as string },
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
    StarterKit.configure({ codeBlock: false }),
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

function initEditor(initialDoc: TipTapDoc): void {
  // Guard against double init without destroy (ready + duplicate init).
  if (editor) {
    editor.destroy();
    editor = undefined;
  }

  const content = prepareDocForEditor(initialDoc);

  editor = new Editor({
    element: document.getElementById('editor')!,
    extensions: getEditorExtensions(),
    content,
    editable: !readonly,
    onUpdate: ({ editor: ed }) => {
      if (suppressUpdate || readonly) {
        return;
      }
      const json = ed.getJSON();
      vscode.postMessage({ type: 'update', docJson: JSON.stringify(json) });
      checkTableLimitsFromEditor(ed);
    },
  });

  isEditorInitialized = true;
  attachToolbarHandlers();
  attachPasteHandler();
  attachGfmTableClickHandler(initialDoc);
}

function applyExternalDoc(doc: TipTapDoc): void {
  if (!editor) {
    return;
  }
  suppressUpdate = true;
  // Prefer TipTap JSON — avoids lossy tipTapJsonToHtml default-empty path.
  editor.commands.setContent(prepareDocForEditor(doc));
  suppressUpdate = false;
}

function attachToolbarHandlers(): void {
  document.querySelectorAll('#toolbar button').forEach((btn) => {
    // Avoid stacking handlers across re-inits.
    const clone = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(clone, btn);
    clone.addEventListener('click', () => {
      if (!editor || readonly) {
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
        case 'link': {
          const url = prompt('URL');
          if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }
          break;
        }
        case 'codeBlock':
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case 'insertTable':
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          checkTableLimitsFromEditor(editor);
          break;
      }
    });
  });
}

let pasteHandlerAttached = false;
function attachPasteHandler(): void {
  if (pasteHandlerAttached) {
    return;
  }
  pasteHandlerAttached = true;
  document.addEventListener('paste', (event) => {
    if (readonly || !event.clipboardData) {
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

let gfmTableHandlerAttached = false;
function attachGfmTableClickHandler(initialDoc: TipTapDoc): void {
  const gfmTables = (initialDoc.content ?? []).filter(
    (n) => (n as TipTapDoc).type === 'table' && (n as TipTapDoc).attrs?.gfmSource,
  );
  if (gfmTables.length === 0 || gfmTableHandlerAttached) {
    return;
  }
  gfmTableHandlerAttached = true;
  document.getElementById('editor')?.addEventListener('click', (e) => {
    if (readonly) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('table')) {
      const json = editor?.getJSON();
      if (json) {
        vscode.postMessage({ type: 'convertGfmTable', docJson: JSON.stringify(json) });
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

window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      readonly = message.readonly;
      document.body.setAttribute('data-readonly', String(readonly));
      // ready must not force a second full init if already initialized —
      // apply content refresh instead of destroying a live editing session.
      if (isEditorInitialized && editor) {
        editor.setEditable(!readonly);
        applyExternalDoc(JSON.parse(message.docJson));
        break;
      }
      initEditor(JSON.parse(message.docJson));
      // Do not post ready here — that would loop with host sendInit on ready.
      break;
    case 'docUpdated':
      if (editor) {
        applyExternalDoc(JSON.parse(message.docJson));
      }
      break;
    case 'readonlyChanged':
      readonly = message.readonly;
      document.body.setAttribute('data-readonly', String(readonly));
      editor?.setEditable(!readonly);
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
      if (editor && !readonly) {
        editor.chain().focus().setImage({ src: message.relativePath, alt: message.relativePath }).run();
        vscode.postMessage({ type: 'update', docJson: JSON.stringify(editor.getJSON()) });
      }
      break;
  }
});

vscode.postMessage({ type: 'ready' });
