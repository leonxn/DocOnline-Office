'use client';

import type { Editor } from '@tiptap/react';
import { Move } from 'lucide-react';
import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { columnWidths, scaleTableTo, selectTable, tableAt } from './table-utils';

interface Props {
  editor: Editor;
  flowRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  /** Ancho útil de la página en px: la tabla no puede pasar de ahí. */
  maxWidth: number;
}

interface Box {
  pos: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Asas de la tabla, como en Word: ⊞ arriba a la izquierda selecciona la tabla completa y el
 * cuadrito de abajo a la derecha cambia su ancho arrastrando.
 * Aparecen sobre la tabla que tiene el cursor o el mouse.
 */
export function TableHandles({ editor, flowRef, zoom, maxWidth }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const [drag, setDrag] = useState<{ width: number } | null>(null);

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    let hovered: HTMLTableElement | null = null;

    const boxFor = (table: HTMLTableElement): Box | null => {
      const flowRect = flow.getBoundingClientRect();
      const r = table.getBoundingClientRect();
      const scale = zoom || 1;
      // Nodo tabla cuyo DOM es exactamente este <table> (o su envoltorio directo)
      let pos = -1;
      editor.state.doc.descendants((node, p) => {
        if (pos >= 0) return false;
        if (node.type.name === 'table') {
          const dom = editor.view.nodeDOM(p) as HTMLElement | null;
          if (dom && (dom === table || dom.querySelector(':scope > table') === table)) {
            pos = p;
            return false;
          }
        }
        return true;
      });
      if (pos < 0) return null;
      return {
        pos,
        left: (r.left - flowRect.left) / scale,
        top: (r.top - flowRect.top) / scale,
        width: r.width / scale,
        height: r.height / scale,
      };
    };

    const fromSelection = () => {
      const { $from } = editor.state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
          const dom = editor.view.nodeDOM($from.before(d)) as HTMLElement | null;
          return dom?.tagName === 'TABLE' ? (dom as HTMLTableElement) : dom?.querySelector('table') ?? null;
        }
      }
      return null;
    };

    const refresh = () => {
      const table = hovered ?? fromSelection();
      setBox(table && table.isConnected ? boxFor(table) : null);
    };

    const onMove = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest('table');
      const inHandles = (e.target as HTMLElement).closest('.we-tbl-handle');
      if (inHandles) return;
      let next = t && editor.view.dom.contains(t) ? (t as HTMLTableElement) : null;
      // Margen de tolerancia: las asas están fuera de la tabla y hay que poder llegar a ellas
      if (!next && hovered?.isConnected) {
        const r = hovered.getBoundingClientRect();
        const pad = 26;
        if (e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) {
          next = hovered;
        }
      }
      if (next !== hovered) {
        hovered = next;
        refresh();
      }
    };
    const onLeave = () => {
      hovered = null;
      refresh();
    };

    flow.addEventListener('mousemove', onMove);
    flow.addEventListener('mouseleave', onLeave);
    editor.on('selectionUpdate', refresh);
    editor.on('update', refresh);
    const ro = new ResizeObserver(refresh);
    ro.observe(editor.view.dom);
    refresh();
    return () => {
      flow.removeEventListener('mousemove', onMove);
      flow.removeEventListener('mouseleave', onLeave);
      editor.off('selectionUpdate', refresh);
      editor.off('update', refresh);
      ro.disconnect();
    };
  }, [editor, flowRef, zoom]);

  if (!box) return null;

  const onSelect = () => {
    const info = tableAt(editor, box.pos);
    if (info) selectTable(editor, info);
  };

  const onResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const info = tableAt(editor, box.pos);
    if (!info) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = columnWidths(editor, info).reduce((a, b) => a + b, 0);
    const widthFor = (x: number) => Math.max(80, Math.min(maxWidth, startWidth + (x - startX) / (zoom || 1)));
    setDrag({ width: widthFor(e.clientX) });
    const move = (ev: PointerEvent) => setDrag({ width: widthFor(ev.clientX) });
    const up = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setDrag(null);
      const fresh = tableAt(editor, box.pos);
      if (fresh) scaleTableTo(editor, fresh, widthFor(ev.clientX));
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  return (
    <>
      <button
        type="button"
        className="we-tbl-handle we-tbl-move"
        style={{ left: box.left - 18, top: box.top - 18 }}
        title="Seleccionar toda la tabla"
        aria-label="Seleccionar toda la tabla"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={onSelect}
      >
        <Move size={12} />
      </button>
      <span
        className="we-tbl-handle we-tbl-resize"
        style={{ left: box.left + (drag?.width ?? box.width) - 4, top: box.top + box.height - 4 }}
        title="Arrastra para cambiar el ancho de la tabla"
        onPointerDown={onResizeStart}
      />
      {drag && (
        <span
          className="we-tbl-ghost"
          style={{ left: box.left, top: box.top, width: drag.width, height: box.height }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
