/**
 * Find & Replace Widget for MD WYSIWYG Editor.
 * Supports Visual (TipTap), Source (Textarea), and Preview (Marp / RO) modes.
 */
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { searchPluginKey, type SearchMatch } from "./extensions/search-and-replace";

export interface SearchQuery {
  term: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
}

export interface SearchResult {
  total: number;
  current: number;
}

export interface SearchAdapter {
  find(query: SearchQuery, jumpToMatch?: boolean): SearchResult;
  next(): SearchResult;
  previous(): SearchResult;
  replace(replaceText: string): boolean;
  replaceAll(replaceText: string): number;
  clear(): void;
}

export function compileRegex(query: SearchQuery): RegExp | null {
  if (!query.term) {
    return null;
  }
  let pattern = query.term;
  if (!query.useRegex) {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  if (query.matchWholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  const flags = query.matchCase ? "gu" : "gui";
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Adapter for Raw Markdown textarea editor.
 */
export class RawSearchAdapter implements SearchAdapter {
  private textarea: HTMLTextAreaElement;
  private backdrop: HTMLElement | null = null;
  private matches: Array<{ start: number; end: number }> = [];
  private currentIndex = -1;
  private currentQuery: SearchQuery | null = null;
  private scrollHandler: (() => void) | null = null;
  private inputHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(textarea: HTMLTextAreaElement) {
    this.textarea = textarea;
    this.backdrop = document.getElementById("raw-search-backdrop");
    this.scrollHandler = () => this.syncScroll();
    this.textarea.addEventListener("scroll", this.scrollHandler);
    this.inputHandler = () => {
      if (this.currentQuery && this.currentQuery.term) {
        this.find(this.currentQuery, false);
      } else {
        this.clear();
      }
    };
    this.textarea.addEventListener("input", this.inputHandler);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.syncScroll());
      this.resizeObserver.observe(this.textarea);
    }
  }

  private syncScroll(): void {
    if (this.backdrop) {
      if (this.textarea.clientWidth > 0) {
        this.backdrop.style.width = `${this.textarea.clientWidth}px`;
        this.backdrop.style.height = `${this.textarea.clientHeight}px`;
      }
      this.backdrop.scrollTop = this.textarea.scrollTop;
      this.backdrop.scrollLeft = this.textarea.scrollLeft;
    }
  }

  find(query: SearchQuery, jumpToMatch = false): SearchResult {
    this.currentQuery = query;
    this.matches = [];
    this.currentIndex = -1;

    const regex = compileRegex(query);
    if (!regex) {
      this.renderBackdrop();
      return { total: 0, current: 0 };
    }

    const text = this.textarea.value;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      this.matches.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    if (this.matches.length > 0) {
      const selStart = this.textarea.selectionStart;
      let nextIdx = this.matches.findIndex((m) => m.start >= selStart);
      if (nextIdx === -1) {
        nextIdx = 0;
      }
      this.currentIndex = nextIdx;
      this.renderBackdrop();
      if (jumpToMatch) {
        this.highlightCurrent();
      }
    } else {
      this.renderBackdrop();
    }

    return {
      total: this.matches.length,
      current: this.currentIndex >= 0 ? this.currentIndex + 1 : 0,
    };
  }

  next(): SearchResult {
    if (this.matches.length === 0) {
      return { total: 0, current: 0 };
    }
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    this.renderBackdrop();
    this.highlightCurrent();
    return {
      total: this.matches.length,
      current: this.currentIndex + 1,
    };
  }

  previous(): SearchResult {
    if (this.matches.length === 0) {
      return { total: 0, current: 0 };
    }
    this.currentIndex =
      (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    this.renderBackdrop();
    this.highlightCurrent();
    return {
      total: this.matches.length,
      current: this.currentIndex + 1,
    };
  }

  private renderBackdrop(): void {
    if (!this.backdrop) {
      this.backdrop = document.getElementById("raw-search-backdrop");
      if (!this.backdrop) {
        return;
      }
    }
    if (this.matches.length === 0) {
      this.backdrop.innerHTML = "";
      return;
    }

    const text = this.textarea.value;
    let html = "";
    let lastIndex = 0;

    for (let i = 0; i < this.matches.length; i++) {
      const m = this.matches[i];
      if (m.start > lastIndex) {
        html += escapeHtml(text.slice(lastIndex, m.start));
      }
      const matchText = escapeHtml(text.slice(m.start, m.end));
      const isCurrent = i === this.currentIndex;
      const cls = isCurrent ? "find-highlight-current" : "find-highlight";
      html += `<mark class="${cls}">${matchText}</mark>`;
      lastIndex = m.end;
    }

    if (lastIndex < text.length) {
      html += escapeHtml(text.slice(lastIndex));
    }

    if (text.endsWith("\n")) {
      html += "\n ";
    }

    this.backdrop.innerHTML = html;
    this.syncScroll();
  }

  private highlightCurrent(): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) {
      return;
    }
    const m = this.matches[this.currentIndex];
    // Set selection range
    this.textarea.setSelectionRange(m.start, m.end);

    // Scroll textarea to view centered
    const currentMark = this.backdrop?.querySelector(
      "mark.find-highlight-current",
    ) as HTMLElement | null;
    if (currentMark) {
      const markTop = currentMark.offsetTop;
      const targetScrollTop = Math.max(
        0,
        markTop - this.textarea.clientHeight / 2,
      );
      this.textarea.scrollTop = targetScrollTop;
    } else {
      const textUpToMatch = this.textarea.value.substring(0, m.start);
      const lineCount = textUpToMatch.split("\n").length;
      const cs = window.getComputedStyle(this.textarea);
      const lineHeight = parseFloat(cs.lineHeight) || 20;
      const targetScrollTop = Math.max(
        0,
        (lineCount - 1) * lineHeight - this.textarea.clientHeight / 2,
      );
      this.textarea.scrollTop = targetScrollTop;
    }
    this.syncScroll();
  }

  replace(replaceText: string): boolean {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) {
      return false;
    }
    const m = this.matches[this.currentIndex];
    const val = this.textarea.value;
    const newVal = val.slice(0, m.start) + replaceText + val.slice(m.end);
    this.textarea.value = newVal;

    // Trigger input event so Document synchronizes
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }));

    // Re-run search from current position
    if (this.currentQuery) {
      this.find(this.currentQuery, false);
    }
    return true;
  }

  replaceAll(replaceText: string): number {
    if (this.matches.length === 0) {
      return 0;
    }
    let val = this.textarea.value;
    // Replace in reverse to prevent index shifting
    for (let i = this.matches.length - 1; i >= 0; i--) {
      const m = this.matches[i];
      val = val.slice(0, m.start) + replaceText + val.slice(m.end);
    }
    const count = this.matches.length;
    this.textarea.value = val;
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }));

    this.matches = [];
    this.currentIndex = -1;
    this.renderBackdrop();
    return count;
  }

  clear(): void {
    this.matches = [];
    this.currentIndex = -1;
    this.currentQuery = null;
    if (this.backdrop) {
      this.backdrop.innerHTML = "";
    }
  }

  destroy(): void {
    if (this.scrollHandler) {
      this.textarea.removeEventListener("scroll", this.scrollHandler);
    }
    if (this.inputHandler) {
      this.textarea.removeEventListener("input", this.inputHandler);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.clear();
  }
}

