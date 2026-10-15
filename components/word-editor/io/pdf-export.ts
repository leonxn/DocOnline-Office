import { buildSheetClones, type PrintGeometry } from './print';

/**
 * Hojas del editor → archivo PDF (sin abrir el diálogo de impresión).
 * Cada hoja se dibuja tal como se ve (con encabezado, pie, tablas, formas y gráficos) y se
 * agrega como una página del PDF del mismo tamaño. Usa `html-to-image` y `jspdf` (MIT), que se
 * cargan solo al exportar.
 */
export async function exportPdf(geo: PrintGeometry, title: string, opts: { pixelRatio?: number; quality?: number } = {}): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const pixelRatio = opts.pixelRatio ?? 2;
  const quality = opts.quality ?? 0.92;

  // Copias de las hojas fuera de la pantalla (las mismas que usa la impresión)
  const root = document.createElement('div');
  root.className = `we-root we-pdf-root ${geo.rootClass ?? ''}`;
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = `${geo.rootStyle ?? ''};position:fixed;left:-${geo.sheetWidth + 200}px;top:0;z-index:-1;pointer-events:none;background:#fff;`;
  const pages = buildSheetClones(geo);
  for (const page of pages) {
    page.style.margin = '0';
    page.style.boxShadow = 'none';
    root.appendChild(page);
  }
  document.body.appendChild(root);

  try {
    await document.fonts?.ready;
    const PT = 72 / 96;
    const w = geo.sheetWidth * PT;
    const h = geo.sheetHeight * PT;
    const orientation = w > h ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation, compress: true });
    pdf.setProperties({ title, creator: 'DocOnline Office' });

    for (let i = 0; i < pages.length; i++) {
      const canvas = await toCanvas(pages[i], {
        pixelRatio,
        backgroundColor: '#ffffff',
        width: geo.sheetWidth,
        height: geo.sheetHeight,
        // Las fuentes del editor son del sistema: no hace falta descargar hojas de estilo externas
        skipFonts: true,
      });
      if (i > 0) pdf.addPage([w, h], orientation);
      pdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, w, h, undefined, 'FAST');
    }
    return pdf.output('blob');
  } finally {
    root.remove();
  }
}
