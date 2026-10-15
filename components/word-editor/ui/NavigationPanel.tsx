'use client';

import type { Editor } from '@tiptap/react';
import { PanelLeftClose } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Heading {
  pos: number;
  level: number;
  text: string;
}

function readHeadings(editor: Editor): Heading[] {
  const out: Heading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      out.push({ pos, level: node.attrs.level as number, text: node.textContent.trim() || '(sin texto)' });
      return false;
    }
    return true;
  });
  return out;
}

/** Panel "Títulos" (navegación): lista los títulos del documento y lleva a cada uno. */
export function NavigationPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [headings, setHeadings] = useState<Heading[]>(() => readHeadings(editor));
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setHeadings(readHeadings(editor));
    const track = () => {
      const pos = editor.state.selection.from;
      const list = readHeadings(editor);
      let active: number | null = null;
      for (const h of list) if (h.pos <= pos) active = h.pos;
      setCurrent(active);
    };
    editor.on('update', refresh);
    editor.on('selectionUpdate', track);
    track();
    return () => {
      editor.off('update', refresh);
      editor.off('selectionUpdate', track);
    };
  }, [editor]);

  const go = (h: Heading) => {
    editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run();
    // Llevar el título hacia la parte de arriba de la vista
    requestAnimationFrame(() => {
      const dom = editor.view.nodeDOM(h.pos) as HTMLElement | null;
      dom?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  return (
    <aside className="we-side we-side-left" aria-label="Títulos">
      <div className="we-side-head">
        <strong>Títulos</strong>
        <button type="button" className="we-icon-btn" aria-label="Cerrar panel" data-tip="Cerrar" onClick={onClose}>
          <PanelLeftClose size={16} />
        </button>
      </div>
      {headings.length ? (
        <nav className="we-nav-list">
          {headings.map((h) => (
            <button
              key={h.pos}
              type="button"
              className={`we-nav-item ${current === h.pos ? 'is-active' : ''}`}
              style={{ paddingLeft: 10 + (h.level - 1) * 14 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(h)}
              title={h.text}
            >
              <span className={`we-nav-text we-nav-l${h.level}`}>{h.text}</span>
            </button>
          ))}
        </nav>
      ) : (
        <p className="we-side-empty">
          No hay títulos en el documento. Aplica un estilo de título (Título 1–4) al texto para que aparezca aquí.
        </p>
      )}
    </aside>
  );
}
