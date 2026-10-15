'use client';

import type { Editor } from '@tiptap/react';
import { ChevronRight, Shapes } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { chartIconSvg } from '../graphics/charts';
import { GRAPHIC_EDIT_EVENT, type GraphicEditDetail } from '../graphics/render';
import { SHAPES, SHAPE_BY_ID, SHAPE_CATEGORIES, type ShapeCategory } from '../graphics/shapes';
import { smartArtIconSvg } from '../graphics/smartart';
import { shapeIconSvg } from '../graphics/svg';
import {
  CHART_TYPES,
  DEFAULT_CHART,
  DEFAULT_SHAPE,
  DEFAULT_SMARTART,
  SMARTART_LAYOUTS,
  defaultSmartArtItems,
  type ChartType,
  type ShapeAttrs,
  type SmartArtLayout,
} from '../graphics/types';
import { Dropdown } from './controls';

const RECENT_KEY = 'doconline-office:recent-shapes';

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((k) => SHAPE_BY_ID.has(k)).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function pushRecent(kind: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([kind, ...readRecent().filter((k) => k !== kind)].slice(0, 12)));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

const Svg = ({ html, className = '' }: { html: string; className?: string }) => <span className={`we-svg-icon ${className}`} dangerouslySetInnerHTML={{ __html: html }} aria-hidden="true" />;

// ---------------------------------------------------------------------------
// Insertar
// ---------------------------------------------------------------------------

/** Tamaño inicial razonable según el tipo de forma. */
function defaultSize(kind: string): { width: number; height: number } {
  const cat = SHAPE_BY_ID.get(kind)?.category;
  if (kind === 'textBox') return { width: 240, height: 76 };
  if (kind === 'lineHorizontal' || kind === 'lineHorizontalArrow') return { width: 200, height: 20 };
  switch (cat) {
    case 'lines':
      return { width: 180, height: 90 };
    case 'arrows':
      return { width: 170, height: 96 };
    case 'flowchart':
      return { width: 160, height: 96 };
    case 'callouts':
      return { width: 190, height: 120 };
    case 'rects':
      return { width: 180, height: 110 };
    default:
      return { width: 130, height: 130 };
  }
}

/** Pide a la forma recién insertada que abra su texto para escribir. */
function startTyping(editor: Editor) {
  setTimeout(() => {
    const sel = editor.state.selection;
    const detail: GraphicEditDetail = { pos: sel.from, key: '', dom: editor.view.dom as HTMLElement };
    window.dispatchEvent(new CustomEvent(GRAPHIC_EDIT_EVENT, { detail }));
  }, 60);
}

export function insertShape(editor: Editor, kind: string, extra: Partial<ShapeAttrs> = {}) {
  pushRecent(kind);
  const isLine = !!SHAPE_BY_ID.get(kind)?.build(10, 10).line;
  const base: Partial<ShapeAttrs> =
    kind === 'textBox'
      ? { fill: '#ffffff', stroke: '#000000', strokeWidth: 0.75, textColor: '#000000', textAlign: 'left', textValign: 'top' }
      : isLine
        ? { fill: null, stroke: '#4472c4', strokeWidth: 1.5 }
        : {};
  editor.chain().focus().insertGraphic('shape', { ...DEFAULT_SHAPE, kind, ...defaultSize(kind), ...base, ...extra }).run();
  if (kind === 'textBox' && !extra.text) startTyping(editor);
}

export function insertChart(editor: Editor, chartType: ChartType) {
  const data = { ...DEFAULT_CHART, chartType };
  if (chartType === 'pie' || chartType === 'doughnut') {
    data.series = [{ name: 'Ventas', values: [8.2, 3.2, 1.4, 1.2] }];
    data.categories = ['1.er trim.', '2.º trim.', '3.er trim.', '4.º trim.'];
    data.title = 'Ventas';
  }
  if (chartType === 'scatter') {
    data.categories = ['0,7', '1,8', '2,6', '3,4', '4,1'];
    data.series = [{ name: 'Valores Y', values: [2.7, 3.2, 0.8, 2.4, 3.9] }];
  }
  editor.chain().focus().insertGraphic('chart', data as unknown as Record<string, unknown>).run();
}

export function insertSmartArt(editor: Editor, layout: SmartArtLayout) {
  editor.chain().focus().insertGraphic('smartart', { ...DEFAULT_SMARTART, layout, items: defaultSmartArtItems(layout), height: layout === 'list-vertical' || layout.startsWith('cycle') || layout.startsWith('relationship') || layout.startsWith('pyramid') || layout === 'matrix-basic' ? 340 : 300 }).run();
}

// ---------------------------------------------------------------------------
// Galería de formas
// ---------------------------------------------------------------------------

