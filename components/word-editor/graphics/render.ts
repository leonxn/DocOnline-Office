import { renderChartSvg } from './charts';
import { renderSmartArtSvg } from './smartart';
import { renderShapeSvg } from './svg';
import {
  DEFAULT_CHART,
  DEFAULT_SHAPE,
  DEFAULT_SMARTART,
  defaultSmartArtItems,
  type ChartAttrs,
  type GraphicType,
  type ShapeAttrs,
  type SmartArtAttrs,
  type SmartArtLayout,
} from './types';

export type GraphicData = ShapeAttrs | ChartAttrs | SmartArtAttrs;

/** Completa los atributos con los valores por defecto (documentos guardados con versiones anteriores). */
export function normalizeGraphic(gtype: GraphicType, data: Record<string, unknown>): GraphicData {
  if (gtype === 'chart') return { ...DEFAULT_CHART, chartType: 'column', ...data } as ChartAttrs;
  if (gtype === 'smartart') {
    const layout = (data.layout as SmartArtLayout) ?? 'list-basic';
    return { ...DEFAULT_SMARTART, layout, items: defaultSmartArtItems(layout), ...data } as SmartArtAttrs;
  }
  return { ...DEFAULT_SHAPE, kind: 'rect', ...data } as ShapeAttrs;
}

export function renderGraphicSvg(gtype: GraphicType, data: Record<string, unknown>): string {
  const d = normalizeGraphic(gtype, data);
  if (gtype === 'chart') return renderChartSvg(d as ChartAttrs);
  if (gtype === 'smartart') return renderSmartArtSvg(d as SmartArtAttrs);
  return renderShapeSvg(d as ShapeAttrs);
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Convierte el SVG en PNG (para el .docx). `scale` = resolución extra. */
export async function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Uint8Array | null> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = svgDataUrl(svg);
  });
  if (!img) return null;
  // Margen para trazos gruesos, flechas y sombra que salen de la caja
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** Evento para empezar a escribir dentro de una forma seleccionada. */
export const GRAPHIC_EDIT_EVENT = 'we-gfx-edit';
export interface GraphicEditDetail {
  pos: number;
  key: string;
  dom: HTMLElement;
}

/** Estilo del contenedor según el ajuste de texto (también lo usa el HTML exportado). */
export function graphicBoxStyle(wrap: string, align: string, width: number): string {
  const base = `width:${Math.round(width)}px;max-width:none;`;
  if (wrap === 'left') return base + 'float:left;margin:4px 16px 8px 0;';
  if (wrap === 'right') return base + 'float:right;margin:4px 0 8px 16px;';
  const margin = align === 'left' ? '0 auto 0 0' : align === 'right' ? '0 0 0 auto' : '0 auto';
  return base + `display:block;margin:${margin};padding:6px 0;`;
}

/** Caja que ocupa un objeto girado (el texto lo rodea a él, como en Word). */
export function rotatedBox(width: number, height: number, deg: number): { width: number; height: number } {
  if (!deg) return { width, height };
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { width: Math.round(width * c + height * s), height: Math.round(width * s + height * c) };
}

/** Evento para abrir el «Editor de gráficos» (hoja de datos) de un gráfico. */
export const CHART_EDIT_EVENT = 'we-chart-edit';
export interface ChartEditDetail {
  pos: number;
  dom: HTMLElement;
}

export function openChartEditor(dom: HTMLElement, pos: number) {
  window.dispatchEvent(new CustomEvent<ChartEditDetail>(CHART_EDIT_EVENT, { detail: { pos, dom } }));
}
