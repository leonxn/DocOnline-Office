/**
 * .docx → HTML con mammoth (BSD-2). Conserva estructura: títulos, negrita/cursiva/subrayado,
 * listas, tablas, enlaces e imágenes. No conserva fuentes, tamaños ni colores exactos.
 */
export async function docxToHtml(arrayBuffer: ArrayBuffer): Promise<{ html: string; warnings: string[] }> {
  const mammoth = (await import('mammoth')).default;
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Título'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Subtítulo'] => h2:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Cita'] => blockquote:fresh",
        "p[style-name='No Spacing'] => p.no-spacing:fresh",
        "p[style-name='Sin espaciado'] => p.no-spacing:fresh",
        'u => u',
        'strike => s',
        "br[type='page'] => hr.we-docx-page-break",
      ],
    },
  );
  const html = result.value
    .replace(/<p class="no-spacing">/g, '<p data-spacing="none">')
    // Los saltos de página de Word llegan dentro de un párrafo: los sacamos como bloque propio
    .replace(/<hr class="we-docx-page-break" ?\/?>/g, '</p><div data-page-break=""></div><p>')
    .replace(/<p><\/p>(?=<div data-page-break)/g, '')
    .replace(/(<div data-page-break=""><\/div>)<p><\/p>/g, '$1');
  return { html, warnings: result.messages.map((m) => m.message) };
}
