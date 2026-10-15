import { Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { GraphicView } from '../graphics/GraphicView';
import { GRAPHIC_EDIT_EVENT, graphicBoxStyle, normalizeGraphic, renderGraphicSvg, rotatedBox, svgDataUrl, type GraphicEditDetail } from '../graphics/render';
import type { GraphicType } from '../graphics/types';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    graphic: {
      /** Inserta una forma, gráfico o SmartArt y lo deja seleccionado. */
      insertGraphic: (gtype: GraphicType, data: Record<string, unknown>) => ReturnType;
      /** Cambia atributos del objeto seleccionado (o del que está en `pos`). */
      updateGraphic: (patch: Record<string, unknown>, pos?: number) => ReturnType;
    };
  }
}

export const Graphic = Node.create({
  name: 'graphic',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      gtype: {
        default: 'shape',
        parseHTML: (el) => el.getAttribute('data-gtype') ?? 'shape',
        renderHTML: () => ({}),
      },
      data: {
        default: {},
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-graphic') ?? '{}');
          } catch {
            return {};
          }
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-graphic]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const gtype = node.attrs.gtype as GraphicType;
    const d = normalizeGraphic(gtype, node.attrs.data ?? {}) as unknown as Record<string, any>;
    const svg = renderGraphicSvg(gtype, d);
    const rotation = gtype === 'shape' && d.rotation ? `transform:rotate(${d.rotation}deg);` : '';
    const frame = rotatedBox(d.width, d.height, gtype === 'shape' ? d.rotation : 0);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'we-gfx-static',
        'data-gtype': gtype,
        'data-graphic': JSON.stringify(node.attrs.data ?? {}),
        style: graphicBoxStyle(d.wrap, d.align, frame.width),
      }),
      [
        'div',
        { style: `position:relative;width:${frame.width}px;height:${frame.height}px;` },
        [
          'img',
          {
            src: svgDataUrl(svg),
            width: String(Math.round(d.width)),
            height: String(Math.round(d.height)),
            alt: d.title || d.text || '',
            style: `position:absolute;left:${(frame.width - d.width) / 2}px;top:${(frame.height - d.height) / 2}px;display:block;overflow:visible;${rotation}`,
          },
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GraphicView);
  },

  addCommands() {
    return {
      insertGraphic:
        (gtype, data) =>
        ({ tr, state, dispatch }) => {
          const node = state.schema.nodes.graphic.create({ gtype, data });
          if (!dispatch) return true;
          tr.replaceSelectionWith(node);
          let found = -1;
          tr.doc.nodesBetween(Math.max(0, tr.selection.from - node.nodeSize - 4), Math.min(tr.doc.content.size, tr.selection.from + 2), (n, pos) => {
            if (n === node) found = pos;
          });
          if (found >= 0) {
            // Si el objeto partió un párrafo con letra capital, la segunda mitad no la conserva
            const after = tr.doc.nodeAt(found + node.nodeSize);
            if (after?.attrs.dropCap) tr.setNodeMarkup(found + node.nodeSize, undefined, { ...after.attrs, dropCap: null });
            tr.setSelection(NodeSelection.create(tr.doc, found));
          }
          tr.scrollIntoView();
          return true;
        },
      updateGraphic:
        (patch, pos) =>
        ({ tr, state, dispatch }) => {
          const sel = state.selection;
          const at = pos ?? (sel instanceof NodeSelection && sel.node.type.name === 'graphic' ? sel.from : -1);
          const node = at >= 0 ? state.doc.nodeAt(at) : null;
          if (!node || node.type.name !== 'graphic') return false;
          if (dispatch) {
            tr.setNodeMarkup(at, undefined, { ...node.attrs, data: { ...(node.attrs.data ?? {}), ...patch } });
            if (sel instanceof NodeSelection && sel.from === at) tr.setSelection(NodeSelection.create(tr.doc, at));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          // Con una forma seleccionada, escribir (o Enter/F2) empieza a editar su texto, como en Word
          handleKeyDown(view, event) {
            const sel = view.state.selection;
            if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'graphic' || sel.node.attrs.gtype !== 'shape') return false;
            if (event.ctrlKey || event.metaKey || event.altKey || !view.editable) return false;
            const printable = event.key.length === 1;
            if (!printable && event.key !== 'Enter' && event.key !== 'F2') return false;
            const detail: GraphicEditDetail = { pos: sel.from, key: printable ? event.key : '', dom: view.dom as HTMLElement };
            window.dispatchEvent(new CustomEvent(GRAPHIC_EDIT_EVENT, { detail }));
            return true;
          },
          // Texto que llega sin tecla (teclado del móvil, dictado, IME)
          handleTextInput(view, _from, _to, text) {
            const sel = view.state.selection;
            if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'graphic' || sel.node.attrs.gtype !== 'shape') return false;
            const detail: GraphicEditDetail = { pos: sel.from, key: text, dom: view.dom as HTMLElement };
            window.dispatchEvent(new CustomEvent(GRAPHIC_EDIT_EVENT, { detail }));
            return true;
          },
        },
      }),
    ];
  },
});
