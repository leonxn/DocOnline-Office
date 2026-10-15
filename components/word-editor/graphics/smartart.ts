/** SmartArt: listas, procesos, ciclos, jerarquías, relaciones, matrices y pirámides en SVG. */
import { fitText, fmt, isDark, shade, svgDoc } from './svg';
import type { SmartArtAttrs, SmartArtItem, SmartArtLayout } from './types';

interface Group {
  text: string;
  children: string[];
}

/** Agrupa los elementos de nivel 0 con sus sub-elementos. */
function groups(items: SmartArtItem[]): Group[] {
  const out: Group[] = [];
  for (const it of items) {
    if (it.level <= 0 || !out.length) out.push({ text: it.text, children: [] });
    else out[out.length - 1].children.push(it.text);
  }
  return out;
}

const groupText = (g: Group) => (g.children.length ? `${g.text}\n${g.children.map((c) => `• ${c}`).join('\n')}` : g.text);

interface Paint {
  fill: string;
  stroke: string;
  text: string;
}

function paint(a: SmartArtAttrs, i = 0, n = 1): Paint {
  // Variación suave de tono entre elementos, como los estilos de color de Office
  const t = n > 1 ? (i / (n - 1)) * 0.35 - 0.1 : 0;
  const base = shade(a.color, t);
  if (a.style === 'outline') return { fill: '#ffffff', stroke: a.color, text: '#404040' };
  return { fill: base, stroke: '#ffffff', text: isDark(base) ? '#ffffff' : '#262626' };
}

