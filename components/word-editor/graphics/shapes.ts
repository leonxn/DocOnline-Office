/**
 * Catálogo de formas (como las autoformas de Word). Cada forma devuelve su contorno SVG
 * para un tamaño dado, así se dibuja nítida a cualquier escala.
 * - `d`: contorno principal (relleno + trazo).
 * - `detail`: líneas interiores (solo trazo), p. ej. la tapa de un cilindro.
 * - `line`: formas de línea (sin relleno, con flechas opcionales).
 */

export interface ShapeGeometry {
  d: string;
  detail?: string;
  /** Regla de relleno (para formas con hueco: anillo, marco). */
  evenOdd?: boolean;
  /** Es una línea: no se rellena. */
  line?: boolean;
  /** Flechas en los extremos de una línea. */
  arrowStart?: boolean;
  arrowEnd?: boolean;
  /** Caja donde va el texto, en proporción del tamaño (x, y, ancho, alto). */
  text?: [number, number, number, number];
}

export interface ShapeDef {
  id: string;
  name: string;
  category: ShapeCategory;
  build: (w: number, h: number) => ShapeGeometry;
}

export type ShapeCategory = 'basic' | 'arrows' | 'math' | 'flowchart' | 'stars' | 'callouts' | 'buttons' | 'rects' | 'lines';

export const SHAPE_CATEGORIES: { id: ShapeCategory; label: string }[] = [
  { id: 'basic', label: 'Formas básicas' },
  { id: 'arrows', label: 'Flechas figuradas' },
  { id: 'math', label: 'Matemáticas' },
  { id: 'flowchart', label: 'Diagrama de flujo' },
  { id: 'stars', label: 'Cintas y estrellas' },
  { id: 'callouts', label: 'Llamadas' },
  { id: 'buttons', label: 'Botones' },
  { id: 'rects', label: 'Rectángulos' },
  { id: 'lines', label: 'Líneas' },
];

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

const f = (n: number) => Math.round(n * 100) / 100;

/** Polígono con puntos en proporción (0..1) del tamaño. */
function poly(points: [number, number][], w: number, h: number): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x * w)} ${f(y * h)}`).join(' ') + ' Z';
}

/** Polígono regular de n lados inscrito en la caja. */
function regular(n: number, w: number, h: number, rotation = -Math.PI / 2): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rotation + (i * 2 * Math.PI) / n;
    pts.push([0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]);
  }
  return poly(pts, w, h);
}

/** Estrella de n puntas; `inner` = radio interior relativo. */
function star(n: number, inner: number, w: number, h: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : 1;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push([0.5 + 0.5 * r * Math.cos(a), 0.5 + 0.5 * r * Math.sin(a)]);
  }
  return poly(pts, w, h);
}

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)} ${f(y)} H${f(x + w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V${f(y + h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`;
}

/** Flecha hacia la derecha (cuerpo + punta), con proporciones ajustables. */
function rightArrowPts(shaft = 0.5, head = 0.4): [number, number][] {
  const t = (1 - shaft) / 2;
  return [
    [0, t],
    [1 - head, t],
    [1 - head, 0],
    [1, 0.5],
    [1 - head, 1],
    [1 - head, 1 - t],
    [0, 1 - t],
  ];
}

const flipX = (pts: [number, number][]) => pts.map(([x, y]) => [1 - x, y] as [number, number]);
const swap = (pts: [number, number][]) => pts.map(([x, y]) => [y, x] as [number, number]);
const flipY = (pts: [number, number][]) => pts.map(([x, y]) => [x, 1 - y] as [number, number]);

const TEXT_FULL: [number, number, number, number] = [0.08, 0.08, 0.84, 0.84];
const TEXT_INNER: [number, number, number, number] = [0.22, 0.22, 0.56, 0.56];

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

const S = (id: string, name: string, category: ShapeCategory, build: ShapeDef['build']): ShapeDef => ({ id, name, category, build });

