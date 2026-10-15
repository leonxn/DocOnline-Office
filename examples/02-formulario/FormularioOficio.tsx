'use client';

/**
 * Ejemplo 2 — El editor como un campo de formulario.
 * Con `name="documento"`, al enviar el formulario el documento se genera en Word o PDF y viaja
 * como archivo en ese campo. `includeJson` agrega `documento_json` para volver a editarlo.
 */
import { FormEvent, useState } from 'react';
import { WordEditor } from '@/components/word-editor'; // en tu proyecto: from 'doconline-office'

export default function FormularioOficio() {
  const [asunto, setAsunto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    try {
      // Ya incluye: asunto, documento (archivo .pdf) y documento_json
      const body = new FormData(e.currentTarget);
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
      <input id="asunto" name="asunto" required value={asunto} onChange={(e) => setAsunto(e.target.value)} />

      <WordEditor
        name="documento"
        formFormat="pdf" // o 'docx', o ['docx', 'pdf']
        fileName={asunto || 'Oficio'}
        includeJson
        required
        height={680}
        hideTitleBar
        initialValue={{
          title: 'Oficio',
          html: '<p>Señor(a):</p><p></p>',
          // Encabezado y número de página ya configurados
          settings: {
            header: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  attrs: { textAlign: 'center' },
                  content: [{ type: 'text', text: 'MI EMPRESA S.A.C.', marks: [{ type: 'bold' }] }],
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
    </form>
  );
}
