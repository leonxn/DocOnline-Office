'use client';

import { X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { buildSheetClones, type PrintGeometry } from '../io/print';

interface Props {
  /** Se llama al abrir para tomar una foto de las hojas actuales. */
  geometry: () => PrintGeometry | null;
  sheetWidth: number;
  sheetHeight: number;
  onPick: (index: number) => void;
  onClose: () => void;
}

/**
 * Vista "Múltiples páginas": todas las hojas en miniatura, una al lado de otra.
 * Es una vista previa (no editable); un clic en una hoja vuelve a ella para editar.
 */
export function MultiPageView({ geometry, sheetWidth, sheetHeight, onPick, onClose }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [count, setCount] = useState(0);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const geo = geometry();
    if (!grid || !geo) return;
    const pages = buildSheetClones(geo);
    grid.replaceChildren(
      ...pages.map((page, i) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'we-mp-cell';
        cell.setAttribute('aria-label', `Ir a la hoja ${i + 1}`);
        cell.style.width = `${sheetWidth * scale}px`;
        cell.style.height = `${sheetHeight * scale}px`;
        const inner = document.createElement('div');
        inner.className = 'we-mp-inner';
        inner.style.width = `${sheetWidth}px`;
        inner.style.height = `${sheetHeight}px`;
        inner.style.transform = `scale(${scale})`;
        inner.appendChild(page);
        const label = document.createElement('span');
        label.className = 'we-mp-label';
        label.textContent = String(i + 1);
        cell.append(inner, label);
        cell.addEventListener('click', () => onPick(i));
        return cell;
      }),
    );
    setCount(pages.length);
  }, [geometry, sheetWidth, sheetHeight, scale, onPick]);

  return (
    <div className="we-mp" role="dialog" aria-label="Múltiples páginas">
      <div className="we-mp-bar">
        <strong>Múltiples páginas</strong>
        <span className="we-mp-count">{count} {count === 1 ? 'hoja' : 'hojas'} · clic en una hoja para editarla</span>
        <span className="we-chat-spacer" />
        <label className="we-mp-size">
          Tamaño
          <input type="range" min={15} max={60} step={5} value={Math.round(scale * 100)} onChange={(e) => setScale(Number(e.target.value) / 100)} />
        </label>
        <button type="button" className="we-icon-btn" aria-label="Cerrar vista de múltiples páginas" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="we-mp-grid" ref={gridRef} />
    </div>
  );
}