function ShapeGrid({ onPick }: { onPick: (kind: string) => void }) {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);
  const byCat = useMemo(() => {
    const m = new Map<ShapeCategory, typeof SHAPES>();
    for (const s of SHAPES) {
      if (s.id === 'textBox') continue;
      m.set(s.category, [...(m.get(s.category) ?? []), s]);
    }
    return m;
  }, []);
  const icons = useMemo(() => new Map(SHAPES.map((s) => [s.id, shapeIconSvg(s.id, 20)])), []);

  const grid = (ids: string[]) => (
    <div className="we-shape-grid">
      {ids.map((id) => (
        <button key={id} type="button" className="we-shape-item" aria-label={SHAPE_BY_ID.get(id)!.name} data-tip={SHAPE_BY_ID.get(id)!.name} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(id)}>
          <Svg html={icons.get(id)!} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="we-shape-gallery">
      {recent.length > 0 && (
        <section>
          <h5>Usados recientemente</h5>
          {grid(recent)}
        </section>
      )}
      {SHAPE_CATEGORIES.map((c) => (
        <section key={c.id}>
          <h5>{c.label}</h5>
          {grid((byCat.get(c.id) ?? []).map((s) => s.id))}
        </section>
      ))}
    </div>
  );
}

/** Botón «Forma» con la galería por categorías. */
export function ShapeGallery({ onPick, trigger, size = 'sm' }: { onPick: (kind: string) => void; trigger: ReactNode; size?: 'sm' | 'lg' }) {
  return (
    <Dropdown title="Forma" size={size} label={typeof trigger === 'string' ? trigger : undefined} trigger={typeof trigger === 'string' ? <Shapes size={size === 'lg' ? 22 : 16} /> : trigger} panelClassName="we-gallery-popover">
      {(close) => (
        <ShapeGrid
          onPick={(kind) => {
            close();
            onPick(kind);
          }}
        />
      )}
    </Dropdown>
  );
}

// ---------------------------------------------------------------------------
// SmartArt
// ---------------------------------------------------------------------------

const SMARTART_GROUPS = Array.from(new Set(SMARTART_LAYOUTS.map((l) => l.group)));

export function SmartArtPicker({ onPick }: { onPick: (layout: SmartArtLayout) => void }) {
  const [group, setGroup] = useState(SMARTART_GROUPS[0]);
  const icons = useMemo(() => new Map(SMARTART_LAYOUTS.map((l) => [l.id, smartArtIconSvg(l.id, '#4472c4', 64)])), []);
  return (
    <div className="we-smartart-picker">
      <div className="we-smartart-groups" role="menu">
        {SMARTART_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            role="menuitem"
            className={`we-menu-item ${g === group ? 'is-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setGroup(g)}
            onFocus={() => setGroup(g)}
            onClick={() => setGroup(g)}
          >
            <span className="we-menu-text">{g}</span>
            <ChevronRight size={13} />
          </button>
        ))}
      </div>
      <div className="we-smartart-items">
        {SMARTART_LAYOUTS.filter((l) => l.group === group).map((l) => (
          <button key={l.id} type="button" className="we-sa-item" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(l.id)}>
            <Svg html={icons.get(l.id)!} />
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------

export function ChartPicker({ onPick }: { onPick: (type: ChartType) => void }) {
  const icons = useMemo(() => new Map(CHART_TYPES.map((t) => [t.id, chartIconSvg(t.id, 52)])), []);
  const groups = Array.from(new Set(CHART_TYPES.map((t) => t.group)));
  return (
    <div className="we-chart-picker">
      {groups.map((g) => (
        <section key={g}>
          <h5>{g}</h5>
          <div className="we-chart-grid">
            {CHART_TYPES.filter((t) => t.group === g).map((t) => (
              <button key={t.id} type="button" className="we-chart-item" aria-label={t.label} data-tip={t.label} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(t.id)}>
                <Svg html={icons.get(t.id)!} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Galería de texto (WordArt)
// ---------------------------------------------------------------------------

export const TEXT_ART: { name: string; style: Partial<ShapeAttrs> }[] = [
  { name: 'Relleno negro', style: { textColor: '#262626' } },
  { name: 'Relleno azul, sombra', style: { textColor: '#4472c4', shadow: true } },
  { name: 'Relleno naranja', style: { textColor: '#ed7d31' } },
  { name: 'Contorno azul', style: { textColor: '#ffffff', textOutline: '#4472c4' } },
  { name: 'Relleno dorado, contorno', style: { textColor: '#ffc000', textOutline: '#7f6000' } },
  { name: 'Relleno gris, cursiva', style: { textColor: '#7f7f7f', italic: true } },
  { name: 'Relleno verde', style: { textColor: '#70ad47', textOutline: '#375623' } },
  { name: 'Relleno rojo, contorno blanco', style: { textColor: '#c00000', textOutline: '#ffffff', shadow: true } },
  { name: 'Azul oscuro', style: { textColor: '#1f3864', fontFamily: 'Georgia' } },
];

export function TextArtPicker({ onPick }: { onPick: (style: Partial<ShapeAttrs>) => void }) {
  return (
    <div className="we-textart-grid">
      {TEXT_ART.map((t) => (
        <button
          key={t.name}
          type="button"
          className="we-textart-item"
          aria-label={t.name}
          data-tip={t.name}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(t.style)}
          style={{
            color: t.style.textColor,
            fontStyle: t.style.italic ? 'italic' : undefined,
            fontFamily: t.style.fontFamily,
            WebkitTextStroke: t.style.textOutline ? `1px ${t.style.textOutline}` : undefined,
            textShadow: t.style.shadow ? '2px 2px 2px rgba(0,0,0,.35)' : undefined,
          }}
        >
          A
        </button>
      ))}
    </div>
  );
}

export function insertTextArt(editor: Editor, style: Partial<ShapeAttrs>) {
  const text = editor.state.selection.empty ? 'Tu texto aquí' : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ').slice(0, 200);
  insertShape(editor, 'textBox', {
    width: 420,
    height: 90,
    fill: null,
    stroke: null,
    fontSize: 36,
    bold: true,
    textAlign: 'center',
    textValign: 'middle',
    fontFamily: 'Arial',
    text,
    ...style,
  });
}
