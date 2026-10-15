/**
 * Utilidades SVG comunes y dibujo de formas. Todo se genera como texto SVG autocontenido
 * (sin foreignObject) para que se vea igual en pantalla, al imprimir y al convertirlo en
 * imagen para el .docx.
 */
import { SHAPE_BY_ID } from './shapes';
import type { ShapeAttrs } from './types';

export const PT_PX = 96 / 72;

export const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Mezcla un color con blanco (t>0) o negro (t<0). */
export function shade(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t)));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** ¿El color es oscuro? (para elegir texto blanco o negro encima). */
export function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

// ---------------------------------------------------------------------------
// Texto: medida, ajuste de líneas y bloque de texto
// ---------------------------------------------------------------------------

export interface FontSpec {
  size: number; // px
  family?: string;
  bold?: boolean;
  italic?: boolean;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

export function textWidth(s: string, font: FontSpec): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (measureCtx) {
    measureCtx.font = `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${font.size}px ${font.family ?? 'Arial'}`;
    return measureCtx.measureText(s).width;
  }
  return s.length * font.size * (font.bold ? 0.58 : 0.52);
}

/** Parte el texto en líneas que caben en `maxWidth` (respeta los saltos de línea). */
export function wrapText(text: string, maxWidth: number, font: FontSpec): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, font) <= maxWidth || !line) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
      // Palabra más larga que la caja: se corta por letras
      while (textWidth(line, font) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && textWidth(line.slice(0, cut), font) > maxWidth) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

/** Recorta con «…» para que quepa en una línea. */
export function ellipsize(text: string, maxWidth: number, font: FontSpec): string {
  if (textWidth(text, font) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && textWidth(s + '…', font) > maxWidth) s = s.slice(0, -1);
  return s + '…';
}

export interface TextBlockOptions extends FontSpec {
  color: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  outline?: string | null;
}

