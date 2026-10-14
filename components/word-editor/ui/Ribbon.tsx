'use client';

import type { Editor } from '@tiptap/react';
import {
  AArrowDown,
  AArrowUp,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  BookOpen,
  Bold,
  CalendarDays,
  CaseSensitive,
  Check,
  ClipboardPaste,
  Code,
  Columns3,
  Copy,
  Eye,
  FileCode,
  FileDown,
  FilePlus,
  FolderOpen,
  Hash,
  Highlighter,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Link,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListTodo,
  Maximize2,
  Minus,
  Omega,
  PaintBucket,
  Paintbrush,
  PanelBottom,
  PanelTop,
  Pilcrow,
  Printer,
  Quote,
  RectangleHorizontal,
  RectangleVertical,
  RemoveFormatting,
  Replace,
  Rows3,
  Ruler as RulerIcon,
  Save,
  Scissors,
  ScanText,
  Search,
  SeparatorHorizontal,
  SpellCheck,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash,
  Baseline,
  Underline,
  Unlink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_FONT,
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZES,
  LINE_SPACINGS,
  MARGIN_PRESETS,
  PAGE_SIZES,
  PageSettings,
  pageDimensions,
  type HeaderFooterKind,
} from '../types';
import { Btn, ColorPicker, Combo, Dropdown, Group, MenuItem, MenuSeparator, Row, TableGridPicker } from './controls';
import type { BlockStyle, EditorUiState } from './editor-state';
import { insertImageFile } from './image-utils';
import { CustomTableForm, HeaderFooterMenus, HeaderFooterTab, LayoutTab, PageNumberMenu, TableTab } from './ribbon-tabs';

export { insertImageFile };
import { changeCase, fontSizeToPt } from './text-utils';

export type RibbonTab = 'inicio' | 'insertar' | 'disposicion' | 'revisar' | 'vista' | 'tabla' | 'imagen' | 'encabezado';

export interface ViewOptions {
  zoom: number;
  showRuler: boolean;
  showMarks: boolean;
  spellcheck: boolean;
  readMode: boolean;
}

export interface RibbonActions {
  newDocument: () => void;
  openFile: () => void;
  save: () => void;
  saveDocx: () => void;
  exportHtml: () => void;
  print: () => void;
  openFind: (mode: 'find' | 'replace') => void;
  toggleFullscreen: () => void;
  fitWidth: () => void;
}

/** Dónde insertar el número de página. */
export type PageNumberPosition =
  | 'header-left'
  | 'header-center'
  | 'header-right'
  | 'footer-left'
  | 'footer-center'
  | 'footer-right'
  | 'footer-center-total'
  | 'footer-right-total'
  | 'current'
  | 'current-total';

export interface HeaderFooterControls {
  /** Encabezado/pie que se está editando, o null. */
  active: { kind: HeaderFooterKind; label: string } | null;
  settings: PageSettings;
  enter: (kind: HeaderFooterKind) => void;
  exit: () => void;
  switchTo: (kind: HeaderFooterKind) => void;
  remove: (kind: HeaderFooterKind) => void;
  insertPageNumber: (position: PageNumberPosition) => void;
  removePageNumbers: () => void;
  update: (patch: Partial<PageSettings>) => void;
}

export interface RibbonProps {
  editor: Editor;
  s: EditorUiState;
  settings: PageSettings;
  onSettings: (patch: Partial<PageSettings>) => void;
  view: ViewOptions;
  onView: (patch: Partial<ViewOptions>) => void;
  actions: RibbonActions;
  painterActive: boolean;
  onPainter: () => void;
  notify: (msg: string) => void;
  /** Muestra "Guardar" (onSave) además de "Descargar .docx". */
  hasSaveHandler: boolean;
  hf: HeaderFooterControls;
  /** Ancho útil de la página en px (para "ajustar tabla a la ventana" e imágenes). */
  contentWidthPx: number;
}

const ICON = 16;
const ICON_LG = 22;

