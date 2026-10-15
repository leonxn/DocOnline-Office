'use client';

import type { Mark } from '@tiptap/pm/model';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import { Printer, Redo2, Save, Search, Undo2 } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { CONTENT_CSS } from './content-styles';
import { buildExtensions } from './extensions';
import { INDENT_STEP_CM } from './extensions/paragraph-format';
import { downloadBlob, exportHtml, importFile, safeFileName } from './io/files';
import { printSheets, type PrintGeometry } from './io/print';
import { useAiChat } from './ai/useAiChat';
import type { AiOptions } from './ai/types';
import {
  DEFAULT_SETTINGS,
  HeaderFooterContent,
  HeaderFooterKind,
  HeaderFooterVariant,
  PageSettings,
  WordDocument,
  headerFooterKey,
  isHeaderFooterEmpty,
  pageDimensions,
  textToHeaderFooter,
  variantForPage,
} from './types';
import { AiConnectDialog } from './ui/AiConnectDialog';
import { AiPanel } from './ui/AiPanel';
import { GraphicPanel } from './ui/GraphicPanel';
import { ContextMenu } from './ui/ContextMenu';
import { Btn } from './ui/controls';
import { selectEditorState } from './ui/editor-state';
import { FindReplace } from './ui/FindReplace';
import { HeaderFooterEditor, StaticHeaderFooter } from './ui/HeaderFooter';
import { MultiPageView } from './ui/MultiPageView';
import { NavigationPanel } from './ui/NavigationPanel';
import { Ribbon, insertImageFile, type HeaderFooterControls, type PageNumberPosition, type RibbonActions, type ViewOptions } from './ui/Ribbon';
import { Ruler, VerticalRuler } from './ui/Ruler';
import { StatusBar } from './ui/StatusBar';
import { columnWidths, currentTable, setColumnWidths, tableDom } from './ui/table-utils';
import { TableHandles } from './ui/TableHandles';
import { applyMarks, captureMarks } from './ui/text-utils';
import './word-editor.css';

const CM_PX = 96 / 2.54;
/** Hueco gris entre hojas, px. */
const SHEET_GAP = 24;
const UNTITLED = 'Documento sin título';

export interface WordEditorProps {
  /**
   * Documento inicial: HTML, o un `WordDocument` guardado antes (se recomienda guardar `json`).
   * `settings` puede ser parcial: lo que falte toma el valor por defecto.
   */
  initialValue?: string | WordDocumentInput;
  /** Se llama (con 400 ms de espera) cada vez que cambia el contenido, el título o la página. */
  onChange?: (doc: WordDocument) => void;
  /** Botón Guardar y Ctrl+S. Si no se pasa, Ctrl+S descarga el .docx. */
  onSave?: (doc: WordDocument) => void | Promise<void>;
  readOnly?: boolean;
  placeholder?: string;
  /** Alto del editor completo (cinta + hoja). Por defecto ocupa el 100 % del contenedor. */
  height?: CSSProperties['height'];
  /** Oculta la barra superior con el título (útil dentro de formularios). */
  hideTitleBar?: boolean;
  /**
   * Herramientas de IA (Claude o Gemini). Por defecto cada usuario conecta su propia clave.
   * Pasa `{ endpoint: '/api/ia' }` para usar tu servidor, o `false` para ocultar la pestaña.
   */
  ai?: false | AiOptions;
  className?: string;
}

/** Documento de entrada: como `WordDocument`, pero todo opcional. */
export type WordDocumentInput = Partial<Omit<WordDocument, 'settings'>> & { settings?: Partial<PageSettings> };

export interface WordEditorHandle {
  editor: Editor | null;
  getDocument: () => WordDocument;
  setDocument: (doc: string | WordDocumentInput) => void;
  exportDocx: () => Promise<Blob>;
  print: () => void;
  focus: () => void;
}

/** Edición activa de un encabezado o pie (como el doble clic de Word). */
interface HeaderFooterEdit {
  kind: HeaderFooterKind;
  variant: HeaderFooterVariant;
  sheet: number;
}

/** Acepta configuraciones guardadas con versiones anteriores (encabezado/pie como texto plano). */
function normalizeSettings(raw: Partial<PageSettings> & { pageNumbers?: boolean } = {}): PageSettings {
  const merged: PageSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    margins: { ...DEFAULT_SETTINGS.margins, ...raw.margins },
  };
  for (const key of ['header', 'footer', 'firstHeader', 'firstFooter', 'evenHeader', 'evenFooter'] as const) {
    const v = merged[key] as unknown;
    if (typeof v === 'string') merged[key] = textToHeaderFooter(v);
  }
  if (raw.pageNumbers) {
    const footer = merged.footer?.content ?? [];
    merged.footer = {
      type: 'doc',
      content: [
        ...footer,
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [
            { type: 'text', text: 'Página ' },
            { type: 'pageNumber' },
            { type: 'text', text: ' de ' },
            { type: 'pageCount' },
          ],
        },
      ],
    };
  }
  return merged;
}

