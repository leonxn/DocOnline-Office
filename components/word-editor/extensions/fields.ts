import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Campos de "Número de página" y "Total de páginas" (como los campos PAGE y NUMPAGES de Word).
 * El nodo no guarda el número: se pinta con CSS a partir de las variables `--we-page-num` y
 * `--we-page-count` de cada hoja, así el mismo encabezado muestra 1, 2, 3… en cada página.
 */
function createField(name: 'pageNumber' | 'pageCount', field: 'page' | 'pages', label: string) {
  return Node.create({
    name,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    parseHTML() {
      return [{ tag: `span[data-field="${field}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(HTMLAttributes, { 'data-field': field, class: `we-field we-field-${field}`, title: label }),
      ];
    },

    renderText() {
      return '#';
    },
  });
}

export const PageNumberField = createField('pageNumber', 'page', 'Número de página');
export const PageCountField = createField('pageCount', 'pages', 'Total de páginas');
