import type { Node as PMNode } from '@tiptap/pm/model';
import { Table, TableCell, TableHeader, TableRow, TableView } from '@tiptap/extension-table';

/**
 * Tablas con opciones tipo Word: estilo, bordes, color de borde, alineación de la tabla,
 * filas con bandas, sombreado y alineación vertical de celdas, y alto de fila.
 */

export type TableStyleId = 'grid' | 'plain' | 'header-blue' | 'header-dark' | 'banded-blue' | 'minimal';
export type TableBorders = 'all' | 'outer' | 'inner' | 'horizontal' | 'none';

export const TABLE_STYLES: { id: TableStyleId; label: string }[] = [
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'plain', label: 'Simple' },
  { id: 'header-blue', label: 'Encabezado azul' },
  { id: 'header-dark', label: 'Encabezado oscuro' },
  { id: 'banded-blue', label: 'Bandas azules' },
  { id: 'minimal', label: 'Minimalista' },
];

/** Atributos de la tabla que se reflejan en el DOM (pantalla, impresión y HTML exportado). */
function tableDomAttrs(attrs: Record<string, any>) {
  const out: Record<string, string> = {
    class: `we-tbl we-tbl-${attrs.tableStyle ?? 'grid'}`,
    'data-borders': attrs.borders ?? 'all',
    'data-align': attrs.align ?? 'left',
  };
  if (attrs.banded) out['data-banded'] = 'true';
  return out;
}

/** La vista de Tiptap solo aplica atributos al crearse: esta los actualiza en cada cambio. */
class StyledTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number, view?: any, HTMLAttributes?: Record<string, any>) {
    super(node, cellMinWidth, view, HTMLAttributes);
    this.applyAttrs(node);
  }

  update(node: PMNode) {
    const ok = super.update(node);
    if (ok) this.applyAttrs(node);
    return ok;
  }

  private applyAttrs(node: PMNode) {
    const attrs = tableDomAttrs(node.attrs);
    this.table.className = attrs.class;
    this.table.setAttribute('data-borders', attrs['data-borders']);
    this.table.setAttribute('data-align', attrs['data-align']);
    if (attrs['data-banded']) this.table.setAttribute('data-banded', 'true');
    else this.table.removeAttribute('data-banded');
    if (node.attrs.borderColor) this.table.style.setProperty('--we-tbl-border', node.attrs.borderColor);
    else this.table.style.removeProperty('--we-tbl-border');
    this.dom.setAttribute('data-align', attrs['data-align']);
  }
}

export const WordTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableStyle: {
        default: 'grid',
        parseHTML: (el) => el.className.match(/we-tbl-([\w-]+)/)?.[1] ?? 'grid',
        renderHTML: () => ({}),
      },
      borders: { default: 'all', parseHTML: (el) => el.getAttribute('data-borders') ?? 'all', renderHTML: () => ({}) },
      align: { default: 'left', parseHTML: (el) => el.getAttribute('data-align') ?? 'left', renderHTML: () => ({}) },
      banded: { default: false, parseHTML: (el) => el.getAttribute('data-banded') === 'true', renderHTML: () => ({}) },
      borderColor: {
        default: null,
        parseHTML: (el) => el.style.getPropertyValue('--we-tbl-border') || null,
        renderHTML: (attrs) => (attrs.borderColor ? { style: `--we-tbl-border: ${attrs.borderColor}` } : {}),
      },
    };
  },
  renderHTML(props) {
    const spec = this.parent!(props) as unknown as any[];
    // spec = ['table', attrs, colgroup, tbody]; añadimos clases y data-* calculados
    const domAttrs = tableDomAttrs(props.node.attrs);
    spec[1] = { ...spec[1], ...domAttrs, class: [spec[1]?.class, domAttrs.class].filter(Boolean).join(' ') };
    return spec as any;
  },
}).configure({ resizable: true, cellMinWidth: 40, View: StyledTableView as any });

const cellAttributes = {
  backgroundColor: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-bg') || el.style.backgroundColor || null,
    renderHTML: (attrs: Record<string, any>) =>
      attrs.backgroundColor ? { 'data-bg': attrs.backgroundColor, style: `background-color: ${attrs.backgroundColor}` } : {},
  },
  verticalAlign: {
    default: 'top',
    parseHTML: (el: HTMLElement) => el.style.verticalAlign || 'top',
    renderHTML: (attrs: Record<string, any>) =>
      attrs.verticalAlign && attrs.verticalAlign !== 'top' ? { style: `vertical-align: ${attrs.verticalAlign}` } : {},
  },
};

export const WordTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});

export const WordTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});

export const WordTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /** Alto mínimo de la fila en cm. */
      height: {
        default: null,
        parseHTML: (el) => {
          const h = parseFloat(el.getAttribute('data-height') ?? '');
          return Number.isFinite(h) ? h : null;
        },
        renderHTML: (attrs) => (attrs.height ? { 'data-height': attrs.height, style: `height: ${attrs.height}cm` } : {}),
      },
    };
  },
});
