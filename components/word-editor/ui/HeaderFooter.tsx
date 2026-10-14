'use client';

import { getHTMLFromFragment, type Extensions } from '@tiptap/core';
import { Node as PMNode, type Schema } from '@tiptap/pm/model';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect, useMemo, type CSSProperties } from 'react';
import { isHeaderFooterEmpty, type HeaderFooterContent, type HeaderFooterKind } from '../types';

/**
 * HTML de un encabezado/pie a partir de su JSON. Se genera con el esquema del editor,
 * así solo salen etiquetas y atributos permitidos (no se inyecta HTML arbitrario).
 */
export function useHeaderFooterHtml(schema: Schema | undefined, content: HeaderFooterContent) {
  return useMemo(() => {
    if (!schema || !content || isHeaderFooterEmpty(content)) return '';
    try {
      return getHTMLFromFragment(PMNode.fromJSON(schema, content).content, schema);
    } catch {
      return '';
    }
  }, [schema, content]);
}

interface StaticProps {
  schema: Schema | undefined;
  content: HeaderFooterContent;
  kind: HeaderFooterKind;
  style: CSSProperties;
  dimmed?: boolean;
}

/** Encabezado/pie de una hoja que no se está editando. */
export function StaticHeaderFooter({ schema, content, kind, style, dimmed }: StaticProps) {
  const html = useHeaderFooterHtml(schema, content);
  return (
    <div
      className={`we-hf-box we-hf-${kind} we-content ${dimmed ? 'is-dimmed' : ''} ${html ? '' : 'is-empty'}`}
      data-kind={kind}
      style={style}
      // El HTML viene de getHTMLFromFragment con el esquema del editor (ver arriba)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface EditorProps {
  extensions: Extensions;
  content: HeaderFooterContent;
  kind: HeaderFooterKind;
  style: CSSProperties;
  onChange: (content: HeaderFooterContent) => void;
  onEditor: (editor: Editor | null) => void;
}

/** Editor enriquecido del encabezado/pie (texto con formato, imágenes, tablas, campos). */
export function HeaderFooterEditor({ extensions, content, kind, style, onChange, onEditor }: EditorProps) {
  const editor = useEditor({
    extensions,
    content: content ?? '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'we-content',
        lang: 'es',
        'aria-label': kind === 'header' ? 'Encabezado' : 'Pie de página',
      },
    },
    onCreate: ({ editor }) => editor.commands.focus('end'),
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onChange(isHeaderFooterEmpty(json) ? null : json);
    },
  });

  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);

  return (
    <div className={`we-hf-box we-hf-${kind} is-editing`} data-kind={kind} style={style}>
      <EditorContent editor={editor} />
    </div>
  );
}