export const SHAPES: ShapeDef[] = [
  // --- Básicas
  S('textBox', 'Cuadro de texto', 'basic', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h), text: [0.04, 0.06, 0.92, 0.88] })),
  S('rect', 'Rectángulo', 'basic', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h), text: TEXT_FULL })),
  S('ellipse', 'Elipse', 'basic', (w, h) => ({ d: ellipse(w / 2, h / 2, w / 2, h / 2), text: [0.15, 0.15, 0.7, 0.7] })),
  S('triangle', 'Triángulo isósceles', 'basic', (w, h) => ({ d: poly([[0.5, 0], [1, 1], [0, 1]], w, h), text: [0.25, 0.45, 0.5, 0.5] })),
  S('rtTriangle', 'Triángulo rectángulo', 'basic', (w, h) => ({ d: poly([[0, 0], [1, 1], [0, 1]], w, h), text: [0.08, 0.5, 0.45, 0.45] })),
  S('parallelogram', 'Paralelogramo', 'basic', (w, h) => ({ d: poly([[0.25, 0], [1, 0], [0.75, 1], [0, 1]], w, h), text: [0.2, 0.1, 0.6, 0.8] })),
  S('trapezoid', 'Trapecio', 'basic', (w, h) => ({ d: poly([[0.25, 0], [0.75, 0], [1, 1], [0, 1]], w, h), text: [0.2, 0.15, 0.6, 0.75] })),
  S('diamond', 'Rombo', 'basic', (w, h) => ({ d: poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h), text: [0.25, 0.25, 0.5, 0.5] })),
  S('pentagon', 'Pentágono', 'basic', (w, h) => ({ d: regular(5, w, h), text: TEXT_INNER })),
  S('hexagon', 'Hexágono', 'basic', (w, h) => ({ d: poly([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]], w, h), text: [0.2, 0.15, 0.6, 0.7] })),
  S('heptagon', 'Heptágono', 'basic', (w, h) => ({ d: regular(7, w, h), text: TEXT_INNER })),
  S('octagon', 'Octágono', 'basic', (w, h) => ({ d: poly([[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]], w, h), text: [0.15, 0.15, 0.7, 0.7] })),
  S('decagon', 'Decágono', 'basic', (w, h) => ({ d: regular(10, w, h), text: TEXT_INNER })),
  S('dodecagon', 'Dodecágono', 'basic', (w, h) => ({ d: regular(12, w, h), text: TEXT_INNER })),
  S('pie', 'Sector circular', 'basic', (w, h) => ({ d: `M${w / 2} ${h / 2} L${w} ${h / 2} A${w / 2} ${h / 2} 0 1 1 ${w / 2} 0 Z` })),
  S('chord', 'Cuerda', 'basic', (w, h) => ({ d: `M${f(w * 0.85)} ${f(h * 0.85)} A${w / 2} ${h / 2} 0 1 1 ${f(w * 0.85)} ${f(h * 0.15)} Z` })),
  S('teardrop', 'Lágrima', 'basic', (w, h) => ({ d: `M${w / 2} ${h} A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2} V${h} Z`, text: [0.15, 0.15, 0.7, 0.7] })),
  S('frame', 'Marco', 'basic', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h) + ' ' + poly([[0.12, 0.12], [0.12, 0.88], [0.88, 0.88], [0.88, 0.12]], w, h), evenOdd: true, text: [0.15, 0.15, 0.7, 0.7] })),
  S('halfFrame', 'Medio marco', 'basic', (w, h) => ({ d: poly([[0, 0], [1, 0], [0.85, 0.15], [0.15, 0.15], [0.15, 0.85], [0, 1]], w, h) })),
  S('corner', 'Forma de L', 'basic', (w, h) => ({ d: poly([[0, 0], [0.4, 0], [0.4, 0.6], [1, 0.6], [1, 1], [0, 1]], w, h) })),
  S('diagStripe', 'Franja diagonal', 'basic', (w, h) => ({ d: poly([[0, 0.5], [0.5, 0], [1, 0], [0, 1]], w, h) })),
  S('plus', 'Cruz', 'basic', (w, h) => ({ d: poly([[0.3, 0], [0.7, 0], [0.7, 0.3], [1, 0.3], [1, 0.7], [0.7, 0.7], [0.7, 1], [0.3, 1], [0.3, 0.7], [0, 0.7], [0, 0.3], [0.3, 0.3]], w, h), text: [0.3, 0.3, 0.4, 0.4] })),
  S('plaque', 'Placa', 'basic', (w, h) => {
    const r = Math.min(w, h) * 0.16;
    return { d: `M${r} 0 H${w - r} A${r} ${r} 0 0 0 ${w} ${r} V${h - r} A${r} ${r} 0 0 0 ${w - r} ${h} H${r} A${r} ${r} 0 0 0 0 ${h - r} V${r} A${r} ${r} 0 0 0 ${r} 0 Z`, text: [0.12, 0.12, 0.76, 0.76] };
  }),
  S('can', 'Cilindro', 'basic', (w, h) => {
    const ry = h * 0.12;
    return {
      d: `M0 ${ry} A${w / 2} ${ry} 0 0 1 ${w} ${ry} V${h - ry} A${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`,
      detail: `M0 ${ry} A${w / 2} ${ry} 0 0 0 ${w} ${ry}`,
      text: [0.08, 0.3, 0.84, 0.6],
    };
  }),
  S('cube', 'Cubo', 'basic', (w, h) => ({
    d: poly([[0, 0.25], [0.25, 0], [1, 0], [1, 0.75], [0.75, 1], [0, 1]], w, h),
    detail: `M0 ${h * 0.25} H${w * 0.75} V${h} M${w * 0.75} ${h * 0.25} L${w} 0`,
    text: [0.04, 0.3, 0.68, 0.66],
  })),
  S('bevel', 'Bisel', 'basic', (w, h) => ({
    d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h),
    detail: `M${w * 0.12} ${h * 0.12} H${w * 0.88} V${h * 0.88} H${w * 0.12} Z M0 0 L${w * 0.12} ${h * 0.12} M${w} 0 L${w * 0.88} ${h * 0.12} M${w} ${h} L${w * 0.88} ${h * 0.88} M0 ${h} L${w * 0.12} ${h * 0.88}`,
    text: [0.14, 0.14, 0.72, 0.72],
  })),
  S('donut', 'Anillo', 'basic', (w, h) => ({ d: ellipse(w / 2, h / 2, w / 2, h / 2) + ' ' + ellipse(w / 2, h / 2, w * 0.3, h * 0.3), evenOdd: true })),
  S('noSmoking', 'Prohibido', 'basic', (w, h) => ({
    d: ellipse(w / 2, h / 2, w / 2, h / 2) + ' ' + ellipse(w / 2, h / 2, w * 0.36, h * 0.36),
    evenOdd: true,
    detail: `M${f(w * 0.25)} ${f(h * 0.25)} L${f(w * 0.75)} ${f(h * 0.75)}`,
  })),
  S('blockArc', 'Arco de bloque', 'basic', (w, h) => ({ d: `M0 ${h / 2} A${w / 2} ${h / 2} 0 0 1 ${w} ${h / 2} H${w * 0.75} A${w / 4} ${h / 4} 0 0 0 ${w / 4} ${h / 2} Z` })),
  S('foldedCorner', 'Esquina doblada', 'basic', (w, h) => ({
    d: poly([[0, 0], [1, 0], [1, 0.8], [0.8, 1], [0, 1]], w, h),
    detail: `M${w * 0.8} ${h} L${w * 0.84} ${h * 0.84} L${w} ${h * 0.8}`,
    text: TEXT_FULL,
  })),
  S('smiley', 'Cara sonriente', 'basic', (w, h) => ({
    d: ellipse(w / 2, h / 2, w / 2, h / 2),
    detail: `${ellipse(w * 0.35, h * 0.38, w * 0.05, h * 0.06)} ${ellipse(w * 0.65, h * 0.38, w * 0.05, h * 0.06)} M${w * 0.28} ${h * 0.62} Q${w * 0.5} ${h * 0.82} ${w * 0.72} ${h * 0.62}`,
  })),
  S('heart', 'Corazón', 'basic', (w, h) => ({
    d: `M${w / 2} ${h * 0.25} C${w / 2} ${h * 0.05} ${w * 0.05} 0 ${w * 0.05} ${h * 0.3} C${w * 0.05} ${h * 0.6} ${w * 0.4} ${h * 0.75} ${w / 2} ${h} C${w * 0.6} ${h * 0.75} ${w * 0.95} ${h * 0.6} ${w * 0.95} ${h * 0.3} C${w * 0.95} 0 ${w / 2} ${h * 0.05} ${w / 2} ${h * 0.25} Z`,
    text: [0.25, 0.25, 0.5, 0.4],
  })),
  S('lightning', 'Rayo', 'basic', (w, h) => ({ d: poly([[0.38, 0], [0.62, 0.28], [0.5, 0.33], [0.78, 0.6], [0.66, 0.65], [1, 1], [0.38, 0.72], [0.52, 0.66], [0.22, 0.42], [0.34, 0.37], [0, 0.12]], w, h) })),
  S('sun', 'Sol', 'basic', (w, h) => ({ d: star(16, 0.62, w, h), detail: ellipse(w / 2, h / 2, w * 0.24, h * 0.24) })),
  S('moon', 'Luna', 'basic', (w, h) => ({ d: `M${w} 0 A${w} ${h / 2} 0 0 0 ${w} ${h} A${w * 0.6} ${h / 2} 0 0 1 ${w} 0 Z` })),
  S('cloud', 'Nube', 'basic', (w, h) => ({
    d: `M${w * 0.22} ${h * 0.86} C${w * 0.02} ${h * 0.86} 0 ${h * 0.56} ${w * 0.18} ${h * 0.52} C${w * 0.12} ${h * 0.28} ${w * 0.36} ${h * 0.14} ${w * 0.48} ${h * 0.26} C${w * 0.56} ${h * 0.04} ${w * 0.86} ${h * 0.06} ${w * 0.84} ${h * 0.32} C${w} ${h * 0.34} ${w} ${h * 0.66} ${w * 0.86} ${h * 0.72} C${w * 0.86} ${h * 0.92} ${w * 0.6} ${h * 0.98} ${w * 0.52} ${h * 0.84} C${w * 0.42} ${h} ${w * 0.26} ${h} ${w * 0.22} ${h * 0.86} Z`,
    text: [0.2, 0.3, 0.6, 0.45],
  })),
  S('bracePair', 'Llaves', 'basic', (w, h) => ({
    line: true,
    d: `M${w * 0.12} 0 Q0 0 0 ${h * 0.1} V${h * 0.4} Q0 ${h / 2} ${-w * 0.06} ${h / 2} Q0 ${h / 2} 0 ${h * 0.6} V${h * 0.9} Q0 ${h} ${w * 0.12} ${h} M${w * 0.88} 0 Q${w} 0 ${w} ${h * 0.1} V${h * 0.4} Q${w} ${h / 2} ${w * 1.06} ${h / 2} Q${w} ${h / 2} ${w} ${h * 0.6} V${h * 0.9} Q${w} ${h} ${w * 0.88} ${h}`,
    text: [0.1, 0.05, 0.8, 0.9],
  })),
  S('bracketPair', 'Corchetes', 'basic', (w, h) => ({ line: true, d: `M${w * 0.12} 0 H0 V${h} H${w * 0.12} M${w * 0.88} 0 H${w} V${h} H${w * 0.88}`, text: [0.1, 0.05, 0.8, 0.9] })),
  S('leftBracket', 'Corchete izquierdo', 'basic', (w, h) => ({ line: true, d: `M${w} 0 H0 V${h} H${w}` })),
  S('rightBracket', 'Corchete derecho', 'basic', (w, h) => ({ line: true, d: `M0 0 H${w} V${h} H0` })),
  S('leftBrace', 'Llave izquierda', 'basic', (w, h) => ({ line: true, d: `M${w} 0 Q${w / 2} 0 ${w / 2} ${h * 0.1} V${h * 0.4} Q${w / 2} ${h / 2} 0 ${h / 2} Q${w / 2} ${h / 2} ${w / 2} ${h * 0.6} V${h * 0.9} Q${w / 2} ${h} ${w} ${h}` })),
  S('rightBrace', 'Llave derecha', 'basic', (w, h) => ({ line: true, d: `M0 0 Q${w / 2} 0 ${w / 2} ${h * 0.1} V${h * 0.4} Q${w / 2} ${h / 2} ${w} ${h / 2} Q${w / 2} ${h / 2} ${w / 2} ${h * 0.6} V${h * 0.9} Q${w / 2} ${h} 0 ${h}` })),

  // --- Flechas
  S('rightArrow', 'Flecha derecha', 'arrows', (w, h) => ({ d: poly(rightArrowPts(), w, h), text: [0.05, 0.3, 0.6, 0.4] })),
  S('leftArrow', 'Flecha izquierda', 'arrows', (w, h) => ({ d: poly(flipX(rightArrowPts()), w, h), text: [0.35, 0.3, 0.6, 0.4] })),
  S('upArrow', 'Flecha arriba', 'arrows', (w, h) => ({ d: poly(swap(flipX(rightArrowPts())), w, h), text: [0.3, 0.4, 0.4, 0.55] })),
  S('downArrow', 'Flecha abajo', 'arrows', (w, h) => ({ d: poly(swap(rightArrowPts()), w, h), text: [0.3, 0.05, 0.4, 0.55] })),
  S('leftRightArrow', 'Flecha izquierda y derecha', 'arrows', (w, h) => ({ d: poly([[0, 0.5], [0.25, 0], [0.25, 0.25], [0.75, 0.25], [0.75, 0], [1, 0.5], [0.75, 1], [0.75, 0.75], [0.25, 0.75], [0.25, 1]], w, h), text: [0.25, 0.3, 0.5, 0.4] })),
  S('upDownArrow', 'Flecha arriba y abajo', 'arrows', (w, h) => ({ d: poly(swap([[0, 0.5], [0.25, 0], [0.25, 0.25], [0.75, 0.25], [0.75, 0], [1, 0.5], [0.75, 1], [0.75, 0.75], [0.25, 0.75], [0.25, 1]]), w, h) })),
  S('quadArrow', 'Flecha en cuatro direcciones', 'arrows', (w, h) => ({
    d: poly([[0.5, 0], [0.68, 0.18], [0.58, 0.18], [0.58, 0.42], [0.82, 0.42], [0.82, 0.32], [1, 0.5], [0.82, 0.68], [0.82, 0.58], [0.58, 0.58], [0.58, 0.82], [0.68, 0.82], [0.5, 1], [0.32, 0.82], [0.42, 0.82], [0.42, 0.58], [0.18, 0.58], [0.18, 0.68], [0, 0.5], [0.18, 0.32], [0.18, 0.42], [0.42, 0.42], [0.42, 0.18], [0.32, 0.18]], w, h),
  })),
  S('leftRightUpArrow', 'Flecha izquierda, derecha y arriba', 'arrows', (w, h) => ({
    d: poly([[0.5, 0], [0.68, 0.2], [0.58, 0.2], [0.58, 0.62], [0.82, 0.62], [0.82, 0.5], [1, 0.75], [0.82, 1], [0.82, 0.86], [0.18, 0.86], [0.18, 1], [0, 0.75], [0.18, 0.5], [0.18, 0.62], [0.42, 0.62], [0.42, 0.2], [0.32, 0.2]], w, h),
  })),
  S('bentArrow', 'Flecha doblada', 'arrows', (w, h) => ({
    d: `M0 ${h} V${h * 0.45} Q0 ${h * 0.2} ${w * 0.25} ${h * 0.2} H${w * 0.7} V0 L${w} ${h * 0.32} L${w * 0.7} ${h * 0.64} V${h * 0.44} H${w * 0.3} Q${w * 0.25} ${h * 0.44} ${w * 0.25} ${h * 0.5} V${h} Z`,
  })),
  S('uturnArrow', 'Flecha en U', 'arrows', (w, h) => {
    const t = w * 0.26; // grosor del cuerpo
    const ro = w * 0.43; // radio exterior
    const ri = ro - t;
    const headTop = h * 0.53;
    return {
      d: `M0 ${h} V${ro} A${ro} ${ro} 0 0 1 ${2 * ro} ${ro} V${headTop} H${w} L${ro * 2 - t / 2} ${h * 0.75} L${ro * 2 - t * 1.9} ${headTop} H${2 * ro - t} V${ro} A${ri} ${ri} 0 0 0 ${t} ${ro} V${h} Z`,
    };
  }),
  S('leftUpArrow', 'Flecha izquierda y arriba', 'arrows', (w, h) => ({
    d: poly([[0, 0.75], [0.22, 0.5], [0.22, 0.65], [0.65, 0.65], [0.65, 0.22], [0.5, 0.22], [0.75, 0], [1, 0.22], [0.85, 0.22], [0.85, 0.85], [0.22, 0.85], [0.22, 1]], w, h),
  })),
  S('bentUpArrow', 'Flecha doblada hacia arriba', 'arrows', (w, h) => ({ d: poly([[0, 0.7], [0.65, 0.7], [0.65, 0.25], [0.5, 0.25], [0.75, 0], [1, 0.25], [0.85, 0.25], [0.85, 1], [0, 1]], w, h) })),
  S('curvedRightArrow', 'Flecha curvada a la derecha', 'arrows', (w, h) => ({
    d: `M0 ${h * 0.35} Q${w * 0.1} ${h * 0.05} ${w * 0.62} ${h * 0.12} V0 L${w} ${h * 0.3} L${w * 0.62} ${h * 0.62} V${h * 0.45} Q${w * 0.2} ${h * 0.38} ${w * 0.15} ${h} H0 Z`,
  })),
  S('stripedRightArrow', 'Flecha con bandas', 'arrows', (w, h) => ({
    d: poly([[0.18, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0.18, 0.75]], w, h) + ' ' + poly([[0, 0.25], [0.04, 0.25], [0.04, 0.75], [0, 0.75]], w, h) + ' ' + poly([[0.08, 0.25], [0.14, 0.25], [0.14, 0.75], [0.08, 0.75]], w, h),
  })),
  S('notchedRightArrow', 'Flecha con muesca', 'arrows', (w, h) => ({ d: poly([[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75], [0.15, 0.5]], w, h) })),
  S('homePlate', 'Pentágono (flecha)', 'arrows', (w, h) => ({ d: poly([[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1]], w, h), text: [0.06, 0.1, 0.66, 0.8] })),
  S('chevron', 'Cheurón', 'arrows', (w, h) => ({ d: poly([[0, 0], [0.7, 0], [1, 0.5], [0.7, 1], [0, 1], [0.3, 0.5]], w, h), text: [0.3, 0.1, 0.4, 0.8] })),
  S('rightArrowCallout', 'Llamada de flecha derecha', 'arrows', (w, h) => ({
    d: poly([[0, 0], [0.62, 0], [0.62, 0.32], [0.8, 0.32], [0.8, 0.15], [1, 0.5], [0.8, 0.85], [0.8, 0.68], [0.62, 0.68], [0.62, 1], [0, 1]], w, h),
    text: [0.05, 0.1, 0.52, 0.8],
  })),
  S('downArrowCallout', 'Llamada de flecha abajo', 'arrows', (w, h) => ({
    d: poly(swap([[0, 0], [0.62, 0], [0.62, 0.32], [0.8, 0.32], [0.8, 0.15], [1, 0.5], [0.8, 0.85], [0.8, 0.68], [0.62, 0.68], [0.62, 1], [0, 1]]), w, h),
    text: [0.1, 0.05, 0.8, 0.52],
  })),
  S('circularArrow', 'Flecha circular', 'arrows', (w, h) => ({
    d: `M${w * 0.1} ${h * 0.6} A${w * 0.42} ${h * 0.42} 0 1 1 ${w * 0.8} ${h * 0.28} L${w * 0.94} ${h * 0.2} L${w * 0.9} ${h * 0.55} L${w * 0.62} ${h * 0.36} L${w * 0.72} ${h * 0.32} A${w * 0.3} ${h * 0.3} 0 1 0 ${w * 0.24} ${h * 0.6} Z`,
  })),

  // --- Matemáticas
  S('mathPlus', 'Más', 'math', (w, h) => ({ d: poly([[0.38, 0.1], [0.62, 0.1], [0.62, 0.38], [0.9, 0.38], [0.9, 0.62], [0.62, 0.62], [0.62, 0.9], [0.38, 0.9], [0.38, 0.62], [0.1, 0.62], [0.1, 0.38], [0.38, 0.38]], w, h) })),
  S('mathMinus', 'Menos', 'math', (w, h) => ({ d: poly([[0.1, 0.38], [0.9, 0.38], [0.9, 0.62], [0.1, 0.62]], w, h) })),
  S('mathMultiply', 'Multiplicar', 'math', (w, h) => ({ d: poly([[0.2, 0.1], [0.5, 0.4], [0.8, 0.1], [0.9, 0.2], [0.6, 0.5], [0.9, 0.8], [0.8, 0.9], [0.5, 0.6], [0.2, 0.9], [0.1, 0.8], [0.4, 0.5], [0.1, 0.2]], w, h) })),
  S('mathDivide', 'Dividir', 'math', (w, h) => ({ d: poly([[0.1, 0.42], [0.9, 0.42], [0.9, 0.58], [0.1, 0.58]], w, h) + ' ' + ellipse(w / 2, h * 0.2, w * 0.09, h * 0.09) + ' ' + ellipse(w / 2, h * 0.8, w * 0.09, h * 0.09) })),
  S('mathEqual', 'Igual', 'math', (w, h) => ({ d: poly([[0.1, 0.25], [0.9, 0.25], [0.9, 0.42], [0.1, 0.42]], w, h) + ' ' + poly([[0.1, 0.58], [0.9, 0.58], [0.9, 0.75], [0.1, 0.75]], w, h) })),
  S('mathNotEqual', 'No es igual', 'math', (w, h) => ({
    d: poly([[0.1, 0.25], [0.9, 0.25], [0.9, 0.42], [0.1, 0.42]], w, h) + ' ' + poly([[0.1, 0.58], [0.9, 0.58], [0.9, 0.75], [0.1, 0.75]], w, h) + ' ' + poly([[0.58, 0.05], [0.7, 0.1], [0.42, 0.95], [0.3, 0.9]], w, h),
  })),

  // --- Diagrama de flujo
  S('flowProcess', 'Proceso', 'flowchart', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h), text: TEXT_FULL })),
  S('flowAltProcess', 'Proceso alternativo', 'flowchart', (w, h) => ({ d: roundRect(0, 0, w, h, Math.min(w, h) * 0.18), text: TEXT_FULL })),
  S('flowDecision', 'Decisión', 'flowchart', (w, h) => ({ d: poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h), text: [0.25, 0.25, 0.5, 0.5] })),
  S('flowData', 'Datos', 'flowchart', (w, h) => ({ d: poly([[0.2, 0], [1, 0], [0.8, 1], [0, 1]], w, h), text: [0.2, 0.1, 0.6, 0.8] })),
  S('flowPredefined', 'Proceso predefinido', 'flowchart', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h), detail: `M${w * 0.12} 0 V${h} M${w * 0.88} 0 V${h}`, text: [0.14, 0.08, 0.72, 0.84] })),
  S('flowInternalStorage', 'Almacenamiento interno', 'flowchart', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h), detail: `M${w * 0.18} 0 V${h} M0 ${h * 0.2} H${w}`, text: [0.2, 0.22, 0.76, 0.74] })),
  S('flowDocument', 'Documento', 'flowchart', (w, h) => ({ d: `M0 0 H${w} V${h * 0.8} C${w * 0.75} ${h * 0.65} ${w * 0.6} ${h} ${w * 0.3} ${h} C${w * 0.15} ${h} ${w * 0.05} ${h * 0.92} 0 ${h * 0.85} Z`, text: [0.06, 0.06, 0.88, 0.66] })),
  S('flowMultidocument', 'Varios documentos', 'flowchart', (w, h) => ({
    d: `M0 ${h * 0.16} H${w * 0.84} V${h * 0.84} C${w * 0.64} ${h * 0.72} ${w * 0.5} ${h} ${w * 0.25} ${h} C${w * 0.12} ${h} ${w * 0.04} ${h * 0.94} 0 ${h * 0.88} Z`,
    detail: `M${w * 0.08} ${h * 0.16} V${h * 0.08} H${w * 0.92} V${h * 0.76} H${w * 0.84} M${w * 0.16} ${h * 0.08} V0 H${w} V${h * 0.68} H${w * 0.92}`,
    text: [0.04, 0.2, 0.76, 0.56],
  })),
  S('flowTerminator', 'Terminador', 'flowchart', (w, h) => ({ d: roundRect(0, 0, w, h, h / 2), text: [0.12, 0.1, 0.76, 0.8] })),
  S('flowPreparation', 'Preparación', 'flowchart', (w, h) => ({ d: poly([[0.2, 0], [0.8, 0], [1, 0.5], [0.8, 1], [0.2, 1], [0, 0.5]], w, h), text: [0.2, 0.1, 0.6, 0.8] })),
  S('flowManualInput', 'Entrada manual', 'flowchart', (w, h) => ({ d: poly([[0, 0.25], [1, 0], [1, 1], [0, 1]], w, h), text: [0.06, 0.3, 0.88, 0.64] })),
  S('flowManualOperation', 'Operación manual', 'flowchart', (w, h) => ({ d: poly([[0, 0], [1, 0], [0.8, 1], [0.2, 1]], w, h), text: [0.2, 0.08, 0.6, 0.84] })),
  S('flowConnector', 'Conector', 'flowchart', (w, h) => ({ d: ellipse(w / 2, h / 2, w / 2, h / 2), text: [0.15, 0.15, 0.7, 0.7] })),
  S('flowOffpage', 'Conector fuera de página', 'flowchart', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 0.75], [0.5, 1], [0, 0.75]], w, h), text: [0.08, 0.08, 0.84, 0.6] })),
  S('flowCard', 'Tarjeta', 'flowchart', (w, h) => ({ d: poly([[0.2, 0], [1, 0], [1, 1], [0, 1], [0, 0.2]], w, h), text: [0.08, 0.2, 0.84, 0.74] })),
  S('flowPunchedTape', 'Cinta perforada', 'flowchart', (w, h) => ({
    d: `M0 ${h * 0.1} Q${w * 0.25} ${-h * 0.1} ${w * 0.5} ${h * 0.1} T${w} ${h * 0.1} V${h * 0.9} Q${w * 0.75} ${h * 1.1} ${w * 0.5} ${h * 0.9} T0 ${h * 0.9} Z`,
    text: [0.06, 0.2, 0.88, 0.6],
  })),
  S('flowSummingJunction', 'Unión de suma', 'flowchart', (w, h) => ({ d: ellipse(w / 2, h / 2, w / 2, h / 2), detail: `M${f(w * 0.15)} ${f(h * 0.15)} L${f(w * 0.85)} ${f(h * 0.85)} M${f(w * 0.85)} ${f(h * 0.15)} L${f(w * 0.15)} ${f(h * 0.85)}` })),
  S('flowOr', 'O', 'flowchart', (w, h) => ({ d: ellipse(w / 2, h / 2, w / 2, h / 2), detail: `M${w / 2} 0 V${h} M0 ${h / 2} H${w}` })),
  S('flowCollate', 'Intercalar', 'flowchart', (w, h) => ({ d: poly([[0, 0], [1, 0], [0, 1], [1, 1]], w, h) })),
  S('flowSort', 'Ordenar', 'flowchart', (w, h) => ({ d: poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h), detail: `M0 ${h / 2} H${w}` })),
  S('flowExtract', 'Extraer', 'flowchart', (w, h) => ({ d: poly([[0.5, 0], [1, 1], [0, 1]], w, h) })),
  S('flowMerge', 'Combinar', 'flowchart', (w, h) => ({ d: poly([[0, 0], [1, 0], [0.5, 1]], w, h) })),
  S('flowStoredData', 'Datos almacenados', 'flowchart', (w, h) => ({ d: `M${w * 0.16} 0 H${w} Q${w * 0.84} ${h / 2} ${w} ${h} H${w * 0.16} Q0 ${h / 2} ${w * 0.16} 0 Z`, text: [0.16, 0.1, 0.66, 0.8] })),
  S('flowDelay', 'Retraso', 'flowchart', (w, h) => ({ d: `M0 0 H${w / 2} A${w / 2} ${h / 2} 0 0 1 ${w / 2} ${h} H0 Z`, text: [0.05, 0.1, 0.75, 0.8] })),
  S('flowMagneticDisk', 'Disco magnético', 'flowchart', (w, h) => {
    const ry = h * 0.15;
    return { d: `M0 ${ry} A${w / 2} ${ry} 0 0 1 ${w} ${ry} V${h - ry} A${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`, detail: `M0 ${ry} A${w / 2} ${ry} 0 0 0 ${w} ${ry}`, text: [0.08, 0.32, 0.84, 0.56] };
  }),
  S('flowDisplay', 'Pantalla', 'flowchart', (w, h) => ({ d: `M0 ${h / 2} L${w * 0.16} 0 H${w * 0.84} A${w * 0.16} ${h / 2} 0 0 1 ${w * 0.84} ${h} H${w * 0.16} Z`, text: [0.16, 0.1, 0.64, 0.8] })),

  // --- Cintas y estrellas
  S('explosion1', 'Explosión 1', 'stars', (w, h) => ({ d: poly([[0.5, 0.18], [0.62, 0], [0.66, 0.2], [0.86, 0.1], [0.78, 0.32], [1, 0.36], [0.82, 0.5], [0.98, 0.7], [0.74, 0.68], [0.76, 0.92], [0.58, 0.76], [0.48, 1], [0.4, 0.78], [0.18, 0.9], [0.24, 0.66], [0, 0.64], [0.16, 0.48], [0.02, 0.28], [0.26, 0.3], [0.22, 0.08], [0.42, 0.24]], w, h), text: [0.28, 0.32, 0.44, 0.36] })),
  S('explosion2', 'Explosión 2', 'stars', (w, h) => ({ d: poly([[0.12, 0.2], [0.36, 0.22], [0.48, 0], [0.56, 0.18], [0.82, 0.04], [0.76, 0.26], [1, 0.3], [0.84, 0.46], [0.96, 0.66], [0.74, 0.66], [0.78, 0.9], [0.58, 0.78], [0.46, 1], [0.38, 0.8], [0.14, 0.96], [0.2, 0.7], [0, 0.66], [0.16, 0.5], [0.02, 0.36], [0.22, 0.34]], w, h), text: [0.28, 0.32, 0.44, 0.36] })),
  S('star4', 'Estrella de 4 puntas', 'stars', (w, h) => ({ d: star(4, 0.38, w, h), text: [0.32, 0.32, 0.36, 0.36] })),
  S('star5', 'Estrella de 5 puntas', 'stars', (w, h) => ({ d: star(5, 0.42, w, h), text: [0.32, 0.36, 0.36, 0.34] })),
  S('star6', 'Estrella de 6 puntas', 'stars', (w, h) => ({ d: star(6, 0.58, w, h), text: [0.25, 0.25, 0.5, 0.5] })),
  S('star7', 'Estrella de 7 puntas', 'stars', (w, h) => ({ d: star(7, 0.6, w, h), text: [0.25, 0.25, 0.5, 0.5] })),
  S('star8', 'Estrella de 8 puntas', 'stars', (w, h) => ({ d: star(8, 0.7, w, h), text: [0.22, 0.22, 0.56, 0.56] })),
  S('star10', 'Estrella de 10 puntas', 'stars', (w, h) => ({ d: star(10, 0.72, w, h), text: [0.2, 0.2, 0.6, 0.6] })),
  S('star12', 'Estrella de 12 puntas', 'stars', (w, h) => ({ d: star(12, 0.74, w, h), text: [0.2, 0.2, 0.6, 0.6] })),
  S('star16', 'Estrella de 16 puntas', 'stars', (w, h) => ({ d: star(16, 0.8, w, h), text: [0.18, 0.18, 0.64, 0.64] })),
  S('star24', 'Estrella de 24 puntas', 'stars', (w, h) => ({ d: star(24, 0.84, w, h), text: [0.16, 0.16, 0.68, 0.68] })),
  S('star32', 'Estrella de 32 puntas', 'stars', (w, h) => ({ d: star(32, 0.86, w, h), text: [0.16, 0.16, 0.68, 0.68] })),
  S('ribbonDown', 'Cinta hacia abajo', 'stars', (w, h) => ({
    d: poly([[0.2, 0], [0.8, 0], [0.8, 0.7], [0.2, 0.7]], w, h) + ' ' + poly([[0, 0.3], [0.2, 0.3], [0.2, 0.7], [0.3, 0.7], [0.3, 1], [0, 1], [0.08, 0.65]], w, h) + ' ' + poly([[1, 0.3], [0.8, 0.3], [0.8, 0.7], [0.7, 0.7], [0.7, 1], [1, 1], [0.92, 0.65]], w, h),
    text: [0.22, 0.05, 0.56, 0.6],
  })),
  S('ribbonUp', 'Cinta hacia arriba', 'stars', (w, h) => ({
    d: poly(flipY([[0.2, 0], [0.8, 0], [0.8, 0.7], [0.2, 0.7]]), w, h) + ' ' + poly(flipY([[0, 0.3], [0.2, 0.3], [0.2, 0.7], [0.3, 0.7], [0.3, 1], [0, 1], [0.08, 0.65]]), w, h) + ' ' + poly(flipY([[1, 0.3], [0.8, 0.3], [0.8, 0.7], [0.7, 0.7], [0.7, 1], [1, 1], [0.92, 0.65]]), w, h),
    text: [0.22, 0.35, 0.56, 0.6],
  })),
  S('verticalScroll', 'Pergamino vertical', 'stars', (w, h) => ({
    d: `M${w * 0.15} ${h * 0.1} Q${w * 0.15} 0 ${w * 0.25} 0 H${w} Q${w * 0.9} 0 ${w * 0.9} ${h * 0.1} V${h * 0.9} Q${w * 0.9} ${h} ${w * 0.8} ${h} H0 Q${w * 0.1} ${h} ${w * 0.1} ${h * 0.9} H${w * 0.15} Z`,
    detail: `M${w * 0.15} ${h * 0.1} H${w * 0.9} M${w * 0.15} ${h * 0.1} V${h * 0.9}`,
    text: [0.2, 0.14, 0.64, 0.72],
  })),
  S('horizontalScroll', 'Pergamino horizontal', 'stars', (w, h) => ({
    d: `M${w * 0.1} ${h * 0.15} Q0 ${h * 0.15} 0 ${h * 0.25} V${h} Q0 ${h * 0.9} ${w * 0.1} ${h * 0.9} H${w * 0.9} Q${w} ${h * 0.9} ${w} ${h * 0.8} V0 Q${w} ${h * 0.1} ${w * 0.9} ${h * 0.1} V${h * 0.15} Z`,
    detail: `M${w * 0.1} ${h * 0.15} V${h * 0.9} M${w * 0.1} ${h * 0.15} H${w * 0.9}`,
    text: [0.14, 0.2, 0.72, 0.64],
  })),
  S('wave', 'Onda', 'stars', (w, h) => ({ d: `M0 ${h * 0.15} Q${w * 0.25} ${-h * 0.1} ${w * 0.5} ${h * 0.15} T${w} ${h * 0.15} V${h * 0.85} Q${w * 0.75} ${h * 1.1} ${w * 0.5} ${h * 0.85} T0 ${h * 0.85} Z`, text: [0.06, 0.2, 0.88, 0.6] })),
  S('doubleWave', 'Doble onda', 'stars', (w, h) => ({ d: `M0 ${h * 0.12} Q${w / 8} 0 ${w / 4} ${h * 0.12} T${w / 2} ${h * 0.12} T${(3 * w) / 4} ${h * 0.12} T${w} ${h * 0.12} V${h * 0.88} Q${(7 * w) / 8} ${h} ${(3 * w) / 4} ${h * 0.88} T${w / 2} ${h * 0.88} T${w / 4} ${h * 0.88} T0 ${h * 0.88} Z`, text: [0.06, 0.2, 0.88, 0.6] })),

  // --- Llamadas
  S('calloutRect', 'Llamada rectangular', 'callouts', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 0.75], [0.42, 0.75], [0.2, 1], [0.25, 0.75], [0, 0.75]], w, h), text: [0.05, 0.05, 0.9, 0.65] })),
  S('calloutRoundRect', 'Llamada rectangular redondeada', 'callouts', (w, h) => {
    const r = Math.min(w, h) * 0.12;
    const b = h * 0.75;
    return { d: `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${b - r} Q${w} ${b} ${w - r} ${b} H${w * 0.42} L${w * 0.2} ${h} L${w * 0.25} ${b} H${r} Q0 ${b} 0 ${b - r} V${r} Q0 0 ${r} 0 Z`, text: [0.06, 0.06, 0.88, 0.62] };
  }),
  S('calloutOval', 'Llamada ovalada', 'callouts', (w, h) => ({
    d: `M${w * 0.28} ${h * 0.7} A${w / 2} ${h * 0.37} 0 1 1 ${w * 0.42} ${h * 0.74} L${w * 0.15} ${h} Z`,
    text: [0.18, 0.14, 0.64, 0.46],
  })),
  S('calloutCloud', 'Llamada de nube', 'callouts', (w, h) => ({
    d: `M${w * 0.22} ${h * 0.72} C${w * 0.02} ${h * 0.72} 0 ${h * 0.46} ${w * 0.18} ${h * 0.43} C${w * 0.12} ${h * 0.22} ${w * 0.36} ${h * 0.1} ${w * 0.48} ${h * 0.2} C${w * 0.56} ${h * 0.02} ${w * 0.86} ${h * 0.04} ${w * 0.84} ${h * 0.26} C${w} ${h * 0.28} ${w} ${h * 0.56} ${w * 0.86} ${h * 0.6} C${w * 0.86} ${h * 0.78} ${w * 0.6} ${h * 0.82} ${w * 0.52} ${h * 0.7} C${w * 0.42} ${h * 0.84} ${w * 0.26} ${h * 0.84} ${w * 0.22} ${h * 0.72} Z`,
    detail: `${ellipse(w * 0.16, h * 0.84, w * 0.05, h * 0.04)} ${ellipse(w * 0.08, h * 0.94, w * 0.03, h * 0.025)}`,
    text: [0.2, 0.24, 0.6, 0.4],
  })),
  S('calloutLine', 'Llamada con línea', 'callouts', (w, h) => ({ d: poly([[0.3, 0], [1, 0], [1, 0.6], [0.3, 0.6]], w, h), detail: `M${w * 0.3} ${h * 0.3} L0 ${h}`, text: [0.33, 0.06, 0.64, 0.5] })),
  S('calloutBorder', 'Llamada con borde y barra', 'callouts', (w, h) => ({ d: poly([[0.3, 0], [1, 0], [1, 0.6], [0.3, 0.6]], w, h), detail: `M${w * 0.24} 0 V${h * 0.6} M${w * 0.24} ${h * 0.3} L0 ${h}`, text: [0.33, 0.06, 0.64, 0.5] })),

  // --- Botones de acción
  ...([
    ['btnBack', 'Botón: atrás', (w: number, h: number) => poly([[0.28, 0.5], [0.72, 0.22], [0.72, 0.78]], w, h)],
    ['btnForward', 'Botón: adelante', (w: number, h: number) => poly([[0.72, 0.5], [0.28, 0.22], [0.28, 0.78]], w, h)],
    ['btnBeginning', 'Botón: inicio', (w: number, h: number) => poly([[0.34, 0.5], [0.72, 0.22], [0.72, 0.78]], w, h) + ' ' + poly([[0.26, 0.22], [0.32, 0.22], [0.32, 0.78], [0.26, 0.78]], w, h)],
    ['btnEnd', 'Botón: final', (w: number, h: number) => poly([[0.66, 0.5], [0.28, 0.22], [0.28, 0.78]], w, h) + ' ' + poly([[0.68, 0.22], [0.74, 0.22], [0.74, 0.78], [0.68, 0.78]], w, h)],
    ['btnHome', 'Botón: inicio (casa)', (w: number, h: number) => poly([[0.5, 0.2], [0.8, 0.48], [0.7, 0.48], [0.7, 0.8], [0.3, 0.8], [0.3, 0.48], [0.2, 0.48]], w, h)],
    ['btnInfo', 'Botón: información', (w: number, h: number) => ellipse(w / 2, h * 0.28, w * 0.06, h * 0.06) + ' ' + poly([[0.42, 0.42], [0.58, 0.42], [0.58, 0.8], [0.42, 0.8]], w, h)],
    ['btnHelp', 'Botón: ayuda', (w: number, h: number) => `M${w * 0.36} ${h * 0.38} Q${w * 0.36} ${h * 0.2} ${w * 0.5} ${h * 0.2} Q${w * 0.64} ${h * 0.2} ${w * 0.64} ${h * 0.36} Q${w * 0.64} ${h * 0.46} ${w * 0.54} ${h * 0.52} V${h * 0.62} H${w * 0.46} V${h * 0.48} Q${w * 0.56} ${h * 0.44} ${w * 0.56} ${h * 0.36} Q${w * 0.56} ${h * 0.28} ${w * 0.5} ${h * 0.28} Q${w * 0.44} ${h * 0.28} ${w * 0.44} ${h * 0.38} Z ` + ellipse(w / 2, h * 0.74, w * 0.05, h * 0.05)],
    ['btnBlank', 'Botón: en blanco', (_w: number, _h: number) => ''],
  ] as [string, string, (w: number, h: number) => string][]).map(([id, name, inner]) =>
    S(id, name, 'buttons', (w, h) => ({ d: poly([[0, 0], [1, 0], [1, 1], [0, 1]], w, h), detail: inner(w, h), text: TEXT_FULL })),
  ),

  // --- Rectángulos
  S('roundRect', 'Rectángulo redondeado', 'rects', (w, h) => ({ d: roundRect(0, 0, w, h, Math.min(w, h) * 0.16), text: TEXT_FULL })),
  S('snip1Rect', 'Rectángulo con una esquina cortada', 'rects', (w, h) => ({ d: poly([[0, 0], [0.82, 0], [1, 0.18], [1, 1], [0, 1]], w, h), text: TEXT_FULL })),
  S('snip2SameRect', 'Rectángulo con esquinas del mismo lado cortadas', 'rects', (w, h) => ({ d: poly([[0.18, 0], [0.82, 0], [1, 0.18], [1, 1], [0, 1], [0, 0.18]], w, h), text: TEXT_FULL })),
  S('snip2DiagRect', 'Rectángulo con esquinas diagonales cortadas', 'rects', (w, h) => ({ d: poly([[0, 0], [0.82, 0], [1, 0.18], [1, 1], [0.18, 1], [0, 0.82]], w, h), text: TEXT_FULL })),
  S('snipRoundRect', 'Rectángulo con esquina cortada y redondeada', 'rects', (w, h) => {
    const r = Math.min(w, h) * 0.18;
    return { d: `M${r} 0 H${w - r} L${w} ${r} V${h} H0 V${r} A${r} ${r} 0 0 1 ${r} 0 Z`, text: TEXT_FULL };
  }),
  S('round1Rect', 'Rectángulo con una esquina redondeada', 'rects', (w, h) => {
    const r = Math.min(w, h) * 0.2;
    return { d: `M0 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h} H0 Z`, text: TEXT_FULL };
  }),
  S('round2SameRect', 'Rectángulo con esquinas del mismo lado redondeadas', 'rects', (w, h) => {
    const r = Math.min(w, h) * 0.2;
    return { d: `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h} H0 V${r} A${r} ${r} 0 0 1 ${r} 0 Z`, text: TEXT_FULL };
  }),
  S('round2DiagRect', 'Rectángulo con esquinas diagonales redondeadas', 'rects', (w, h) => {
    const r = Math.min(w, h) * 0.2;
    return { d: `M${r} 0 H${w} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H0 V${r} A${r} ${r} 0 0 1 ${r} 0 Z`, text: TEXT_FULL };
  }),

  // --- Líneas
  S('line', 'Línea', 'lines', (w, h) => ({ line: true, d: `M0 0 L${w} ${h}` })),
  S('lineArrow', 'Flecha', 'lines', (w, h) => ({ line: true, d: `M0 0 L${w} ${h}`, arrowEnd: true })),
  S('lineDoubleArrow', 'Flecha doble', 'lines', (w, h) => ({ line: true, d: `M0 0 L${w} ${h}`, arrowStart: true, arrowEnd: true })),
  S('lineHorizontal', 'Línea horizontal', 'lines', (w, h) => ({ line: true, d: `M0 ${h / 2} H${w}` })),
  S('lineHorizontalArrow', 'Flecha horizontal', 'lines', (w, h) => ({ line: true, d: `M0 ${h / 2} H${w}`, arrowEnd: true })),
  S('elbow', 'Conector angular', 'lines', (w, h) => ({ line: true, d: `M0 0 H${w / 2} V${h} H${w}` })),
  S('elbowArrow', 'Conector angular de flecha', 'lines', (w, h) => ({ line: true, d: `M0 0 H${w / 2} V${h} H${w}`, arrowEnd: true })),
  S('curve', 'Curva', 'lines', (w, h) => ({ line: true, d: `M0 ${h} C${w * 0.3} ${-h * 0.2} ${w * 0.7} ${h * 1.2} ${w} 0` })),
  S('curveArrow', 'Conector curvo de flecha', 'lines', (w, h) => ({ line: true, d: `M0 0 C${w * 0.6} 0 ${w * 0.4} ${h} ${w} ${h}`, arrowEnd: true })),
  S('freeform', 'Forma libre', 'lines', (w, h) => ({ line: true, d: `M0 ${h * 0.8} L${w * 0.2} ${h * 0.2} L${w * 0.45} ${h * 0.7} L${w * 0.7} ${h * 0.1} L${w} ${h * 0.6}` })),
  S('scribble', 'Garabato', 'lines', (w, h) => ({ line: true, d: `M0 ${h * 0.6} C${w * 0.1} 0 ${w * 0.25} 0 ${w * 0.3} ${h * 0.5} S${w * 0.5} ${h} ${w * 0.6} ${h * 0.4} S${w * 0.85} 0 ${w} ${h * 0.5}` })),
];

export const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));
