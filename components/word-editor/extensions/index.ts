import type { Extensions } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { PageCountField, PageNumberField } from './fields';
import { PageBreak } from './page-break';
import { Pagination } from './pagination';
import { ParagraphFormat } from './paragraph-format';
import { SearchReplace } from './search-replace';
import { WordTable, WordTableCell, WordTableHeader, WordTableRow } from './table-ext';

/** Imagen con alineación (izquierda/centro/derecha) además del redimensionado nativo. */
const AlignedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') ?? 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
    };
  },
}).configure({
  allowBase64: true,
  resize: { enabled: true, minWidth: 40, minHeight: 40, alwaysPreserveAspectRatio: true },
});

/**
 * `pagination: false` para editores sin hojas (encabezado y pie de página).
 */
export function buildExtensions(placeholder: string, options: { pagination?: boolean } = {}): Extensions {
  const { pagination = true } = options;
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    WordTable,
    WordTableRow,
    WordTableHeader,
    WordTableCell,
    AlignedImage,
    PageBreak,
    ParagraphFormat,
    SearchReplace,
    ...(pagination ? [Pagination] : []),
    PageNumberField,
    PageCountField,
    CharacterCount,
    Placeholder.configure({ placeholder }),
  ];
}
