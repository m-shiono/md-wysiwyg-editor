import { Editor, Extension } from '@tiptap/core';
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
}

let editor: Editor | undefined;
let readonly = false;
let suppressUpdate = false;

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

const HtmlBlockExtension = Extension.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { html: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-html-block]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-html-block': 'true', innerHTML: HTMLAttributes.html }];
  },
});

function tipTapJsonToHtml(doc: TipTapDoc): string {
  if (!doc.content) {
    return '<p></p>';
  }
  return doc.content.map(nodeToHtml).join('');
}

function nodeToHtml(node: TipTapDoc): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const inner = inlineContent(node.content ?? []);
      return `<h${level}>${inner}</h${level}>`;
    }
    case 'paragraph':
      return `<p>${inlineContent(node.content ?? [])}</p>`;
    case 'bulletList':
      return `<ul>${(node.content ?? []).map((li) => `<li>${blockContent((li as TipTapDoc).content ?? [])}</li>`).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content ?? []).map((li) => `<li>${blockContent((li as TipTapDoc).content ?? [])}</li>`).join('')}</ol>`;
    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      const text = inlineContent(node.content ?? []);
      if (lang === 'mermaid') {
        return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(text)}"><div class="mermaid-preview"></div><pre class="mermaid-source">${escapeHtml(text)}</pre></div>`;
      }
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    }
    case 'table':
      if (node.attrs?.html) {
        return DOMPurify.sanitize(node.attrs.html as string);
      }
      return tableToHtml(node);
    case 'htmlBlock':
      return DOMPurify.sanitize((node.attrs?.html as string) ?? '');
    case 'horizontalRule':
      return '<hr/>';
    case 'blockquote':
      return `<blockquote>${blockContent(node.content ?? [])}</blockquote>`;
    default:
      return '';
  }
}

function inlineContent(nodes: unknown[]): string {
  return (nodes as TipTapDoc[])
    .map((n) => {
      if (n.type !== 'text') {
        return '';
      }
      let text = escapeHtml(n.text ?? '');
      for (const mark of n.marks ?? []) {
        if (mark.type === 'bold') {
          text = `<strong>${text}</strong>`;
        } else if (mark.type === 'italic') {
          text = `<em>${text}</em>`;
        } else if (mark.type === 'code') {
          text = `<code>${text}</code>`;
        } else if (mark.type === 'link') {
          text = `<a href="${escapeHtml((mark.attrs?.href as string) ?? '')}">${text}</a>`;
        }
      }
      return text;
    })
    .join('');
}

function blockContent(nodes: unknown[]): string {
  return (nodes as TipTapDoc[]).map(nodeToHtml).join('');
}

function tableToHtml(node: TipTapDoc): string {
  let html = '<table>';
  for (const row of node.content ?? []) {
    html += '<tr>';
    for (const cell of (row as TipTapDoc).content ?? []) {
      const tag = (cell as TipTapDoc).type === 'tableHeader' ? 'th' : 'td';
      html += `<${tag}>${blockContent((cell as TipTapDoc).content ?? [])}</${tag}>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return DOMPurify.sanitize(html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initEditor(initialDoc: TipTapDoc): void {
  const html = tipTapJsonToHtml(initialDoc);

  editor = new Editor({
    element: document.getElementById('editor')!,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: true, allowBase64: false }),
      HtmlTableExtension,
      HtmlBlockExtension,
    ],
    content: html,
    editable: !readonly,
    onUpdate: ({ editor: ed }) => {
      if (suppressUpdate || readonly) {
        return;
      }
      const json = ed.getJSON();
      vscode.postMessage({ type: 'update', docJson: JSON.stringify(json) });
      checkTableLimitsFromEditor(ed);
      scheduleMermaidRender();
    },
  });

  attachToolbarHandlers();
  attachPasteHandler();
  attachGfmTableClickHandler(initialDoc);
  scheduleMermaidRender();
}

function attachToolbarHandlers(): void {
  document.querySelectorAll('#toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!editor || readonly) {
        return;
      }
      const cmd = btn.getAttribute('data-cmd');
      switch (cmd) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'heading': {
          const level = parseInt(btn.getAttribute('data-level') ?? '1', 10) as 1 | 2 | 3 | 4 | 5 | 6;
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

function attachPasteHandler(): void {
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

function attachGfmTableClickHandler(initialDoc: TipTapDoc): void {
  const gfmTables = (initialDoc.content ?? []).filter(
    (n) => (n as TipTapDoc).type === 'table' && (n as TipTapDoc).attrs?.gfmSource,
  );
  if (gfmTables.length === 0) {
    return;
  }
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

function scheduleMermaidRender(): void {
  document.querySelectorAll('.mermaid-block').forEach((block, index) => {
    const id = `mermaid-${index}`;
    const source = decodeURIComponent(block.getAttribute('data-mermaid') ?? '');
    const preview = block.querySelector('.mermaid-preview');
    if (!preview) {
      return;
    }
    const existing = mermaidTimers.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    mermaidTimers.set(
      id,
      setTimeout(async () => {
        try {
          const { svg } = await mermaid.render(`${id}-svg`, source);
          preview.innerHTML = DOMPurify.sanitize(svg);
        } catch (err) {
          preview.innerHTML = `<div class="mermaid-error">${escapeHtml(String(err))}</div>`;
          vscode.postMessage({ type: 'mermaidError', error: String(err) });
        }
      }, MERMAID_DEBOUNCE_MS),
    );
  });
}

window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      readonly = message.readonly;
      document.body.setAttribute('data-readonly', String(readonly));
      initEditor(JSON.parse(message.docJson));
      vscode.postMessage({ type: 'ready' });
      break;
    case 'docUpdated':
      if (editor) {
        suppressUpdate = true;
        const doc = JSON.parse(message.docJson);
        editor.commands.setContent(tipTapJsonToHtml(doc));
        suppressUpdate = false;
        scheduleMermaidRender();
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