/**
 * Adapter for TipTap (Visual mode and RO Preview mode).
 */
export class TipTapSearchAdapter implements SearchAdapter {
  private editor: Editor;
  private matches: SearchMatch[] = [];
  private currentIndex = -1;
  private currentQuery: SearchQuery | null = null;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  find(query: SearchQuery, jumpToMatch = false): SearchResult {
    this.currentQuery = query;
    this.matches = [];
    this.currentIndex = -1;

    const regex = compileRegex(query);
    if (!regex) {
      this.updateDecorations();
      return { total: 0, current: 0 };
    }

    const doc = this.editor.state.doc;
    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null = null;
        while ((match = regex.exec(node.text)) !== null) {
          if (match[0].length === 0) {
            regex.lastIndex++;
            continue;
          }
          const from = pos + match.index;
          const to = from + match[0].length;
          this.matches.push({ from, to });
        }
      }
    });

    if (this.matches.length > 0) {
      const currentPos = this.editor.state.selection.from;
      let nextIdx = this.matches.findIndex((m) => m.from >= currentPos);
      if (nextIdx === -1) {
        nextIdx = 0;
      }
      this.currentIndex = nextIdx;
      this.updateDecorations();
      if (jumpToMatch) {
        this.scrollCurrentIntoView();
      }
    } else {
      this.updateDecorations();
    }

    return {
      total: this.matches.length,
      current: this.currentIndex >= 0 ? this.currentIndex + 1 : 0,
    };
  }

  next(): SearchResult {
    if (this.matches.length === 0) {
      return { total: 0, current: 0 };
    }
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    this.updateDecorations();
    this.scrollCurrentIntoView();
    return {
      total: this.matches.length,
      current: this.currentIndex + 1,
    };
  }

  previous(): SearchResult {
    if (this.matches.length === 0) {
      return { total: 0, current: 0 };
    }
    this.currentIndex =
      (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    this.updateDecorations();
    this.scrollCurrentIntoView();
    return {
      total: this.matches.length,
      current: this.currentIndex + 1,
    };
  }

  private scrollCurrentIntoView(): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) {
      return;
    }
    const m = this.matches[this.currentIndex];
    this.updateDecorations();

    // 1. Dispatch TextSelection + scrollIntoView to ProseMirror
    try {
      const tr = this.editor.state.tr
        .setSelection(TextSelection.create(this.editor.state.doc, m.from, m.to))
        .scrollIntoView();
      this.editor.view.dispatch(tr);
    } catch {
      // Fallback if selection fails
    }

    // 2. Direct DOM scroll to current highlight element
    requestAnimationFrame(() => {
      const currentEl = document.querySelector(".find-highlight-current");
      if (currentEl) {
        currentEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  private updateDecorations(): void {
    const { state, view } = this.editor;
    const { doc } = state;

    let decorations = DecorationSet.empty;
    if (this.matches.length > 0) {
      const decos = this.matches.map((m, index) => {
        const isCurrent = index === this.currentIndex;
        return Decoration.inline(m.from, m.to, {
          class: isCurrent ? "find-highlight-current" : "find-highlight",
        });
      });
      decorations = DecorationSet.create(doc, decos);
    }

    const tr = state.tr.setMeta(searchPluginKey, {
      results: this.matches,
      currentIndex: this.currentIndex,
      decorations,
    });
    view.dispatch(tr);
  }

  replace(replaceText: string): boolean {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) {
      return false;
    }
    const m = this.matches[this.currentIndex];
    const tr = this.editor.state.tr.insertText(replaceText, m.from, m.to);
    this.editor.view.dispatch(tr);

    if (this.currentQuery) {
      this.find(this.currentQuery, false);
    }
    return true;
  }

  replaceAll(replaceText: string): number {
    if (this.matches.length === 0) {
      return 0;
    }
    const count = this.matches.length;
    let tr = this.editor.state.tr;
    // Replace in reverse order so positions remain valid
    for (let i = this.matches.length - 1; i >= 0; i--) {
      const m = this.matches[i];
      tr = tr.insertText(replaceText, m.from, m.to);
    }
    this.editor.view.dispatch(tr);

    this.matches = [];
    this.currentIndex = -1;
    this.updateDecorations();
    return count;
  }

  clear(): void {
    this.matches = [];
    this.currentIndex = -1;
    this.currentQuery = null;
    this.updateDecorations();
  }
}

/**
 * Adapter for Marp Preview DOM (Readonly).
 */
export class MarpSearchAdapter implements SearchAdapter {
  private container: HTMLElement;
  private matches: HTMLElement[] = [];
  private currentIndex = -1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  find(query: SearchQuery, jumpToMatch = false): SearchResult {
    this.clear();
    const regex = compileRegex(query);
    if (!regex || !this.container) {
      return { total: 0, current: 0 };
    }

    const walker = document.createTreeWalker(
      this.container,
      NodeFilter.SHOW_TEXT,
      null,
    );

    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode.textContent && currentNode.textContent.trim()) {
        textNodes.push(currentNode as Text);
      }
      currentNode = walker.nextNode();
    }

    for (const node of textNodes) {
      const text = node.textContent ?? "";
      regex.lastIndex = 0;
      let match: RegExpExecArray | null = null;
      let lastIndex = 0;
      const fragments: Node[] = [];

      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        if (match.index > lastIndex) {
          fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const mark = document.createElement("mark");
        mark.className = "find-highlight";
        mark.textContent = match[0];
        fragments.push(mark);
        this.matches.push(mark);
        lastIndex = match.index + match[0].length;
      }

      if (fragments.length > 0) {
        if (lastIndex < text.length) {
          fragments.push(document.createTextNode(text.slice(lastIndex)));
        }
        const parent = node.parentNode;
        if (parent) {
          for (const frag of fragments) {
            parent.insertBefore(frag, node);
          }
          parent.removeChild(node);
        }
      }
    }

    if (this.matches.length > 0) {
      this.currentIndex = 0;
      if (jumpToMatch) {
        this.highlightCurrent();
      } else {
        this.matches.forEach((el, idx) => {
          el.classList.toggle("find-highlight-current", idx === 0);
        });
      }
    }

    return {
      total: this.matches.length,
      current: this.currentIndex >= 0 ? this.currentIndex + 1 : 0,
    };
  }

  next(): SearchResult {
    if (this.matches.length === 0) {
      return { total: 0, current: 0 };
    }
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    this.highlightCurrent();
    return {
      total: this.matches.length,
      current: this.currentIndex + 1,
    };
  }

  previous(): SearchResult {
    if (this.matches.length === 0) {
      return { total: 0, current: 0 };
    }
    this.currentIndex =
      (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    this.highlightCurrent();
    return {
      total: this.matches.length,
      current: this.currentIndex + 1,
    };
  }

  private highlightCurrent(): void {
    this.matches.forEach((el, idx) => {
      el.classList.toggle("find-highlight-current", idx === this.currentIndex);
    });
    if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
      this.matches[this.currentIndex].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  replace(): boolean {
    return false; // RO
  }

  replaceAll(): number {
    return 0; // RO
  }

  clear(): void {
    if (!this.container) {
      return;
    }
    const marks = this.container.querySelectorAll("mark.find-highlight");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
        parent.normalize();
      }
    });
    this.matches = [];
    this.currentIndex = -1;
  }
}