function box(x: number, y: number, w: number, h: number, p: Paint, label: string, size = 16, r = 6, align: 'center' | 'left' = 'center'): string {
  const pad = Math.min(10, w * 0.08);
  return (
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(r)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>` +
    fitText(label, x + pad, y + pad * 0.6, w - pad * 2, h - pad * 1.2, { size, color: p.text, align, valign: align === 'left' ? 'top' : 'middle' })
  );
}

function arrowRight(x: number, y: number, w: number, h: number, color: string): string {
  return `<path d="M${fmt(x)} ${fmt(y + h * 0.3)} H${fmt(x + w * 0.55)} V${fmt(y)} L${fmt(x + w)} ${fmt(y + h / 2)} L${fmt(x + w * 0.55)} ${fmt(y + h)} V${fmt(y + h * 0.7)} H${fmt(x)} Z" fill="${color}"/>`;
}

function arrowDown(x: number, y: number, w: number, h: number, color: string): string {
  return `<path d="M${fmt(x + w * 0.3)} ${fmt(y)} V${fmt(y + h * 0.55)} H${fmt(x)} L${fmt(x + w / 2)} ${fmt(y + h)} L${fmt(x + w)} ${fmt(y + h * 0.55)} H${fmt(x + w * 0.7)} V${fmt(y)} Z" fill="${color}"/>`;
}

const LAYOUTS: Record<SmartArtLayout, (a: SmartArtAttrs, W: number, H: number, gs: Group[]) => string> = {
  'list-basic': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const cols = Math.max(1, Math.round(Math.sqrt((n * W) / H / 1.5)));
    const rows = Math.ceil(n / cols);
    const gap = 12;
    const bw = (W - gap * (cols + 1)) / cols;
    const bh = Math.min((H - gap * (rows + 1)) / rows, bw * 0.75);
    const oy = (H - (rows * bh + (rows - 1) * gap)) / 2;
    return gs
      .map((g, i) => {
        const r = Math.floor(i / cols);
        const inRow = Math.min(cols, n - r * cols);
        const ox = (W - (inRow * bw + (inRow - 1) * gap)) / 2;
        return box(ox + (i % cols) * (bw + gap), oy + r * (bh + gap), bw, bh, paint(a, i, n), groupText(g), 18, 4);
      })
      .join('');
  },
  'list-vertical': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const gap = 8;
    const rh = (H - gap * (n - 1)) / n;
    const hw = W * 0.34;
    return gs
      .map((g, i) => {
        const y = i * (rh + gap);
        const p = paint(a, i, n);
        const light: Paint = { fill: shade(a.color, 0.82), stroke: shade(a.color, 0.6), text: '#262626' };
        return (
          box(0, y, hw, rh, p, g.text, 18, 4) +
          box(hw - 4, y + rh * 0.08, W - hw + 4, rh * 0.84, light, g.children.map((c) => `• ${c}`).join('\n'), 14, 0, 'left')
        );
      })
      .join('');
  },
  'process-basic': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const aw = Math.min(30, W / n / 4);
    const bw = (W - (n - 1) * (aw + 12)) / n;
    const bh = Math.min(H, bw * 0.75);
    const y = (H - bh) / 2;
    return gs
      .map((g, i) => {
        const x = i * (bw + aw + 12);
        const arrow = i < n - 1 ? arrowRight(x + bw + 6, H / 2 - aw * 0.6, aw, aw * 1.2, shade(a.color, 0.45)) : '';
        return box(x, y, bw, bh, paint(a, i, n), groupText(g), 18, 6) + arrow;
      })
      .join('');
  },
  'process-chevron': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const notch = Math.min(H * 0.25, W / n / 3);
    const cw = (W + notch * (n - 1)) / n;
    const ch = Math.min(H, cw * 0.55);
    const y = (H - ch) / 2;
    return gs
      .map((g, i) => {
        const x = i * (cw - notch);
        const p = paint(a, i, n);
        const d = i === 0
          ? `M${fmt(x)} ${fmt(y)} H${fmt(x + cw - notch)} L${fmt(x + cw)} ${fmt(y + ch / 2)} L${fmt(x + cw - notch)} ${fmt(y + ch)} H${fmt(x)} Z`
          : `M${fmt(x)} ${fmt(y)} H${fmt(x + cw - notch)} L${fmt(x + cw)} ${fmt(y + ch / 2)} L${fmt(x + cw - notch)} ${fmt(y + ch)} H${fmt(x)} L${fmt(x + notch)} ${fmt(y + ch / 2)} Z`;
        return (
          `<path d="${d}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>` +
          fitText(groupText(g), x + notch + 4, y + 6, cw - notch * 2 - 8, ch - 12, { size: 16, color: p.text })
        );
      })
      .join('');
  },
  'process-vertical': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const ah = Math.min(26, H / n / 3);
    const bh = (H - (n - 1) * (ah + 8)) / n;
    const bw = Math.min(W, Math.max(W * 0.5, bh * 4));
    const x = (W - bw) / 2;
    return gs
      .map((g, i) => {
        const y = i * (bh + ah + 8);
        const arrow = i < n - 1 ? arrowDown(W / 2 - ah * 0.6, y + bh + 4, ah * 1.2, ah, shade(a.color, 0.45)) : '';
        return box(x, y, bw, bh, paint(a, i, n), groupText(g), 16, 6) + arrow;
      })
      .join('');
  },
  'cycle-basic': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - Math.min(W, H) * 0.16;
    const nr = Math.min(Math.min(W, H) * 0.16, ((Math.PI * r) / n) * 0.8);
    let out = '';
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const next = ang + (Math.PI * 2) / n;
      // Flecha curva entre nodos
      const gapA = (nr / r) * 1.35;
      const a0 = ang + gapA;
      const a1 = next - gapA;
      if (n > 1 && a1 > a0) {
        const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
        const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        const color = shade(a.color, 0.45);
        out += `<path d="M${fmt(p0[0])} ${fmt(p0[1])} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(p1[0])} ${fmt(p1[1])}" fill="none" stroke="${color}" stroke-width="${fmt(Math.max(3, nr * 0.14))}"/>`;
        const tx = -Math.sin(a1);
        const ty = Math.cos(a1);
        const s = Math.max(7, nr * 0.32);
        out += `<path d="M${fmt(p1[0] + tx * s)} ${fmt(p1[1] + ty * s)} L${fmt(p1[0] - ty * s * 0.6)} ${fmt(p1[1] + tx * s * 0.6)} L${fmt(p1[0] + ty * s * 0.6)} ${fmt(p1[1] - tx * s * 0.6)} Z" fill="${color}"/>`;
      }
    }
    gs.forEach((g, i) => {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      const p = paint(a, i, n);
      out += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(nr)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>`;
      out += fitText(groupText(g), x - nr * 0.72, y - nr * 0.72, nr * 1.44, nr * 1.44, { size: 15, color: p.text });
    });
    return out;
  },
  'cycle-donut': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const cx = W / 2;
    const cy = H / 2;
    const ro = Math.min(W, H) / 2 - 4;
    const ri = ro * 0.42;
    let out = '';
    gs.forEach((g, i) => {
      const a0 = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const a1 = a0 + (Math.PI * 2) / n;
      const p = paint(a, i, n);
      const pt = (rr: number, an: number) => `${fmt(cx + rr * Math.cos(an))} ${fmt(cy + rr * Math.sin(an))}`;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      out +=
        n === 1
          ? `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt((ro + ri) / 2)}" fill="none" stroke="${p.fill}" stroke-width="${fmt(ro - ri)}"/>`
          : `<path d="M${pt(ro, a0)} A${fmt(ro)} ${fmt(ro)} 0 ${large} 1 ${pt(ro, a1)} L${pt(ri, a1)} A${fmt(ri)} ${fmt(ri)} 0 ${large} 0 ${pt(ri, a0)} Z" fill="${p.fill}" stroke="#ffffff" stroke-width="3"/>`;
      const mid = (a0 + a1) / 2;
      const mr = (ro + ri) / 2;
      const bw = Math.min(ro - ri, (2 * Math.PI * mr) / n) * 0.9;
      out += fitText(groupText(g), cx + mr * Math.cos(mid) - bw / 2, cy + mr * Math.sin(mid) - bw / 3, bw, (bw * 2) / 3, { size: 14, color: a.style === 'outline' ? '#404040' : p.text });
    });
    return out;
  },
  'hierarchy-org': (a, W, H, _gs) => {
    interface Node {
      text: string;
      level: number;
      children: Node[];
      leaves: number;
      x: number;
      depth: number;
    }
    const roots: Node[] = [];
    const stack: Node[] = [];
    for (const it of a.items) {
      const node: Node = { text: it.text, level: it.level, children: [], leaves: 0, x: 0, depth: 0 };
      while (stack.length && stack[stack.length - 1].level >= it.level) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      stack.push(node);
    }
    let maxDepth = 0;
    const count = (n: Node, d: number): number => {
      n.depth = d;
      maxDepth = Math.max(maxDepth, d);
      n.leaves = n.children.length ? n.children.reduce((s, c) => s + count(c, d + 1), 0) : 1;
      return n.leaves;
    };
    const totalLeaves = roots.reduce((s, r) => s + count(r, 0), 0) || 1;
    const unit = W / totalLeaves;
    const place = (n: Node, start: number) => {
      n.x = (start + n.leaves / 2) * unit;
      let s = start;
      for (const c of n.children) {
        place(c, s);
        s += c.leaves;
      }
    };
    let s0 = 0;
    for (const r of roots) {
      place(r, s0);
      s0 += r.leaves;
    }
    const levels = maxDepth + 1;
    const rowH = H / levels;
    const bh = Math.min(rowH * 0.62, 70);
    const bw = Math.min(unit * 0.86, bh * 2.4);
    const lineColor = shade(a.color, 0.35);
    let lines = '';
    let boxes = '';
    const draw = (n: Node) => {
      const y = n.depth * rowH + (rowH - bh) / 2;
      boxes += box(n.x - bw / 2, y, bw, bh, paint(a, n.depth, levels), n.text, 16, 4);
      if (n.children.length) {
        const midY = y + bh + (rowH - bh) / 2;
        lines += `<path d="M${fmt(n.x)} ${fmt(y + bh)} V${fmt(midY)}" stroke="${lineColor}" stroke-width="1.5" fill="none"/>`;
        const xs = n.children.map((c) => c.x);
        if (xs.length > 1) lines += `<path d="M${fmt(Math.min(...xs))} ${fmt(midY)} H${fmt(Math.max(...xs))}" stroke="${lineColor}" stroke-width="1.5"/>`;
        for (const c of n.children) {
          lines += `<path d="M${fmt(c.x)} ${fmt(midY)} V${fmt((c.depth * rowH) + (rowH - bh) / 2)}" stroke="${lineColor}" stroke-width="1.5"/>`;
          draw(c);
        }
      }
    };
    roots.forEach(draw);
    return lines + boxes;
  },
  'relationship-venn': (a, W, H, gs) => {
    const n = Math.max(1, gs.length);
    const cx = W / 2;
    const cy = H / 2;
    const size = Math.min(W, H);
    const rr = n === 1 ? size * 0.45 : size * (n === 2 ? 0.3 : 0.27);
    const off = n === 1 ? 0 : n === 2 ? rr * 0.75 : rr * 0.72;
    let out = '';
    let labels = '';
    gs.forEach((g, i) => {
      const ang = n === 2 ? (i ? 0 : Math.PI) : -Math.PI / 2 + (i * Math.PI * 2) / n;
      const x = cx + off * Math.cos(ang);
      const y = cy + off * Math.sin(ang);
      const p = paint(a, i, n);
      out += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(rr)}" fill="${p.fill}" fill-opacity="${a.style === 'outline' ? 0 : 0.55}" stroke="${a.style === 'outline' ? a.color : p.fill}" stroke-width="1.5"/>`;
      const lx = x + rr * 0.35 * Math.cos(ang);
      const ly = y + rr * 0.35 * Math.sin(ang);
      labels += fitText(groupText(g), lx - rr * 0.55, ly - rr * 0.4, rr * 1.1, rr * 0.8, { size: 15, color: a.style === 'outline' ? '#404040' : '#1f1f1f' });
    });
    return out + labels;
  },
  'relationship-radial': (a, W, H, gs) => {
    const [center, ...rest] = gs.length ? gs : [{ text: '', children: [] }];
    const n = Math.max(1, rest.length);
    const cx = W / 2;
    const cy = H / 2;
    const size = Math.min(W, H);
    const cr = size * 0.2;
    const nr = Math.min(size * 0.14, ((Math.PI * size * 0.36) / n) * 0.8);
    const dist = size / 2 - nr - 2;
    let out = '';
    let nodes = '';
    rest.forEach((g, i) => {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const x = cx + dist * Math.cos(ang);
      const y = cy + dist * Math.sin(ang);
      out += `<line x1="${fmt(cx)}" y1="${fmt(cy)}" x2="${fmt(x)}" y2="${fmt(y)}" stroke="${shade(a.color, 0.4)}" stroke-width="2"/>`;
      const p = paint(a, i + 1, n + 1);
      nodes += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(nr)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>`;
      nodes += fitText(groupText(g), x - nr * 0.72, y - nr * 0.72, nr * 1.44, nr * 1.44, { size: 14, color: p.text });
    });
    const p0 = paint(a, 0, 2);
    nodes += `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(cr)}" fill="${p0.fill}" stroke="${p0.stroke}" stroke-width="1.5"/>`;
    nodes += fitText(groupText(center), cx - cr * 0.72, cy - cr * 0.72, cr * 1.44, cr * 1.44, { size: 18, color: p0.text });
    return out + nodes;
  },
  'matrix-basic': (a, W, H, gs) => {
    const items = gs.slice(0, 4);
    while (items.length < 4) items.push({ text: '', children: [] });
    const size = Math.min(W, H);
    const gap = 8;
    const q = (size - gap) / 2;
    const ox = (W - size) / 2;
    const oy = (H - size) / 2;
    return items
      .map((g, i) => box(ox + (i % 2) * (q + gap), oy + Math.floor(i / 2) * (q + gap), q, q, paint(a, i, 4), groupText(g), 18, 8))
      .join('');
  },
  'pyramid-basic': (a, W, H, gs) => pyramid(a, W, H, gs, false),
  'pyramid-inverted': (a, W, H, gs) => pyramid(a, W, H, gs, true),
};

