/** Gráficos (columnas, barras, líneas, áreas, circular, anillo, dispersión, radial y combinado) en SVG. */
import { ellipsize, esc, fmt, svgDoc, textWidth } from './svg';
import { CHART_COLORS, type ChartAttrs, type ChartType } from './types';

const LABEL = '#595959';
const GRID = '#d9d9d9';
const AXIS = '#bfbfbf';
const FONT = { size: 11, family: 'Arial' };

export const seriesColor = (a: ChartAttrs, i: number) => a.series[i]?.color || CHART_COLORS[i % CHART_COLORS.length];

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  let nice: number;
  if (round) nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

function niceScale(min: number, max: number, ticks = 5) {
  if (!isFinite(min) || !isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) max = min + 1;
  const range = niceNum(max - min, false);
  const step = niceNum(range / (ticks - 1), true);
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

function numLabel(v: number, percent = false): string {
  if (percent) return `${Math.round(v * 100)} %`;
  const r = Math.round(v * 1000) / 1000;
  return Math.abs(r) >= 1000 ? r.toLocaleString('es') : String(r).replace('.', ',');
}

const text = (x: number, y: number, s: string, anchor = 'middle', size = FONT.size, color = LABEL, extra = '') =>
  `<text x="${fmt(x)}" y="${fmt(y)}" font-family="Arial" font-size="${size}" fill="${color}" text-anchor="${anchor}"${extra}>${esc(s)}</text>`;

const isPie = (t: ChartType) => t === 'pie' || t === 'doughnut';

/** Leyenda centrada en una o varias filas. Devuelve el SVG y el alto ocupado. */
function legend(names: { name: string; color: string; line?: boolean }[], width: number, bottom: number): { svg: string; height: number } {
  const items = names.map((n) => ({ ...n, w: 14 + textWidth(n.name, FONT) + 14 }));
  const rows: (typeof items)[] = [[]];
  let rowW = 0;
  for (const it of items) {
    if (rowW + it.w > width - 20 && rows[rows.length - 1].length) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1].push(it);
    rowW += it.w;
  }
  const lh = 18;
  const height = rows.length * lh + 6;
  let svg = '';
  rows.forEach((row, r) => {
    const total = row.reduce((s, it) => s + it.w, 0) - 14;
    let x = (width - total) / 2;
    const y = bottom - height + r * lh + lh / 2 + 3;
    for (const it of row) {
      svg += it.line
        ? `<line x1="${fmt(x)}" y1="${fmt(y)}" x2="${fmt(x + 10)}" y2="${fmt(y)}" stroke="${it.color}" stroke-width="2.5"/>`
        : `<rect x="${fmt(x + 1)}" y="${fmt(y - 4)}" width="8" height="8" fill="${it.color}"/>`;
      svg += text(x + 14, y + 4, it.name, 'start');
      x += it.w;
    }
  });
  return { svg, height };
}