/**
 * Main Find & Replace Widget controller.
 */
export class FindWidget {
  private widgetEl: HTMLElement | null = null;
  private findInput: HTMLInputElement | null = null;
  private replaceInput: HTMLInputElement | null = null;
  private countLabel: HTMLElement | null = null;
  private toggleReplaceBtn: HTMLButtonElement | null = null;
  private replaceRow: HTMLElement | null = null;

  private adapter: SearchAdapter | null = null;
  private matchCase = false;
  private matchWholeWord = false;
  private useRegex = false;
  private isReplaceOpen = false;
  private isReadonly = false;
  private currentMode: "preview" | "markdown" | "raw" = "raw";
  public onClose?: () => void;

  constructor() {
    this.initElements();
    this.bindEvents();
  }

  private initElements(): void {
    this.widgetEl = document.getElementById("find-widget");
    this.findInput = document.getElementById("find-input") as HTMLInputElement | null;
    this.replaceInput = document.getElementById("replace-input") as HTMLInputElement | null;
    this.countLabel = document.getElementById("find-count");
    this.toggleReplaceBtn = document.getElementById("find-toggle-replace") as HTMLButtonElement | null;
    this.replaceRow = document.getElementById("replace-row");
  }

  private bindEvents(): void {
    if (!this.widgetEl) {
      return;
    }

    // Input changes (typing search query without losing input focus or jumping)
    this.findInput?.addEventListener("input", () => this.executeSearch(false));
    this.findInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          this.previous();
        } else {
          this.next();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });

    this.replaceInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.altKey || e.metaKey || e.ctrlKey) {
          this.replaceAll();
        } else {
          this.replace();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });

    // Option buttons
    this.widgetEl.querySelectorAll(".find-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = btn.getAttribute("data-option");
        if (opt === "matchCase") {
          this.matchCase = !this.matchCase;
          btn.classList.toggle("active", this.matchCase);
          btn.setAttribute("aria-pressed", String(this.matchCase));
        } else if (opt === "matchWholeWord") {
          this.matchWholeWord = !this.matchWholeWord;
          btn.classList.toggle("active", this.matchWholeWord);
          btn.setAttribute("aria-pressed", String(this.matchWholeWord));
        } else if (opt === "useRegex") {
          this.useRegex = !this.useRegex;
          btn.classList.toggle("active", this.useRegex);
          btn.setAttribute("aria-pressed", String(this.useRegex));
        }
        this.executeSearch(false);
      });
    });

    // Action buttons
    const prevBtn = this.widgetEl.querySelector('[data-action="find-prev"]');
    const nextBtn = this.widgetEl.querySelector('[data-action="find-next"]');

    prevBtn?.addEventListener("mousedown", (e) => e.preventDefault());
    prevBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      this.previous();
      this.findInput?.focus();
    });

    nextBtn?.addEventListener("mousedown", (e) => e.preventDefault());
    nextBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      this.next();
      this.findInput?.focus();
    });

    this.widgetEl.querySelector('[data-action="find-close"]')?.addEventListener("click", () => this.close());
    this.widgetEl.querySelector('[data-action="replace-one"]')?.addEventListener("click", () => this.replace());
    this.widgetEl.querySelector('[data-action="replace-all"]')?.addEventListener("click", () => this.replaceAll());

    // Toggle replace
    this.toggleReplaceBtn?.addEventListener("click", () => {
      this.toggleReplace(!this.isReplaceOpen);
    });
  }

  setAdapter(adapter: SearchAdapter | null): void {
    if (this.adapter && this.adapter !== adapter) {
      this.adapter.clear();
    }
    this.adapter = adapter;
    if (this.isOpen() && this.findInput?.value) {
      this.executeSearch(false);
    }
  }

  setContext(mode: "preview" | "markdown" | "raw", readonly: boolean): void {
    this.currentMode = mode;
    this.isReadonly = readonly;
    this.updateReadonlyState();
  }

  private updateReadonlyState(): void {
    const disableReplace = this.isReadonly || this.currentMode === "preview";
    if (disableReplace) {
      this.toggleReplace(false);
      if (this.toggleReplaceBtn) {
        this.toggleReplaceBtn.style.display = "none";
      }
    } else {
      if (this.toggleReplaceBtn) {
        this.toggleReplaceBtn.style.display = "";
      }
    }
  }

  toggleReplace(open: boolean): void {
    if (this.isReadonly || this.currentMode === "preview") {
      open = false;
    }
    this.isReplaceOpen = open;
    this.replaceRow?.classList.toggle("hidden", !open);
    this.toggleReplaceBtn?.setAttribute("aria-expanded", String(open));
    this.toggleReplaceBtn?.classList.toggle("active", open);
    const arrow = this.toggleReplaceBtn?.querySelector(".codicon-arrow");
    if (arrow) {
      arrow.textContent = open ? "▾" : "▸";
    }
  }

  open(options?: { showReplace?: boolean; initialQuery?: string }): void {
    if (!this.widgetEl) {
      this.initElements();
    }
    this.widgetEl?.classList.remove("hidden");
    this.updateReadonlyState();

    if (options?.showReplace && !this.isReadonly && this.currentMode !== "preview") {
      this.toggleReplace(true);
    }

    if (options?.initialQuery && this.findInput) {
      this.findInput.value = options.initialQuery;
    }

    this.findInput?.focus();
    this.findInput?.select();
    this.executeSearch(false);
  }

  close(): void {
    this.widgetEl?.classList.add("hidden");
    this.adapter?.clear();
    if (this.countLabel) {
      this.countLabel.textContent = "No results";
    }
    this.onClose?.();
  }

  isOpen(): boolean {
    return !!this.widgetEl && !this.widgetEl.classList.contains("hidden");
  }

  private executeSearch(jumpToMatch = false): void {
    if (!this.findInput || !this.adapter) {
      return;
    }
    const query: SearchQuery = {
      term: this.findInput.value,
      matchCase: this.matchCase,
      matchWholeWord: this.matchWholeWord,
      useRegex: this.useRegex,
    };

    // Check regex safety
    if (query.useRegex && query.term) {
      try {
        new RegExp(query.term);
        this.findInput.classList.remove("input-error");
      } catch {
        this.findInput.classList.add("input-error");
        if (this.countLabel) {
          this.countLabel.textContent = "Invalid regex";
        }
        this.adapter.clear();
        return;
      }
    } else {
      this.findInput.classList.remove("input-error");
    }

    if (!query.term) {
      this.adapter.clear();
      if (this.countLabel) {
        this.countLabel.textContent = "No results";
      }
      return;
    }

    const res = this.adapter.find(query, jumpToMatch);
    this.updateCount(res);
  }

  next(): void {
    if (this.adapter) {
      const res = this.adapter.next();
      this.updateCount(res);
    }
  }

  previous(): void {
    if (this.adapter) {
      const res = this.adapter.previous();
      this.updateCount(res);
    }
  }

  replace(): void {
    if (this.isReadonly || this.currentMode === "preview") {
      return;
    }
    if (this.adapter && this.replaceInput) {
      this.adapter.replace(this.replaceInput.value);
    }
  }

  replaceAll(): void {
    if (this.isReadonly || this.currentMode === "preview") {
      return;
    }
    if (this.adapter && this.replaceInput) {
      this.adapter.replaceAll(this.replaceInput.value);
    }
  }

  private updateCount(res: SearchResult): void {
    if (!this.countLabel) {
      return;
    }
    if (res.total === 0) {
      this.countLabel.textContent = "No results";
    } else {
      this.countLabel.textContent = `${res.current} of ${res.total}`;
    }
  }
}