function normalize(value: WordEditorProps['initialValue']) {
  if (!value || typeof value === 'string') {
    return { title: UNTITLED, content: (value as string) ?? '', settings: DEFAULT_SETTINGS };
  }
  return {
    title: value.title ?? UNTITLED,
    content: (value.json ?? value.html ?? '') as JSONContent | string,
    settings: normalizeSettings(value.settings),
  };
}

const HF_LABELS: Record<HeaderFooterKind, Record<HeaderFooterVariant | 'odd', string>> = {
  header: {
    default: 'Encabezado',
    odd: 'Encabezado de página impar',
    first: 'Encabezado de primera página',
    even: 'Encabezado de página par',
  },
  footer: {
    default: 'Pie de página',
    odd: 'Pie de página impar',
    first: 'Pie de primera página',
    even: 'Pie de página par',
  },
};

const pageNumberParagraph = (align: string, withTotal: boolean): JSONContent => ({
  type: 'paragraph',
  attrs: { textAlign: align },
  content: withTotal
    ? [{ type: 'text', text: 'Página ' }, { type: 'pageNumber' }, { type: 'text', text: ' de ' }, { type: 'pageCount' }]
    : [{ type: 'pageNumber' }],
});

/** Quita los campos de número de página de un encabezado/pie. */
function stripPageFields(content: HeaderFooterContent): HeaderFooterContent {
  if (!content) return content;
  const walk = (n: JSONContent): JSONContent => ({
    ...n,
    content: n.content?.filter((c) => c.type !== 'pageNumber' && c.type !== 'pageCount').map(walk),
  });
  const out = walk(content);
  return isHeaderFooterEmpty(out) ? null : out;
}

