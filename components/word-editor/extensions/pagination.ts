import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { TableMap } from '@tiptap/pm/tables';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

/**
 * Paginación real estilo Word.
 *
 * El documento sigue siendo un solo flujo de ProseMirror, pero se insertan "espaciadores"
 * (decoraciones que no forman parte del documento) justo donde termina el área útil de cada
 * página. El espaciador ocupa el margen inferior + el hueco entre hojas + el margen superior,
 * así el texto continúa exactamente al inicio de la hoja siguiente.
 *
 * - Los párrafos se cortan por LÍNEA (no se mueve el párrafo entero).
 * - Las tablas se cortan entre filas; imágenes y líneas pasan completas a la hoja siguiente.
 * - Un título nunca queda solo al final de una hoja (se va con el párrafo que le sigue).
 * - Los saltos de página manuales fuerzan la hoja siguiente.
 *
 * Todas las medidas son px a escala 1 (sin zoom), relativas al borde superior del contenido.
 */

export interface PaginationConfig {
  /** Distancia entre el inicio de una hoja y el de la siguiente (alto de hoja + hueco), px. */
  pitch: number;
  /** Alto útil por hoja (alto - margen superior - margen inferior), px. */
  usable: number;
}

export interface PaginationLayout {
  pages: number;
  pitch: number;
}

interface PageBreakSpec {
  pos: number;
  kind: 'inline' | 'block' | 'row';
  /** Columnas de la tabla (solo para cortes entre filas). */
  cols?: number;
  /** Índice (desde 0) de la hoja donde empieza el contenido que sigue al espaciador. */
  page: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pagination: {
      /** Actualiza medidas de página y recalcula. */
      setPaginationConfig: (config: PaginationConfig) => ReturnType;
    };
  }
  interface Storage {
    pagination: {
      config: PaginationConfig;
      layout: PaginationLayout;
      onLayout?: (layout: PaginationLayout) => void;
      relayout?: () => void;
    };
  }
}

export const paginationKey = new PluginKey<DecorationSet>('pagination');

const EPS = 0.5;

// ---------------------------------------------------------------------------
// Medición
// ---------------------------------------------------------------------------

type Unit =
  | { kind: 'text'; pos: number; node: PMNode; dom: HTMLElement }
  | { kind: 'row'; pos: number; dom: HTMLElement; cols: number }
  | { kind: 'atom'; pos: number; dom: HTMLElement }
  | { kind: 'forced'; pos: number; end: number; dom: HTMLElement };

function collectUnits(view: EditorView): Unit[] {
  const units: Unit[] = [];
  let tableCols = 1;
  view.state.doc.descendants((node, pos) => {
    const name = node.type.name;
    if (name === 'table') tableCols = TableMap.get(node).width;
    if (node.isTextblock) {
      const dom = view.nodeDOM(pos);
      if (dom instanceof HTMLElement) units.push({ kind: 'text', pos, node, dom });
      return false;
    }
    if (name === 'tableRow') {
      const dom = view.nodeDOM(pos);
      if (dom instanceof HTMLElement) units.push({ kind: 'row', pos, dom, cols: tableCols });
      return false;
    }
    if (name === 'pageBreak') {
      const dom = view.nodeDOM(pos);
      if (dom instanceof HTMLElement) units.push({ kind: 'forced', pos, end: pos + node.nodeSize, dom });
      return false;
    }
    if (node.isAtom || name === 'image' || name === 'horizontalRule') {
      const dom = view.nodeDOM(pos);
      if (dom instanceof HTMLElement) units.push({ kind: 'atom', pos, dom });
      return false;
    }
    return true; // listas, citas, tablas, ítems: bajar a sus hijos
  });
  return units;
}

interface Measure {
  /** Convierte un DOMRect a coordenadas del contenido sin zoom. */
  top: (r: DOMRect) => number;
  bottom: (r: DOMRect) => number;
}

function makeMeasure(view: EditorView): Measure {
  const root = view.dom.getBoundingClientRect();
  const scale = root.height / (view.dom.offsetHeight || 1) || 1;
  return {
    top: (r) => (r.top - root.top) / scale,
    bottom: (r) => (r.bottom - root.top) / scale,
  };
}

/** Caracteres de un bloque de texto, en orden, para buscar dónde empieza cada línea. */
function textChars(el: HTMLElement) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if (t.data.length && !(t.parentElement?.closest('[data-we-spacer]'))) nodes.push(t);
  }
  const offsets: number[] = [];
  let total = 0;
  for (const n of nodes) {
    offsets.push(total);
    total += n.data.length;
  }
  const locate = (i: number): [Text, number] => {
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= i) lo = mid;
      else hi = mid - 1;
    }
    return [nodes[lo], i - offsets[lo]];
  };
  return { total, locate };
}