function pyramid(a: SmartArtAttrs, W: number, H: number, gs: Group[], inverted: boolean): string {
  const n = Math.max(1, gs.length);
  const pw = Math.min(W, H * 1.6);
  const ox = (W - pw) / 2;
  const gap = 3;
  const bandH = (H - gap * (n - 1)) / n;
  let out = '';
  gs.forEach((g, i) => {
    const y0 = i * (bandH + gap);
    const y1 = y0 + bandH;
    // Ancho de la pirámide a una altura dada
    const half = (y: number) => ((inverted ? H - y : y) / H) * (pw / 2);
    const cx = ox + pw / 2;
    const d = `M${fmt(cx - half(y0))} ${fmt(y0)} H${fmt(cx + half(y0))} L${fmt(cx + half(y1))} ${fmt(y1)} H${fmt(cx - half(y1))} Z`;
    const p = paint(a, i, n);
    out += `<path d="${d}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>`;
    // El texto va en la parte ancha de la franja, para que no salga del triángulo en la punta
    const wideY = inverted ? y0 : y1;
    const narrowY = inverted ? y1 : y0;
    const tTop = narrowY + (wideY - narrowY) * 0.3;
    const tw = 2 * half(narrowY + (wideY - narrowY) * 0.35) * 0.92;
    const th = Math.abs(wideY - tTop) * 0.92;
    out += fitText(groupText(g), cx - tw / 2, Math.min(tTop, wideY) + (Math.abs(wideY - tTop) - th) / 2, tw, th, { size: 16, color: p.text, minSize: 6 });
  });
  return out;
}

