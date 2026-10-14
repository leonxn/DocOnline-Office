import type { Editor } from '@tiptap/react';
import type { Mark } from '@tiptap/pm/model';

export type CaseMode = 'sentence' | 'lower' | 'upper' | 'title' | 'toggle';

function transform(text: string, mode: CaseMode, prevChar: string): string {
  switch (mode) {
    case 'upper':
      return text.toLocaleUpperCase('es');
    case 'lower':
      return text.toLocaleLowerCase('es');
    case 'toggle':
      return [...text].map((c) => (c === c.toLocaleUpperCase('es') ? c.toLocaleLowerCase('es') : c.toLocaleUpperCase('es'))).join('');
    case 'title':
      return (prevChar + text.toLocaleLowerCase('es'))
        .replace(/(^|[\s(¿¡"'«—-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'))
        .slice(prevChar.length);
    case 'sentence':
      return (prevChar + text.toLocaleLowerCase('es'))
        .replace(/(^|[.!?]\s+|^\s*[¿¡])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'))
        .slice(prevChar.length);
  }
}

/** Cambia mayúsculas/minúsculas de la selección conservando el formato de cada fragmento. */
export function changeCase(editor: Editor, mode: CaseMode) {
  const { state } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return;
  const tr = state.tr;
  // Para "tipo oración"/"título" necesitamos saber qué hay justo antes de la selección
  let prev = from > 1 ? state.doc.textBetween(from - 1, from, '\n', ' ') : '';
  if (mode === 'sentence' && (!prev || /\n/.test(prev))) prev = '';

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    const text = node.text.slice(start - pos, end - pos);
    const next = transform(text, mode, prev);
    prev = text.slice(-1);
    if (next !== text) {
      tr.replaceWith(tr.mapping.map(start), tr.mapping.map(end), state.schema.text(next, node.marks));
    }
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}

/** Copia el formato del texto bajo el cursor (brocha "Copiar formato"). */
export function captureMarks(editor: Editor): readonly Mark[] {
  const { state } = editor;
  return state.storedMarks ?? state.selection.$from.marks();
}

export function applyMarks(editor: Editor, marks: readonly Mark[]) {
  const { state } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return;
  const tr = state.tr;
  // Quitamos el formato existente (salvo enlaces) y aplicamos el copiado
  Object.values(state.schema.marks).forEach((type) => {
    if (type.name !== 'link') tr.removeMark(from, to, type);
  });
  marks.forEach((mark) => {
    if (mark.type.name !== 'link') tr.addMark(from, to, mark);
  });
  editor.view.dispatch(tr);
}

/** Tamaño de fuente efectivo en pt (el de la marca o el predeterminado). */
export function fontSizeToPt(size: string | null, fallback: number): number {
  if (!size) return fallback;
  const n = parseFloat(size);
  return size.endsWith('px') ? Math.round(n * 0.75 * 2) / 2 : n;
}
