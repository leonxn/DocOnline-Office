'use client';

/**
 * Ejemplo 4 — Mostrar un documento guardado sin permitir editarlo.
 * Se ven las hojas con encabezado, pie y números de página; se puede imprimir (Ctrl+P),
 * buscar (Ctrl+F) y hacer zoom, pero no modificar.
 */
import { WordEditor, type WordDocument } from '@/components/word-editor';

export default function VisorDocumento({ documento }: { documento: WordDocument }) {
  return (
    <div style={{ height: '80vh' }}>
      <WordEditor initialValue={documento} readOnly />
    </div>
  );
}
