'use client';

/**
 * Ejemplo 2 — El editor como un campo de formulario.
 * Al enviar se obtiene el documento (JSON + HTML + configuración de página) y el .docx,
 * y se mandan juntos a tu API con FormData.
 */
import { FormEvent, useRef, useState } from 'react';
import { WordEditor, type WordEditorHandle } from '@/components/word-editor';

export default function FormularioOficio() {
  const editorRef = useRef<WordEditorHandle>(null);
  const [asunto, setAsunto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const editor = editorRef.current;
    if (!editor || editor.editor?.isEmpty) return alert('Escribe el contenido del oficio');

    setEnviando(true);
    try {
      const doc = editor.getDocument(); // { title, json, html, settings }
      const docx = await editor.exportDocx(); // Blob .docx

      const body = new FormData();
      body.append('asunto', asunto);
      body.append('documento', JSON.stringify(doc)); // guárdalo en una columna JSON
      body.append('archivo', docx, `${doc.title}.docx`);

      const res = await fetch('/api/oficios', { method: 'POST', body });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      alert('Oficio enviado');
    } catch (err) {
      alert(`No se pudo enviar: ${err instanceof Error ? err.message : err}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <label htmlFor="asunto">Asunto</label>
      <input id="asunto" required value={asunto} onChange={(e) => setAsunto(e.target.value)} />

      <WordEditor
        ref={editorRef}
        height={680}
        hideTitleBar
        initialValue={{
          title: 'Oficio',
          html: '<p>Señor(a):</p><p></p>',
          // Encabezado institucional y número de página ya configurados
          settings: {
            header: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  attrs: { textAlign: 'center' },
                  content: [{ type: 'text', text: 'GOBIERNO REGIONAL', marks: [{ type: 'bold' }] }],
                },
              ],
            },
            footer: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  attrs: { textAlign: 'right' },
                  content: [
                    { type: 'text', text: 'Página ' },
                    { type: 'pageNumber' },
                    { type: 'text', text: ' de ' },
                    { type: 'pageCount' },
                  ],
                },
              ],
            },
          },
        }}
      />

      <button type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar'}
      </button>
      <button type="button" onClick={() => editorRef.current?.print()}>
        Vista previa / PDF
      </button>
    </form>
  );
}
