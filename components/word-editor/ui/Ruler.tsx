'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Margins } from '../types';

const SNAP_CM = 0.25;
const MIN_TEXT_CM = 2;

const fmt = (cm: number) => `${cm.toFixed(2).replace('.', ',')} cm`;
const snap = (cm: number, free: boolean) => (free ? Math.round(cm * 100) / 100 : Math.round(cm / SNAP_CM) * SNAP_CM);

export interface Indents {
  left: number;
  firstLine: number;
  right: number;
}

type DragKind = 'marginLeft' | 'marginRight' | 'indentLeft' | 'firstLine' | 'indentRight' | 'marginTop' | 'marginBottom' | `col${number}`;

const LABELS: Record<string, string> = {
  marginLeft: 'Margen izquierdo',
  marginRight: 'Margen derecho',
  indentLeft: 'Sangría izquierda',
  firstLine: 'Sangría de primera línea',
  indentRight: 'Sangría derecha',
  marginTop: 'Margen superior',
  marginBottom: 'Margen inferior',
};

/**
 * Arrastre con puntero sobre una regla. `toCm` convierte la posición del puntero a cm
 * desde el inicio de la regla (ya considera el zoom porque usa el tamaño en pantalla).
 */
function useDrag(onMove: (kind: DragKind, cm: number, free: boolean) => void) {
  const [drag, setDrag] = useState<{ kind: DragKind; cm: number } | null>(null);
  const start = (kind: DragKind, toCm: (e: PointerEvent | ReactPointerEvent) => number) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const cm = toCm(ev);
      setDrag({ kind, cm });
      onMove(kind, cm, ev.altKey);
    };
    const up = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setDrag(null);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    setDrag({ kind, cm: toCm(e) });
  };
  return { drag, start };
}

// ---------------------------------------------------------------------------
// Regla horizontal: márgenes y sangrías del párrafo actual
// ---------------------------------------------------------------------------

interface RulerProps {
  widthCm: number;
  margins: Margins;
  onMargins: (patch: Partial<Margins>) => void;
  indents: Indents | null;
  onIndents: (values: Indents) => void;
  disabled?: boolean;
  /** Bordes de las columnas de la tabla actual, en cm desde el borde de la hoja. */
  tableColumns?: number[] | null;
  /** Arrastre del borde `index` de columna a `cm`. */
  onTableColumn?: (index: number, cm: number) => void;
}

