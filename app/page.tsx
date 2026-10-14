'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WordEditor, type WordDocument } from '@/components/word-editor';

const STORAGE_KEY = 'editor-documentos:borrador';

const SAMPLE = `
<h1>Informe de ejemplo</h1>
<p>Este editor funciona como un procesador de textos: <strong>negrita</strong>, <em>cursiva</em>,
<u>subrayado</u>, <span style="color: #c00000">colores</span>, <mark data-color="#ffff00" style="background-color: #ffff00">resaltado</mark>,
fuentes y tamaños, listas, tablas, imágenes, encabezado y pie de página.</p>
<h2>Lista de pendientes</h2>
<ul><li><p>Revisar presupuesto</p></li><li><p>Enviar propuesta</p></li></ul>
<table><tbody>
<tr><th><p>Producto</p></th><th><p>Cantidad</p></th><th><p>Precio</p></th></tr>
<tr><td><p>Laptop</p></td><td><p>2</p></td><td><p>S/ 3 500</p></td></tr>
<tr><td><p>Monitor</p></td><td><p>4</p></td><td><p>S/ 800</p></td></tr>
</tbody></table>
<p>Prueba <strong>Archivo → Descargar como Word</strong> para obtener el .docx.</p>
`;

/** Demo: editor a pantalla completa con borrador guardado en el navegador. */
export default function Home() {
  const [initial, setInitial] = useState<Partial<WordDocument> | string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setInitial(saved ? (JSON.parse(saved) as WordDocument) : SAMPLE);
    } catch {
      setInitial(SAMPLE);
    }
  }, []);

  const save = (doc: WordDocument) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: doc.title, json: doc.json, settings: doc.settings }));
    } catch {
      // Sin almacenamiento (modo privado): el borrador no se conserva
    }
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <nav className="demo-nav">
        <strong>DocOnline Office</strong>
        <Link href="/formulario">Ejemplo en un formulario</Link>
      </nav>
      <div style={{ flex: 1, minHeight: 0, padding: '0 8px 8px' }}>
        {initial !== null && <WordEditor initialValue={initial} onChange={save} onSave={save} />}
      </div>
    </div>
  );
}
