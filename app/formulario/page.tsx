'use client';

import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { WordEditor, type WordEditorHandle } from '@/components/word-editor';

/**
 * Ejemplo: el editor como un campo más de un formulario.
 * Al enviar se obtiene el documento (JSON + HTML) y, si se quiere, el .docx generado.
 */
export default function FormularioPage() {
  const editorRef = useRef<WordEditorHandle>(null);
  const [asunto, setAsunto] = useState('');
  const [result, setResult] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const doc = editorRef.current!.getDocument();
    if (editorRef.current!.editor?.isEmpty) {
      setResult('Escribe el contenido del oficio antes de enviar.');
      return;
    }
    const docx = await editorRef.current!.exportDocx();
    // Aquí enviarías a tu API, por ejemplo:
    // const body = new FormData();
    // body.append('asunto', asunto);
    // body.append('contenido', JSON.stringify(doc.json));
    // body.append('archivo', docx, `${doc.title}.docx`);
    // await fetch('/api/tramites', { method: 'POST', body });
    setResult(
      `Listo para enviar: asunto "${asunto}", ${doc.html.length.toLocaleString('es-PE')} caracteres de HTML y un .docx de ${(docx.size / 1024).toFixed(1)} KB.`,
    );
  }

  return (
    <form className="demo-form" onSubmit={onSubmit}>
      <p><Link href="/">← Editor completo</Link></p>
      <h1>Nuevo oficio</h1>
      <p className="lead">El editor funciona como un campo del formulario.</p>

      <div className="demo-field">
        <label htmlFor="asunto">Asunto</label>
        <input id="asunto" required value={asunto} onChange={(e) => setAsunto(e.target.value)} />
      </div>

      <div className="demo-field">
        <span className="demo-label">Contenido</span>
        <WordEditor
          ref={editorRef}
          height={640}
          hideTitleBar
          initialValue={{ title: 'Oficio', html: '<p>Señor(a):</p><p></p>' }}
        />
      </div>

      <div className="demo-actions">
        <button type="submit" className="primary">Enviar</button>
        <button type="button" onClick={() => editorRef.current?.print()}>Vista previa / PDF</button>
      </div>
      {result && <div className="demo-result" role="status">{result}</div>}
    </form>
  );
}
