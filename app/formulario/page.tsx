'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { WordEditor, type FormFileFormat } from '@/components/word-editor';

interface Sent {
  asunto: string;
  files: { name: string; size: number; url: string }[];
  json: boolean;
}

/**
 * Ejemplo: el editor como un campo más de un formulario.
 * Con `name="documento"`, al enviar el formulario el documento se genera en Word o PDF y viaja
 * como archivo en ese campo: `new FormData(form).get('documento')` es un `File`.
 */
export default function FormularioPage() {
  const [asunto, setAsunto] = useState('');
  const [formato, setFormato] = useState<'docx' | 'pdf' | 'ambos'>('docx');
  const [sent, setSent] = useState<Sent>();

  const formFormat: FormFileFormat | FormFileFormat[] = formato === 'ambos' ? ['docx', 'pdf'] : formato;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const files = data.getAll('documento').filter((v): v is File => v instanceof File && v.size > 0);
    // En tu aplicación enviarías el formulario tal cual a tu API:
    // await fetch('/api/tramites', { method: 'POST', body: data });
    sent?.files.forEach((f) => URL.revokeObjectURL(f.url));
    setSent({
      asunto: String(data.get('asunto') ?? ''),
      files: files.map((f) => ({ name: f.name, size: f.size, url: URL.createObjectURL(f) })),
      json: !!data.get('documento_json'),
    });
  }

  return (
    <form className="demo-form" onSubmit={onSubmit}>
      <p><Link href="/">← Editor completo</Link></p>
      <h1>Nuevo oficio</h1>
      <p className="lead">
        El editor funciona como un campo del formulario: al enviar, el documento se adjunta como archivo Word o PDF.
      </p>

      <div className="demo-field">
        <label htmlFor="asunto">Asunto</label>
        <input id="asunto" name="asunto" required value={asunto} onChange={(e) => setAsunto(e.target.value)} />
      </div>

      <div className="demo-field">
        <label htmlFor="formato">Enviar el documento como</label>
        <select id="formato" value={formato} onChange={(e) => setFormato(e.target.value as typeof formato)}>
          <option value="docx">Word (.docx)</option>
          <option value="pdf">PDF</option>
          <option value="ambos">Word y PDF</option>
        </select>
      </div>

      <div className="demo-field">
        <span className="demo-label">Contenido</span>
        <WordEditor
          name="documento"
          formFormat={formFormat}
          fileName={asunto ? `Oficio - ${asunto}` : 'Oficio'}
          includeJson
          required
          height={640}
          hideTitleBar
          initialValue={{ title: 'Oficio', html: '<p>Señor(a):</p><p></p>' }}
        />
      </div>

      <div className="demo-actions">
        <button type="submit" className="primary">Enviar</button>
      </div>

      {sent && (
        <div className="demo-result" role="status">
          <p>
            Formulario listo para enviar: asunto «{sent.asunto}»{sent.json ? ' y el documento editable (documento_json)' : ''}. Archivos en el
            campo <code>documento</code>:
          </p>
          <ul>
            {sent.files.map((f) => (
              <li key={f.url}>
                <a href={f.url} download={f.name}>{f.name}</a> ({(f.size / 1024).toFixed(1)} KB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
