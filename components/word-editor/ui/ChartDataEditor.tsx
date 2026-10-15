'use client';

import type { Editor } from '@tiptap/react';
import {
  ArrowLeftRight,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Redo2,
  TableColumnsSplit,
  TableRowsSplit,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { normalizeGraphic } from '../graphics/render';
import type { ChartAttrs } from '../graphics/types';

/**
 * «Editor de gráficos»: una hoja de cálculo pequeña con los datos del gráfico, como la de
 * OnlyOffice / Excel. Fila 1 = nombres de las series, columna A = categorías.
 * Cada cambio se refleja al momento en el gráfico del documento.
 */

type Grid = string[][];
interface Cell {
  r: number;
  c: number;
}

const MIN_ROWS = 20;
const MIN_COLS = 11;

const colName = (c: number): string => (c < 26 ? String.fromCharCode(65 + c) : colName(Math.floor(c / 26) - 1) + String.fromCharCode(65 + (c % 26)));
const numText = (v: number | undefined) => (v == null || !Number.isFinite(v) ? '' : String(Math.round(v * 1e6) / 1e6).replace('.', ','));
const parseNum = (s: string) => {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return 0;
  // 1.234,5 (es) o 1,234.5 (en) o 12,5 / 12.5
  const norm = /,\d*$/.test(t) && t.includes('.') ? t.replace(/\./g, '').replace(',', '.') : /\.\d*$/.test(t) && t.includes(',') ? t.replace(/,/g, '') : t.replace(',', '.');
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
};
const isNumeric = (s: string) => /^\s*-?[\d.,]+\s*%?\s*$/.test(s) && /\d/.test(s);

function chartToGrid(d: ChartAttrs): Grid {
  return [['', ...d.series.map((s) => s.name)], ...d.categories.map((cat, i) => [cat, ...d.series.map((s) => numText(s.values[i]))])];
}

/** Zona con datos: hasta la última columna/fila que tenga algo escrito. */
function usedRange(g: Grid) {
  let lastCol = 0;
  let lastRow = 0;
  g.forEach((row, r) => row.forEach((v, c) => {
    if (c >= 1 && v.trim()) lastCol = Math.max(lastCol, c);
  }));
  g.forEach((row, r) => {
    if (r >= 1 && row.slice(0, lastCol + 1).some((v) => v.trim())) lastRow = Math.max(lastRow, r);
  });
  return { lastRow, lastCol };
}

const get = (g: Grid, r: number, c: number) => g[r]?.[c] ?? '';

function setCells(g: Grid, updates: { r: number; c: number; v: string }[]): Grid {
  const out = g.map((row) => row.slice());
  for (const { r, c, v } of updates) {
    while (out.length <= r) out.push([]);
    while (out[r].length <= c) out[r].push('');
    out[r][c] = v;
  }
  return out;
}

export function ChartDataEditor({ editor, pos: initialPos, onClose }: { editor: Editor; pos: number; onClose: () => void }) {
  const [pos, setPos] = useState(initialPos);
  const chart = useMemo(() => {
    const node = editor.state.doc.nodeAt(pos);
    return node?.type.name === 'graphic' && node.attrs.gtype === 'chart' ? (normalizeGraphic('chart', node.attrs.data ?? {}) as ChartAttrs) : null;
  }, [editor, pos]);

  const [grid, setGrid] = useState<Grid>(() => (chart ? chartToGrid(chart) : [['']]));
  const [past, setPast] = useState<Grid[]>([]);
  const [future, setFuture] = useState<Grid[]>([]);
  const [sel, setSel] = useState<Cell>({ r: 1, c: 1 });
  const [anchor, setAnchor] = useState<Cell>({ r: 1, c: 1 });
  const [editing, setEditing] = useState<{ value: string; mode: 'enter' | 'edit'; fromBar?: boolean } | null>(null);
  const [box, setBox] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const posRef = useRef(pos);
  /** Columna donde empezó una serie de Tab: Enter vuelve a ella en la fila siguiente (como Excel). */
  const tabStart = useRef<number | null>(null);
  posRef.current = pos;

  // El objeto puede moverse en el documento mientras el editor está abierto
  useEffect(() => {
    const onTr = ({ transaction }: { transaction: { mapping: { map: (p: number) => number }; docChanged: boolean } }) => {
      if (!transaction.docChanged) return;
      const next = transaction.mapping.map(posRef.current);
      const node = editor.state.doc.nodeAt(next);
      if (!node || node.type.name !== 'graphic' || node.attrs.gtype !== 'chart') onClose();
      else if (next !== posRef.current) setPos(next);
    };
    editor.on('transaction', onTr as never);
    return () => {
      editor.off('transaction', onTr as never);
    };
  }, [editor, onClose]);

  useLayoutEffect(() => {
    const w = Math.min(760, window.innerWidth - 16);
    setBox({ x: Math.max(8, (window.innerWidth - w) / 2), y: Math.max(70, window.innerHeight - 400) });
  }, []);

  // Al abrir, el teclado va a la hoja (no al documento, donde escribir reemplazaría el gráfico)
  const ready = box !== null;
  useEffect(() => {
    if (ready) gridRef.current?.focus({ preventScroll: true });
  }, [ready]);

  const used = usedRange(grid);
  const rows = Math.max(MIN_ROWS, grid.length + 8);
  const cols = Math.max(MIN_COLS, (grid[0]?.length ?? 1) + 4, ...grid.map((r) => r.length + 2));

  /** Pasa la hoja al gráfico del documento. */
  const apply = useCallback(
    (g: Grid) => {
      const { lastRow, lastCol } = usedRange(g);
      const node = editor.state.doc.nodeAt(posRef.current);
      if (!node || node.attrs.gtype !== 'chart' || lastCol < 1 || lastRow < 1) return;
      // Colores actuales de las series (pudieron cambiarse en el panel)
      const current = normalizeGraphic('chart', node.attrs.data ?? {}) as ChartAttrs;
      const categories = Array.from({ length: lastRow }, (_, i) => get(g, i + 1, 0));
      const series = Array.from({ length: lastCol }, (_, j) => ({
        name: get(g, 0, j + 1) || `Serie ${j + 1}`,
        // Celda vacía = sin dato (se guarda null y se dibuja como 0, pero la hoja la muestra vacía)
        values: Array.from({ length: lastRow }, (_, i) => (get(g, i + 1, j + 1).trim() ? parseNum(get(g, i + 1, j + 1)) : (null as unknown as number))),
        ...(current.series[j]?.color ? { color: current.series[j].color } : {}),
      }));
      editor.commands.updateGraphic({ categories, series }, posRef.current);
    },
    [editor],
  );

  const commitGrid = (next: Grid) => {
    setPast((p) => [...p.slice(-99), grid]);
    setFuture([]);
    setGrid(next);
    apply(next);
  };

  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [grid, ...f]);
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setGrid(prev);
    apply(prev);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, grid]);
    const [next, ...rest] = future;
    setFuture(rest);
    setGrid(next);
    apply(next);
  };

  const range = {
    r0: Math.min(sel.r, anchor.r),
    r1: Math.max(sel.r, anchor.r),
    c0: Math.min(sel.c, anchor.c),
    c1: Math.max(sel.c, anchor.c),
  };

  const select = (cell: Cell, extend = false, keepTab = false) => {
    if (!keepTab) tabStart.current = null;
    const next = { r: Math.max(0, Math.min(rows - 1, cell.r)), c: Math.max(0, Math.min(cols - 1, cell.c)) };
    setSel(next);
    if (!extend) setAnchor(next);
    // Que la celda quede a la vista
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next.r}-${next.c}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  };

  const commitEdit = (move?: Cell, keepTab = false) => {
    if (editing) {
      if (editing.value !== get(grid, sel.r, sel.c)) commitGrid(setCells(grid, [{ r: sel.r, c: sel.c, v: editing.value }]));
      setEditing(null);
    }
    if (move) select(move, false, keepTab);
    gridRef.current?.focus();
  };

  const clearRange = () => {
    const ups: { r: number; c: number; v: string }[] = [];
    for (let r = range.r0; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) if (get(grid, r, c)) ups.push({ r, c, v: '' });
    if (ups.length) commitGrid(setCells(grid, ups));
  };

  // --- Estructura
  const transpose = () => {
    const { lastRow, lastCol } = used;
    const t: Grid = Array.from({ length: lastCol + 1 }, (_, r) => Array.from({ length: lastRow + 1 }, (_, c) => get(grid, c, r)));
    commitGrid(t);
  };
  const insertRow = () => {
    const at = Math.max(1, sel.r);
    const g = grid.map((r) => r.slice());
    g.splice(at, 0, []);
    commitGrid(g);
  };
  const deleteRow = () => {
    if (sel.r < 1 || sel.r >= grid.length) return;
    commitGrid(grid.filter((_, i) => i !== sel.r));
  };
  const insertCol = () => {
    const at = Math.max(1, sel.c);
    commitGrid(grid.map((r) => {
      const row = r.slice();
      while (row.length < at) row.push('');
      row.splice(at, 0, '');
      return row;
    }));
  };
  const deleteCol = () => {
    if (sel.c < 1) return;
    commitGrid(grid.map((r) => r.filter((_, i) => i !== sel.c)));
  };

  // --- Teclado
  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      select({ r: sel.r + dr, c: sel.c + dc }, e.shiftKey);
    };
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      return redo();
    }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setAnchor({ r: 0, c: 0 });
      setSel({ r: Math.max(used.lastRow, 1), c: Math.max(used.lastCol, 1) });
      return;
    }
    switch (e.key) {
      case 'ArrowUp':
        return move(-1, 0);
      case 'ArrowDown':
        return move(1, 0);
      case 'ArrowLeft':
        return move(0, -1);
      case 'ArrowRight':
        return move(0, 1);
      case 'Enter':
        e.preventDefault();
        return select({ r: sel.r + (e.shiftKey ? -1 : 1), c: tabStart.current ?? sel.c });
      case 'Tab':
        e.preventDefault();
        tabStart.current ??= sel.c;
        return select({ r: sel.r, c: sel.c + (e.shiftKey ? -1 : 1) }, false, true);
      case 'F2':
        e.preventDefault();
        return setEditing({ value: get(grid, sel.r, sel.c), mode: 'edit' });
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        return clearRange();
      case 'Escape':
        e.preventDefault();
        return onClose();
    }
    if (e.key.length === 1 && !mod && !e.altKey) {
      e.preventDefault();
      setAnchor(sel);
      setEditing({ value: e.key, mode: 'enter' });
    }
  };

  const onCellInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit({ r: sel.r + (e.shiftKey ? -1 : 1), c: tabStart.current ?? sel.c });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      tabStart.current ??= sel.c;
      commitEdit({ r: sel.r, c: sel.c + (e.shiftKey ? -1 : 1) }, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
      gridRef.current?.focus();
    } else if (editing?.mode === 'enter' && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key as 'ArrowUp']!;
      commitEdit({ r: sel.r + d[0], c: sel.c + d[1] });
    }
  };

  // --- Portapapeles (se puede pegar un rango copiado de Excel)
  const onCopy = (e: React.ClipboardEvent) => {
    if (editing) return;
    const lines: string[] = [];
    for (let r = range.r0; r <= range.r1; r++) {
      const cells: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) cells.push(get(grid, r, c));
      lines.push(cells.join('\t'));
    }
    e.clipboardData.setData('text/plain', lines.join('\n'));
    e.preventDefault();
  };
  const onCut = (e: React.ClipboardEvent) => {
    if (editing) return;
    onCopy(e);
    clearRange();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
    const ups: { r: number; c: number; v: string }[] = [];
    lines.forEach((line, i) => line.split('\t').forEach((v, j) => ups.push({ r: range.r0 + i, c: range.c0 + j, v: v.trim() })));
    commitGrid(setCells(grid, ups));
    const last = ups[ups.length - 1];
    setAnchor({ r: range.r0, c: range.c0 });
    setSel({ r: Math.max(range.r0, range.r0 + lines.length - 1), c: last ? Math.max(...ups.map((u) => u.c)) : range.c0 });
  };

  // --- Mover la ventana
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || !box) return;
    e.preventDefault();
    const sx = e.clientX - box.x;
    const sy = e.clientY - box.y;
    const move = (ev: PointerEvent) => {
      if (!(ev.buttons & 1)) return up();
      setBox({ x: Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - sx)), y: Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - sy)) });
    };
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const cellClass = (r: number, c: number) => {
    const inUsed = r <= used.lastRow && c <= used.lastCol;
    let cls = 'we-cde-cell';
    if (inUsed && used.lastCol >= 1 && used.lastRow >= 1) {
      if (r === 0 && c >= 1) cls += ' is-series';
      else if (c === 0 && r >= 1) cls += ' is-cat';
      else if (r >= 1 && c >= 1) cls += ' is-value';
      if (r === used.lastRow) cls += ' edge-b';
      if (c === used.lastCol) cls += ' edge-r';
      if (r === 0 && c >= 1) cls += ' edge-t';
      if (c === 0 && r >= 1) cls += ' edge-l';
    }
    if (r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1) cls += ' is-in-range';
    if (r === sel.r && c === sel.c) cls += ' is-active';
    const v = get(grid, r, c);
    if (r >= 1 && c >= 1 && isNumeric(v)) cls += ' is-num';
    return cls;
  };

  if (!chart || !box) return null;
  const address = range.r0 === range.r1 && range.c0 === range.c1 ? `${colName(sel.c)}${sel.r + 1}` : `${colName(range.c0)}${range.r0 + 1}:${colName(range.c1)}${range.r1 + 1}`;

  return (
    <div className="we-cde" role="dialog" aria-label="Editor de gráficos" style={{ left: box.x, top: box.y }}>
      <div className="we-cde-head" onPointerDown={startDrag}>
        <span>Editor de gráficos</span>
        <button type="button" className="we-btn we-btn-sm" aria-label="Cerrar" data-tip="Cerrar" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="we-cde-toolbar" onMouseDown={(e) => e.preventDefault()}>
        <button type="button" className="we-btn we-btn-sm" aria-label="Deshacer" data-tip="Deshacer (Ctrl+Z)" disabled={!past.length} onClick={undo}>
          <Undo2 size={16} />
        </button>
        <button type="button" className="we-btn we-btn-sm" aria-label="Rehacer" data-tip="Rehacer (Ctrl+Y)" disabled={!future.length} onClick={redo}>
          <Redo2 size={16} />
        </button>
        <span className="we-cde-sep" />
        <button type="button" className="we-btn we-btn-sm" aria-label="Insertar fila" data-tip="Insertar fila" onClick={insertRow}>
          <BetweenHorizontalStart size={16} />
        </button>
        <button type="button" className="we-btn we-btn-sm" aria-label="Eliminar fila" data-tip="Eliminar fila" disabled={sel.r < 1} onClick={deleteRow}>
          <TableRowsSplit size={16} />
        </button>
        <button type="button" className="we-btn we-btn-sm" aria-label="Insertar columna" data-tip="Insertar columna (serie)" onClick={insertCol}>
          <BetweenVerticalStart size={16} />
        </button>
        <button type="button" className="we-btn we-btn-sm" aria-label="Eliminar columna" data-tip="Eliminar columna" disabled={sel.c < 1} onClick={deleteCol}>
          <TableColumnsSplit size={16} />
        </button>
        <span className="we-cde-sep" />
        <button type="button" className="we-cde-text-btn" onClick={transpose} data-tip="Las series pasan a ser categorías y viceversa">
          <ArrowLeftRight size={15} /> Cambiar filas/columnas
        </button>
      </div>

      <div className="we-cde-formula">
        <span className="we-cde-name">{address}</span>
        <span className="we-cde-fx">fx</span>
        <input
          aria-label="Contenido de la celda"
          value={editing ? editing.value : get(grid, sel.r, sel.c)}
          onFocus={() => !editing && setEditing({ value: get(grid, sel.r, sel.c), mode: 'edit', fromBar: true })}
          onChange={(e) => setEditing({ value: e.target.value, mode: 'edit', fromBar: true })}
          onKeyDown={onCellInputKey}
          onBlur={() => editing?.fromBar && commitEdit()}
        />
      </div>

      <div
        className="we-cde-grid"
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKey}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onMouseUp={() => (dragging.current = false)}
        onMouseLeave={() => (dragging.current = false)}
      >
        <table>
          <thead>
            <tr>
              <th className="we-cde-corner" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className={c >= range.c0 && c <= range.c1 ? 'is-hl' : ''} onMouseDown={() => { setAnchor({ r: 0, c }); setSel({ r: rows - 1, c }); }}>
                  {colName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th className={r >= range.r0 && r <= range.r1 ? 'is-hl' : ''} onMouseDown={() => { setAnchor({ r, c: 0 }); setSel({ r, c: cols - 1 }); }}>
                  {r + 1}
                </th>
                {Array.from({ length: cols }, (_, c) => {
                  const active = r === sel.r && c === sel.c;
                  return (
                    <td
                      key={c}
                      data-cell={`${r}-${c}`}
                      className={cellClass(r, c)}
                      onMouseDown={(e) => {
                        if (active && editing) return;
                        e.preventDefault();
                        if (editing) commitEdit();
                        dragging.current = true;
                        select({ r, c }, e.shiftKey);
                        gridRef.current?.focus();
                      }}
                      onMouseEnter={() => dragging.current && setSel({ r, c })}
                      onDoubleClick={() => setEditing({ value: get(grid, r, c), mode: 'edit' })}
                    >
                      {active && editing && !editing.fromBar ? (
                        <input
                          className="we-cde-input"
                          autoFocus
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onKeyDown={onCellInputKey}
                          onBlur={() => commitEdit()}
                        />
                      ) : (
                        get(grid, r, c)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="we-cde-foot">
        <span className="we-cde-sheet">Hoja1</span>
        <span className="we-cde-hint">Fila 1: nombres de las series · Columna A: categorías · Puedes pegar datos desde Excel (Ctrl+V)</span>
      </div>
    </div>
  );
}
