'use client';

import { Minus, Plus } from 'lucide-react';
import type { EditorUiState } from './editor-state';

interface Props {
  s: EditorUiState;
  page: number;
  pages: number;
  zoom: number;
  onZoom: (zoom: number) => void;
  status?: string;
  readOnly?: boolean;
}

export function StatusBar({ s, page, pages, zoom, onZoom, status, readOnly }: Props) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="we-status" role="status">
      <span>Página {page} de {pages}</span>
      <span>{s.words.toLocaleString('es-PE')} {s.words === 1 ? 'palabra' : 'palabras'}</span>
      <span>Español (Perú)</span>
      {readOnly && <span className="we-status-badge">Solo lectura</span>}
      {status && <span className="we-status-msg">{status}</span>}
      <span className="we-status-spacer" />
      <div className="we-zoom-control">
        <button type="button" aria-label="Alejar" onClick={() => onZoom(Math.max(0.25, +(zoom - 0.1).toFixed(2)))}>
          <Minus size={14} />
        </button>
        <input
          type="range"
          min={25}
          max={300}
          step={5}
          value={pct}
          aria-label="Zoom"
          onChange={(e) => onZoom(Number(e.target.value) / 100)}
        />
        <button type="button" aria-label="Acercar" onClick={() => onZoom(Math.min(3, +(zoom + 0.1).toFixed(2)))}>
          <Plus size={14} />
        </button>
        <button type="button" className="we-zoom-pct" aria-label="Restablecer zoom al 100 %" onClick={() => onZoom(1)}>
          {pct} %
        </button>
      </div>
    </div>
  );
}
