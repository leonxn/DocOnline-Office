import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorState, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchRange {
  from: number;
  to: number;
}

export interface SearchState {
  term: string;
  caseSensitive: boolean;
  results: SearchRange[];
  index: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setSearchCaseSensitive: (value: boolean) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const searchKey = new PluginKey<SearchState>('searchReplace');

export const getSearchState = (state: EditorState): SearchState =>
  searchKey.getState(state) ?? { term: '', caseSensitive: false, results: [], index: 0 };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findMatches(doc: PMNode, term: string, caseSensitive: boolean): SearchRange[] {
  if (!term) return [];
  const regex = new RegExp(escapeRegExp(term), caseSensitive ? 'g' : 'gi');
  const results: SearchRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Cada nodo hoja en línea (salto de línea) ocupa 1 posición: lo representamos con 1 carácter
    const text = node.textBetween(0, node.content.size, undefined, '￼');
    for (const match of text.matchAll(regex)) {
      const from = pos + 1 + (match.index ?? 0);
      results.push({ from, to: from + match[0].length });
    }
    return false;
  });
  return results;
}

/** Buscar y reemplazar con resaltado de coincidencias (Ctrl+F / Ctrl+H en la interfaz). */
export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addCommands() {
    const select =
      (direction: 1 | -1) =>
      ({ state, tr, dispatch }: any) => {
        const s = getSearchState(state);
        if (!s.results.length) return false;
        const index = (s.index + direction + s.results.length) % s.results.length;
        if (dispatch) {
          const r = s.results[index];
          tr.setMeta(searchKey, { index });
          tr.setSelection(TextSelection.create(tr.doc, r.from, r.to)).scrollIntoView();
          dispatch(tr);
        }
        return true;
      };

    return {
      setSearchTerm:
        (term) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { term, index: 0 }));
          return true;
        },
      setSearchCaseSensitive:
        (caseSensitive) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { caseSensitive, index: 0 }));
          return true;
        },
      nextSearchResult: () => select(1),
      previousSearchResult: () => select(-1),
      replaceCurrent:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const s = getSearchState(state);
          const r = s.results[s.index];
          if (!r) return false;
          if (dispatch) {
            if (replacement) tr.insertText(replacement, r.from, r.to);
            else tr.delete(r.from, r.to);
            dispatch(tr);
          }
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const s = getSearchState(state);
          if (!s.results.length) return false;
          if (dispatch) {
            // De atrás hacia adelante para no desplazar las posiciones pendientes
            [...s.results].reverse().forEach((r) => {
              if (replacement) tr.insertText(replacement, r.from, r.to);
              else tr.delete(r.from, r.to);
            });
            dispatch(tr);
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { term: '', index: 0 }));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ term: '', caseSensitive: false, results: [], index: 0 }),
          apply(tr, prev) {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            const next = meta ? { ...prev, ...meta } : prev;
            const needsSearch = tr.docChanged || meta?.term !== undefined || meta?.caseSensitive !== undefined;
            if (!needsSearch) return next;
            const results = findMatches(tr.doc, next.term, next.caseSensitive);
            return { ...next, results, index: Math.min(next.index, Math.max(0, results.length - 1)) };
          },
        },
        props: {
          decorations(state) {
            const { results, index } = getSearchState(state);
            if (!results.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              results.map((r, i) =>
                Decoration.inline(r.from, r.to, {
                  class: i === index ? 'we-search-match we-search-current' : 'we-search-match',
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});
