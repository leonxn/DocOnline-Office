import { DEFAULT_FONT, DEFAULT_FONT_SIZE } from './types';

/**
 * Estilos del CONTENIDO del documento. Se usan en pantalla, al imprimir y al exportar HTML,
 * así el documento se ve igual en los tres casos.
 */
export const CONTENT_CSS = `
.we-content {
  font-family: ${DEFAULT_FONT}, Helvetica, sans-serif;
  font-size: ${DEFAULT_FONT_SIZE}pt;
  line-height: 1.15;
  color: #000;
  word-wrap: break-word;
  white-space: pre-wrap;
  tab-size: 4;
  outline: none;
}
.we-content > * + * { margin-top: 0; }
.we-content p { margin: 0 0 8pt; min-height: 1em; }
.we-content p[data-spacing="none"], .we-content h1[data-spacing="none"], .we-content h2[data-spacing="none"],
.we-content h3[data-spacing="none"], .we-content h4[data-spacing="none"] { margin-bottom: 0; }
.we-content h1, .we-content h2, .we-content h3, .we-content h4 { font-weight: 600; color: #1f3a5f; margin: 12pt 0 6pt; line-height: 1.2; }
.we-content h1 { font-size: 20pt; }
.we-content h2 { font-size: 16pt; }
.we-content h3 { font-size: 14pt; }
.we-content h4 { font-size: 12pt; font-style: italic; }
.we-content a { color: #0b57d0; text-decoration: underline; }
.we-content ul, .we-content ol { margin: 0 0 8pt; padding-left: 1.25cm; }
.we-content li > p { margin-bottom: 0; }
.we-content ul[data-type="taskList"] { list-style: none; padding-left: 0.3cm; }
.we-content ul[data-type="taskList"] li { display: flex; gap: 0.5em; align-items: flex-start; }
.we-content ul[data-type="taskList"] li > label { margin-top: 0.15em; user-select: none; }
.we-content ul[data-type="taskList"] li > div { flex: 1; }
.we-content ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; color: #666; }
.we-content blockquote { margin: 0 0 8pt; padding-left: 0.5cm; border-left: 3px solid #c8ccd2; color: #333; font-style: italic; }
.we-content pre { background: #f3f4f6; padding: 8pt; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 10pt; margin: 0 0 8pt; }
.we-content code { font-family: 'Courier New', monospace; background: #f3f4f6; padding: 0 2px; }
.we-content pre code { background: none; padding: 0; }
.we-content hr { border: none; border-top: 1px solid #999; margin: 8pt 0; }
.we-content table { --we-tbl-border: #8c8c8c; border-collapse: collapse; width: 100%; margin: 0 0 8pt; table-layout: fixed; }
.we-content td, .we-content th { border: 1px solid var(--we-tbl-border); padding: 3pt 6pt; vertical-align: top; position: relative; }
.we-content th { background: #f0f2f5; font-weight: 600; text-align: left; }
.we-content td > p, .we-content th > p { margin: 0; }
.we-content tr[data-height] > td, .we-content tr[data-height] > th { height: inherit; }
/* Alineación de la tabla (cuando tiene ancho fijo) */
.we-content table[data-align="center"] { margin-left: auto; margin-right: auto; }
.we-content table[data-align="right"] { margin-left: auto; margin-right: 0; }
/* Bordes */
.we-content table[data-borders="none"] td, .we-content table[data-borders="none"] th { border-color: transparent; }
.we-content table[data-borders="outer"] { border: 1px solid var(--we-tbl-border); }
.we-content table[data-borders="outer"] td, .we-content table[data-borders="outer"] th { border-color: transparent; }
.we-content table[data-borders="inner"] { border-style: hidden; }
.we-content table[data-borders="horizontal"] td, .we-content table[data-borders="horizontal"] th { border-left-color: transparent; border-right-color: transparent; }
/* Estilos de tabla */
.we-content table.we-tbl-plain th { background: transparent; }
.we-content table.we-tbl-header-blue th, .we-content table.we-tbl-banded-blue th { background: #1d5fc4; color: #fff; }
.we-content table.we-tbl-header-dark th { background: #2b2f36; color: #fff; }
.we-content table.we-tbl-banded-blue, .we-content table[data-banded="true"] { --we-band: #e8effb; }
.we-content table.we-tbl-banded-blue tbody tr:nth-child(even of :has(> td)) > td,
.we-content table[data-banded="true"] tbody tr:nth-child(even of :has(> td)) > td { background: var(--we-band); }
.we-content table.we-tbl-minimal td, .we-content table.we-tbl-minimal th { border-left-color: transparent; border-right-color: transparent; }
.we-content table.we-tbl-minimal th { background: transparent; border-bottom: 2px solid #1f2328; }
/* Campos de página: el número lo pone cada hoja con variables CSS */
.we-field { display: inline-block; min-width: 0.6em; }
.we-field-page::after { content: var(--we-page-num, "1"); }
.we-field-pages::after { content: var(--we-page-count, "1"); }
.we-content img { max-width: 100%; height: auto; display: block; margin: 0 0 8pt; }
.we-content img[data-align="center"] { margin-left: auto; margin-right: auto; }
.we-content img[data-align="right"] { margin-left: auto; }
.we-content [data-resize-container]:has(img[data-align="center"]) { justify-content: center; }
.we-content [data-resize-container]:has(img[data-align="right"]) { justify-content: flex-end; }
.we-content [data-resize-wrapper] img { margin: 0; }
.we-content mark { padding: 0; color: inherit; }
.we-content .we-page-break { break-after: page; page-break-after: always; height: 0; }
`;

/** Documento HTML independiente (para exportar e imprimir). */
export function standaloneHtml(opts: { title: string; body: string; extraCss?: string }) {
  const title = opts.title.replace(/[<>&]/g, '');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { margin: 0; background: #fff; }
img { max-width: 100%; }
${CONTENT_CSS}
${opts.extraCss ?? ''}
</style>
</head>
<body><div class="we-content">${opts.body}</div></body>
</html>`;
}