/** Bloque de texto con líneas ya calculadas dentro de una caja. */
export function textBlock(lines: string[], x: number, y: number, w: number, h: number, o: TextBlockOptions): string {
  if (!lines.length || (lines.length === 1 && !lines[0])) return '';
  const lh = o.size * (o.lineHeight ?? 1.2);
  const total = lines.length * lh;
  const valign = o.valign ?? 'middle';
  const top = valign === 'top' ? y : valign === 'bottom' ? y + h - total : y + (h - total) / 2;
  const align = o.align ?? 'center';
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const tx = align === 'left' ? x : align === 'right' ? x + w : x + w / 2;
  const attrs = [
    `font-family="${esc(o.family ?? 'Arial')}"`,
    `font-size="${fmt(o.size)}"`,
    `fill="${esc(o.color)}"`,
    `text-anchor="${anchor}"`,
    o.bold ? 'font-weight="bold"' : '',
    o.italic ? 'font-style="italic"' : '',
    o.outline ? `stroke="${esc(o.outline)}" stroke-width="${fmt(Math.max(1, o.size / 14))}" paint-order="stroke" stroke-linejoin="round"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const spans = lines
    .map((line, i) => `<tspan x="${fmt(tx)}" y="${fmt(top + i * lh + (lh - o.size) / 2 + o.size * 0.82)}">${esc(line) || ' '}</tspan>`)
    .join('');
  return `<text ${attrs} xml:space="preserve">${spans}</text>`;
}

/**
 * Ajusta el texto a la caja reduciendo la letra si hace falta (como el «autoajuste» de
 * SmartArt). Devuelve el SVG del texto.
 */
export function fitText(text: string, x: number, y: number, w: number, h: number, o: TextBlockOptions & { minSize?: number }): string {
  let size = o.size;
  const min = o.minSize ?? 7;
  const words = text.split(/\s+/).filter(Boolean);
  // Se reduce la letra hasta que ninguna palabra tenga que partirse y el texto quepa en alto
  const fits = (sz: number, lines: string[]) =>
    lines.length * sz * 1.2 <= h && words.every((wd) => textWidth(wd, { ...o, size: sz }) <= w);
  let lines = wrapText(text, w, { ...o, size });
  while (size > min && !fits(size, lines)) {
    size -= 0.5;
    lines = wrapText(text, w, { ...o, size });
  }
  return textBlock(lines, x, y, w, h, { ...o, size });
}

export function svgDoc(width: number, height: number, body: string, extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" overflow="visible" ${extra}>${body}</svg>`;
}

// ---------------------------------------------------------------------------
// Formas
// ---------------------------------------------------------------------------

function dashArray(dash: ShapeAttrs['strokeDash'], sw: number): string {
  const u = Math.max(sw, 1);
  switch (dash) {
    case 'dash':
      return `${fmt(u * 4)} ${fmt(u * 3)}`;
    case 'dot':
      return `${fmt(u)} ${fmt(u * 2)}`;
    case 'dashDot':
      return `${fmt(u * 4)} ${fmt(u * 2)} ${fmt(u)} ${fmt(u * 2)}`;
    default:
      return '';
  }
}

/** Dibuja una forma con su relleno, trazo, sombra, volteo y texto. La rotación la aplica quien la muestra. */
export function renderShapeSvg(a: ShapeAttrs): string {
  const def = SHAPE_BY_ID.get(a.kind) ?? SHAPE_BY_ID.get('rect')!;
  const w = Math.max(1, a.width);
  const h = Math.max(1, a.height);
  const g = def.build(w, h);
  const sw = a.stroke ? a.strokeWidth * PT_PX : 0;
  const color = (a.stroke ?? '#000000').replace(/[^#\w]/g, '');
  const defs: string[] = [];

  let markers = '';
  if (g.line && (g.arrowStart || g.arrowEnd) && a.stroke) {
    const id = `we-arrow-${color.replace('#', '')}`;
    defs.push(
      `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0 0 L10 5 L0 10 Z" fill="${esc(a.stroke)}" fill-opacity="${a.strokeOpacity}"/></marker>`,
    );
    markers = `${g.arrowStart ? ` marker-start="url(#${id})"` : ''}${g.arrowEnd ? ` marker-end="url(#${id})"` : ''}`;
  }
  let filter = '';
  if (a.shadow) {
    defs.push(`<filter id="we-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="3" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.35"/></filter>`);
    filter = ' filter="url(#we-shadow)"';
  }

  const strokeAttrs = a.stroke
    ? `stroke="${esc(a.stroke)}" stroke-width="${fmt(sw)}" stroke-opacity="${a.strokeOpacity}" stroke-linejoin="round"${a.strokeDash !== 'solid' ? ` stroke-dasharray="${dashArray(a.strokeDash, sw)}"` : ''}${a.strokeDash === 'dot' ? ' stroke-linecap="round"' : ''}`
    : 'stroke="none"';
  const fillAttrs = g.line || !a.fill ? 'fill="none"' : `fill="${esc(a.fill)}" fill-opacity="${a.fillOpacity}"${g.evenOdd ? ' fill-rule="evenodd"' : ''}`;

  const flip = a.flipH || a.flipV ? ` transform="translate(${a.flipH ? w : 0} ${a.flipV ? h : 0}) scale(${a.flipH ? -1 : 1} ${a.flipV ? -1 : 1})"` : '';
  let body = `<g${flip}${filter}>`;
  if (g.d) body += `<path d="${g.d}" ${fillAttrs} ${strokeAttrs}${markers}/>`;
  if (g.detail && a.stroke) body += `<path d="${g.detail}" fill="none" ${strokeAttrs}/>`;
  else if (g.detail) body += `<path d="${g.detail}" fill="none" stroke="${esc(shade(a.fill ?? '#000000', -0.35))}" stroke-width="1"/>`;
  body += '</g>';

  if (a.text) {
    const [tx, ty, tw, th] = g.text ?? [0.1, 0.1, 0.8, 0.8];
    const font = { size: a.fontSize * PT_PX, family: a.fontFamily, bold: a.bold, italic: a.italic };
    const bw = tw * w;
    const lines = wrapText(a.text, Math.max(10, bw), font);
    body += textBlock(lines, tx * w, ty * h, bw, th * h, {
      ...font,
      color: a.textColor,
      align: a.textAlign,
      valign: a.textValign,
      outline: a.textOutline,
    });
  }
  return svgDoc(w, h, (defs.length ? `<defs>${defs.join('')}</defs>` : '') + body);
}

/** Ícono pequeño de una forma para las galerías. */
export function shapeIconSvg(kind: string, size = 20): string {
  const def = SHAPE_BY_ID.get(kind);
  if (!def) return '';
  const g = def.build(size, size);
  const fill = g.line ? 'none' : 'currentColor';
  const extra = g.evenOdd ? ' fill-rule="evenodd"' : '';
  const marker = g.arrowEnd ? `<path d="M${size - 5} ${size} L${size} ${size} L${size} ${size - 5}" fill="none" stroke="currentColor" stroke-width="1.4"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-1.5 -1.5 ${size + 3} ${size + 3}" overflow="visible"><path d="${g.d}" fill="${fill}" fill-opacity="${g.line ? 0 : 0.18}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"${extra}/>${g.detail ? `<path d="${g.detail}" fill="none" stroke="currentColor" stroke-width="1"/>` : ''}${marker}</svg>`;
}
