import type { Node as PMNode } from '@tiptap/pm/model';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/react';

export interface TableInfo {
  /** Posición del nodo tabla. */
  pos: number;
  node: PMNode;
  map: TableMap;
  /** Posición (relativa a la tabla) de la celda con el cursor, si hay. */
  cellRel: number | null;
}

/** Tabla que contiene la selección (o null). */
export function currentTable(editor: Editor): TableInfo | null {
  const { $from } = editor.state.selection;
  let cellRel: number | null = null;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if ((node.type.name === 'tableCell' || node.type.name === 'tableHeader') && cellRel === null) {
      cellRel = $from.before(d);
    }
    if (node.type.name === 'table') {
      const pos = $from.before(d);
      return { pos, node, map: TableMap.get(node), cellRel: cellRel === null ? null : cellRel - pos - 1 };
    }
  }
  // CellSelection: la tabla es el ancestro de la celda ancla
  const sel = editor.state.selection;
  if (sel instanceof CellSelection) {
    const $cell = sel.$anchorCell;
    for (let d = $cell.depth; d > 0; d--) {
      if ($cell.node(d).type.name === 'table') {
        const pos = $cell.before(d);
        const node = $cell.node(d);
        return { pos, node, map: TableMap.get(node), cellRel: $cell.pos - pos - 1 };
      }
    }
  }
  return null;
}

/** Tabla en una posición concreta (por ejemplo, la que tiene el mouse encima). */
export function tableAt(editor: Editor, pos: number): TableInfo | null {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'table') return null;
  return { pos, node, map: TableMap.get(node), cellRel: null };
}

export function selectTable(editor: Editor, info: TableInfo) {
  const { map, pos } = info;
  const first = pos + 1 + map.map[0];
  const last = pos + 1 + map.map[map.map.length - 1];
  const sel = CellSelection.create(editor.state.doc, first, last);
  editor.view.dispatch(editor.state.tr.setSelection(sel));
  editor.view.focus();
}

export function selectRowOrColumn(editor: Editor, info: TableInfo, kind: 'row' | 'column') {
  if (info.cellRel === null) return;
  const { map, pos } = info;
  const rect = map.findCell(info.cellRel);
  const first =
    kind === 'row' ? map.map[rect.top * map.width] : map.map[rect.left];
  const last =
    kind === 'row'
      ? map.map[rect.top * map.width + map.width - 1]
      : map.map[(map.height - 1) * map.width + rect.left];
  const $a = editor.state.doc.resolve(pos + 1 + first);
  const $b = editor.state.doc.resolve(pos + 1 + last);
  const sel = kind === 'row' ? CellSelection.rowSelection($a, $b) : CellSelection.colSelection($a, $b);
  editor.view.dispatch(editor.state.tr.setSelection(sel));
  editor.view.focus();
}

/** Elemento <table> en pantalla para una tabla del documento. */
export function tableDom(editor: Editor, pos: number): HTMLTableElement | null {
  const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
  if (!dom) return null;
  return dom.tagName === 'TABLE' ? (dom as HTMLTableElement) : dom.querySelector('table');
}

/** Ancho actual de cada columna en px (sin zoom). */
export function columnWidths(editor: Editor, info: TableInfo): number[] {
  const { map, node } = info;
  const table = tableDom(editor, info.pos);
  const widths: number[] = new Array(map.width).fill(0);
  // 1) anchos guardados en el documento
  const seen = new Set<number>();
  map.map.forEach((cellPos) => {
    if (seen.has(cellPos)) return;
    seen.add(cellPos);
    const cell = node.nodeAt(cellPos)!;
    const rect = map.findCell(cellPos);
    const cw: (number | null)[] | null = cell.attrs.colwidth;
    for (let c = rect.left; c < rect.right; c++) {
      const w = cw?.[c - rect.left];
      if (w && !widths[c]) widths[c] = w;
    }
  });
  if (widths.every((w) => w > 0)) return widths;
  // 2) medir en pantalla las que faltan
  if (table) {
    const scale = table.getBoundingClientRect().width / (table.offsetWidth || 1) || 1;
    const rows = Array.from(table.rows).filter((r) => !r.hasAttribute('data-we-spacer'));
    for (let c = 0; c < map.width; c++) {
      if (widths[c]) continue;
      for (const row of rows) {
        let col = 0;
        for (const td of Array.from(row.cells)) {
          if (col === c && td.colSpan === 1) {
            widths[c] = td.getBoundingClientRect().width / scale;
            break;
          }
          col += td.colSpan;
        }
        if (widths[c]) break;
      }
    }
    const total = table.offsetWidth;
    const missing = widths.filter((w) => !w).length;
    if (missing) {
      const rest = Math.max(40, (total - widths.reduce((a, b) => a + b, 0)) / missing);
      for (let c = 0; c < widths.length; c++) if (!widths[c]) widths[c] = rest;
    }
  }
  return widths.map((w) => w || 80);
}

/** Aplica anchos de columna (px) a todas las celdas de la tabla. `null` = automático. */
export function setColumnWidths(editor: Editor, info: TableInfo, widths: number[] | null) {
  const { map, node, pos } = info;
  const tr = editor.state.tr;
  const seen = new Set<number>();
  map.map.forEach((cellPos) => {
    if (seen.has(cellPos)) return;
    seen.add(cellPos);
    const cell = node.nodeAt(cellPos)!;
    const rect = map.findCell(cellPos);
    const colwidth = widths ? widths.slice(rect.left, rect.right).map((w) => Math.max(24, Math.round(w))) : null;
    tr.setNodeMarkup(pos + 1 + cellPos, undefined, { ...cell.attrs, colwidth });
  });
  editor.view.dispatch(tr);
}

/** Todas las columnas iguales, conservando el ancho total. */
export function distributeColumns(editor: Editor, info: TableInfo) {
  const widths = columnWidths(editor, info);
  const total = widths.reduce((a, b) => a + b, 0);
  setColumnWidths(editor, info, widths.map(() => total / widths.length));
}

/** Escala la tabla para que ocupe `targetPx` de ancho. */
export function scaleTableTo(editor: Editor, info: TableInfo, targetPx: number) {
  const widths = columnWidths(editor, info);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  setColumnWidths(editor, info, widths.map((w) => (w * targetPx) / total));
}