export function renderSmartArtSvg(a: SmartArtAttrs): string {
  const W = Math.max(80, a.width);
  const H = Math.max(60, a.height);
  const pad = 6;
  const inner = LAYOUTS[a.layout] ?? LAYOUTS['list-basic'];
  const body = inner(a, W - pad * 2, H - pad * 2, groups(a.items));
  return svgDoc(W, H, `<g transform="translate(${pad} ${pad})">${body}</g>`);
}

/** Miniatura de un diseño de SmartArt para el menú. */
export function smartArtIconSvg(layout: SmartArtLayout, color = '#4472c4', size = 56): string {
  const items: SmartArtItem[] =
    layout === 'hierarchy-org'
      ? [{ text: '', level: 0 }, { text: '', level: 1 }, { text: '', level: 1 }, { text: '', level: 1 }]
      : layout === 'relationship-venn'
        ? [{ text: '', level: 0 }, { text: '', level: 0 }, { text: '', level: 0 }]
        : layout === 'list-vertical'
          ? [{ text: '', level: 0 }, { text: '', level: 0 }, { text: '', level: 0 }]
          : Array.from({ length: layout === 'relationship-radial' ? 5 : 4 }, () => ({ text: '', level: 0 }));
  const svg = renderSmartArtSvg({ layout, items, color, style: 'fill', width: 160, height: 120, align: 'center', wrap: 'inline' });
  return svg.replace(/width="160" height="120"/, `width="${size}" height="${Math.round(size * 0.75)}"`).replace(/<text[\s\S]*?<\/text>/g, '');
}

