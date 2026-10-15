import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { normalizeGraphic } from '../graphics/render';
import type { GraphicType } from '../graphics/types';
import { INDENT_STEP_CM } from '../extensions/paragraph-format';
import { getSearchState } from '../extensions/search-replace';

export type BlockStyle = 'normal' | 'nospacing' | 'h1' | 'h2' | 'h3' | 'h4' | 'quote' | 'code';

/** Todo lo que la cinta necesita saber del cursor. `useEditorState` lo recalcula en cada cambio. */
export function selectEditorState({ editor }: { editor: Editor | null }) {
  // Un editor de encabezado recién cerrado puede llegar ya destruido
  if (!editor || editor.isDestroyed) return null;
  const textStyle = editor.getAttributes('textStyle');
  const heading = editor.isActive('heading');
  const block = heading ? editor.getAttributes('heading') : editor.getAttributes('paragraph');

  let blockStyle: BlockStyle = block.spacing === 'none' ? 'nospacing' : 'normal';
  if (heading) blockStyle = `h${block.level}` as BlockStyle;
  else if (editor.isActive('codeBlock')) blockStyle = 'code';
  else if (editor.isActive('blockquote')) blockStyle = 'quote';

  const search = getSearchState(editor.state);

  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    superscript: editor.isActive('superscript'),
    subscript: editor.isActive('subscript'),
    code: editor.isActive('code'),
    fontFamily: (textStyle.fontFamily as string | undefined) ?? null,
    fontSize: (textStyle.fontSize as string | undefined) ?? null,
    color: (textStyle.color as string | undefined) ?? null,
    highlight: (editor.getAttributes('highlight').color as string | undefined) ?? null,
    textAlign: (block.textAlign as string | undefined) ?? 'left',
    lineSpacing: (block.lineSpacing as string | undefined) ?? null,
    shading: (block.shading as string | undefined) ?? null,
    dropCap: (editor.getAttributes('paragraph').dropCap as 'drop' | 'margin' | null | undefined) ?? null,
    graphic: graphicState(editor),
    /** Sangrías del párrafo actual en cm (para la regla). */
    indentLeftCm: ((block.indent as number | undefined) ?? 0) * INDENT_STEP_CM,
    firstLineCm: (block.firstLine as number | undefined) ?? 0,
    indentRightCm: (block.indentRight as number | undefined) ?? 0,
    blockStyle,
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    orderedType: (editor.getAttributes('orderedList').type as string | undefined) ?? '1',
    bulletStyle: (editor.getAttributes('bulletList').listStyle as string | undefined) ?? 'disc',
    link: (editor.getAttributes('link').href as string | undefined) ?? null,
    spaceBefore: (block.spaceBefore as number | null | undefined) ?? null,
    spaceAfter: (block.spaceAfter as number | null | undefined) ?? null,
    inTable: editor.isActive('table'),
    table: tableState(editor),
    image: editor.isActive('image'),
    imageAlign: (editor.getAttributes('image').align as string | undefined) ?? 'center',
    imageAlt: (editor.getAttributes('image').alt as string | undefined) ?? '',
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    canMerge: editor.can().mergeCells(),
    canSplit: editor.can().splitCell(),
    selectionEmpty: editor.state.selection.empty,
    words: (editor.storage.characterCount?.words?.() as number | undefined) ?? 0,
    characters: (editor.storage.characterCount?.characters?.() as number | undefined) ?? 0,
    searchTerm: search.term,
    searchCount: search.results.length,
    searchIndex: search.index,
    editable: editor.isEditable,
  };
}

/** Forma, gráfico o SmartArt seleccionado (para el panel de propiedades). */
function graphicState(editor: Editor) {
  const sel = editor.state.selection;
  if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'graphic') return null;
  const gtype = sel.node.attrs.gtype as GraphicType;
  return { pos: sel.from, gtype, data: normalizeGraphic(gtype, sel.node.attrs.data ?? {}) };
}

/** Atributos de la tabla, fila y celda donde está el cursor (para la pestaña Tabla). */
function tableState(editor: Editor) {
  if (!editor.isActive('table')) return null;
  const t = editor.getAttributes('table');
  const cell = editor.isActive('tableHeader') ? editor.getAttributes('tableHeader') : editor.getAttributes('tableCell');
  const { $from } = editor.state.selection;
  let headerRow = false;
  let headerCol = false;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table') {
      const first = node.firstChild;
      headerRow = !!first && first.childCount > 0 && Array.from({ length: first.childCount }, (_, i) => first.child(i)).every((c) => c.type.name === 'tableHeader');
      headerCol = node.childCount > 1 && Array.from({ length: node.childCount }, (_, i) => node.child(i)).slice(1).every((r) => r.firstChild?.type.name === 'tableHeader');
      break;
    }
  }
  return {
    style: (t.tableStyle as string) ?? 'grid',
    borders: (t.borders as string) ?? 'all',
    align: (t.align as string) ?? 'left',
    banded: !!t.banded,
    borderColor: (t.borderColor as string | null) ?? null,
    cellBg: (cell.backgroundColor as string | null) ?? null,
    cellVAlign: (cell.verticalAlign as string) ?? 'top',
    rowHeight: (editor.getAttributes('tableRow').height as number | null) ?? null,
    headerRow,
    headerCol,
  };
}

export type EditorUiState = NonNullable<ReturnType<typeof selectEditorState>>;
