'use client';

/**
 * Ejemplo 3 — Abrir y guardar un documento en tu API.
 * - Carga el documento guardado (GET).
 * - Guarda con el botón Guardar o Ctrl+S (PUT).
 * - Autoguardado: `onChange` llega con 400 ms de espera; aquí se guarda cada 5 s como máximo.
 *
 * El backend solo tiene que guardar y devolver el objeto `WordDocument` tal cual
 * (ver `route.ts` en esta misma carpeta, o `../05-backend-nestjs`).
 */
import { useEffect, useRef, useState } from 'react';
import { WordEditor, type WordDocument } from '@/components/word-editor';

export default function EditorConGuardado({ documentoId }: { documentoId: string }) {
  const [inicial, setInicial] = useState<WordDocument | null>(null);
  const [error, setError] = useState<string>();
  const ultimoGuardado = useRef(0);

  useEffect(() => {
    fetch(`/api/documentos/${documentoId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`))))
      .then(setInicial)
      .catch((e) => setError(e.message));
  }, [documentoId]);

  async function guardar(doc: WordDocument) {
    const res = await fetch(`/api/documentos/${documentoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // `html` es opcional: sirve para mostrar el documento sin el editor
      body: JSON.stringify({ title: doc.title, json: doc.json, html: doc.html, settings: doc.settings }),
    });
    if (!res.ok) throw new Error(`Error ${res.status}`); // el editor muestra el error
    ultimoGuardado.current = Date.now();
  }

  if (error) return <p role="alert">No se pudo abrir el documento: {error}</p>;
  if (!inicial) return <p>Cargando…</p>;

  return (
    <div style={{ height: '100vh' }}>
      <WordEditor
        initialValue={inicial}
        onSave={guardar}
        onChange={(doc) => {
          if (Date.now() - ultimoGuardado.current > 5000) guardar(doc).catch(() => {});
        }}
      />
    </div>
  );
}
