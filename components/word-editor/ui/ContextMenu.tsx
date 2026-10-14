'use client';

import type { Editor } from '@tiptap/react';
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  ClipboardPaste,
  Columns3,
  Copy,
  PanelBottom,
  PanelTop,
  Scissors,
  TableCellsMerge,
  TableCellsSplit,
  Trash,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { currentTable, distributeColumns, selectTable } from './table-utils';

interface Props {
  x: number;
  y: number;
  editor: Editor;
  onClose: () => void;
  notify: (msg: string) => void;
  onEditHeaderFooter?: (kind: 'header' | 'footer') => void;
}

type Item = { label: string; icon?: ReactNode; hint?: string; disabled?: boolean; run: () => void } | 'sep';

const I = 15;

/** Menú del clic derecho (Mayús + clic derecho abre el del navegador, con la ortografía). */
export function ContextMenu({ x, y, editor, onClose, notify, onEditHeaderFooter }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({ left: Math.min(x, window.innerWidth - width - 8), top: Math.min(y, window.innerHeight - height - 8) });
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onScroll = () => onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const chain = () => editor.chain().focus();
  const clip = (cmd: 'copy' | 'cut') => {
    editor.view.focus();
    if (!document.execCommand(cmd)) notify(`Usa Ctrl+${cmd === 'copy' ? 'C' : 'X'}`);
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      chain().insertContent(text).run();
    } catch {
      notify('El navegador no permitió leer el portapapeles. Usa Ctrl+V.');
    }
  };

  const empty = editor.state.selection.empty;
  const table = currentTable(editor);
  const items: Item[] = [
    { label: 'Cortar', icon: <Scissors size={I} />, hint: 'Ctrl+X', disabled: empty, run: () => clip('cut') },
    { label: 'Copiar', icon: <Copy size={I} />, hint: 'Ctrl+C', disabled: empty, run: () => clip('copy') },
    { label: 'Pegar como texto', icon: <ClipboardPaste size={I} />, hint: 'Ctrl+V', run: paste },
  ];

  if (table) {
    items.push(
      'sep',
      { label: 'Insertar fila arriba', icon: <BetweenHorizontalStart size={I} />, run: () => chain().addRowBefore().run() },
      { label: 'Insertar fila abajo', icon: <BetweenHorizontalEnd size={I} />, run: () => chain().addRowAfter().run() },
      { label: 'Insertar columna a la izquierda', icon: <BetweenVerticalStart size={I} />, run: () => chain().addColumnBefore().run() },
      { label: 'Insertar columna a la derecha', icon: <BetweenVerticalEnd size={I} />, run: () => chain().addColumnAfter().run() },
      'sep',
      { label: 'Combinar celdas', icon: <TableCellsMerge size={I} />, disabled: !editor.can().mergeCells(), run: () => chain().mergeCells().run() },
      { label: 'Dividir celda', icon: <TableCellsSplit size={I} />, disabled: !editor.can().splitCell(), run: () => chain().splitCell().run() },
      { label: 'Distribuir columnas', icon: <Columns3 size={I} />, run: () => distributeColumns(editor, table) },
      'sep',
      { label: 'Alinear celda arriba', icon: <AlignVerticalJustifyStart size={I} />, run: () => chain().setCellAttribute('verticalAlign', 'top').run() },
      { label: 'Alinear celda al centro', icon: <AlignVerticalJustifyCenter size={I} />, run: () => chain().setCellAttribute('verticalAlign', 'middle').run() },
      { label: 'Alinear celda abajo', icon: <AlignVerticalJustifyEnd size={I} />, run: () => chain().setCellAttribute('verticalAlign', 'bottom').run() },
      'sep',
      { label: 'Seleccionar tabla', run: () => selectTable(editor, table) },
      { label: 'Eliminar fila', icon: <Trash size={I} />, run: () => chain().deleteRow().run() },
      { label: 'Eliminar columna', icon: <Trash size={I} />, run: () => chain().deleteColumn().run() },
      { label: 'Eliminar tabla', icon: <Trash size={I} />, run: () => chain().deleteTable().run() },
    );
  }

  if (onEditHeaderFooter) {
    items.push(
      'sep',
      { label: 'Editar encabezado', icon: <PanelTop size={I} />, run: () => onEditHeaderFooter('header') },
      { label: 'Editar pie de página', icon: <PanelBottom size={I} />, run: () => onEditHeaderFooter('footer') },
    );
  }

  return (
    <div ref={ref} className="we-context-menu we-popover" role="menu" style={{ position: 'fixed', ...pos }}>
      {items.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="we-menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className="we-menu-item"
            disabled={item.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClose();
              item.run();
            }}
          >
            <span className="we-menu-icon">{item.icon}</span>
            <span className="we-menu-text">{item.label}</span>
            {item.hint && <span className="we-menu-hint">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
