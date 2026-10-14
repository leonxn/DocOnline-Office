import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

/** Salto de página: en pantalla es una línea, al imprimir y en .docx fuerza una página nueva. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      // Saltos que vienen de Word al pegar/importar
      { tag: 'br[style*="page-break-before"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'we-page-break' })];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).createParagraphNear().run(),
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});