/** Editor de documentos tipo Word. `forwardRef` para que la ref funcione en React 18 y 19. */
export const WordEditor = forwardRef<WordEditorHandle, WordEditorProps>(function WordEditor(
  {
    initialValue,
    onChange,
    onSave,
    readOnly = false,
    placeholder = 'Escribe aquí…',
    height = '100%',
    hideTitleBar = false,
    className = '',
    ai,
  },
  ref,
) {
  const initial = useMemo(() => normalize(initialValue), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState(initial.title);
  const [settings, setSettings] = useState<PageSettings>(initial.settings);
  const [view, setView] = useState<ViewOptions>({
    zoom: 1,
    showRuler: true,
    showMarks: false,
    spellcheck: true,
    readMode: false,
    showStatusBar: true,
    ribbonPinned: true,
    leftPanel: false,
    rightPanel: false,
    multiPage: false,
    theme: 'light',
  });
  const [aiConnectOpen, setAiConnectOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    if (view.theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [view.theme]);
  const theme = view.theme === 'system' ? (systemDark ? 'dark' : 'light') : view.theme;
  const [find, setFind] = useState<'find' | 'replace' | null>(null);
  const [painter, setPainter] = useState<readonly Mark[] | null>(null);
  const [toast, setToast] = useState<string>();
  const [saveStatus, setSaveStatus] = useState<string>();
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [hfEdit, setHfEdit] = useState<HeaderFooterEdit | null>(null);
  const [hfEditor, setHfEditor] = useState<Editor | null>(null);
  const [hfHeights, setHfHeights] = useState({ header: 0, footer: 0 });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  // Refs para leer el estado más reciente desde callbacks del editor sin recrearlo
  const latest = useRef({ title, settings, onChange, onSave });
  latest.current = { title, settings, onChange, onSave };

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? undefined : t)), 3500);
  }, []);

  const changeTimer = useRef<number | undefined>(undefined);
  const getDocument = useCallback((): WordDocument => {
    const ed = editorRef.current;
    return {
      title: latest.current.title,
      settings: latest.current.settings,
      json: ed?.getJSON() ?? { type: 'doc', content: [] },
      html: ed?.getHTML() ?? '',
    };
  }, []);
  const scheduleChange = useCallback(() => {
    if (!latest.current.onChange) return;
    window.clearTimeout(changeTimer.current);
    changeTimer.current = window.setTimeout(() => latest.current.onChange?.(getDocument()), 400);
  }, [getDocument]);

  const extensions = useMemo(() => buildExtensions(placeholder), [placeholder]);
  const hfExtensions = useMemo(() => buildExtensions('', { pagination: false }), []);

  const editor = useEditor({
    extensions,
    content: initial.content,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'we-content', lang: 'es', spellcheck: 'true', 'aria-label': 'Contenido del documento' },
      // Pegar o soltar imágenes (capturas de pantalla, archivos)
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length || !editorRef.current) return false;
        files.forEach((f) => insertImageFile(editorRef.current!, f, notify));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length || !editorRef.current) return false;
        event.preventDefault();
        files.forEach((f) => insertImageFile(editorRef.current!, f, notify));
        return true;
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
    onUpdate: scheduleChange,
  });
  editorRef.current = editor;

  const sMain = useEditorState({ editor, selector: selectEditorState });
  const sHf = useEditorState({ editor: hfEditor, selector: selectEditorState });
  // La cinta actúa sobre el encabezado/pie mientras se edita (como en Word)
  const activeEditor = hfEdit && hfEditor ? hfEditor : editor;
  const s = hfEdit && hfEditor ? sHf : sMain;

  // --- Herramientas de IA
  const aiOptions: AiOptions | null = ai === false ? null : (ai ?? {});
  const activeEditorRef = useRef<Editor | null>(null);
  activeEditorRef.current = activeEditor;
  const getActiveEditor = useCallback(() => activeEditorRef.current, []);
  const aiChat = useAiChat(getActiveEditor, aiOptions ?? {});
  const chat = aiOptions ? aiChat : null;

  // Título y configuración de página también disparan onChange
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scheduleChange();
  }, [title, settings, scheduleChange]);

  const editable = !readOnly && !view.readMode;

  // Panel de propiedades de la forma/gráfico seleccionado; se reabre al elegir otro objeto
  const selectedGraphic = !hfEdit && editable ? sMain?.graphic ?? null : null;
  const [graphicPanelClosed, setGraphicPanelClosed] = useState<number | null>(null);
  const showGraphicPanel = !!selectedGraphic && graphicPanelClosed !== selectedGraphic.pos;

  useEffect(() => {
    editor?.setEditable(editable && !hfEdit);
  }, [editor, editable, hfEdit]);

  useEffect(() => {
    editor?.view.dom.setAttribute('spellcheck', String(view.spellcheck));
  }, [editor, view.spellcheck]);

  // --- Copiar formato: se aplica al soltar el mouse sobre una nueva selección
  useEffect(() => {
    const target = activeEditor;
    if (!target || !painter) return;
    const dom = target.view.dom;
    // setTimeout (no rAF) para que ProseMirror termine de fijar la selección del mouseup
    const onUp = () =>
      window.setTimeout(() => {
        if (target.state.selection.empty) return;
        applyMarks(target, painter);
        setPainter(null);
      }, 0);
    dom.addEventListener('mouseup', onUp);
    dom.classList.add('is-painting');
    return () => {
      dom.removeEventListener('mouseup', onUp);
      dom.classList.remove('is-painting');
    };
  }, [activeEditor, painter]);

  // --- Geometría de la hoja (px a escala 1)
  const dims = pageDimensions(settings);
  const m = settings.margins;
  const sheetW = dims.width * CM_PX;
  const sheetH = dims.height * CM_PX;
  const pitch = sheetH + SHEET_GAP;
  const contentLeft = m.left * CM_PX;
  const contentWidth = sheetW - (m.left + m.right) * CM_PX;
  // Si el encabezado/pie es más alto que el margen, el texto empieza más abajo (como en Word)
  const headerTopPx = settings.headerDistance * CM_PX;
  const footerBottomPx = settings.footerDistance * CM_PX;
  const effTop = Math.max(m.top * CM_PX, hfHeights.header ? headerTopPx + hfHeights.header + 6 : 0);
  const effBottom = Math.max(m.bottom * CM_PX, hfHeights.footer ? footerBottomPx + hfHeights.footer + 6 : 0);
  const usablePx = Math.max(60, sheetH - effTop - effBottom);

  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.pagination;
    storage.onLayout = (layout) => setPages(layout.pages);
    editor.commands.setPaginationConfig({ pitch, usable: usablePx });
    return () => {
      storage.onLayout = undefined;
    };
  }, [editor, pitch, usablePx]);

  // Alto real de encabezados y pies (los más altos mandan)
  const measureHeaderFooter = useCallback(() => {
    const root = sheetsRef.current;
    if (!root) return;
    const max = (kind: HeaderFooterKind) =>
      Math.max(
        0,
        ...Array.from(root.querySelectorAll<HTMLElement>(`.we-hf-box[data-kind="${kind}"]:not(.is-empty)`)).map((el) => el.offsetHeight),
      );
    const next = { header: max('header'), footer: max('footer') };
    setHfHeights((prev) =>
      Math.abs(prev.header - next.header) < 1 && Math.abs(prev.footer - next.footer) < 1 ? prev : next,
    );
  }, []);
  useLayoutEffect(() => {
    measureHeaderFooter();
    const root = sheetsRef.current;
    if (!root) return;
    const ro = new ResizeObserver(measureHeaderFooter);
    root.querySelectorAll('.we-hf-box').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  });

  // Hoja en la que está el cursor
  useEffect(() => {
    if (!editor) return;
    const updatePage = () => {
      try {
        const dom = editor.view.dom;
        const rect = dom.getBoundingClientRect();
        const scale = rect.height / (dom.offsetHeight || 1) || 1;
        const { head, $head } = editor.state.selection;
        let coords = editor.view.coordsAtPos(head, 1);
        // Justo después de un corte de página dentro de un párrafo, la posición "pertenece" al
        // final de la línea anterior; se usa el carácter siguiente (que está en la hoja nueva)
        if ($head.parent.isTextblock && $head.parentOffset < $head.parent.content.size) {
          const next = editor.view.coordsAtPos(head + 1, -1);
          if (next.top - coords.top > pitch * scale * 0.25) coords = next;
        }
        const top = (coords.top - rect.top) / scale;
        // +2 px: el cursor al inicio de una hoja cae justo en el borde y el redondeo lo dejaría en la anterior
        setPage(Math.max(1, Math.floor((top + 2) / pitch) + 1));
      } catch {
        // coordsAtPos falla si el editor aún no está en el DOM
      }
    };
    updatePage();
    editor.on('selectionUpdate', updatePage);
    editor.on('update', updatePage);
    return () => {
      editor.off('selectionUpdate', updatePage);
      editor.off('update', updatePage);
    };
  }, [editor, pitch, pages]);

  // Ctrl + rueda del mouse = zoom (como en Word)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setView((v) => ({ ...v, zoom: Math.max(0.25, Math.min(3, +(v.zoom - Math.sign(e.deltaY) * 0.1).toFixed(2))) }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // --- Encabezado y pie de página
  const setHeaderFooter = useCallback((kind: HeaderFooterKind, variant: HeaderFooterVariant, content: HeaderFooterContent) => {
    setSettings((p) => ({ ...p, [headerFooterKey(kind, variant)]: content }));
  }, []);

  const enterHeaderFooter = useCallback(
    (kind: HeaderFooterKind, sheet = page - 1) => {
      if (!editable) return;
      const index = Math.min(Math.max(0, sheet), pages - 1);
      setHfEdit({ kind, variant: variantForPage(latest.current.settings, index), sheet: index });
    },
    [editable, page, pages],
  );
  const exitHeaderFooter = useCallback(() => {
    setHfEdit(null);
    setHfEditor(null);
    editor?.commands.focus();
  }, [editor]);

  // Si cambian las opciones (primera página / pares) la variante editada puede cambiar
  useEffect(() => {
    setHfEdit((cur) => {
      if (!cur) return cur;
      const variant = variantForPage(settings, cur.sheet);
      return variant === cur.variant ? cur : { ...cur, variant };
    });
  }, [settings.differentFirst, settings.differentOddEven]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeVariants = (s2: PageSettings): HeaderFooterVariant[] => [
    'default',
    ...(s2.differentFirst ? (['first'] as const) : []),
    ...(s2.differentOddEven ? (['even'] as const) : []),
  ];

  const hfControls: HeaderFooterControls = {
    active: hfEdit ? { kind: hfEdit.kind, label: hfLabel(hfEdit) } : null,
    settings,
    enter: (kind) => enterHeaderFooter(kind),
    exit: exitHeaderFooter,
    switchTo: (kind) => hfEdit && setHfEdit({ ...hfEdit, kind }),
    remove: (kind) => {
      setSettings((p) => {
        const next = { ...p };
        for (const v of ['default', 'first', 'even'] as const) next[headerFooterKey(kind, v)] = null;
        return next;
      });
      if (hfEdit?.kind === kind) exitHeaderFooter();
    },
    insertPageNumber: (position: PageNumberPosition) => {
      if (position === 'current' || position === 'current-total') {
        if (!hfEditor) return notify('Abre el encabezado o el pie para insertar en la posición actual');
        hfEditor
          .chain()
          .focus()
          .insertContent(
            position === 'current'
              ? { type: 'pageNumber' }
              : [{ type: 'text', text: 'Página ' }, { type: 'pageNumber' }, { type: 'text', text: ' de ' }, { type: 'pageCount' }],
          )
          .run();
        return;
      }
      const [kind, align, total] = position.split('-') as [HeaderFooterKind, string, string?];
      const paragraph = pageNumberParagraph(align, total === 'total');
      // Se cierra el editor abierto para no pisar el cambio con su contenido anterior
      setHfEdit(null);
      setHfEditor(null);
      setSettings((p) => {
        const next = { ...p };
        for (const v of activeVariants(p)) {
          const key = headerFooterKey(kind, v);
          const cleaned = stripPageFields(p[key]);
          next[key] = { type: 'doc', content: [...(cleaned?.content ?? []), paragraph] };
        }
        return next;
      });
      setTimeout(() => enterHeaderFooter(kind), 0);
    },
    removePageNumbers: () => {
      setHfEdit(null);
      setHfEditor(null);
      setSettings((p) => {
        const next = { ...p };
        for (const key of ['header', 'footer', 'firstHeader', 'firstFooter', 'evenHeader', 'evenFooter'] as const) {
          next[key] = stripPageFields(p[key]);
        }
        return next;
      });
    },
    update: (patch) => setSettings((p) => ({ ...p, ...patch })),
  };

  function hfLabel(edit: HeaderFooterEdit) {
    const labels = HF_LABELS[edit.kind];
    if (edit.variant === 'default' && settings.differentOddEven) return labels.odd;
    return labels[edit.variant];
  }

  // --- Acciones
  const saveDocx = useCallback(async () => {
    if (!editor) return;
    try {
      const { exportDocx } = await import('./io/docx-export');
      downloadBlob(await exportDocx(editor.getJSON(), settings, title), safeFileName(title, 'docx'));
    } catch (err) {
      notify(`No se pudo generar el .docx: ${err instanceof Error ? err.message : err}`);
    }
  }, [editor, settings, title, notify]);

  const save = useCallback(async () => {
    const handler = latest.current.onSave;
    if (!handler) return saveDocx();
    setSaveStatus('Guardando…');
    try {
      await handler(getDocument());
      setSaveStatus(`Guardado ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (err) {
      setSaveStatus(undefined);
      notify(`Error al guardar: ${err instanceof Error ? err.message : err}`);
    }
  }, [getDocument, saveDocx, notify]);

  const doPrint = useCallback(() => {
    if (!editor || !sheetsRef.current) return;
    printSheets(
      {
        sheets: Array.from(sheetsRef.current.querySelectorAll<HTMLElement>('.we-sheet')),
        content: editor.view.dom,
        pitch,
        sheetWidth: sheetW,
        sheetHeight: sheetH,
        contentLeft,
        contentTop: effTop,
        contentWidth,
        usable: usablePx,
        rootClass: settings.hyphenation ? 'is-hyphenated' : '',
        rootStyle: `--we-heading-color: ${settings.themeColor}`,
      },
      title,
    );
  }, [editor, pitch, sheetW, sheetH, contentLeft, effTop, contentWidth, usablePx, settings.hyphenation, title]);

  const print = useCallback(() => {
    if (hfEdit) {
      // Primero se cierra la edición del encabezado para imprimir su versión final
      exitHeaderFooter();
      setTimeout(doPrint, 60);
    } else doPrint();
  }, [hfEdit, exitHeaderFooter, doPrint]);

  const fitWidth = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const zoom = (canvas.clientWidth - 100) / sheetW;
    setView((v) => ({ ...v, zoom: Math.max(0.25, Math.min(3, +zoom.toFixed(2))) }));
  }, [sheetW]);

  // En pantallas angostas la hoja se ajusta al ancho disponible al abrir
  const didAutoFit = useRef(false);
  useEffect(() => {
    if (!editor || didAutoFit.current || !canvasRef.current) return;
    didAutoFit.current = true;
    if (canvasRef.current.clientWidth < sheetW + 100) fitWidth();
  }, [editor, sheetW, fitWidth]);

  const fitPage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const zoom = Math.min((canvas.clientHeight - 60) / sheetH, (canvas.clientWidth - 100) / sheetW);
    setView((v) => ({ ...v, zoom: Math.max(0.25, Math.min(3, +zoom.toFixed(2))) }));
  }, [sheetH, sheetW]);

  /** Foto de las hojas para la vista "Múltiples páginas". */
  const multiPageGeometry = useCallback((): PrintGeometry | null => {
    if (!editor || !sheetsRef.current) return null;
    return {
      sheets: Array.from(sheetsRef.current.querySelectorAll<HTMLElement>('.we-sheet')),
      content: editor.view.dom,
      pitch,
      sheetWidth: sheetW,
      sheetHeight: sheetH,
      contentLeft,
      contentTop: effTop,
      contentWidth,
      usable: usablePx,
    };
  }, [editor, pitch, sheetW, sheetH, contentLeft, effTop, contentWidth, usablePx]);

  const goToSheet = useCallback(
    (index: number) => {
      setView((v) => ({ ...v, multiPage: false }));
      // Esperar a que se cierre la vista de miniaturas (si no, el punto cae sobre ella)
      window.setTimeout(() => {
        const sheet = sheetsRef.current?.querySelectorAll<HTMLElement>('.we-sheet')[index];
        sheet?.scrollIntoView({ block: 'start' });
        if (!editor || !sheet) return;
        const r = sheet.getBoundingClientRect();
        const pos = editor.view.posAtCoords({ left: r.left + r.width / 2, top: r.top + (effTop + 10) * (r.height / sheetH) });
        if (pos) editor.chain().focus().setTextSelection(pos.pos).run();
      }, 60);
    },
    [editor, effTop, sheetH],
  );

  const actions: RibbonActions = {
    newDocument: () => {
      if (!editor) return;
      if (!editor.isEmpty && !window.confirm('¿Descartar el documento actual y empezar uno nuevo?')) return;
      setHfEdit(null);
      editor.commands.setContent('');
      setTitle(UNTITLED);
      setSettings(DEFAULT_SETTINGS);
      editor.commands.focus();
    },
    openFile: () => fileInputRef.current?.click(),
    save,
    saveDocx,
    exportHtml: () => editor && exportHtml(editor, title, settings.themeColor),
    print,
    openFind: setFind,
    toggleFullscreen: () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else rootRef.current?.requestFullscreen?.();
    },
    fitWidth,
    fitPage,
    openAiConnect: () => setAiConnectOpen(true),
  };

  const onOpenFile = async (file: File) => {
    if (!editor) return;
    try {
      const { html, warnings } = await importFile(file);
      setHfEdit(null);
      editor.commands.setContent(html);
      setTitle(file.name.replace(/\.[^.]+$/, ''));
      editor.commands.focus('start');
      notify(warnings.length ? `Abierto con ${warnings.length} aviso(s) de formato no compatible` : `Abierto: ${file.name}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      editor,
      getDocument,
      setDocument: (doc) => {
        const n = normalize(doc);
        setHfEdit(null);
        editor?.commands.setContent(n.content);
        setTitle(n.title);
        setSettings(n.settings);
      },
      exportDocx: async () => {
        const { exportDocx } = await import('./io/docx-export');
        return exportDocx(editor?.getJSON() ?? { type: 'doc' }, latest.current.settings, latest.current.title);
      },
      print,
      focus: () => editor?.commands.focus(),
    }),
    [editor, getDocument, print],
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (painter) return setPainter(null);
      if (hfEdit) return exitHeaderFooter();
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const map: Record<string, () => void> = {
      s: save,
      p: print,
      f: () => setFind('find'),
      h: () => setFind('replace'),
      o: actions.openFile,
    };
    if (readOnly && key !== 'p' && key !== 'f') return;
    if (map[key] && !e.shiftKey) {
      e.preventDefault();
      map[key]();
    }
  };

  // --- Ratón sobre las hojas
  const docRef = useRef<HTMLDivElement>(null);
  /** Hoja y zona (encabezado, cuerpo o pie) bajo un punto de la pantalla. */
  const zoneFromPoint = (clientX: number, clientY: number) => {
    const doc = docRef.current;
    if (!doc) return null;
    const rect = doc.getBoundingClientRect();
    const scale = rect.width / sheetW || 1;
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    if (x < 0 || x > sheetW || y < 0) return null;
    const index = Math.floor(y / pitch);
    const yIn = y - index * pitch;
    if (index >= pages || yIn > sheetH) return null; // hueco entre hojas
    const zone: 'header' | 'footer' | 'body' = yIn < effTop ? 'header' : yIn > sheetH - effBottom ? 'footer' : 'body';
    return { index, zone };
  };

  /**
   * Se captura antes que el editor: el texto ocupa todas las hojas (también los márgenes de
   * las hojas anteriores), así que la zona se decide por coordenadas y no por el elemento.
   */
  const onDocMouseDownCapture = (e: ReactMouseEvent) => {
    if (!editor || !editable || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.we-hf-box.is-editing, .we-vruler, .we-tbl-handle, input, button, label')) return;
    const hit = zoneFromPoint(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.zone === 'body') {
      if (!hfEdit) return; // edición normal del documento
      e.preventDefault();
      e.stopPropagation();
      if (e.detail >= 2) exitHeaderFooter(); // doble clic en el texto: volver al documento
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (hfEdit) setHfEdit({ kind: hit.zone, variant: variantForPage(settings, hit.index), sheet: hit.index });
    else if (e.detail >= 2) enterHeaderFooter(hit.zone, hit.index);
  };

  /** Clic en los márgenes laterales o entre hojas: el cursor va a la línea más cercana (como Word). */
  const onSheetsMouseDown = (e: ReactMouseEvent) => {
    if (!editor || !editable || hfEdit || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('input, button, .we-vruler')) return;
    e.preventDefault();
    if (e.detail > 1) return;
    const dom = editor.view.dom;
    const rect = dom.getBoundingClientRect();
    if (e.clientY > rect.bottom) return void editor.commands.focus('end');
    if (e.clientY < rect.top) return void editor.commands.focus('start');
    const left = Math.min(Math.max(e.clientX, rect.left + 2), rect.right - 2);
    const pos = editor.view.posAtCoords({ left, top: e.clientY });
    if (pos) editor.chain().focus().setTextSelection(pos.pos).run();
    else editor.commands.focus();
  };

  // --- Columnas de la tabla actual en la regla
  const tableInfo = editor && sMain?.inTable && !hfEdit ? currentTable(editor) : null;
  const tableColumns = useMemo(() => {
    if (!editor || !tableInfo || !flowRef.current) return null;
    const table = tableDom(editor, tableInfo.pos);
    if (!table) return null;
    const flowRect = flowRef.current.getBoundingClientRect();
    const scale = view.zoom || 1;
    const left = (table.getBoundingClientRect().left - flowRect.left) / scale + contentLeft;
    const widths = columnWidths(editor, tableInfo);
    const edges = [left];
    widths.forEach((w) => edges.push(edges[edges.length - 1] + w));
    return edges.map((px) => px / CM_PX);
    // sMain cambia en cada transacción: recalcula al moverse por la tabla o cambiar anchos
  }, [editor, sMain, tableInfo?.pos, view.zoom, contentLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTableColumn = (index: number, cm: number) => {
    if (!editor || !tableColumns) return;
    const info = currentTable(editor);
    if (!info) return;
    const widths = columnWidths(editor, info);
    // El borde actual se calcula con los anchos vigentes (no con los del inicio del arrastre),
    // si no, cada movimiento del mouse sumaría el desplazamiento otra vez
    const currentEdge = tableColumns[0] * CM_PX + widths.slice(0, index).reduce((a, b) => a + b, 0);
    const delta = cm * CM_PX - currentEdge;
    const next = [...widths];
    if (index === widths.length) {
      next[index - 1] = Math.max(24, next[index - 1] + delta);
    } else if (index > 0) {
      const d = Math.max(24 - next[index - 1], Math.min(delta, next[index] - 24));
      next[index - 1] += d;
      next[index] -= d;
    } else return;
    setColumnWidths(editor, info, next);
  };

  const showHeader = editable || !isHeaderFooterEmpty(settings.header) || settings.differentFirst || settings.differentOddEven;
  const rulerIndents = s && editable ? { left: s.indentLeftCm, firstLine: s.firstLineCm, right: s.indentRightCm } : null;

  return (
    <div
      ref={rootRef}
      className={`we-root ${view.showMarks ? 'show-marks' : ''} ${settings.hyphenation ? 'is-hyphenated' : ''} ${className}`}
      data-theme={theme}
      style={{ height, '--we-heading-color': settings.themeColor } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <style>{CONTENT_CSS}</style>

      {!hideTitleBar && (
        <div className="we-titlebar">
          {!readOnly && (
            <div className="we-quick">
              <Btn title={onSave ? 'Guardar' : 'Descargar .docx'} shortcut="Ctrl+S" onClick={save}>
                <Save size={16} />
              </Btn>
              <Btn title="Imprimir" shortcut="Ctrl+P" onClick={print}>
                <Printer size={16} />
              </Btn>
              <Btn title="Deshacer" shortcut="Ctrl+Z" disabled={!s?.canUndo} onClick={() => activeEditor?.chain().focus().undo().run()}>
                <Undo2 size={16} />
              </Btn>
              <Btn title="Rehacer" shortcut="Ctrl+Y" disabled={!s?.canRedo} onClick={() => activeEditor?.chain().focus().redo().run()}>
                <Redo2 size={16} />
              </Btn>
            </div>
          )}
          <input
            className="we-title"
            aria-label="Título del documento"
            value={title}
            readOnly={readOnly}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title.trim() && setTitle(UNTITLED)}
          />
          <div className="we-quick we-quick-right">
            {saveStatus && <span className="we-save-status">{saveStatus}</span>}
            <Btn title="Buscar" shortcut="Ctrl+F" onClick={() => setFind('find')}>
              <Search size={16} />
            </Btn>
          </div>
        </div>
      )}

      {activeEditor && s && !readOnly && (
        <Ribbon
          editor={activeEditor}
          s={s}
          settings={settings}
          onSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
          view={view}
          onView={(patch) => setView((prev) => ({ ...prev, ...patch }))}
          actions={actions}
          painterActive={!!painter}
          onPainter={() => setPainter((p) => (p ? null : captureMarks(activeEditor)))}
          notify={notify}
          hasSaveHandler={!!onSave}
          hf={hfControls}
          ai={chat}
          contentWidthPx={contentWidth}
        />
      )}

      <div className="we-workspace">
        {editor && view.leftPanel && <NavigationPanel editor={editor} onClose={() => setView((v) => ({ ...v, leftPanel: false }))} />}

        <div className="we-center">
        {editor && sMain && find && (
          <FindReplace editor={editor} s={sMain} mode={find} onMode={setFind} onClose={() => setFind(null)} />
        )}
        {view.multiPage && (
          <MultiPageView
            geometry={multiPageGeometry}
            sheetWidth={sheetW}
            sheetHeight={sheetH}
            onPick={goToSheet}
            onClose={() => setView((v) => ({ ...v, multiPage: false }))}
          />
        )}

        <div className="we-canvas" ref={canvasRef}>
          <div className="we-zoom" style={{ zoom: view.zoom }}>
            {view.showRuler && !readOnly && (
              <Ruler
                widthCm={dims.width}
                margins={m}
                onMargins={(patch) => setSettings((p) => ({ ...p, margins: { ...p.margins, ...patch } }))}
                disabled={!editable}
                indents={tableColumns ? null : rulerIndents}
                onIndents={(v) =>
                  activeEditor?.commands.setParagraphIndents({
                    indent: Math.round((v.left / INDENT_STEP_CM) * 1000) / 1000,
                    firstLine: v.firstLine,
                    indentRight: v.right,
                  })
                }
                tableColumns={tableColumns}
                onTableColumn={onTableColumn}
              />
            )}
            <div
              ref={docRef}
              className={`we-doc ${hfEdit ? 'is-hf-editing' : ''}`}
              style={{ width: sheetW, height: pages * pitch - SHEET_GAP }}
              onMouseDownCapture={onDocMouseDownCapture}
              onContextMenu={(e) => {
                if (e.shiftKey || !editable) return; // Mayús + clic derecho = menú del navegador
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY });
              }}
            >
              <div className="we-sheets" ref={sheetsRef} onMouseDown={onSheetsMouseDown}>
                {Array.from({ length: pages }, (_, i) => {
                  const variant = variantForPage(settings, i);
                  const header = settings[headerFooterKey('header', variant)];
                  const footer = settings[headerFooterKey('footer', variant)];
                  const editingHere = hfEdit && hfEdit.sheet === i ? hfEdit.kind : null;
                  const boxStyle = { left: contentLeft, width: contentWidth };
                  const sheetStyle = {
                    top: i * pitch,
                    height: sheetH,
                    background: settings.pageColor ?? undefined,
                    '--we-page-num': `"${i + 1}"`,
                    '--we-page-count': `"${pages}"`,
                  } as CSSProperties;
                  const labelFor = (kind: HeaderFooterKind) =>
                    hfLabel({ kind, variant, sheet: i });
                  return (
                    <div
                      key={i}
                      data-index={i}
                      className={`we-sheet ${i === page - 1 ? 'is-current' : ''}`}
                      style={sheetStyle}
                      aria-label={`Hoja ${i + 1} de ${pages}`}
                    >
                      {settings.watermark && (
                        <div className="we-watermark" aria-hidden="true">
                          <span>{settings.watermark}</span>
                        </div>
                      )}
                      {view.showRuler && !readOnly && i === page - 1 && editable && !hfEdit && (
                        <VerticalRuler
                          heightCm={dims.height}
                          margins={m}
                          onMargins={(patch) => setSettings((p) => ({ ...p, margins: { ...p.margins, ...patch } }))}
                        />
                      )}

                      {editingHere === 'header' ? (
                        <HeaderFooterEditor
                          key={`header-${variant}-${i}`}
                          extensions={hfExtensions}
                          content={header}
                          kind="header"
                          style={{ ...boxStyle, top: headerTopPx }}
                          onChange={(c) => setHeaderFooter('header', variant, c)}
                          onEditor={setHfEditor}
                        />
                      ) : (
                        (showHeader || hfEdit) && (
                          <StaticHeaderFooter
                            schema={editor?.schema}
                            content={header}
                            kind="header"
                            dimmed={!hfEdit}
                            style={{ ...boxStyle, top: headerTopPx }}
                          />
                        )
                      )}

                      {editingHere === 'footer' ? (
                        <HeaderFooterEditor
                          key={`footer-${variant}-${i}`}
                          extensions={hfExtensions}
                          content={footer}
                          kind="footer"
                          style={{ ...boxStyle, bottom: footerBottomPx }}
                          onChange={(c) => setHeaderFooter('footer', variant, c)}
                          onEditor={setHfEditor}
                        />
                      ) : (
                        <StaticHeaderFooter
                          schema={editor?.schema}
                          content={footer}
                          kind="footer"
                          dimmed={!hfEdit}
                          style={{ ...boxStyle, bottom: footerBottomPx }}
                        />
                      )}

                      {hfEdit && (
                        <>
                          <div className="we-hf-line" style={{ top: effTop }} />
                          <span className="we-hf-tab we-hf-tab-header" style={{ top: effTop + 2, left: 8 }}>
                            {labelFor('header')}
                          </span>
                          <div className="we-hf-line" style={{ top: sheetH - effBottom }} />
                          <span className="we-hf-tab we-hf-tab-footer" style={{ top: sheetH - effBottom - 22, left: 8 }}>
                            {labelFor('footer')}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                ref={flowRef}
                className={`we-flow ${hfEdit ? 'is-dimmed' : ''}`}
                style={{ top: effTop, left: contentLeft, width: contentWidth }}
              >
                {editor ? <EditorContent editor={editor} /> : <div className="we-content we-loading">Cargando editor…</div>}
                {editor && editable && !hfEdit && (
                  <TableHandles editor={editor} flowRef={flowRef} zoom={view.zoom} maxWidth={contentWidth} />
                )}
              </div>
            </div>
          </div>
        </div>
        </div>

        {editor && selectedGraphic && showGraphicPanel && (
          <GraphicPanel editor={editor} graphic={selectedGraphic} onClose={() => setGraphicPanelClosed(selectedGraphic.pos)} />
        )}

        {chat && activeEditor && view.rightPanel && !readOnly && !showGraphicPanel && (
          <AiPanel
            chat={chat}
            editor={activeEditor}
            notify={notify}
            onConnect={() => setAiConnectOpen(true)}
            onClose={() => setView((v) => ({ ...v, rightPanel: false }))}
          />
        )}
      </div>

      {chat && aiOptions && aiConnectOpen && (
        <AiConnectDialog chat={chat} options={aiOptions} onClose={() => setAiConnectOpen(false)} />
      )}

      {sMain && view.showStatusBar && (
        <StatusBar
          s={sMain}
          page={Math.min(page, pages)}
          pages={pages}
          zoom={view.zoom}
          readOnly={!editable}
          onZoom={(zoom) => setView((v) => ({ ...v, zoom }))}
          status={
            painter
              ? 'Copiar formato: selecciona el texto de destino (Esc para cancelar)'
              : hfEdit
                ? `Editando ${hfLabel(hfEdit).toLowerCase()} · doble clic en el texto o Esc para salir`
                : undefined
          }
        />
      )}

      {menu && activeEditor && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          editor={activeEditor}
          notify={notify}
          onClose={() => setMenu(null)}
          onEditHeaderFooter={hfEdit ? undefined : (kind) => enterHeaderFooter(kind)}
        />
      )}

      {toast && (
        <div className="we-toast" role="status">
          {toast}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".docx,.html,.htm,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onOpenFile(file);
        }}
      />
    </div>
  );
});
