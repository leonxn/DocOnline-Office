'use client';

/**
 * Ejemplo 1 — El uso más simple.
 * El editor ocupa todo el alto de su contenedor; Ctrl+S descarga el .docx.
 */
import { WordEditor } from '@/components/word-editor';

export default function EditorBasico() {
  return (
    <div style={{ height: '100vh' }}>
      <WordEditor initialValue="<h1>Mi documento</h1><p>Empieza a escribir…</p>" />
    </div>
  );
}
