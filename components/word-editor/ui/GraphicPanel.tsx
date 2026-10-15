'use client';

import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  FlipHorizontal2,
  FlipVertical2,
  FoldVertical,
  Italic,
  Lock,
  Minus,
  PanelRightClose,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { seriesColor } from '../graphics/charts';
import type { GraphicData } from '../graphics/render';
import { SHAPE_BY_ID } from '../graphics/shapes';
import {
  CHART_TYPES,
  SMARTART_LAYOUTS,
  defaultSmartArtItems,
  type ChartAttrs,
  type ChartType,
  type GraphicType,
  type ShapeAttrs,
  type SmartArtAttrs,
  type SmartArtItem,
  type SmartArtLayout,
} from '../graphics/types';
import { FONT_FAMILIES } from '../types';
import { ShapeGallery } from './insert-graphics';

export interface GraphicSelection {
  pos: number;
  gtype: GraphicType;
  data: GraphicData;
}

interface Props {
  editor: Editor;
  graphic: GraphicSelection;
  onClose: () => void;
}

const CM = 2.54 / 96;
const STROKE_SIZES = [0, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6];
const ACCENTS = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e', '#7030a0', '#c00000'];

/** Estilos rápidos de forma (relleno, borde, texto), como los de Office. */
const QUICK_STYLES: { fill: string | null; stroke: string | null; textColor: string }[] = [
  { fill: '#4472c4', stroke: '#2f528f', textColor: '#ffffff' },
  { fill: '#ed7d31', stroke: '#ae5a21', textColor: '#ffffff' },
  { fill: '#a5a5a5', stroke: '#787878', textColor: '#ffffff' },
  { fill: '#ffc000', stroke: '#bc8c00', textColor: '#262626' },
  { fill: '#5b9bd5', stroke: '#41719c', textColor: '#ffffff' },
  { fill: '#70ad47', stroke: '#507e32', textColor: '#ffffff' },
  { fill: '#ffffff', stroke: '#4472c4', textColor: '#262626' },
  { fill: '#ffffff', stroke: '#ed7d31', textColor: '#262626' },
  { fill: '#dae3f3', stroke: null, textColor: '#1f3864' },
  { fill: '#fbe5d6', stroke: null, textColor: '#843c0c' },
  { fill: null, stroke: '#262626', textColor: '#262626' },
  { fill: '#262626', stroke: null, textColor: '#ffffff' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="we-gp-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="we-gp-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ value, onChange, label }: { value: string | null; onChange: (c: string | null) => void; label: string }) {
  return (
    <div className="we-gp-color">
      <input type="color" aria-label={label} value={value ?? '#ffffff'} onChange={(e) => onChange(e.target.value)} />
      <div className="we-gp-swatches">
        {ACCENTS.slice(0, 8).map((c) => (
          <button key={c} type="button" className="we-swatch" style={{ background: c }} aria-label={c} title={c} onClick={() => onChange(c)} />
        ))}
      </div>
    </div>
  );
}

function Slider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="we-gp-slider">
      <input type="range" min={0} max={100} value={Math.round(value * 100)} aria-label={label} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <span>{Math.round(value * 100)} %</span>
    </div>
  );
}

function IconToggle({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`we-btn we-btn-sm ${active ? 'is-active' : ''}`} aria-label={title} aria-pressed={active} data-tip={title} onClick={onClick}>
      {children}
    </button>
  );
}