/** Rectángulo visible del carácter i (o null si es un espacio colapsado). */
function charRect(range: Range, chars: ReturnType<typeof textChars>, i: number): DOMRect | null {
  const [node, off] = chars.locate(i);
  range.setStart(node, off);
  range.setEnd(node, off + 1);
  const rects = range.getClientRects();
  for (const r of Array.from(rects)) if (r.height > 0) return r;
  return null;
}

/**
 * Dentro de un bloque de texto, busca la primera línea cuyo borde inferior pasa de `limit`.
 * Devuelve la posición del documento al inicio de esa línea y el borde superior de su caja de línea.
 */
function findOverflowLine(
  view: EditorView,
  unit: Extract<Unit, { kind: 'text' }>,
  limit: number,
  m: Measure,
): { pos: number; lineTop: number; first: boolean } | null {
  const chars = textChars(unit.dom);
  const style = getComputedStyle(unit.dom);
  const blockRect = unit.dom.getBoundingClientRect();
  const contentTop = m.top(blockRect) + parseFloat(style.paddingTop || '0') + parseFloat(style.borderTopWidth || '0');
  if (!chars.total) return { pos: unit.pos + 1, lineTop: contentTop, first: true };

  const range = document.createRange();
  const rectAt = (i: number) => {
    // Los espacios al final de línea pueden no tener caja: buscar el siguiente carácter visible
    for (let j = i; j < chars.total; j++) {
      const r = charRect(range, chars, j);
      if (r) return { r, j };
    }
    return null;
  };

  // 1) primer carácter cuyo borde inferior pasa el límite (búsqueda binaria)
  let lo = 0;
  let hi = chars.total - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const hit = rectAt(mid);
    if (!hit) {
      hi = mid - 1;
      continue;
    }
    if (m.bottom(hit.r) > limit + EPS) {
      found = hit.j;
      hi = mid - 1;
    } else lo = hit.j + 1;
  }
  if (found < 0) return null;

  // 2) retroceder al primer carácter de esa línea
  const lineGlyphTop = m.top(rectAt(found)!.r);
  lo = 0;
  hi = found;
  let start = found;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const hit = rectAt(mid);
    if (hit && m.top(hit.r) >= lineGlyphTop - 2) {
      start = Math.min(start, hit.j);
      hi = mid - 1;
    } else lo = mid + 1;
  }
  const startHit = rectAt(start)!;
  const glyphTop = m.top(startHit.r);
  const glyphH = m.bottom(startHit.r) - glyphTop;
  const lineHeight = parseFloat(style.lineHeight) || glyphH;
  const lineTop = Math.max(contentTop, glyphTop - Math.max(0, (lineHeight - glyphH) / 2));
  const first = lineTop <= contentTop + 1;

  const [node, off] = chars.locate(startHit.j);
  const pos = first ? unit.pos + 1 : view.posAtDOM(node, off);
  return { pos, lineTop: first ? contentTop : lineTop, first };
}

/** Decide dónde van los cortes de página (con los espaciadores ocultos = flujo natural). */
function computeBreaks(view: EditorView, config: PaginationConfig): PageBreakSpec[] {
  const { usable } = config;
  if (usable < 40) return [];
  const m = makeMeasure(view);
  const units = collectUnits(view);
  const breaks: PageBreakSpec[] = [];
  let page = 0;
  let pageStart = 0;
  let prev: { unit: Unit; top: number } | null = null;

  const isHeading = (u: Unit | undefined) => u?.kind === 'text' && u.node.type.name === 'heading';

  for (const unit of units) {
    const rect = unit.dom.getBoundingClientRect();
    const top = m.top(rect);
    const bottom = m.bottom(rect);

    if (unit.kind === 'forced') {
      page++;
      breaks.push({ pos: unit.end, kind: 'block', page });
      pageStart = bottom;
      prev = null;
      continue;
    }

    let limit = pageStart + usable;
    if (bottom <= limit + EPS) {
      prev = { unit, top };
      continue;
    }

    if (unit.kind === 'text') {
      // Un párrafo largo puede ocupar varias hojas
      let guard = 0;
      while (bottom > limit + EPS && guard++ < 200) {
        const line = findOverflowLine(view, unit, limit, m);
        if (!line) break;
        // El título no queda huérfano: si cortamos en la primera línea y antes hay un título
        // que no está al inicio de la hoja, el título pasa también a la hoja siguiente.
        if (line.first && prev && isHeading(prev.unit) && prev.top > pageStart + 1) {
          const h = prev.unit as Extract<Unit, { kind: 'text' }>;
          const hLine = findOverflowLine(view, h, prev.top - 1, m) ?? { pos: h.pos + 1, lineTop: prev.top };
          page++;
          breaks.push({ pos: h.pos + 1, kind: 'inline', page });
          pageStart = hLine.lineTop;
        } else {
          if (line.lineTop <= pageStart + 1) break; // una línea más alta que la hoja: no se puede cortar
          page++;
          breaks.push({ pos: line.pos, kind: 'inline', page });
          pageStart = line.lineTop;
        }
        limit = pageStart + usable;
      }
    } else if (top > pageStart + 1) {
      // Fila de tabla, imagen o línea: pasa entera a la hoja siguiente
      page++;
      breaks.push(unit.kind === 'row' ? { pos: unit.pos, kind: 'row', cols: unit.cols, page } : { pos: unit.pos, kind: 'block', page });
      pageStart = top;
    }
    // Si un elemento es más alto que una hoja y ya está arriba, se deja desbordar
    prev = { unit, top };
  }
  return breaks;
}