export function Ruler({ widthCm, margins, onMargins, indents, onIndents, disabled, tableColumns, onTableColumn }: RulerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const textWidth = widthCm - margins.left - margins.right;

  const toCm = (e: PointerEvent | ReactPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * widthCm;
  };

  const { drag, start } = useDrag((kind, raw, free) => {
    const cm = snap(raw, free);
    const ind = indents ?? { left: 0, firstLine: 0, right: 0 };
    if (kind.startsWith('col')) {
      onTableColumn?.(Number(kind.slice(3)), cm);
      return;
    }
    switch (kind) {
      case 'marginLeft':
        onMargins({ left: Math.max(0, Math.min(cm, widthCm - margins.right - MIN_TEXT_CM)) });
        break;
      case 'marginRight':
        onMargins({ right: Math.max(0, Math.min(widthCm - cm, widthCm - margins.left - MIN_TEXT_CM)) });
        break;
      case 'indentLeft': {
        // Como en Word: el marcador inferior mueve la sangría izquierda y conserva la primera línea
        const left = Math.max(0, Math.min(cm - margins.left, textWidth - ind.right - 1));
        onIndents({ ...ind, left });
        break;
      }
      case 'firstLine': {
        const abs = Math.max(0, Math.min(cm - margins.left, textWidth - ind.right - 0.5));
        onIndents({ ...ind, firstLine: Math.round((abs - ind.left) * 100) / 100 });
        break;
      }
      case 'indentRight': {
        const right = Math.max(0, Math.min(widthCm - margins.right - cm, textWidth - ind.left - 1));
        onIndents({ ...ind, right });
        break;
      }
    }
  });

  const ticks: { x: number; kind: 'cm' | 'half' | 'quarter'; label?: number }[] = [];
  for (let q = 0; q <= widthCm * 4; q++) {
    const x = q / 4;
    const rel = Math.round((x - margins.left) * 4) / 4;
    const kind = Number.isInteger(rel) ? 'cm' : Number.isInteger(rel * 2) ? 'half' : 'quarter';
    ticks.push({ x, kind, label: kind === 'cm' && rel !== 0 ? Math.abs(rel) : undefined });
  }

  const ind = indents ?? { left: 0, firstLine: 0, right: 0 };
  const xLeft = margins.left + ind.left;
  const xFirst = xLeft + ind.firstLine;
  const xRight = widthCm - margins.right - ind.right;

  const tipFor = (kind: DragKind, cm: number) => {
    if (kind.startsWith('col') && tableColumns) {
      const i = Number(kind.slice(3));
      const prev = tableColumns[i - 1];
      return prev !== undefined ? `Columna ${i}: ${fmt(Math.max(0, snap(cm, false) - prev))}` : fmt(cm);
    }
    switch (kind) {
      case 'marginLeft':
        return `${LABELS[kind]}: ${fmt(margins.left)}`;
      case 'marginRight':
        return `${LABELS[kind]}: ${fmt(margins.right)}`;
      case 'indentLeft':
        return `${LABELS[kind]}: ${fmt(ind.left)}`;
      case 'firstLine':
        return `${LABELS[kind]}: ${fmt(ind.firstLine)}`;
      case 'indentRight':
        return `${LABELS[kind]}: ${fmt(ind.right)}`;
      default:
        return fmt(cm);
    }
  };

  return (
    <div className={`we-ruler ${disabled ? 'is-disabled' : ''}`} style={{ width: `${widthCm}cm` }} ref={ref}>
      <div className="we-ruler-margin" style={{ left: 0, width: `${margins.left}cm` }} />
      <div className="we-ruler-margin" style={{ right: 0, width: `${margins.right}cm` }} />
      {ticks.map((t) => (
        <span key={t.x} className={`we-tick we-tick-${t.kind}`} style={{ left: `${t.x}cm` }} aria-hidden="true">
          {t.label !== undefined && <span className="we-tick-label">{t.label}</span>}
        </span>
      ))}

      {!disabled && (
        <>
          <span
            className="we-ruler-edge"
            style={{ left: `${margins.left}cm` }}
            title={`${LABELS.marginLeft} (arrastra; Alt = sin ajuste)`}
            onPointerDown={start('marginLeft', toCm)}
          />
          <span
            className="we-ruler-edge"
            style={{ left: `${widthCm - margins.right}cm` }}
            title={`${LABELS.marginRight} (arrastra)`}
            onPointerDown={start('marginRight', toCm)}
          />
          {tableColumns?.map((cm, i) =>
            i === 0 ? null : (
              <span
                key={`col-${i}`}
                className="we-ruler-col"
                style={{ left: `${cm}cm` }}
                title={i === tableColumns.length - 1 ? 'Borde derecho de la tabla' : `Borde de la columna ${i}`}
                onPointerDown={start(`col${i}`, toCm)}
              />
            ),
          )}
          {indents && (
            <>
              <span
                className="we-indent we-indent-first"
                style={{ left: `${xFirst}cm` }}
                title={LABELS.firstLine}
                onPointerDown={start('firstLine', toCm)}
              />
              <span
                className="we-indent we-indent-left"
                style={{ left: `${xLeft}cm` }}
                title={LABELS.indentLeft}
                onPointerDown={start('indentLeft', toCm)}
              />
              <span
                className="we-indent we-indent-right"
                style={{ left: `${xRight}cm` }}
                title={LABELS.indentRight}
                onPointerDown={start('indentRight', toCm)}
              />
            </>
          )}
        </>
      )}

      {drag && (
        <>
          <span className="we-ruler-guide" style={{ left: `${snap(drag.cm, false)}cm` }} />
          <span className="we-ruler-tip" style={{ left: `${Math.max(1.5, Math.min(widthCm - 1.5, drag.cm))}cm` }}>
            {tipFor(drag.kind, drag.cm)}
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Regla vertical (al lado de la hoja actual): márgenes superior e inferior
// ---------------------------------------------------------------------------

interface VerticalRulerProps {
  heightCm: number;
  margins: Margins;
  onMargins: (patch: Partial<Margins>) => void;
}

export function VerticalRuler({ heightCm, margins, onMargins }: VerticalRulerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const toCm = (e: PointerEvent | ReactPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return ((e.clientY - rect.top) / rect.height) * heightCm;
  };
  const { drag, start } = useDrag((kind, raw, free) => {
    const cm = snap(raw, free);
    if (kind === 'marginTop') onMargins({ top: Math.max(0, Math.min(cm, heightCm - margins.bottom - MIN_TEXT_CM)) });
    if (kind === 'marginBottom') onMargins({ bottom: Math.max(0, Math.min(heightCm - cm, heightCm - margins.top - MIN_TEXT_CM)) });
  });

  const ticks: { y: number; kind: 'cm' | 'half'; label?: number }[] = [];
  for (let h = 0; h <= heightCm * 2; h++) {
    const y = h / 2;
    const rel = Math.round((y - margins.top) * 2) / 2;
    const kind = Number.isInteger(rel) ? 'cm' : 'half';
    ticks.push({ y, kind, label: kind === 'cm' && rel !== 0 ? Math.abs(rel) : undefined });
  }

  return (
    <div className="we-vruler" style={{ height: `${heightCm}cm` }} ref={ref}>
      <div className="we-ruler-margin" style={{ top: 0, height: `${margins.top}cm`, left: 0, right: 0 }} />
      <div className="we-ruler-margin" style={{ bottom: 0, height: `${margins.bottom}cm`, left: 0, right: 0 }} />
      {ticks.map((t) => (
        <span key={t.y} className={`we-vtick we-vtick-${t.kind}`} style={{ top: `${t.y}cm` }} aria-hidden="true">
          {t.label !== undefined && <span className="we-vtick-label">{t.label}</span>}
        </span>
      ))}
      <span className="we-vruler-edge" style={{ top: `${margins.top}cm` }} title={LABELS.marginTop} onPointerDown={start('marginTop', toCm)} />
      <span
        className="we-vruler-edge"
        style={{ top: `${heightCm - margins.bottom}cm` }}
        title={LABELS.marginBottom}
        onPointerDown={start('marginBottom', toCm)}
      />
      {drag && (
        <span className="we-ruler-tip we-vruler-tip" style={{ top: `${drag.cm}cm` }}>
          {drag.kind === 'marginTop' ? `${LABELS.marginTop}: ${fmt(margins.top)}` : `${LABELS.marginBottom}: ${fmt(margins.bottom)}`}
        </span>
      )}
    </div>
  );
}
