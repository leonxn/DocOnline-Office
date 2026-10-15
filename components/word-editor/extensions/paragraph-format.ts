import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphFormat: {
      /** Interlineado del párrafo (1, 1.15, 1.5, 2…). `null` vuelve al valor por defecto. */
      setLineSpacing: (value: string | null) => ReturnType;
      /** `none` = estilo "Sin espacio" (sin espacio después del párrafo). */
      setParagraphSpacing: (value: 'none' | null) => ReturnType;
      /** Color de fondo (sombreado) del párrafo completo. */
      setParagraphShading: (color: string | null) => ReturnType;
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
      /** Sangrías en cm (desde la regla). `indent` es el nivel de sangría izquierda (× 1,25 cm). */
      setParagraphIndents: (values: { indent?: number; firstLine?: number; indentRight?: number }) => ReturnType;
      /** Espacio antes/después del párrafo en pt (`null` = el del estilo). */
      setParagraphSpaces: (values: { spaceBefore?: number | null; spaceAfter?: number | null }) => ReturnType;
      /** Letra capital: `drop` = en el texto, `margin` = en el margen, `null` = ninguna. */
      setDropCap: (value: 'drop' | 'margin' | null) => ReturnType;
      /** Quita interlineado, sangría, sombreado y espaciado del párrafo. */
      resetParagraphFormat: () => ReturnType;
    };
  }
}

const BLOCK_TYPES = ['paragraph', 'heading'];
const MAX_INDENT = 10;
/** Cada nivel de sangría equivale a 1,25 cm, como en Word. */
export const INDENT_STEP_CM = 1.25;

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  // Menor prioridad que listas y tablas para que su Tab se ejecute primero
  priority: 50,

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          lineSpacing: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (attrs) => (attrs.lineSpacing ? { style: `line-height: ${attrs.lineSpacing}` } : {}),
          },
          indent: {
            default: 0,
            parseHTML: (el) => {
              const fromData = Number(el.getAttribute('data-indent'));
              if (fromData) return fromData;
              const cm = parseMarginCm(el.style.marginLeft);
              return cm ? Math.min(MAX_INDENT, Math.round(cm / INDENT_STEP_CM)) : 0;
            },
            renderHTML: (attrs) =>
              attrs.indent
                ? { 'data-indent': attrs.indent, style: `margin-left: ${attrs.indent * INDENT_STEP_CM}cm` }
                : {},
          },
          firstLine: {
            default: 0,
            parseHTML: (el) => Math.round(parseMarginCm(el.style.textIndent, true) * 100) / 100,
            renderHTML: (attrs) => (attrs.firstLine ? { style: `text-indent: ${attrs.firstLine}cm` } : {}),
          },
          indentRight: {
            default: 0,
            parseHTML: (el) => Math.round(parseMarginCm(el.style.marginRight) * 100) / 100,
            renderHTML: (attrs) => (attrs.indentRight ? { style: `margin-right: ${attrs.indentRight}cm` } : {}),
          },
          spaceBefore: {
            default: null,
            parseHTML: (el) => (el.style.marginTop ? parseMarginPt(el.style.marginTop) : null),
            renderHTML: (attrs) => (attrs.spaceBefore != null ? { style: `margin-top: ${attrs.spaceBefore}pt` } : {}),
          },
          spaceAfter: {
            default: null,
            parseHTML: (el) => (el.style.marginBottom ? parseMarginPt(el.style.marginBottom) : null),
            renderHTML: (attrs) => (attrs.spaceAfter != null ? { style: `margin-bottom: ${attrs.spaceAfter}pt` } : {}),
          },
          spacing: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-spacing'),
            renderHTML: (attrs) => (attrs.spacing ? { 'data-spacing': attrs.spacing } : {}),
          },
          shading: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-shading'),
            renderHTML: (attrs) =>
              attrs.shading ? { 'data-shading': attrs.shading, style: `background-color: ${attrs.shading}` } : {},
          },
        },
      },
      {
        types: ['paragraph'],
        attributes: {
          dropCap: {
            default: null,
            // Como en Word, el párrafo nuevo (Enter) no hereda la letra capital
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-dropcap'),
            renderHTML: (attrs) => (attrs.dropCap ? { 'data-dropcap': attrs.dropCap } : {}),
          },
        },
      },
      {
        types: ['bulletList'],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (el) => el.style.listStyleType || null,
            renderHTML: (attrs) => (attrs.listStyle ? { style: `list-style-type: ${attrs.listStyle}` } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    const updateBlocks =
      (attrs: Record<string, unknown>) =>
      ({ commands }: { commands: any }) =>
        BLOCK_TYPES.map((type) => commands.updateAttributes(type, attrs)).some(Boolean);

    const shiftIndent =
      (delta: number) =>
      ({ state, tr, dispatch }: any) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (!BLOCK_TYPES.includes(node.type.name)) return;
          const indent = Math.max(0, Math.min(MAX_INDENT, (node.attrs.indent ?? 0) + delta));
          if (indent !== node.attrs.indent) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };

    return {
      setLineSpacing: (value) => updateBlocks({ lineSpacing: value }),
      setParagraphSpacing: (value) => updateBlocks({ spacing: value }),
      setParagraphShading: (color) => updateBlocks({ shading: color }),
      setParagraphIndents: (values) => updateBlocks(values),
      setParagraphSpaces: (values) => updateBlocks(values),
      setDropCap:
        (value) =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { dropCap: value }),
      resetParagraphFormat: () =>
        updateBlocks({
          lineSpacing: null,
          spacing: null,
          shading: null,
          indent: 0,
          firstLine: 0,
          indentRight: 0,
          spaceBefore: null,
          spaceAfter: null,
        }),
      increaseIndent:
        () =>
        ({ editor, commands, ...props }) => {
          if (editor.isActive('listItem')) return commands.sinkListItem('listItem');
          if (editor.isActive('taskItem')) return commands.sinkListItem('taskItem');
          return shiftIndent(1)({ ...props, editor, commands });
        },
      decreaseIndent:
        () =>
        ({ editor, commands, ...props }) => {
          if (editor.isActive('listItem')) return commands.liftListItem('listItem');
          if (editor.isActive('taskItem')) return commands.liftListItem('taskItem');
          return shiftIndent(-1)({ ...props, editor, commands });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Fuera de listas y tablas, Tab inserta una tabulación como en Word
      Tab: () => this.editor.commands.insertContent('\t'),
      'Mod-]': () => this.editor.commands.increaseIndent(),
      'Mod-[': () => this.editor.commands.decreaseIndent(),
    };
  },
});

function parseMarginCm(value: string, allowNegative = false): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (!allowNegative && n < 0) return 0;
  if (value.endsWith('cm')) return n;
  if (value.endsWith('in')) return n * 2.54;
  if (value.endsWith('pt')) return (n / 72) * 2.54;
  if (value.endsWith('px')) return (n / 96) * 2.54;
  return 0;
}

function parseMarginPt(value: string): number | null {
  const cm = parseMarginCm(value);
  return value && cm >= 0 ? Math.round(((cm / 2.54) * 72) * 10) / 10 : null;
}