export function Ribbon(props: RibbonProps) {
  const { s } = props;
  const { hf } = props;
  const [tab, setTab] = useState<RibbonTab>('inicio');
  // Al entrar a editar el encabezado/pie se abre su pestaña (como en Word)
  const hfKind = hf.active?.kind ?? null;
  useEffect(() => {
    if (hfKind) setTab('encabezado');
  }, [hfKind]);
  // Si la pestaña contextual desaparece (salimos de la tabla), volvemos a Inicio
  const current =
    (tab === 'tabla' && !s.inTable) || (tab === 'imagen' && !s.image) || (tab === 'encabezado' && !hf.active) ? 'inicio' : tab;

  const tabs: { id: RibbonTab; label: string; contextual?: boolean }[] = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'insertar', label: 'Insertar' },
    { id: 'disposicion', label: 'Disposición' },
    { id: 'revisar', label: 'Revisar' },
    { id: 'vista', label: 'Vista' },
    ...(hf.active ? [{ id: 'encabezado' as const, label: 'Encabezado y pie', contextual: true }] : []),
    ...(s.inTable ? [{ id: 'tabla' as const, label: 'Tabla', contextual: true }] : []),
    ...(s.image ? [{ id: 'imagen' as const, label: 'Imagen', contextual: true }] : []),
  ];

  return (
    <div className="we-ribbon">
      <div className="we-tabs" role="tablist" aria-label="Cinta de opciones">
        <FileMenu {...props} />
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={current === t.id}
            className={`we-tab ${current === t.id ? 'is-active' : ''} ${t.contextual ? 'is-contextual' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="we-panel" role="tabpanel">
        {current === 'inicio' && <HomeTab {...props} />}
        {current === 'insertar' && <InsertTab {...props} />}
        {current === 'disposicion' && <LayoutTab {...props} />}
        {current === 'revisar' && <ReviewTab {...props} />}
        {current === 'vista' && <ViewTab {...props} />}
        {current === 'tabla' && <TableTab {...props} />}
        {current === 'imagen' && <ImageTab {...props} />}
        {current === 'encabezado' && <HeaderFooterTab {...props} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Archivo
// ---------------------------------------------------------------------------

function FileMenu({ actions, hasSaveHandler }: RibbonProps) {
  return (
    <Dropdown title="Archivo" trigger={<span className="we-file-tab">Archivo</span>} panelClassName="we-file-menu">
      {(close) => {
        const run = (fn: () => void) => () => {
          close();
          fn();
        };
        return (
          <>
            <MenuItem icon={<FilePlus size={ICON} />} onSelect={run(actions.newDocument)}>Nuevo documento</MenuItem>
            <MenuItem icon={<FolderOpen size={ICON} />} hint="Ctrl+O" onSelect={run(actions.openFile)}>Abrir (.docx, .html, .txt)…</MenuItem>
            <MenuSeparator />
            {hasSaveHandler && (
              <MenuItem icon={<Save size={ICON} />} hint="Ctrl+S" onSelect={run(actions.save)}>Guardar</MenuItem>
            )}
            <MenuItem icon={<FileDown size={ICON} />} hint={hasSaveHandler ? undefined : 'Ctrl+S'} onSelect={run(actions.saveDocx)}>
              Descargar como Word (.docx)
            </MenuItem>
            <MenuItem icon={<FileCode size={ICON} />} onSelect={run(actions.exportHtml)}>Descargar como HTML</MenuItem>
            <MenuItem icon={<Printer size={ICON} />} hint="Ctrl+P" onSelect={run(actions.print)}>Imprimir o guardar como PDF…</MenuItem>
          </>
        );
      }}
    </Dropdown>
  );
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------

const STYLE_GALLERY: { id: BlockStyle; label: string; className: string }[] = [
  { id: 'normal', label: 'Normal', className: 'g-normal' },
  { id: 'nospacing', label: 'Sin espacio', className: 'g-normal' },
  { id: 'h1', label: 'Título 1', className: 'g-h1' },
  { id: 'h2', label: 'Título 2', className: 'g-h2' },
  { id: 'h3', label: 'Título 3', className: 'g-h3' },
  { id: 'h4', label: 'Título 4', className: 'g-h4' },
  { id: 'quote', label: 'Cita', className: 'g-quote' },
  { id: 'code', label: 'Código', className: 'g-code' },
];

export function applyBlockStyle(editor: Editor, style: BlockStyle) {
  const chain = editor.chain().focus();
  // Salimos de cita/código antes de aplicar otro estilo
  if (style !== 'quote' && editor.isActive('blockquote')) chain.lift('blockquote');
  if (style !== 'code' && editor.isActive('codeBlock')) chain.setParagraph();
  switch (style) {
    case 'normal':
      chain.setParagraph().setParagraphSpacing(null);
      break;
    case 'nospacing':
      chain.setParagraph().setParagraphSpacing('none');
      break;
    case 'quote':
      if (!editor.isActive('blockquote')) chain.setParagraph().setBlockquote();
      break;
    case 'code':
      chain.setCodeBlock();
      break;
    default:
      chain.setHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 | 4 });
  }
  chain.run();
}

async function pasteFromClipboard(editor: Editor, notify: (m: string) => void) {
  try {
    if (navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const html = await (await item.getType('text/html')).text();
          editor.chain().focus().insertContent(html).run();
          return;
        }
      }
    }
    const text = await navigator.clipboard.readText();
    editor.chain().focus().insertContent(text).run();
  } catch {
    notify('El navegador no permitió leer el portapapeles. Usa Ctrl+V.');
  }
}

function HomeTab({ editor, s, painterActive, onPainter, notify, view, onView }: RibbonProps) {
  const [textColor, setTextColor] = useState('#c00000');
  const [highlightColor, setHighlightColor] = useState('#ffff00');
  const [shadingColor, setShadingColor] = useState('#fff2cc');
  const chain = () => editor.chain().focus();

  const sizePt = fontSizeToPt(s.fontSize, DEFAULT_FONT_SIZE);
  const stepSize = (dir: 1 | -1) => {
    const next =
      dir > 0 ? FONT_SIZES.find((x) => x > sizePt) ?? sizePt + 10 : [...FONT_SIZES].reverse().find((x) => x < sizePt) ?? 1;
    chain().setFontSize(`${next}pt`).run();
  };

  const clipboardCmd = (cmd: 'copy' | 'cut') => {
    editor.view.focus();
    if (!document.execCommand(cmd)) notify(`Usa Ctrl+${cmd === 'copy' ? 'C' : 'X'}`);
  };

  return (
    <>
      <Group label="Portapapeles">
        <Btn title="Pegar" shortcut="Ctrl+V" size="lg" label="Pegar" onClick={() => pasteFromClipboard(editor, notify)}>
          <ClipboardPaste size={ICON_LG} />
        </Btn>
        <div className="we-col">
          <Btn title="Cortar" shortcut="Ctrl+X" disabled={s.selectionEmpty} onClick={() => clipboardCmd('cut')}>
            <Scissors size={ICON} />
          </Btn>
          <Btn title="Copiar" shortcut="Ctrl+C" disabled={s.selectionEmpty} onClick={() => clipboardCmd('copy')}>
            <Copy size={ICON} />
          </Btn>
          <Btn title="Copiar formato" active={painterActive} onClick={onPainter}>
            <Paintbrush size={ICON} />
          </Btn>
        </div>
      </Group>

      <Group label="Fuente">
        <Row>
          <Combo
            title="Fuente"
            width={150}
            value={s.fontFamily?.split(',')[0].replace(/["']/g, '') ?? DEFAULT_FONT}
            options={FONT_FAMILIES}
            renderOption={(f) => <span style={{ fontFamily: f }}>{f}</span>}
            onCommit={(f) => (f === DEFAULT_FONT ? chain().unsetFontFamily().run() : chain().setFontFamily(f).run())}
          />
          <Combo
            title="Tamaño de fuente"
            width={58}
            inputMode="decimal"
            value={String(sizePt)}
            options={FONT_SIZES.map(String)}
            onCommit={(v) => {
              const n = parseFloat(v.replace(',', '.'));
              if (n >= 1 && n <= 400) chain().setFontSize(`${n}pt`).run();
              else notify('El tamaño debe estar entre 1 y 400');
            }}
          />
          <Btn title="Aumentar tamaño" onClick={() => stepSize(1)}>
            <AArrowUp size={ICON} />
          </Btn>
          <Btn title="Reducir tamaño" onClick={() => stepSize(-1)}>
            <AArrowDown size={ICON} />
          </Btn>
          <Dropdown title="Cambiar mayúsculas y minúsculas" trigger={<CaseSensitive size={ICON} />} disabled={s.selectionEmpty}>
            {(close) => (
              <>
                {(
                  [
                    ['sentence', 'Tipo oración.'],
                    ['lower', 'minúsculas'],
                    ['upper', 'MAYÚSCULAS'],
                    ['title', 'Poner En Mayúsculas Cada Palabra'],
                    ['toggle', 'tIPO iNVERSO'],
                  ] as const
                ).map(([mode, label]) => (
                  <MenuItem
                    key={mode}
                    onSelect={() => {
                      close();
                      changeCase(editor, mode);
                    }}
                  >
                    {label}
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>
        </Row>
        <Row>
          <Btn title="Negrita" shortcut="Ctrl+B" active={s.bold} onClick={() => chain().toggleBold().run()}>
            <Bold size={ICON} />
          </Btn>
          <Btn title="Cursiva" shortcut="Ctrl+I" active={s.italic} onClick={() => chain().toggleItalic().run()}>
            <Italic size={ICON} />
          </Btn>
          <Btn title="Subrayado" shortcut="Ctrl+U" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
            <Underline size={ICON} />
          </Btn>
          <Btn title="Tachado" shortcut="Ctrl+Mayús+S" active={s.strike} onClick={() => chain().toggleStrike().run()}>
            <Strikethrough size={ICON} />
          </Btn>
          <Btn title="Superíndice" shortcut="Ctrl+." active={s.superscript} onClick={() => chain().toggleSuperscript().run()}>
            <Superscript size={ICON} />
          </Btn>
          <Btn title="Subíndice" shortcut="Ctrl+," active={s.subscript} onClick={() => chain().toggleSubscript().run()}>
            <Subscript size={ICON} />
          </Btn>
          <ColorPicker
            title="Color de resaltado"
            variant="highlight"
            icon={<Highlighter size={ICON} />}
            current={highlightColor}
            onChange={(c) => {
              if (c) {
                setHighlightColor(c);
                chain().setHighlight({ color: c }).run();
              } else chain().unsetHighlight().run();
            }}
          />
          <ColorPicker
            title="Color de fuente"
            icon={<Baseline size={ICON} />}
            current={textColor}
            onChange={(c) => {
              if (c) {
                setTextColor(c);
                chain().setColor(c).run();
              } else chain().unsetColor().run();
            }}
          />
          <Btn
            title="Borrar formato"
            onClick={() => chain().unsetAllMarks().unsetTextAlign().resetParagraphFormat().run()}
          >
            <RemoveFormatting size={ICON} />
          </Btn>
        </Row>
      </Group>

      <Group label="Párrafo">
        <Row>
          <Dropdown
            title="Viñetas"
            active={s.bulletList}
            onMainClick={() => chain().toggleBulletList().run()}
            trigger={<List size={ICON} />}
          >
            {(close) => (
              <>
                {(
                  [
                    ['disc', '●  Círculo relleno'],
                    ['circle', '○  Círculo'],
                    ['square', '■  Cuadrado'],
                  ] as const
                ).map(([style, label]) => (
                  <MenuItem
                    key={style}
                    active={s.bulletList && s.bulletStyle === style}
                    onSelect={() => {
                      close();
                      if (!editor.isActive('bulletList')) chain().toggleBulletList().run();
                      chain().updateAttributes('bulletList', { listStyle: style === 'disc' ? null : style }).run();
                    }}
                  >
                    {label}
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>
          <Dropdown
            title="Numeración"
            active={s.orderedList}
            onMainClick={() => chain().toggleOrderedList().run()}
            trigger={<ListOrdered size={ICON} />}
          >
            {(close) => (
              <>
                {(
                  [
                    ['1', '1. 2. 3.'],
                    ['a', 'a. b. c.'],
                    ['A', 'A. B. C.'],
                    ['i', 'i. ii. iii.'],
                    ['I', 'I. II. III.'],
                  ] as const
                ).map(([type, label]) => (
                  <MenuItem
                    key={type}
                    active={s.orderedList && s.orderedType === type}
                    onSelect={() => {
                      close();
                      if (!editor.isActive('orderedList')) chain().toggleOrderedList().run();
                      chain().updateAttributes('orderedList', { type: type === '1' ? null : type }).run();
                    }}
                  >
                    {label}
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>
          <Btn title="Lista de tareas" active={s.taskList} onClick={() => chain().toggleTaskList().run()}>
            <ListTodo size={ICON} />
          </Btn>
          <Btn title="Disminuir sangría" shortcut="Mayús+Tab" onClick={() => chain().decreaseIndent().run()}>
            <ListIndentDecrease size={ICON} />
          </Btn>
          <Btn title="Aumentar sangría" shortcut="Tab" onClick={() => chain().increaseIndent().run()}>
            <ListIndentIncrease size={ICON} />
          </Btn>
          <Dropdown title="Interlineado" trigger={<Rows3 size={ICON} />}>
            {(close) => (
              <>
                {LINE_SPACINGS.map((v) => (
                  <MenuItem
                    key={v}
                    active={(s.lineSpacing ?? '1.15') === v}
                    icon={(s.lineSpacing ?? '1.15') === v ? <Check size={14} /> : null}
                    onSelect={() => {
                      close();
                      chain().setLineSpacing(v === '1.15' ? null : v).run();
                    }}
                  >
                    {v.replace('.', ',')}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem
                  icon={s.blockStyle === 'nospacing' ? <Check size={14} /> : null}
                  onSelect={() => {
                    close();
                    chain().setParagraphSpacing(s.blockStyle === 'nospacing' ? null : 'none').run();
                  }}
                >
                  Quitar espacio después del párrafo
                </MenuItem>
              </>
            )}
          </Dropdown>
          <Btn
            title="Mostrar marcas de formato"
            active={view.showMarks}
            onClick={() => onView({ showMarks: !view.showMarks })}
          >
            <Pilcrow size={ICON} />
          </Btn>
        </Row>
        <Row>
          <Btn title="Alinear a la izquierda" shortcut="Ctrl+Mayús+L" active={s.textAlign === 'left'} onClick={() => chain().setTextAlign('left').run()}>
            <TextAlignStart size={ICON} />
          </Btn>
          <Btn title="Centrar" shortcut="Ctrl+Mayús+E" active={s.textAlign === 'center'} onClick={() => chain().setTextAlign('center').run()}>
            <TextAlignCenter size={ICON} />
          </Btn>
          <Btn title="Alinear a la derecha" shortcut="Ctrl+Mayús+R" active={s.textAlign === 'right'} onClick={() => chain().setTextAlign('right').run()}>
            <TextAlignEnd size={ICON} />
          </Btn>
          <Btn title="Justificar" shortcut="Ctrl+Mayús+J" active={s.textAlign === 'justify'} onClick={() => chain().setTextAlign('justify').run()}>
            <TextAlignJustify size={ICON} />
          </Btn>
          <ColorPicker
            title="Sombreado del párrafo"
            variant="fill"
            icon={<PaintBucket size={ICON} />}
            current={shadingColor}
            onChange={(c) => {
              if (c) setShadingColor(c);
              chain().setParagraphShading(c).run();
            }}
          />
          <Btn title="Cita" active={s.blockStyle === 'quote'} onClick={() => chain().toggleBlockquote().run()}>
            <Quote size={ICON} />
          </Btn>
        </Row>
      </Group>

      <Group label="Estilos" className="we-group-styles">
        <div className="we-gallery" role="listbox" aria-label="Estilos">
          {STYLE_GALLERY.map((g) => (
            <button
              key={g.id}
              type="button"
              role="option"
              aria-selected={s.blockStyle === g.id}
              className={`we-gallery-item ${g.className} ${s.blockStyle === g.id ? 'is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyBlockStyle(editor, g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Insertar
// ---------------------------------------------------------------------------

const SYMBOLS = '©®™°±×÷≠≤≥≈∞√∑πΩµ€£¥¢§¶†‡•…–—«»“”‘’¿¡←→↑↓↔⇒✓✔✗★☆♥♦♣♠½¼¾²³¹αβγδλσ'.split('');

export function InlineForm({
  label,
  placeholder,
  initial = '',
  submitLabel,
  onSubmit,
  extra,
}: {
  label: string;
  placeholder?: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  extra?: ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="we-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value.trim());
      }}
    >
      <label>
        {label}
        <input autoFocus value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="we-inline-actions">
        {extra}
        <button type="submit" className="we-primary">{submitLabel}</button>
      </div>
    </form>
  );
}

function InsertTab(props: RibbonProps) {
  const { editor, s, notify } = props;
  const chain = () => editor.chain().focus();
  const now = new Date();
  const dateFormats = [
    now.toLocaleDateString('es-PE'),
    now.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
    now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
  ];

  return (
    <>
      <Group label="Páginas">
        <Btn title="Salto de página" shortcut="Ctrl+Enter" size="lg" label="Salto de página" onClick={() => chain().setPageBreak().run()}>
          <SeparatorHorizontal size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Tablas">
        <Dropdown title="Tabla" size="lg" label="Tabla" trigger={<Table size={ICON_LG} />}>
          {(close) => (
            <>
              <TableGridPicker
                onPick={(rows, cols) => {
                  close();
                  chain().insertTable({ rows, cols, withHeaderRow: true }).run();
                }}
              />
              <MenuSeparator />
              <CustomTableForm
                onInsert={(rows, cols, header) => {
                  close();
                  chain().insertTable({ rows, cols, withHeaderRow: header }).run();
                }}
              />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Ilustraciones">
        <Dropdown title="Imagen" size="lg" label="Imagen" trigger={<ImagePlus size={ICON_LG} />}>
          {(close) => (
            <>
              <label className="we-menu-item">
                <span className="we-menu-icon"><ImageIcon size={ICON} /></span>
                Desde este equipo…
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    close();
                    if (file) insertImageFile(editor, file, notify);
                  }}
                />
              </label>
              <MenuSeparator />
              <InlineForm
                label="Desde una URL"
                placeholder="https://…"
                submitLabel="Insertar"
                onSubmit={(url) => {
                  if (!/^https?:\/\//i.test(url)) return notify('La URL debe empezar con http:// o https://');
                  close();
                  chain().setImage({ src: url }).run();
                }}
              />
            </>
          )}
        </Dropdown>
        <Btn title="Línea horizontal" size="lg" label="Línea" onClick={() => chain().setHorizontalRule().run()}>
          <Minus size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Vínculos">
        <Dropdown title="Vínculo" size="lg" label="Vínculo" active={!!s.link} trigger={<Link size={ICON_LG} />}>
          {(close) => (
            <InlineForm
              key={s.link ?? ''}
              label="Dirección"
              placeholder="https://ejemplo.com"
              initial={s.link ?? ''}
              submitLabel={s.link ? 'Actualizar' : 'Insertar'}
              extra={
                s.link ? (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      chain().extendMarkRange('link').unsetLink().run();
                    }}
                  >
                    <Unlink size={14} /> Quitar
                  </button>
                ) : null
              }
              onSubmit={(href) => {
                close();
                if (!href) return chain().extendMarkRange('link').unsetLink().run();
                const url = /^(https?:|mailto:|tel:|#)/i.test(href) ? href : `https://${href}`;
                if (editor.state.selection.empty && !s.link) {
                  chain().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href: url } }] }).run();
                } else {
                  chain().extendMarkRange('link').setLink({ href: url }).run();
                }
              }}
            />
          )}
        </Dropdown>
      </Group>

      <Group label="Encabezado y pie">
        <HeaderFooterMenus {...props} />
        <PageNumberMenu {...props} />
      </Group>

      <Group label="Texto">
        <Dropdown title="Fecha y hora" size="lg" label="Fecha y hora" trigger={<CalendarDays size={ICON_LG} />}>
          {(close) => (
            <>
              {dateFormats.map((f) => (
                <MenuItem
                  key={f}
                  onSelect={() => {
                    close();
                    chain().insertContent(f).run();
                  }}
                >
                  {f}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <Btn title="Bloque de código" size="lg" label="Código" active={s.blockStyle === 'code'} onClick={() => chain().toggleCodeBlock().run()}>
          <Code size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Símbolos">
        <Dropdown title="Símbolo" size="lg" label="Símbolo" trigger={<Omega size={ICON_LG} />} align="right">
          {(close) => (
            <div className="we-symbols">
              {SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  aria-label={`Insertar ${sym}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    close();
                    chain().insertContent(sym).run();
                  }}
                >
                  {sym}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      </Group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Revisar
// ---------------------------------------------------------------------------

function ReviewTab({ editor, s, view, onView, actions }: RibbonProps) {
  let paragraphs = 0;
  editor.state.doc.descendants((n) => {
    if (n.isTextblock && n.textContent.trim()) paragraphs++;
  });

  return (
    <>
      <Group label="Edición">
        <Btn title="Buscar" shortcut="Ctrl+F" size="lg" label="Buscar" onClick={() => actions.openFind('find')}>
          <Search size={ICON_LG} />
        </Btn>
        <Btn title="Reemplazar" shortcut="Ctrl+H" size="lg" label="Reemplazar" onClick={() => actions.openFind('replace')}>
          <Replace size={ICON_LG} />
        </Btn>
      </Group>
      <Group label="Revisión">
        <Btn
          title="Revisión ortográfica del navegador"
          size="lg"
          label="Ortografía"
          active={view.spellcheck}
          onClick={() => onView({ spellcheck: !view.spellcheck })}
        >
          <SpellCheck size={ICON_LG} />
        </Btn>
        <Dropdown title="Contar palabras" size="lg" label="Contar" trigger={<ScanText size={ICON_LG} />}>
          {() => (
            <dl className="we-stats">
              <dt>Palabras</dt>
              <dd>{s.words.toLocaleString('es-PE')}</dd>
              <dt>Caracteres (con espacios)</dt>
              <dd>{s.characters.toLocaleString('es-PE')}</dd>
              <dt>Caracteres (sin espacios)</dt>
              <dd>{editor.getText().replace(/\s/g, '').length.toLocaleString('es-PE')}</dd>
              <dt>Párrafos</dt>
              <dd>{paragraphs.toLocaleString('es-PE')}</dd>
            </dl>
          )}
        </Dropdown>
      </Group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

function ViewTab({ view, onView, actions }: RibbonProps) {
  return (
    <>
      <Group label="Vistas">
        <Btn
          title="Modo lectura"
          size="lg"
          label="Modo lectura"
          active={view.readMode}
          onClick={() => onView({ readMode: !view.readMode })}
        >
          <BookOpen size={ICON_LG} />
        </Btn>
        <Btn title="Pantalla completa" size="lg" label="Pantalla completa" onClick={actions.toggleFullscreen}>
          <Maximize2 size={ICON_LG} />
        </Btn>
      </Group>
      <Group label="Mostrar">
        <Btn title="Regla" size="lg" label="Regla" active={view.showRuler} onClick={() => onView({ showRuler: !view.showRuler })}>
          <RulerIcon size={ICON_LG} />
        </Btn>
        <Btn
          title="Marcas de formato"
          size="lg"
          label="Marcas ¶"
          active={view.showMarks}
          onClick={() => onView({ showMarks: !view.showMarks })}
        >
          <Eye size={ICON_LG} />
        </Btn>
      </Group>
      <Group label="Zoom">
        <Btn title="Alejar" size="lg" label="Alejar" onClick={() => onView({ zoom: Math.max(0.25, +(view.zoom - 0.1).toFixed(2)) })}>
          <ZoomOut size={ICON_LG} />
        </Btn>
        <Btn title="100 %" size="lg" label="100 %" onClick={() => onView({ zoom: 1 })}>
          <span className="we-zoom-badge">1:1</span>
        </Btn>
        <Btn title="Acercar" size="lg" label="Acercar" onClick={() => onView({ zoom: Math.min(3, +(view.zoom + 0.1).toFixed(2)) })}>
          <ZoomIn size={ICON_LG} />
        </Btn>
        <Btn title="Ajustar al ancho" size="lg" label="Ancho de página" onClick={actions.fitWidth}>
          <Columns3 size={ICON_LG} />
        </Btn>
      </Group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Imagen (contextual)
// ---------------------------------------------------------------------------

function ImageTab({ editor, s, settings }: RibbonProps) {
  const chain = () => editor.chain().focus();
  const { width } = pageDimensions(settings);
  const contentPx = ((width - settings.margins.left - settings.margins.right) / 2.54) * 96;

  const setWidthPercent = (pct: number) => {
    const { src } = editor.getAttributes('image');
    const img = new Image();
    img.onload = () => {
      const w = Math.round(contentPx * pct);
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
      chain().updateAttributes('image', { width: w, height: h }).run();
    };
    img.src = src;
  };

  return (
    <>
      <Group label="Alinear">
        <Btn title="Alinear a la izquierda" size="lg" label="Izquierda" active={s.imageAlign === 'left'} onClick={() => chain().updateAttributes('image', { align: 'left' }).run()}>
          <TextAlignStart size={ICON_LG} />
        </Btn>
        <Btn title="Centrar" size="lg" label="Centro" active={s.imageAlign === 'center'} onClick={() => chain().updateAttributes('image', { align: 'center' }).run()}>
          <TextAlignCenter size={ICON_LG} />
        </Btn>
        <Btn title="Alinear a la derecha" size="lg" label="Derecha" active={s.imageAlign === 'right'} onClick={() => chain().updateAttributes('image', { align: 'right' }).run()}>
          <TextAlignEnd size={ICON_LG} />
        </Btn>
      </Group>
      <Group label="Tamaño">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <Btn key={p} title={`${p * 100} % del ancho`} size="lg" label={`${p * 100} %`} onClick={() => setWidthPercent(p)}>
            <span className="we-zoom-badge">{p * 100}</span>
          </Btn>
        ))}
        <Btn title="Tamaño original" size="lg" label="Original" onClick={() => chain().updateAttributes('image', { width: null, height: null }).run()}>
          <ImageIcon size={ICON_LG} />
        </Btn>
      </Group>
      <Group label="Accesibilidad">
        <Dropdown title="Texto alternativo" size="lg" label="Texto alt." trigger={<ScanText size={ICON_LG} />}>
          {(close) => (
            <InlineForm
              key={s.imageAlt}
              label="Describe la imagen"
              initial={s.imageAlt}
              submitLabel="Guardar"
              onSubmit={(alt) => {
                close();
                chain().updateAttributes('image', { alt }).run();
              }}
            />
          )}
        </Dropdown>
        <Btn title="Eliminar imagen" size="lg" label="Eliminar" onClick={() => chain().deleteSelection().run()}>
          <Trash size={ICON_LG} />
        </Btn>
      </Group>
    </>
  );
}
