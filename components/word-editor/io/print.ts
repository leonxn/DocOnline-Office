/**
 * Impresión "lo que ves es lo que imprimes": se clonan las hojas de la pantalla (con su
 * encabezado, pie, número de página, marca de agua y color) y, en cada una, el tramo del
 * contenido que le corresponde. Así el corte de páginas impreso es idéntico al del editor.
 * Desde el diálogo se puede elegir "Guardar como PDF".
 */
export interface PrintGeometry {
  /** Hojas en pantalla (elementos .we-sheet), en orden. */
  sheets: HTMLElement[];
  /** Contenido del editor (ProseMirror). */
  content: HTMLElement;
  /** Distancia entre el inicio de una hoja y la siguiente, px. */
  pitch: number;
  sheetWidth: number;
  sheetHeight: number;
  /** Caja del contenido dentro de la hoja, px. */
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  usable: number;
  /** Clases extra para la raíz (p. ej. guiones automáticos). */
  rootClass?: string;
  /** Estilos de la raíz (p. ej. el color de los títulos). */
  rootStyle?: string;
}

const STYLE_ID = 'we-print-style';

/**
 * Copia de cada hoja con su tramo de contenido (solo lectura). La usan la impresión y la
 * vista "Múltiples páginas".
 */
export function buildSheetClones(geo: PrintGeometry): HTMLElement[] {
  return geo.sheets.map((sheet, i) => {
    const page = sheet.cloneNode(true) as HTMLElement;
    page.className = `${sheet.className} we-print-sheet`.replace('is-current', '');
    page.removeAttribute('style');
    page.style.cssText = sheet.style.cssText;
    page.style.position = 'relative';
    page.style.top = '0';
    page.style.width = `${geo.sheetWidth}px`;
    page.style.height = `${geo.sheetHeight}px`;
    page.querySelectorAll('.we-vruler, .we-hf-tab, .we-hf-line').forEach((el) => el.remove());
    page.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));

    // Tramo del contenido de esta hoja: se recorta a la caja útil de la página
    const clip = document.createElement('div');
    clip.className = 'we-flow we-print-clip';
    clip.style.cssText = `position:absolute;left:${geo.contentLeft}px;top:${geo.contentTop}px;width:${geo.contentWidth}px;height:${geo.usable + 2}px;overflow:hidden;`;
    const flow = geo.content.cloneNode(true) as HTMLElement;
    flow.removeAttribute('contenteditable');
    flow.style.cssText = `position:absolute;left:0;top:${-i * geo.pitch}px;width:100%;`;
    flow
      .querySelectorAll('.we-search-match, .ProseMirror-selectednode, .selectedCell')
      .forEach((el) => el.classList.remove('we-search-match', 'we-search-current', 'ProseMirror-selectednode', 'selectedCell'));
    flow.querySelectorAll('[data-resize-handle], .column-resize-handle, .ProseMirror-gapcursor').forEach((el) => el.remove());
    clip.appendChild(flow);
    page.appendChild(clip);
    return page;
  });
}

export function printSheets(geo: PrintGeometry, title: string) {
  document.querySelector('.we-print-root')?.remove();
  document.getElementById(STYLE_ID)?.remove();

  const root = document.createElement('div');
  root.className = `we-root we-print-root ${geo.rootClass ?? ''}`;
  root.setAttribute('aria-hidden', 'true');
  if (geo.rootStyle) root.style.cssText = geo.rootStyle;
  buildSheetClones(geo).forEach((page) => root.appendChild(page));

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .we-print-root { display: none; }
    @page { size: ${geo.sheetWidth}px ${geo.sheetHeight}px; margin: 0; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
      body > *:not(.we-print-root) { display: none !important; }
      .we-print-root { display: block !important; }
      .we-print-sheet { box-shadow: none !important; overflow: hidden; break-after: page; page-break-after: always; }
      .we-print-sheet:last-child { break-after: auto; page-break-after: auto; }
      .we-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }`;
  document.head.appendChild(style);
  document.body.appendChild(root);

  const previousTitle = document.title;
  // El título del documento es el nombre que propone "Guardar como PDF"
  document.title = title;
  const cleanup = () => {
    root.remove();
    style.remove();
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 0);
}