export function renderChartSvg(a: ChartAttrs): string {
  const W = Math.max(120, a.width);
  const H = Math.max(90, a.height);
  const t = a.chartType;
  // Área del gráfico: relleno y borde configurables
  const bw = a.borderColor ? (a.borderWidth ?? 0.75) * (96 / 72) : 0;
  const dash = a.borderDash && a.borderDash !== 'solid' ? ` stroke-dasharray="${a.borderDash === 'dot' ? `${fmt(bw)} ${fmt(bw * 2)}` : a.borderDash === 'dash' ? `${fmt(bw * 4)} ${fmt(bw * 3)}` : `${fmt(bw * 4)} ${fmt(bw * 2)} ${fmt(bw)} ${fmt(bw * 2)}`}"` : '';
  let body = `<rect class="we-chart-area" x="${fmt(bw / 2)}" y="${fmt(bw / 2)}" width="${fmt(W - bw)}" height="${fmt(H - bw)}" fill="${a.bgFill ? esc(a.bgFill) : 'none'}" fill-opacity="${a.bgOpacity ?? 1}"${a.borderColor ? ` stroke="${esc(a.borderColor)}" stroke-width="${fmt(bw)}" stroke-opacity="${a.borderOpacity ?? 1}"${dash}` : ''}/>`;
  let top = 10;
  if (a.title) {
    body += text(W / 2, 26, ellipsize(a.title, W - 20, { size: 15, family: 'Arial' }), 'middle', 15, LABEL);
    top = 40;
  }
  let bottom = H - 8;
  const nSeries = a.series.length;
  const nCat = a.categories.length;

  if (a.showLegend) {
    const names = isPie(t)
      ? a.categories.map((c, i) => ({ name: c, color: CHART_COLORS[i % CHART_COLORS.length] }))
      : a.series.map((s, i) => ({ name: s.name, color: seriesColor(a, i), line: t === 'line' || t === 'lineMarkers' || t === 'radar' || t === 'scatter' || (t === 'combo' && i === nSeries - 1 && nSeries > 1) }));
    const lg = legend(names, W, bottom);
    body += lg.svg;
    bottom -= lg.height;
  }

  const left = 12;
  const right = W - 14;

  // --- Circular y anillo
  if (isPie(t)) {
    const vals = (a.series[0]?.values ?? []).slice(0, nCat).map((v) => Math.max(0, v || 0));
    const sum = vals.reduce((s, v) => s + v, 0) || 1;
    const cx = W / 2;
    const cy = (top + bottom) / 2;
    const r = Math.max(10, Math.min(right - left, bottom - top) / 2 - 4);
    const ri = t === 'doughnut' ? r * 0.5 : 0;
    let ang = -Math.PI / 2;
    vals.forEach((v, i) => {
      const frac = v / sum;
      const a0 = ang;
      const a1 = ang + frac * Math.PI * 2;
      ang = a1;
      const color = CHART_COLORS[i % CHART_COLORS.length];
      if (frac >= 0.9999) {
        body += `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${color}" stroke="#fff"/>`;
        if (ri) body += `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(ri)}" fill="#fff"/>`;
      } else if (frac > 0) {
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (rr: number, an: number) => `${fmt(cx + rr * Math.cos(an))} ${fmt(cy + rr * Math.sin(an))}`;
        const d = ri
          ? `M${p(r, a0)} A${fmt(r)} ${fmt(r)} 0 ${large} 1 ${p(r, a1)} L${p(ri, a1)} A${fmt(ri)} ${fmt(ri)} 0 ${large} 0 ${p(ri, a0)} Z`
          : `M${fmt(cx)} ${fmt(cy)} L${p(r, a0)} A${fmt(r)} ${fmt(r)} 0 ${large} 1 ${p(r, a1)} Z`;
        body += `<path d="${d}" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
      }
      if (a.showValues && frac > 0.03) {
        const mid = (a0 + a1) / 2;
        const lr = ri ? (r + ri) / 2 : r * 0.64;
        body += text(cx + lr * Math.cos(mid), cy + lr * Math.sin(mid) + 4, `${Math.round(frac * 100)} %`, 'middle', 11, '#ffffff', ' font-weight="bold"');
      }
    });
    return svgDoc(W, H, body);
  }

  // --- Radial
  if (t === 'radar') {
    const cx = W / 2;
    const cy = (top + bottom) / 2 + 4;
    const r = Math.max(10, Math.min(right - left - 60, bottom - top - 30) / 2);
    const all = a.series.flatMap((s) => s.values.slice(0, nCat));
    const sc = niceScale(Math.min(0, ...all), Math.max(0, ...all));
    const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / Math.max(1, nCat);
    const pt = (i: number, v: number) => {
      const rr = ((v - sc.lo) / (sc.hi - sc.lo)) * r;
      return [cx + rr * Math.cos(ang(i)), cy + rr * Math.sin(ang(i))];
    };
    for (let v = sc.lo + sc.step; v <= sc.hi + 1e-9; v += sc.step) {
      const pts = a.categories.map((_, i) => pt(i, v).map(fmt).join(',')).join(' ');
      body += `<polygon points="${pts}" fill="none" stroke="${GRID}"/>`;
      body += text(cx + 3, pt(0, v)[1] + 4, numLabel(v), 'start', 9);
    }
    a.categories.forEach((c, i) => {
      const [x, y] = pt(i, sc.hi);
      body += `<line x1="${fmt(cx)}" y1="${fmt(cy)}" x2="${fmt(x)}" y2="${fmt(y)}" stroke="${GRID}"/>`;
      const lx = cx + (r + 12) * Math.cos(ang(i));
      const ly = cy + (r + 12) * Math.sin(ang(i));
      const anchor = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end';
      body += text(lx, ly + 4, ellipsize(c, 90, FONT), anchor);
    });
    a.series.forEach((s, si) => {
      const color = seriesColor(a, si);
      const pts = a.categories.map((_, i) => pt(i, s.values[i] ?? 0));
      body += `<polygon points="${pts.map((p) => p.map(fmt).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linejoin="round"/>`;
      pts.forEach(([x, y]) => (body += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="3" fill="${color}"/>`));
    });
    return svgDoc(W, H, body);
  }

  // --- Dispersión (XY)
  if (t === 'scatter') {
    const xs = a.categories.map((c, i) => {
      const n = parseFloat(c.replace(',', '.'));
      return isFinite(n) ? n : i + 1;
    });
    const ys = a.series.flatMap((s) => s.values.slice(0, nCat));
    const sx = niceScale(Math.min(0, ...xs), Math.max(...xs, 1));
    const sy = niceScale(Math.min(0, ...ys), Math.max(0, ...ys));
    const yLabels = [] as number[];
    for (let v = sy.lo; v <= sy.hi + 1e-9; v += sy.step) yLabels.push(v);
    const pl = left + Math.max(...yLabels.map((v) => textWidth(numLabel(v), FONT))) + 8;
    const pb = bottom - 20;
    const px = (v: number) => pl + ((v - sx.lo) / (sx.hi - sx.lo)) * (right - pl);
    const py = (v: number) => pb - ((v - sy.lo) / (sy.hi - sy.lo)) * (pb - top);
    for (const v of yLabels) {
      if (a.showGrid) body += `<line x1="${fmt(pl)}" y1="${fmt(py(v))}" x2="${fmt(right)}" y2="${fmt(py(v))}" stroke="${GRID}"/>`;
      body += text(pl - 6, py(v) + 4, numLabel(v), 'end');
    }
    for (let v = sx.lo; v <= sx.hi + 1e-9; v += sx.step) {
      if (a.showGrid) body += `<line x1="${fmt(px(v))}" y1="${fmt(top)}" x2="${fmt(px(v))}" y2="${fmt(pb)}" stroke="${GRID}"/>`;
      body += text(px(v), pb + 15, numLabel(v));
    }
    body += `<line x1="${fmt(pl)}" y1="${fmt(pb)}" x2="${fmt(right)}" y2="${fmt(pb)}" stroke="${AXIS}"/>`;
    a.series.forEach((s, si) => {
      const color = seriesColor(a, si);
      xs.forEach((x, i) => {
        const v = s.values[i];
        if (v == null || !isFinite(v)) return;
        body += `<circle cx="${fmt(px(x))}" cy="${fmt(py(v))}" r="4" fill="${color}" stroke="#fff"/>`;
        if (a.showValues) body += text(px(x), py(v) - 7, numLabel(v), 'middle', 10);
      });
    });
    return svgDoc(W, H, body);
  }

  // --- Ejes de categorías: columnas, barras, líneas, áreas, combinado
  const horizontal = t === 'bar' || t === 'barStacked';
  const stacked = t === 'columnStacked' || t === 'barStacked' || t === 'areaStacked' || t === 'columnPercent';
  const percent = t === 'columnPercent';
  const val = (si: number, ci: number) => {
    const v = a.series[si]?.values[ci];
    return v != null && isFinite(v) ? v : 0;
  };
  let min = 0;
  let max = 0;
  if (percent) max = 1;
  else if (stacked) {
    for (let ci = 0; ci < nCat; ci++) {
      let pos = 0;
      let neg = 0;
      for (let si = 0; si < nSeries; si++) {
        const v = val(si, ci);
        if (v >= 0) pos += v;
        else neg += v;
      }
      max = Math.max(max, pos);
      min = Math.min(min, neg);
    }
  } else {
    for (let si = 0; si < nSeries; si++) for (let ci = 0; ci < nCat; ci++) {
      max = Math.max(max, val(si, ci));
      min = Math.min(min, val(si, ci));
    }
  }
  const sc = percent ? { lo: 0, hi: 1, step: 0.2 } : niceScale(min, max);
  const ticks: number[] = [];
  for (let v = sc.lo; v <= sc.hi + sc.step / 1000; v += sc.step) ticks.push(Math.round(v / sc.step) * sc.step);

  const catFont = FONT;
  let pl: number;
  let pb: number;
  if (horizontal) {
    const maxCat = Math.min(W * 0.3, Math.max(0, ...a.categories.map((c) => textWidth(c, catFont))));
    pl = left + maxCat + 8;
    pb = bottom - 20;
  } else {
    pl = left + Math.max(...ticks.map((v) => textWidth(numLabel(v, percent), FONT))) + 8;
    pb = bottom - 20;
  }
  const pt = top;
  const plotW = right - pl;
  const plotH = pb - pt;
  const catLen = horizontal ? plotH : plotW;
  const valLen = horizontal ? plotW : plotH;
  const valPx = (v: number) => ((v - sc.lo) / (sc.hi - sc.lo)) * valLen;
  const zero = valPx(Math.max(sc.lo, Math.min(0, sc.hi)));
  const slot = catLen / Math.max(1, nCat);

  // Cuadrícula y etiquetas de valores
  for (const v of ticks) {
    const p = valPx(v);
    if (horizontal) {
      if (a.showGrid) body += `<line x1="${fmt(pl + p)}" y1="${fmt(pt)}" x2="${fmt(pl + p)}" y2="${fmt(pb)}" stroke="${GRID}"/>`;
      body += text(pl + p, pb + 15, numLabel(v, percent));
    } else {
      if (a.showGrid) body += `<line x1="${fmt(pl)}" y1="${fmt(pb - p)}" x2="${fmt(right)}" y2="${fmt(pb - p)}" stroke="${GRID}"/>`;
      body += text(pl - 6, pb - p + 4, numLabel(v, percent), 'end');
    }
  }
  // Etiquetas de categorías
  a.categories.forEach((c, ci) => {
    const mid = (ci + 0.5) * slot;
    if (horizontal) body += text(pl - 6, pt + catLen - mid + 4, ellipsize(c, pl - left - 8, catFont), 'end');
    else body += text(pl + mid, pb + 15, ellipsize(c, Math.max(20, slot - 4), catFont));
  });

  /** Rectángulo de barra/columna en coordenadas del eje (c = posición en categorías, v0..v1 en px de valor). */
  const bar = (c0: number, cw: number, v0: number, v1: number, color: string) => {
    const lo = Math.min(v0, v1);
    const len = Math.abs(v1 - v0);
    return horizontal
      ? `<rect x="${fmt(pl + lo)}" y="${fmt(pt + catLen - c0 - cw)}" width="${fmt(len)}" height="${fmt(cw)}" fill="${color}"/>`
      : `<rect x="${fmt(pl + c0)}" y="${fmt(pb - lo - len)}" width="${fmt(cw)}" height="${fmt(len)}" fill="${color}"/>`;
  };
  const valueText = (c: number, v: number, label: string) =>
    horizontal ? text(pl + v + 4, pt + catLen - c + 4, label, 'start', 10) : text(pl + c, pb - v - 5, label, 'middle', 10);

  const columnSeries = t === 'combo' ? (nSeries > 1 ? nSeries - 1 : nSeries) : nSeries;
  const isColumnKind = t.startsWith('column') || t.startsWith('bar') || t === 'combo';

  if (isColumnKind) {
    for (let ci = 0; ci < nCat; ci++) {
      const start = ci * slot;
      if (stacked) {
        const cw = slot * 0.55;
        const c0 = start + (slot - cw) / 2;
        const total = percent ? a.series.reduce((s, _, si) => s + Math.abs(val(si, ci)), 0) || 1 : 1;
        let pos = 0;
        let neg = 0;
        for (let si = 0; si < nSeries; si++) {
          const v = val(si, ci) / total;
          const base = v >= 0 ? pos : neg;
          const next = base + v;
          if (v >= 0) pos = next;
          else neg = next;
          body += bar(c0, cw, valPx(base), valPx(next), seriesColor(a, si));
          if (a.showValues && v !== 0) {
            const mid = (valPx(base) + valPx(next)) / 2;
            body += horizontal
              ? text(pl + mid, pt + catLen - c0 - cw / 2 + 4, numLabel(percent ? v : val(si, ci), percent), 'middle', 10, '#fff')
              : text(pl + c0 + cw / 2, pb - mid + 4, numLabel(percent ? v : val(si, ci), percent), 'middle', 10, '#fff');
          }
        }
      } else {
        const groupW = slot * 0.7;
        const cw = groupW / Math.max(1, columnSeries);
        const g0 = start + (slot - groupW) / 2;
        for (let si = 0; si < columnSeries; si++) {
          const v = val(si, ci);
          body += bar(g0 + si * cw, cw * 0.92, zero, valPx(v), seriesColor(a, si));
          if (a.showValues) body += valueText(g0 + si * cw + cw / 2, valPx(v), numLabel(v));
        }
      }
    }
  }

  // Líneas y áreas (y la serie de línea del combinado)
  const lineSeries = t === 'combo' ? (nSeries > 1 ? [nSeries - 1] : []) : t.startsWith('line') || t.startsWith('area') ? a.series.map((_, i) => i) : [];
  const cumulative = new Array(nCat).fill(0);
  for (const si of lineSeries) {
    const color = seriesColor(a, si);
    const pts = a.categories.map((_, ci) => {
      let v = val(si, ci);
      if (t === 'areaStacked') {
        const base = cumulative[ci];
        cumulative[ci] += v;
        v = base + v;
      }
      return [pl + (ci + 0.5) * slot, pb - valPx(v)] as [number, number];
    });
    if (!pts.length) continue;
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`).join(' ');
    if (t.startsWith('area')) {
      let baseline: string;
      if (t === 'areaStacked' && si > 0) {
        const prev = a.categories.map((_, ci) => {
          let s = 0;
          for (let k = 0; k < si; k++) s += val(k, ci);
          return [pl + (ci + 0.5) * slot, pb - valPx(s)] as [number, number];
        });
        baseline = prev.reverse().map(([x, y]) => `L${fmt(x)} ${fmt(y)}`).join(' ');
      } else {
        baseline = `L${fmt(pts[pts.length - 1][0])} ${fmt(pb - zero)} L${fmt(pts[0][0])} ${fmt(pb - zero)}`;
      }
      body += `<path d="${line} ${baseline} Z" fill="${color}" fill-opacity="${t === 'area' ? 0.75 : 1}"/>`;
    } else {
      body += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (t === 'lineMarkers' || t === 'combo') pts.forEach(([x, y]) => (body += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="4.5" fill="${color}" stroke="#fff"/>`));
    }
    if (a.showValues) pts.forEach(([x, y], ci) => (body += text(x, y - 7, numLabel(val(si, ci)), 'middle', 10)));
  }
  // Eje de categorías
  body += horizontal
    ? `<line x1="${fmt(pl + zero)}" y1="${fmt(pt)}" x2="${fmt(pl + zero)}" y2="${fmt(pb)}" stroke="${AXIS}"/>`
    : `<line x1="${fmt(pl)}" y1="${fmt(pb - zero)}" x2="${fmt(right)}" y2="${fmt(pb - zero)}" stroke="${AXIS}"/>`;
  return svgDoc(W, H, body);
}

/** Miniatura de un tipo de gráfico para la galería. */
export function chartIconSvg(type: ChartType, size = 44): string {
  const demo: ChartAttrs = {
    chartType: type,
    width: 160,
    height: 120,
    align: 'center',
    wrap: 'inline',
    title: '',
    categories: type === 'scatter' ? ['1', '2', '3', '4', '5'] : ['A', 'B', 'C', 'D'],
    series: [
      { name: 'a', values: [4, 2.5, 3.5, 4.6, 3] },
      { name: 'b', values: [2.4, 4.4, 1.8, 2.8, 3.6] },
      { name: 'c', values: [2, 2, 3, 5, 1.5] },
    ],
    showLegend: false,
    showValues: false,
    showGrid: false,
    bgFill: null,
    bgOpacity: 1,
    borderColor: null,
    borderWidth: 0,
    borderDash: 'solid',
    borderOpacity: 1,
  };
  const svg = renderChartSvg(demo)
    .replace(/<text[^>]*>[^<]*<\/text>/g, '')
    .replace(/<rect class="we-chart-area"[^>]*\/>/, '');
  return svg.replace(/width="160" height="120"/, `width="${size}" height="${Math.round(size * 0.75)}"`);
}
