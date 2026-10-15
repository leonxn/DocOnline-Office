import type { Editor } from '@tiptap/react';
import { standaloneHtml } from '../content-styles';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Quita la extensión y caracteres no válidos en nombres de archivo. */
export function safeFileName(title: string, ext: string) {
  const base = title.replace(/\.(docx|html?|txt|pdf)$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'documento';
  return `${base}.${ext}`;
}

export function exportHtml(editor: Editor, title: string, headingColor = '#1f3a5f') {
  const html = standaloneHtml({
    title,
    body: editor.getHTML(),
    extraCss: `body { max-width: 21cm; margin: 2cm auto; padding: 0 1cm; } .we-content { --we-heading-color: ${headingColor}; }`,
  });
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), safeFileName(title, 'html'));
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Abre .docx, .html o .txt y devuelve HTML listo para `editor.commands.setContent`. */
export async function importFile(file: File): Promise<{ html: string; warnings: string[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    const { docxToHtml } = await import('./docx-import');
    return docxToHtml(await file.arrayBuffer());
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const parsed = new DOMParser().parseFromString(await file.text(), 'text/html');
    const content = parsed.querySelector('.we-content') ?? parsed.body;
    return { html: content.innerHTML, warnings: [] };
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = await file.text();
    const html = text
      .split(/\r?\n/)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
    return { html, warnings: [] };
  }
  throw new Error('Formato no soportado. Usa .docx, .html o .txt');
}