// ---------------------------------------------------------------------------
// Espaciadores
// ---------------------------------------------------------------------------

function spacerDOM(kind: PageBreakSpec['kind'], page: number, cols = 1) {
  let el: HTMLElement;
  if (kind === 'row') {
    el = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = cols;
    el.appendChild(td);
  } else {
    el = document.createElement(kind === 'inline' ? 'span' : 'div');
  }
  el.className = `we-page-spacer we-page-spacer-${kind}`;
  el.setAttribute('data-we-spacer', kind);
  el.setAttribute('data-page', String(page));
  el.contentEditable = 'false';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

const breakSig = (b: PageBreakSpec) => `${b.kind}:${b.pos}:${b.page}:${b.cols ?? 0}`;

/** Firma de los cortes que existen AHORA en el editor (las decoraciones pueden haberse borrado). */
function currentSig(view: EditorView) {
  const set = paginationKey.getState(view.state);
  if (!set) return '';
  return set
    .find()
    .map((d) => (d.spec.pgSig as string).replace(/^(\w+):\d+/, `$1:${d.from}`))
    .join('|');
}

function buildDecorations(doc: PMNode, breaks: PageBreakSpec[]) {
  return DecorationSet.create(
    doc,
    breaks.map((b) =>
      Decoration.widget(b.pos, () => spacerDOM(b.kind, b.page, b.cols), {
        // El cursor en esta posición se dibuja DESPUÉS del espaciador (en la hoja nueva)
        side: -1,
        ignoreSelection: true,
        key: `pg-${b.kind}-${b.pos}-${b.page}-${b.cols ?? 0}`,
        pgSig: breakSig(b),
      }),
    ),
  );
}

/** Ajusta la altura de cada espaciador para que lo que sigue empiece justo en su hoja. */
function sizeSpacers(view: EditorView, config: PaginationConfig): number {
  const spacers = Array.from(view.dom.querySelectorAll<HTMLElement>('[data-we-spacer]'));
  let lastPage = 0;
  for (const el of spacers) {
    const page = Number(el.getAttribute('data-page')) || 0;
    lastPage = Math.max(lastPage, page);
    const target = page * config.pitch;
    const sizeEl = el.tagName === 'TR' ? (el.firstElementChild as HTMLElement) : el;
    sizeEl.style.height = '0px';
    const m = makeMeasure(view);
    const top = m.top(el.getBoundingClientRect());
    let extra = 0;
    if (el.getAttribute('data-we-spacer') === 'block') {
      const next = el.nextElementSibling as HTMLElement | null;
      if (next) extra = parseFloat(getComputedStyle(next).marginTop) || 0;
    }
    sizeEl.style.height = `${Math.max(0, target - top - extra)}px`;
  }
  const height = view.dom.offsetHeight;
  return Math.max(lastPage + 1, Math.floor(Math.max(0, height - 1) / config.pitch) + 1);
}

// ---------------------------------------------------------------------------
// Flechas arriba/abajo entre hojas
// ---------------------------------------------------------------------------

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * El navegador no sabe cruzar un espaciador no editable con las flechas (salta al final del
 * documento). Si justo debajo/encima de la línea actual hay un corte de página, movemos el
 * cursor nosotros a la misma columna en la primera/última línea de la hoja vecina.
 */
function moveAcrossPage(view: EditorView, dir: 1 | -1, extend: boolean): boolean {
  const sel = view.state.selection;
  if (!(sel instanceof TextSelection)) return false;
  let c: { left: number; top: number; bottom: number };
  try {
    c = view.coordsAtPos(sel.head, dir);
  } catch {
    return false;
  }
  const lineH = Math.max(8, c.bottom - c.top);
  let spacer: HTMLElement | null = null;
  for (const s of Array.from(view.dom.querySelectorAll<HTMLElement>('[data-we-spacer]'))) {
    const r = s.getBoundingClientRect();
    if (!r.height) continue;
    if (dir > 0 && r.top >= c.bottom - 3 && r.top <= c.bottom + lineH * 0.8) spacer = s;
    if (dir < 0 && r.bottom <= c.top + 3 && r.bottom >= c.top - lineH * 0.8) spacer = s;
    if (spacer) break;
  }
  if (!spacer) return false;

  const yFor = () => {
    const r = spacer!.getBoundingClientRect();
    return dir > 0 ? r.bottom + lineH / 2 + 1 : r.top - lineH / 2 - 1;
  };
  // posAtCoords solo funciona con puntos visibles: desplazar si hace falta
  let y = yFor();
  const scroller = scrollParent(view.dom);
  if (scroller) {
    const box = scroller.getBoundingClientRect();
    if (y > box.bottom - lineH) scroller.scrollTop += y - box.bottom + lineH * 3;
    if (y < box.top + lineH) scroller.scrollTop -= box.top - y + lineH * 3;
    y = yFor();
  }
  const hit = view.posAtCoords({ left: c.left, top: y });
  if (!hit) return false;
  const next = extend
    ? TextSelection.create(view.state.doc, sel.anchor, hit.pos)
    : TextSelection.create(view.state.doc, hit.pos);
  view.dispatch(view.state.tr.setSelection(next).scrollIntoView());
  return true;
}

// ---------------------------------------------------------------------------
// Extensión
// ---------------------------------------------------------------------------

export const Pagination = Extension.create({
  name: 'pagination',

  addStorage() {
    return {
      config: { pitch: 0, usable: 0 } as PaginationConfig,
      layout: { pages: 1, pitch: 0 } as PaginationLayout,
      onLayout: undefined as ((layout: PaginationLayout) => void) | undefined,
      relayout: undefined as (() => void) | undefined,
    };
  },

  addCommands() {
    return {
      setPaginationConfig:
        (config) =>
        ({ editor }) => {
          const storage = editor.storage.pagination;
          storage.config = config;
          storage.relayout?.();
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    const view = () => this.editor.view;
    return {
      ArrowDown: () => moveAcrossPage(view(), 1, false),
      ArrowUp: () => moveAcrossPage(view(), -1, false),
      'Shift-ArrowDown': () => moveAcrossPage(view(), 1, true),
      'Shift-ArrowUp': () => moveAcrossPage(view(), -1, true),
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin<DecorationSet>({
        key: paginationKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(paginationKey) as DecorationSet | undefined;
            return meta ?? set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state),
        },
        view(view) {
          let scheduled = false;
          let lastWidth = 0;

          const layout = () => {
            scheduled = false;
            if (!view.dom.isConnected) return;
            const config = storage.config;
            if (!config.pitch || !config.usable) return;

            // 1) Medir en flujo natural: se ocultan los espaciadores un instante (sin repintar)
            const host = view.dom.parentElement ?? view.dom;
            host.classList.add('we-measuring');
            let breaks: PageBreakSpec[] = [];
            try {
              breaks = computeBreaks(view, config);
            } finally {
              host.classList.remove('we-measuring');
            }

            // 2) Actualizar decoraciones solo si cambió dónde cortan las hojas
            const key = breaks.map(breakSig).join('|');
            if (key !== currentSig(view)) {
              const tr = view.state.tr.setMeta(paginationKey, buildDecorations(view.state.doc, breaks));
              tr.setMeta('addToHistory', false);
              view.dispatch(tr);
            }

            // 3) Dar a cada espaciador la altura exacta
            const pages = sizeSpacers(view, config);
            const next: PaginationLayout = { pages, pitch: config.pitch };
            if (next.pages !== storage.layout.pages || next.pitch !== storage.layout.pitch) {
              storage.layout = next;
              storage.onLayout?.(next);
            } else storage.layout = next;
          };

          // Se ejecuta en una microtarea: después de que ProseMirror pinte el cambio y antes
          // de que el navegador muestre el cuadro, así no se ve un salto.
          const schedule = () => {
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(layout);
          };
          storage.relayout = schedule;

          const ro = new ResizeObserver(() => {
            const w = view.dom.offsetWidth;
            if (w !== lastWidth) {
              lastWidth = w;
              schedule();
            }
          });
          ro.observe(view.dom);
          // Imágenes que terminan de cargar cambian la altura
          const onLoad = (e: Event) => (e.target as HTMLElement).tagName === 'IMG' && schedule();
          view.dom.addEventListener('load', onLoad, true);
          document.fonts?.ready.then(schedule);
          schedule();

          return {
            update(v, prevState) {
              if (!prevState.doc.eq(v.state.doc)) schedule();
            },
            destroy() {
              ro.disconnect();
              view.dom.removeEventListener('load', onLoad, true);
              storage.relayout = undefined;
            },
          };
        },
      }),
    ];
  },
});
