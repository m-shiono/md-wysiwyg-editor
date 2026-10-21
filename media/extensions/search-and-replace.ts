import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchOptions {
  searchTerm: string;
  replaceTerm: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  results: SearchMatch[];
  currentIndex: number;
}

export const searchPluginKey = new PluginKey<{
  results: SearchMatch[];
  currentIndex: number;
  decorations: DecorationSet;
}>("searchAndReplace");

function buildRegex(
  searchTerm: string,
  matchCase: boolean,
  matchWholeWord: boolean,
  useRegex: boolean,
): RegExp | null {
  if (!searchTerm) {
    return null;
  }
  let pattern = searchTerm;
  if (!useRegex) {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  if (matchWholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  const flags = matchCase ? "gu" : "gui";
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function findMatchesInDoc(
  doc: ProsemirrorNode,
  regex: RegExp | null,
): SearchMatch[] {
  if (!regex) {
    return [];
  }
  const matches: SearchMatch[] = [];
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
        matches.push({ from, to });
      }
    }
  });
  return matches;
}

function createDecorations(
  doc: ProsemirrorNode,
  matches: SearchMatch[],
  currentIndex: number,
): DecorationSet {
  if (matches.length === 0) {
    return DecorationSet.empty;
  }
  const decos = matches.map((m, index) => {
    const isCurrent = index === currentIndex;
    return Decoration.inline(m.from, m.to, {
      class: isCurrent ? "find-highlight-current" : "find-highlight",
    });
  });
  return DecorationSet.create(doc, decos);
}

export const SearchAndReplace = Extension.create<SearchOptions>({
  name: "searchAndReplace",

  addOptions() {
    return {
      searchTerm: "",
      replaceTerm: "",
      matchCase: false,
      matchWholeWord: false,
      useRegex: false,
      results: [],
      currentIndex: -1,
    };
  },

  addStorage() {
    return {
      results: [] as SearchMatch[],
      currentIndex: -1,
    };
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init: () => ({
            results: [],
            currentIndex: -1,
            decorations: DecorationSet.empty,
          }),
          apply: (tr, prevValue, _oldState, newState) => {
            const meta = tr.getMeta(searchPluginKey);
            if (meta) {
              return meta;
            }
            if (tr.docChanged && prevValue.results.length > 0) {
              const regex = buildRegex(
                extension.options.searchTerm,
                extension.options.matchCase,
                extension.options.matchWholeWord,
                extension.options.useRegex,
              );
              const results = findMatchesInDoc(newState.doc, regex);
              let currentIndex = prevValue.currentIndex;
              if (currentIndex >= results.length) {
                currentIndex = results.length - 1;
              }
              extension.storage.results = results;
              extension.storage.currentIndex = currentIndex;
              return {
                results,
                currentIndex,
                decorations: createDecorations(newState.doc, results, currentIndex),
              };
            }
            return prevValue;
          },
        },
        props: {
          decorations: (state) => {
            return searchPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
