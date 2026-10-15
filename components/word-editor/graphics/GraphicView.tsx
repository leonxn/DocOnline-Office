'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GRAPHIC_EDIT_EVENT, graphicBoxStyle, normalizeGraphic, renderGraphicSvg, rotatedBox, type GraphicData, type GraphicEditDetail } from './render';
import { SHAPE_BY_ID } from './shapes';
import { PT_PX } from './svg';
import type { GraphicType, ShapeAttrs } from './types';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

function styleToObject(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const part of css.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = part.slice(i + 1).trim();
  }
  return out as React.CSSProperties;
}

/** Vista de una forma, gráfico o SmartArt dentro del documento: asas, giro, arrastre y texto. */
export function GraphicView({ node, selected, editor, getPos }: NodeViewProps) {
  const gtype = node.attrs.gtype as GraphicType;
  const data = useMemo(() => normalizeGraphic(gtype, node.attrs.data ?? {}), [gtype, node.attrs.data]);
  const [draft, setDraft] = useState<Partial<GraphicData> | null>(null);
  const live = useMemo(() => (draft ? ({ ...data, ...draft } as GraphicData) : data), [data, draft]);
  const [editing, setEditing] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const editable = editor.isEditable;
  // Mientras se escribe, el texto lo muestra el cuadro de edición (no el dibujo)
  const svg = useMemo(
    () => renderGraphicSvg(gtype, (editing != null ? { ...live, text: '' } : live) as unknown as Record<string, unknown>),
    [gtype, live, editing != null], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shape = gtype === 'shape' ? (live as ShapeAttrs) : null;
  const shapeDef = shape ? SHAPE_BY_ID.get(shape.kind) : null;
  const isLine = !!shapeDef?.build(10, 10).line;

  const pos = () => (typeof getPos === 'function' ? getPos() : undefined);

  const commit = useCallback(
    (patch: Record<string, unknown>) => {
      const p = typeof getPos === 'function' ? getPos() : undefined;
      if (p == null) return;
      editor.chain().updateGraphic(patch, p).setNodeSelection(p).run();
    },
    [editor, getPos],
  );

  // Cambió el tamaño o el ajuste: recalcular las hojas
  useLayoutEffect(() => {
    (editor.storage as unknown as { pagination?: { relayout?: () => void } }).pagination?.relayout?.();
  }, [editor, data.width, data.height, data.wrap, data.align]);

  // --- Escribir en la forma
  useEffect(() => {
    if (gtype !== 'shape') return;
    const onEdit = (e: Event) => {
      const d = (e as CustomEvent<GraphicEditDetail>).detail;
      if (d.dom !== editor.view.dom || d.pos !== pos()) return;
      setEditing(((data as ShapeAttrs).text ?? '') + d.key);
    };
    window.addEventListener(GRAPHIC_EDIT_EVENT, onEdit);
    return () => window.removeEventListener(GRAPHIC_EDIT_EVENT, onEdit);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const finishEditing = (value: string | null) => {
    setEditing(null);
    if (value != null && value !== (data as ShapeAttrs).text) commit({ text: value });
    else {
      const p = pos();
      if (p != null) editor.chain().setNodeSelection(p).focus().run();
    }
  };

  const scaleOf = () => {
    const el = wrapRef.current;
    if (!el) return 1;
    return el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
  };

  // --- Cambiar tamaño
  const startResize = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const scale = scaleOf();
    const rot = (((shape?.rotation ?? 0) as number) * Math.PI) / 180;
    const start = { x: e.clientX, y: e.clientY, w: data.width, h: data.height };
    const ratio = start.w / (start.h || 1);
    const min = isLine ? 2 : 12;
    let last: { width: number; height: number } | null = null;
    const move = (ev: PointerEvent) => {
      if (!(ev.buttons & 1)) return up(); // se soltó fuera de la ventana
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;
      const lx = dx * Math.cos(rot) + dy * Math.sin(rot);
      const ly = -dx * Math.sin(rot) + dy * Math.cos(rot);
      let w = start.w + (handle.includes('e') ? lx : handle.includes('w') ? -lx : 0);
      let h = start.h + (handle.includes('s') ? ly : handle.includes('n') ? -ly : 0);
      const corner = handle.length === 2;
      // Mayús (o gráficos y SmartArt en las esquinas) mantiene la proporción
      if (corner && (ev.shiftKey || gtype !== 'shape')) {
        if (Math.abs(w / start.w) > Math.abs(h / start.h)) h = w / ratio;
        else w = h * ratio;
      }
      last = { width: Math.round(Math.max(min, w)), height: Math.round(Math.max(min, h)) };
      setDraft(last);
    };
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDraft(null);
      if (last) commit(last);
      last = null;
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // --- Girar
  const startRotate = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = boxRef.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let last: number | null = null;
    const move = (ev: PointerEvent) => {
      if (!(ev.buttons & 1)) return up();
      let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      deg = ev.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
      deg = ((deg % 360) + 360) % 360;
      last = deg;
      setDraft({ rotation: deg } as Partial<ShapeAttrs>);
    };
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDraft(null);
      if (last != null) commit({ rotation: last });
      last = null;
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!editable || gtype !== 'shape' || isLine) return;
    e.preventDefault();
    setEditing((data as ShapeAttrs).text ?? '');
  };

  const onMouseDown = (e: React.MouseEvent) => {
    // Un clic selecciona el objeto entero (y no deja el cursor dentro de la forma)
    if (!editable || editing != null || e.button !== 0) return;
    const p = pos();
    if (p == null) return;
    const sel = editor.state.selection;
    if (!(sel instanceof NodeSelection && sel.from === p)) {
      e.preventDefault();
      editor.chain().setNodeSelection(p).focus(undefined, { scrollIntoView: false }).run();
    }
  };

  const rotation = shape?.rotation ?? 0;
  const textBox = shapeDef?.build(live.width, live.height).text ?? [0.1, 0.1, 0.8, 0.8];
  const showHandles = selected && editable && editing == null;
  // Espacio reservado: el del objeto ya girado (con el giro guardado, para que no salte al girar)
  const frame = rotatedBox(live.width, live.height, (data as ShapeAttrs).rotation ?? 0);

  return (
    <NodeViewWrapper
      ref={wrapRef}
      className={`we-gfx ${selected ? 'is-selected' : ''}`}
      data-gtype={gtype}
      data-wrap={live.wrap}
      style={styleToObject(graphicBoxStyle(live.wrap, live.align, frame.width))}
    >
      <div className="we-gfx-frame" style={{ width: frame.width, height: frame.height }}>
      <div
        ref={boxRef}
        className="we-gfx-box"
        style={{
          left: (frame.width - live.width) / 2,
          top: (frame.height - live.height) / 2,
          width: live.width,
          height: live.height,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
        }}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        draggable={editable && editing == null}
        data-drag-handle=""
        contentEditable={false}
      >
        <div className="we-gfx-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        {editing != null && shape && (
          <textarea
            className="we-gfx-text-edit"
            autoFocus
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
            onBlur={(e) => finishEditing(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') finishEditing(e.currentTarget.value);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              left: `${textBox[0] * 100}%`,
              top: `${textBox[1] * 100}%`,
              width: `${textBox[2] * 100}%`,
              height: `${textBox[3] * 100}%`,
              fontFamily: shape.fontFamily,
              fontSize: shape.fontSize * PT_PX,
              fontWeight: shape.bold ? 700 : 400,
              fontStyle: shape.italic ? 'italic' : 'normal',
              color: shape.textColor,
              textAlign: shape.textAlign,
            }}
          />
        )}
        {showHandles && (
          <>
            {HANDLES.map((h) => (
              <span key={h} className={`we-gfx-handle we-gfx-handle-${h}`} onPointerDown={startResize(h)} />
            ))}
            {gtype === 'shape' && (
              <span className="we-gfx-rotate" title="Girar (Mayús = de 15 en 15°)" onPointerDown={startRotate} />
            )}
          </>
        )}
      </div>
      </div>
      {draft && 'width' in draft && (
        <span className="we-gfx-size">
          {(live.width * 2.54 / 96).toFixed(2)} × {(live.height * 2.54 / 96).toFixed(2)} cm
        </span>
      )}
    </NodeViewWrapper>
  );
}