/** Tamaño en cm, con candado de proporción. */
function SizeFields({ data, set }: { data: GraphicData; set: (p: Record<string, unknown>) => void }) {
  const [lock, setLock] = useState(true);
  const ratio = data.width / (data.height || 1);
  const cm = (px: number) => Math.round(px * CM * 100) / 100;
  const commit = (dim: 'width' | 'height', raw: string) => {
    const v = parseFloat(raw.replace(',', '.'));
    if (!(v > 0.05 && v < 60)) return;
    const px = Math.round(v / CM);
    if (!lock) return set({ [dim]: px });
    set(dim === 'width' ? { width: px, height: Math.round(px / ratio) } : { height: px, width: Math.round(px * ratio) });
  };
  return (
    <div className="we-gp-row">
      <Field label="Ancho">
        <span className="we-gp-unit">
          <input type="number" step={0.1} defaultValue={cm(data.width)} key={`w${data.width}`} onBlur={(e) => commit('width', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit('width', e.currentTarget.value)} />
          cm
        </span>
      </Field>
      <button type="button" className="we-btn we-btn-sm we-gp-lock" aria-label="Mantener proporción" aria-pressed={lock} data-tip="Mantener proporción" onClick={() => setLock((l) => !l)}>
        {lock ? <Lock size={14} /> : <Unlock size={14} />}
      </button>
      <Field label="Alto">
        <span className="we-gp-unit">
          <input type="number" step={0.1} defaultValue={cm(data.height)} key={`h${data.height}`} onBlur={(e) => commit('height', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit('height', e.currentTarget.value)} />
          cm
        </span>
      </Field>
    </div>
  );
}

function WrapFields({ data, set }: { data: GraphicData; set: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Ajuste del texto">
        <select value={data.wrap} onChange={(e) => set({ wrap: e.target.value })}>
          <option value="inline">En línea con el texto</option>
          <option value="left">Cuadrado (objeto a la izquierda)</option>
          <option value="right">Cuadrado (objeto a la derecha)</option>
        </select>
      </Field>
      {data.wrap === 'inline' && (
        <div className="we-gp-row">
          <span className="we-gp-label">Posición</span>
          <IconToggle title="Izquierda" active={data.align === 'left'} onClick={() => set({ align: 'left' })}>
            <AlignLeft size={15} />
          </IconToggle>
          <IconToggle title="Centro" active={data.align === 'center'} onClick={() => set({ align: 'center' })}>
            <AlignCenter size={15} />
          </IconToggle>
          <IconToggle title="Derecha" active={data.align === 'right'} onClick={() => set({ align: 'right' })}>
            <AlignRight size={15} />
          </IconToggle>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Forma
// ---------------------------------------------------------------------------

function ShapeSettings({ d, set }: { d: ShapeAttrs; set: (p: Record<string, unknown>) => void }) {
  const isLine = !!SHAPE_BY_ID.get(d.kind)?.build(10, 10).line;
  return (
    <>
      {!isLine && (
        <Section title="Estilo rápido">
          <div className="we-gp-quick">
            {QUICK_STYLES.map((q, i) => (
              <button
                key={i}
                type="button"
                className="we-gp-quick-item"
                aria-label={`Estilo ${i + 1}`}
                style={{ background: q.fill ?? 'transparent', borderColor: q.stroke ?? q.fill ?? '#999', color: q.textColor }}
                onClick={() => set({ fill: q.fill, stroke: q.stroke, textColor: q.textColor, fillOpacity: 1, strokeOpacity: 1, strokeWidth: q.stroke ? Math.max(1, d.strokeWidth) : d.strokeWidth })}
              >
                Abc
              </button>
            ))}
          </div>
        </Section>
      )}
      {!isLine && (
        <Section title="Relleno">
          <select value={d.fill ? 'solid' : 'none'} onChange={(e) => set({ fill: e.target.value === 'none' ? null : d.fill ?? '#5b9bd5' })}>
            <option value="solid">Color sólido</option>
            <option value="none">Sin relleno</option>
          </select>
          {d.fill && (
            <>
              <ColorInput label="Color de relleno" value={d.fill} onChange={(c) => set({ fill: c })} />
              <Field label="Opacidad">
                <Slider label="Opacidad del relleno" value={d.fillOpacity} onChange={(v) => set({ fillOpacity: v })} />
              </Field>
            </>
          )}
        </Section>
      )}
      <Section title={isLine ? 'Línea' : 'Trazo'}>
        <div className="we-gp-row">
          <Field label="Tamaño">
            <select value={d.stroke ? String(d.strokeWidth) : '0'} onChange={(e) => {
              const v = Number(e.target.value);
              set(v === 0 ? { stroke: null } : { strokeWidth: v, stroke: d.stroke ?? '#41719c' });
            }}>
              {STROKE_SIZES.map((s) => (
                <option key={s} value={s}>{s === 0 ? (isLine ? '—' : 'Sin línea') : `${String(s).replace('.', ',')} pt`}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo">
            <select value={d.strokeDash} onChange={(e) => set({ strokeDash: e.target.value })}>
              <option value="solid">Continua</option>
              <option value="dash">Guiones</option>
              <option value="dot">Puntos</option>
              <option value="dashDot">Guion y punto</option>
            </select>
          </Field>
        </div>
        {d.stroke && (
          <>
            <ColorInput label="Color del trazo" value={d.stroke} onChange={(c) => set({ stroke: c })} />
            <Field label="Opacidad">
              <Slider label="Opacidad del trazo" value={d.strokeOpacity} onChange={(v) => set({ strokeOpacity: v })} />
            </Field>
          </>
        )}
      </Section>
      {!isLine && (
        <Section title="Texto">
          <textarea className="we-gp-textarea" rows={2} value={d.text} placeholder="Escribe el texto de la forma…" onChange={(e) => set({ text: e.target.value })} />
          <div className="we-gp-row">
            <select aria-label="Fuente" value={d.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <input aria-label="Tamaño del texto" className="we-gp-small" type="number" min={6} max={96} value={d.fontSize} onChange={(e) => Number(e.target.value) >= 6 && set({ fontSize: Number(e.target.value) })} />
            <input type="color" aria-label="Color del texto" value={d.textColor} onChange={(e) => set({ textColor: e.target.value })} />
          </div>
          <div className="we-gp-row">
            <IconToggle title="Negrita" active={d.bold} onClick={() => set({ bold: !d.bold })}><Bold size={15} /></IconToggle>
            <IconToggle title="Cursiva" active={d.italic} onClick={() => set({ italic: !d.italic })}><Italic size={15} /></IconToggle>
            <span className="we-gp-sep" />
            <IconToggle title="Alinear a la izquierda" active={d.textAlign === 'left'} onClick={() => set({ textAlign: 'left' })}><AlignLeft size={15} /></IconToggle>
            <IconToggle title="Centrar" active={d.textAlign === 'center'} onClick={() => set({ textAlign: 'center' })}><AlignCenter size={15} /></IconToggle>
            <IconToggle title="Alinear a la derecha" active={d.textAlign === 'right'} onClick={() => set({ textAlign: 'right' })}><AlignRight size={15} /></IconToggle>
            <span className="we-gp-sep" />
            <IconToggle title="Arriba" active={d.textValign === 'top'} onClick={() => set({ textValign: 'top' })}><ArrowUpToLine size={15} /></IconToggle>
            <IconToggle title="En medio" active={d.textValign === 'middle'} onClick={() => set({ textValign: 'middle' })}><FoldVertical size={15} /></IconToggle>
            <IconToggle title="Abajo" active={d.textValign === 'bottom'} onClick={() => set({ textValign: 'bottom' })}><ArrowDownToLine size={15} /></IconToggle>
          </div>
        </Section>
      )}
      <Section title="Rotación">
        <div className="we-gp-row">
          <Field label="Ángulo">
            <span className="we-gp-unit">
              <input type="number" min={0} max={359} value={d.rotation} onChange={(e) => set({ rotation: ((Number(e.target.value) % 360) + 360) % 360 })} />°
            </span>
          </Field>
          <IconToggle title="Girar 90° a la izquierda" onClick={() => set({ rotation: (d.rotation + 270) % 360 })}><RotateCcw size={15} /></IconToggle>
          <IconToggle title="Girar 90° a la derecha" onClick={() => set({ rotation: (d.rotation + 90) % 360 })}><RotateCw size={15} /></IconToggle>
          <IconToggle title="Voltear horizontalmente" active={d.flipH} onClick={() => set({ flipH: !d.flipH })}><FlipHorizontal2 size={15} /></IconToggle>
          <IconToggle title="Voltear verticalmente" active={d.flipV} onClick={() => set({ flipV: !d.flipV })}><FlipVertical2 size={15} /></IconToggle>
        </div>
      </Section>
      <Section title="Editar forma">
        <ShapeGallery onPick={(kind) => set({ kind })} trigger="Cambiar forma" />
        <label className="we-check">
          <input type="checkbox" checked={d.shadow} onChange={(e) => set({ shadow: e.target.checked })} />
          Mostrar sombra
        </label>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Gráfico
// ---------------------------------------------------------------------------

function ChartSettings({ d, set }: { d: ChartAttrs; set: (p: Record<string, unknown>) => void }) {
  const nCat = d.categories.length;
  const setValue = (si: number, ci: number, raw: string) => {
    const v = parseFloat(raw.replace(',', '.'));
    const series = d.series.map((s, i) => (i === si ? { ...s, values: d.categories.map((_, k) => (k === ci ? (Number.isFinite(v) ? v : 0) : s.values[k] ?? 0)) } : s));
    set({ series });
  };
  return (
    <>
      <Section title="Tipo de gráfico">
        <select value={d.chartType} onChange={(e) => set({ chartType: e.target.value as ChartType })}>
          {Array.from(new Set(CHART_TYPES.map((t) => t.group))).map((g) => (
            <optgroup key={g} label={g}>
              {CHART_TYPES.filter((t) => t.group === g).map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <Field label="Título">
          <input type="text" value={d.title} placeholder="Sin título" onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <label className="we-check"><input type="checkbox" checked={d.showLegend} onChange={(e) => set({ showLegend: e.target.checked })} /> Leyenda</label>
        <label className="we-check"><input type="checkbox" checked={d.showValues} onChange={(e) => set({ showValues: e.target.checked })} /> Etiquetas de datos</label>
        <label className="we-check"><input type="checkbox" checked={d.showGrid} onChange={(e) => set({ showGrid: e.target.checked })} /> Líneas de cuadrícula</label>
      </Section>
      <Section title="Datos">
        <div className="we-gp-grid-wrap">
          <table className="we-gp-grid">
            <thead>
              <tr>
                <th />
                {d.series.map((s, si) => (
                  <th key={si}>
                    <span className="we-gp-series">
                      <input type="color" aria-label={`Color de ${s.name}`} value={seriesColor(d, si)} onChange={(e) => set({ series: d.series.map((x, i) => (i === si ? { ...x, color: e.target.value } : x)) })} />
                      <input type="text" aria-label="Nombre de la serie" value={s.name} onChange={(e) => set({ series: d.series.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)) })} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.categories.map((c, ci) => (
                <tr key={ci}>
                  <th>
                    <input type="text" aria-label="Categoría" value={c} onChange={(e) => set({ categories: d.categories.map((x, i) => (i === ci ? e.target.value : x)) })} />
                  </th>
                  {d.series.map((s, si) => (
                    <td key={si}>
                      <input type="text" inputMode="decimal" aria-label={`${s.name}, ${c}`} defaultValue={String(s.values[ci] ?? 0).replace('.', ',')} key={`${si}-${ci}-${s.values[ci]}`} onBlur={(e) => setValue(si, ci, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setValue(si, ci, e.currentTarget.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="we-gp-row">
          <button type="button" className="we-gp-btn" onClick={() => set({ categories: [...d.categories, `Categoría ${nCat + 1}`], series: d.series.map((s) => ({ ...s, values: [...s.values.slice(0, nCat), 0] })) })}>
            <Plus size={13} /> Categoría
          </button>
          <button type="button" className="we-gp-btn" disabled={nCat <= 1} onClick={() => set({ categories: d.categories.slice(0, -1), series: d.series.map((s) => ({ ...s, values: s.values.slice(0, nCat - 1) })) })}>
            <Minus size={13} /> Categoría
          </button>
          <button type="button" className="we-gp-btn" onClick={() => set({ series: [...d.series, { name: `Serie ${d.series.length + 1}`, values: d.categories.map(() => 1) }] })}>
            <Plus size={13} /> Serie
          </button>
          <button type="button" className="we-gp-btn" disabled={d.series.length <= 1} onClick={() => set({ series: d.series.slice(0, -1) })}>
            <Minus size={13} /> Serie
          </button>
        </div>
        <p className="we-gp-hint">
          {d.chartType === 'pie' || d.chartType === 'doughnut'
            ? 'El gráfico circular usa la primera serie.'
            : d.chartType === 'scatter'
              ? 'En dispersión, las categorías son los valores X.'
              : d.chartType === 'combo'
                ? 'La última serie se dibuja como línea.'
                : 'Edita los valores y pulsa Enter.'}
        </p>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// SmartArt
// ---------------------------------------------------------------------------

const itemsToText = (items: SmartArtItem[]) => items.map((it) => '  '.repeat(it.level) + it.text).join('\n');
const textToItems = (text: string): SmartArtItem[] =>
  text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const m = /^([ \t]*)/.exec(l)![1].replace(/\t/g, '  ');
      return { text: l.trim(), level: Math.min(4, Math.floor(m.length / 2)) };
    });

function SmartArtSettings({ d, set }: { d: SmartArtAttrs; set: (p: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState(() => itemsToText(d.items));
  useEffect(() => {
    if (itemsToText(textToItems(draft)) !== itemsToText(d.items)) setDraft(itemsToText(d.items));
  }, [d.items]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Section title="Diseño">
        <select
          value={d.layout}
          onChange={(e) => {
            const layout = e.target.value as SmartArtLayout;
            let items = d.items;
            if (layout === 'hierarchy-org') {
              // El organigrama necesita niveles: si no hay, se usan los de ejemplo
              if (!items.some((i) => i.level > 0)) items = defaultSmartArtItems(layout);
            } else if (layout !== 'list-vertical' && items.length > 1 && items.filter((i) => i.level === 0).length <= 1) {
              // Venía de un organigrama (un solo elemento principal): cada línea pasa a ser un elemento
              items = items.map((i) => ({ ...i, level: 0 }));
            }
            set({ layout, items });
          }}
        >
          {Array.from(new Set(SMARTART_LAYOUTS.map((l) => l.group))).map((g) => (
            <optgroup key={g} label={g}>
              {SMARTART_LAYOUTS.filter((l) => l.group === g).map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Section>
      <Section title="Texto">
        <textarea
          className="we-gp-textarea"
          rows={7}
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            set({ items: textToItems(e.target.value) });
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Tab') return;
            // Tab / Mayús+Tab cambian el nivel de la línea, como en el panel de texto de SmartArt
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
            const line = ta.value.slice(start);
            const next = e.shiftKey ? ta.value.slice(0, start) + line.replace(/^ {1,2}/, '') : ta.value.slice(0, start) + '  ' + line;
            const caret = ta.selectionStart + (e.shiftKey ? next.length - ta.value.length : 2);
            setDraft(next);
            set({ items: textToItems(next) });
            requestAnimationFrame(() => ta.setSelectionRange(caret, caret));
          }}
        />
        <p className="we-gp-hint">Un elemento por línea. Tab baja un nivel y Mayús+Tab lo sube.</p>
      </Section>
      <Section title="Colores">
        <div className="we-gp-swatches">
          {ACCENTS.map((c) => (
            <button key={c} type="button" className={`we-swatch ${d.color === c ? 'is-active' : ''}`} style={{ background: c }} aria-label={c} title={c} onClick={() => set({ color: c })} />
          ))}
          <input type="color" aria-label="Otro color" value={d.color} onChange={(e) => set({ color: e.target.value })} />
        </div>
        <Field label="Estilo">
          <select value={d.style} onChange={(e) => set({ style: e.target.value })}>
            <option value="fill">Relleno</option>
            <option value="outline">Contorno</option>
          </select>
        </Field>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const TITLES: Record<GraphicType, string> = { shape: 'Ajustes de forma', chart: 'Ajustes del gráfico', smartart: 'Ajustes de SmartArt' };

export function GraphicPanel({ editor, graphic, onClose }: Props) {
  const { pos, gtype, data } = graphic;
  const set = (patch: Record<string, unknown>) => editor.chain().updateGraphic(patch, pos).run();
  const remove = () => editor.chain().focus().setNodeSelection(pos).deleteSelection().run();

  return (
    <aside
      className="we-side we-side-right we-gfx-panel"
      aria-label={TITLES[gtype]}
      // Los botones no quitan el foco al documento: se puede seguir escribiendo en la forma
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
    >
      <div className="we-side-head">
        <strong>{TITLES[gtype]}</strong>
        <div className="we-side-tools">
          <button type="button" className="we-btn we-btn-sm" aria-label="Eliminar" data-tip="Eliminar" onClick={remove}>
            <Trash2 size={15} />
          </button>
          <button type="button" className="we-btn we-btn-sm" aria-label="Cerrar panel" data-tip="Cerrar panel" onClick={onClose}>
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>
      <div className="we-gp-body" key={pos}>
        {gtype === 'shape' && <ShapeSettings d={data as ShapeAttrs} set={set} />}
        {gtype === 'chart' && <ChartSettings d={data as ChartAttrs} set={set} />}
        {gtype === 'smartart' && <SmartArtSettings d={data as SmartArtAttrs} set={set} />}
        <Section title="Tamaño y posición">
          <SizeFields data={data} set={set} />
          <WrapFields data={data} set={set} />
        </Section>
      </div>
    </aside>
  );
}

