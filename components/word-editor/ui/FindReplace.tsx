'use client';

import type { Editor } from '@tiptap/react';
import { CaseSensitive, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EditorUiState } from './editor-state';

interface Props {
  editor: Editor;
  s: EditorUiState;
  mode: 'find' | 'replace';
  onMode: (mode: 'find' | 'replace') => void;
  onClose: () => void;
}

export function FindReplace({ editor, s, mode, onMode, onClose }: Props) {
  const [term, setTerm] = useState(() => {
    const { from, to, empty } = editor.state.selection;
    return empty ? s.searchTerm : editor.state.doc.textBetween(from, to, ' ').slice(0, 100);
  });
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [mode]);

  useEffect(() => {
    editor.commands.setSearchTerm(term);
  }, [editor, term]);

  useEffect(() => {
    editor.commands.setSearchCaseSensitive(caseSensitive);
  }, [editor, caseSensitive]);

  // Al cerrar se limpia el resaltado
  useEffect(() => () => void editor.commands.clearSearch(), [editor]);

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const counter = !term ? '' : s.searchCount ? `${s.searchIndex + 1} de ${s.searchCount}` : 'Sin resultados';

  return (
    <div
      className="we-find"
      role="dialog"
      aria-label={mode === 'find' ? 'Buscar' : 'Buscar y reemplazar'}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div className="we-find-row">
        <button
          type="button"
          className="we-icon-btn"
          aria-label={mode === 'find' ? 'Mostrar reemplazar' : 'Ocultar reemplazar'}
          aria-expanded={mode === 'replace'}
          onClick={() => onMode(mode === 'find' ? 'replace' : 'find')}
        >
          {mode === 'replace' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <input
          ref={inputRef}
          aria-label="Buscar"
          placeholder="Buscar en el documento"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) editor.commands.previousSearchResult();
              else editor.commands.nextSearchResult();
            }
          }}
        />
        <span className="we-find-count" aria-live="polite">{counter}</span>
        <button
          type="button"
          className={`we-icon-btn ${caseSensitive ? 'is-active' : ''}`}
          aria-label="Coincidir mayúsculas y minúsculas"
          aria-pressed={caseSensitive}
          data-tip="Coincidir mayúsculas y minúsculas"
          onClick={() => setCaseSensitive((v) => !v)}
        >
          <CaseSensitive size={16} />
        </button>
        <button type="button" className="we-icon-btn" aria-label="Anterior" data-tip="Anterior (Mayús+Enter)" disabled={!s.searchCount} onClick={() => editor.commands.previousSearchResult()}>
          <ChevronUp size={16} />
        </button>
        <button type="button" className="we-icon-btn" aria-label="Siguiente" data-tip="Siguiente (Enter)" disabled={!s.searchCount} onClick={() => editor.commands.nextSearchResult()}>
          <ChevronDown size={16} />
        </button>
        <button type="button" className="we-icon-btn" aria-label="Cerrar" onClick={close}>
          <X size={16} />
        </button>
      </div>
      {mode === 'replace' && (
        <div className="we-find-row we-find-replace">
          <input
            aria-label="Reemplazar con"
            placeholder="Reemplazar con"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                editor.commands.replaceCurrent(replacement);
              }
            }}
          />
          <button type="button" disabled={!s.searchCount} onClick={() => editor.commands.replaceCurrent(replacement)}>
            Reemplazar
          </button>
          <button type="button" disabled={!s.searchCount} onClick={() => editor.commands.replaceAll(replacement)}>
            Todo
          </button>
        </div>
      )}
    </div>
  );
}
