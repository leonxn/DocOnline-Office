'use client';

import { CellSelection } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/react';
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownToLine,
  ArrowUpFromLine,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  CalendarDays,
  Columns2,
  Paintbrush2,
  Columns3,
  Frame,
  Grid3x3,
  Hash,
  ImagePlus,
  Maximize2,
  MousePointerClick,
  PaintBucket,
  Palette,
  PanelBottom,
  PanelTop,
  RectangleHorizontal,
  RectangleVertical,
  SeparatorHorizontal,
  Stamp,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  TextWrap,
  Trash,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { TABLE_STYLES } from '../extensions/table-ext';
import { INDENT_STEP_CM } from '../extensions/paragraph-format';
import { MARGIN_PRESETS, PAGE_SIZES, THEME_COLORS, isHeaderFooterEmpty, pageDimensions, type PageSizeId } from '../types';
import { Btn, ColorPicker, Dropdown, Group, MenuItem, MenuSeparator, Row, TableGridPicker } from './controls';
import { insertImageFile } from './image-utils';
import type { RibbonProps } from './Ribbon';
import { currentTable, distributeColumns, scaleTableTo, selectRowOrColumn, selectTable, setColumnWidths } from './table-utils';

const ICON = 16;
const ICON_LG = 22;

// ---------------------------------------------------------------------------
// Controles pequeños
// ---------------------------------------------------------------------------

/** Campo numérico con etiqueta y unidad (como "Sangría izquierda [0 cm]" de Word). */
export function NumberInput({
  label,
  value,
  unit,
  step = 0.1,
  min = 0,
  max = 100,
  onCommit,
  disabled,
  width = 64,
}: {
  label: string;
  value: number;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  width?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Math.round(value * 100) / 100)), [value]);
  const commit = (raw: string) => {
    const v = parseFloat(raw.replace(',', '.'));
    if (!Number.isNaN(v) && v >= min && v <= max) onCommit(Math.round(v * 100) / 100);
  };
  return (
    <label className={`we-num ${disabled ? 'is-disabled' : ''}`}>
      <span className="we-num-label">{label}</span>
      <span className="we-num-box">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={draft}
          disabled={disabled}
          style={{ width }}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
          onBlur={() => setDraft(String(Math.round(value * 100) / 100))}
        />
        <span className="we-num-unit">{unit}</span>
      </span>
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="we-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** "Insertar tabla…" con número de filas y columnas. */
export function CustomTableForm({ onInsert }: { onInsert: (rows: number, cols: number, header: boolean) => void }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [header, setHeader] = useState(true);
  return (
    <form
      className="we-inline-form we-table-form"
      onSubmit={(e) => {
        e.preventDefault();
        onInsert(Math.min(100, Math.max(1, rows)), Math.min(30, Math.max(1, cols)), header);
      }}
    >
      <div className="we-menu-title">Insertar tabla personalizada</div>
      <div className="we-row">
        <NumberInput label="Columnas" value={cols} unit="" step={1} min={1} max={30} width={52} onCommit={setCols} />
        <NumberInput label="Filas" value={rows} unit="" step={1} min={1} max={100} width={52} onCommit={setRows} />
      </div>
      <Check label="Primera fila como encabezado" checked={header} onChange={setHeader} />
      <div className="we-inline-actions">
        <button type="submit" className="we-primary">Insertar</button>
      </div>
    </form>
  );
}

const nowFormats = () => {
  const now = new Date();
  return [
    now.toLocaleDateString('es-PE'),
    now.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
  ];
};

// ---------------------------------------------------------------------------
// Encabezado y pie de página
// ---------------------------------------------------------------------------

export function HeaderFooterMenus({ hf }: RibbonProps) {
  const header = !isHeaderFooterEmpty(hf.settings.header);
  const footer = !isHeaderFooterEmpty(hf.settings.footer);
  return (
    <>
      <Dropdown title="Encabezado" size="lg" label="Encabezado" active={hf.active?.kind === 'header'} trigger={<PanelTop size={ICON_LG} />}>
        {(close) => (
          <>
            <MenuItem icon={<PanelTop size={ICON} />} hint="Doble clic arriba" onSelect={() => { close(); hf.enter('header'); }}>
              Editar encabezado
            </MenuItem>
            <MenuItem icon={<Trash size={ICON} />} onSelect={() => { close(); hf.remove('header'); }}>
              {header ? 'Quitar encabezado' : 'Quitar encabezado (vacío)'}
            </MenuItem>
          </>
        )}
      </Dropdown>
      <Dropdown title="Pie de página" size="lg" label="Pie de página" active={hf.active?.kind === 'footer'} trigger={<PanelBottom size={ICON_LG} />}>
        {(close) => (
          <>
            <MenuItem icon={<PanelBottom size={ICON} />} hint="Doble clic abajo" onSelect={() => { close(); hf.enter('footer'); }}>
              Editar pie de página
            </MenuItem>
            <MenuItem icon={<Trash size={ICON} />} onSelect={() => { close(); hf.remove('footer'); }}>
              {footer ? 'Quitar pie de página' : 'Quitar pie de página (vacío)'}
            </MenuItem>
          </>
        )}
      </Dropdown>
    </>
  );
}

export function PageNumberMenu({ hf }: RibbonProps) {
  return (
    <Dropdown title="Número de página" size="lg" label="N.º de página" trigger={<Hash size={ICON_LG} />}>
      {(close) => {
        const go = (p: Parameters<typeof hf.insertPageNumber>[0]) => () => {
          close();
          hf.insertPageNumber(p);
        };
        return (
          <div className="we-pn-menu">
            <div className="we-menu-title">Principio de página</div>
            <div className="we-pn-row">
              <button type="button" onClick={go('header-left')}>Izquierda</button>
              <button type="button" onClick={go('header-center')}>Centro</button>
              <button type="button" onClick={go('header-right')}>Derecha</button>
            </div>
            <div className="we-menu-title">Final de página</div>
            <div className="we-pn-row">
              <button type="button" onClick={go('footer-left')}>Izquierda</button>
              <button type="button" onClick={go('footer-center')}>Centro</button>
              <button type="button" onClick={go('footer-right')}>Derecha</button>
            </div>
            <MenuItem onSelect={go('footer-center-total')}>«Página X de Y» abajo al centro</MenuItem>
            <MenuItem onSelect={go('footer-right-total')}>«Página X de Y» abajo a la derecha</MenuItem>
            <MenuSeparator />
            <div className="we-menu-title">Posición actual {hf.active ? '' : '(abre el encabezado o pie)'}</div>
            <MenuItem onSelect={go('current')}>Número de página</MenuItem>
            <MenuItem onSelect={go('current-total')}>«Página X de Y»</MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Trash size={ICON} />}
              onSelect={() => {
                close();
                hf.removePageNumbers();
              }}
            >
              Quitar números de página
            </MenuItem>
          </div>
        );
      }}
    </Dropdown>
  );
}

export function HeaderFooterTab(props: RibbonProps) {
  const { editor, hf, notify } = props;
  const st = hf.settings;
  const chain = () => editor.chain().focus();
  return (
    <>
      <Group label="Encabezado y pie">
        <HeaderFooterMenus {...props} />
        {hf.active?.kind === 'header' ? (
          <Btn title="Ir al pie de página" size="lg" label="Ir al pie" onClick={() => hf.switchTo('footer')}>
            <ArrowDownToLine size={ICON_LG} />
          </Btn>
        ) : (
          <Btn title="Ir al encabezado" size="lg" label="Ir al encabezado" onClick={() => hf.switchTo('header')}>
            <ArrowUpFromLine size={ICON_LG} />
          </Btn>
        )}
      </Group>

      <Group label="Insertar">
        <PageNumberMenu {...props} />
        <Dropdown title="Fecha y hora" size="lg" label="Fecha y hora" trigger={<CalendarDays size={ICON_LG} />}>
          {(close) => (
            <>
              {nowFormats().map((f) => (
                <MenuItem key={f} onSelect={() => { close(); chain().insertContent(f).run(); }}>
                  {f}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <label className="we-btn we-btn-lg" data-tip="Imagen (logo)">
          <ImagePlus size={ICON_LG} />
          <span className="we-btn-label">Imagen</span>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) insertImageFile(editor, file, notify);
            }}
          />
        </label>
        <Dropdown title="Tabla" size="lg" label="Tabla" trigger={<Table size={ICON_LG} />}>
          {(close) => (
            <TableGridPicker
              onPick={(rows, cols) => {
                close();
                // En encabezados se usa sin bordes para maquetar (logo | título | fecha)
                chain().insertTable({ rows, cols, withHeaderRow: false }).updateAttributes('table', { borders: 'none' }).run();
              }}
            />
          )}
        </Dropdown>
      </Group>

      <Group label="Posición">
        <div className="we-col we-col-gap">
          <NumberInput
            label="Encabezado desde arriba"
            value={st.headerDistance}
            unit="cm"
            step={0.05}
            max={10}
            onCommit={(v) => hf.update({ headerDistance: v })}
          />
          <NumberInput
            label="Pie de página desde abajo"
            value={st.footerDistance}
            unit="cm"
            step={0.05}
            max={10}
            onCommit={(v) => hf.update({ footerDistance: v })}
          />
        </div>
      </Group>

      <Group label="Opciones">
        <div className="we-col we-col-gap">
          <Check label="Primera página diferente" checked={st.differentFirst} onChange={(v) => hf.update({ differentFirst: v })} />
          <Check
            label="Páginas pares e impares diferentes"
            checked={st.differentOddEven}
            onChange={(v) => hf.update({ differentOddEven: v })}
          />
        </div>
      </Group>

      <Group label="Cerrar">
        <Btn title="Cerrar encabezado y pie de página" shortcut="Esc" size="lg" label="Cerrar" className="we-btn-close" onClick={hf.exit}>
          <X size={ICON_LG} />
        </Btn>
      </Group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Diseño
// ---------------------------------------------------------------------------

/** Bloques en columnas (tabla sin bordes, que en Word también se ve como columnas). */
const COLUMN_LAYOUTS: { id: string; label: string; hint: string; widths: number[] }[] = [
  { id: 'two', label: 'Dos columnas', hint: '½ · ½', widths: [1, 1] },
  { id: 'three', label: 'Tres columnas', hint: '⅓ · ⅓ · ⅓', widths: [1, 1, 1] },
  { id: 'left', label: 'Izquierda angosta', hint: '⅓ · ⅔', widths: [1, 2] },
  { id: 'right', label: 'Derecha angosta', hint: '⅔ · ⅓', widths: [2, 1] },
];

function insertColumns(editor: Editor, ratios: number[], totalPx: number) {
  editor
    .chain()
    .focus()
    .insertTable({ rows: 1, cols: ratios.length, withHeaderRow: false })
    .updateAttributes('table', { borders: 'none', tableStyle: 'plain' })
    .run();
  const info = currentTable(editor);
  if (!info) return;
  const sum = ratios.reduce((a, b) => a + b, 0);
  setColumnWidths(editor, info, ratios.map((r) => (r / sum) * totalPx));
}

// ---------------------------------------------------------------------------
// Disposición (Diseño en Word)
// ---------------------------------------------------------------------------

const WATERMARKS = ['CONFIDENCIAL', 'BORRADOR', 'URGENTE', 'COPIA', 'NO COPIAR'];

export function LayoutTab(props: RibbonProps) {
  const { editor, s, settings, onSettings, contentWidthPx } = props;
  const m = settings.margins;
  const [custom, setCustom] = useState('');
  const defaultAfter = s.blockStyle === 'nospacing' ? 0 : 8;
  return (
    <>
      <Group label="Configurar página">
        <Dropdown title="Márgenes" size="lg" label="Márgenes" trigger={<Maximize2 size={ICON_LG} />}>
          {(close) => (
            <>
              {MARGIN_PRESETS.map((p) => (
                <MenuItem
                  key={p.id}
                  active={JSON.stringify(p.margins) === JSON.stringify(m)}
                  hint={`${p.margins.top} / ${p.margins.left} cm`}
                  onSelect={() => {
                    close();
                    onSettings({ margins: p.margins });
                  }}
                >
                  {p.label}
                </MenuItem>
              ))}
              <MenuSeparator />
              <div className="we-margins-form">
                <div className="we-menu-title">Personalizados</div>
                <NumberInput label="Superior" value={m.top} unit="cm" max={10} onCommit={(top) => onSettings({ margins: { ...m, top } })} />
                <NumberInput label="Inferior" value={m.bottom} unit="cm" max={10} onCommit={(bottom) => onSettings({ margins: { ...m, bottom } })} />
                <NumberInput label="Izquierdo" value={m.left} unit="cm" max={10} onCommit={(left) => onSettings({ margins: { ...m, left } })} />
                <NumberInput label="Derecho" value={m.right} unit="cm" max={10} onCommit={(right) => onSettings({ margins: { ...m, right } })} />
              </div>
            </>
          )}
        </Dropdown>
        <Dropdown
          title="Orientación"
          size="lg"
          label="Orientación"
          trigger={settings.orientation === 'portrait' ? <RectangleVertical size={ICON_LG} /> : <RectangleHorizontal size={ICON_LG} />}
        >
          {(close) => (
            <>
              <MenuItem icon={<RectangleVertical size={ICON} />} active={settings.orientation === 'portrait'} onSelect={() => { close(); onSettings({ orientation: 'portrait' }); }}>
                Vertical
              </MenuItem>
              <MenuItem icon={<RectangleHorizontal size={ICON} />} active={settings.orientation === 'landscape'} onSelect={() => { close(); onSettings({ orientation: 'landscape' }); }}>
                Horizontal
              </MenuItem>
            </>
          )}
        </Dropdown>
        <Dropdown title="Tamaño" size="lg" label="Tamaño" trigger={<Columns3 size={ICON_LG} />}>
          {(close) => (
            <>
              {(Object.keys(PAGE_SIZES) as PageSizeId[]).map((id) => (
                <MenuItem key={id} active={settings.size === id} onSelect={() => { close(); onSettings({ size: id }); }}>
                  {PAGE_SIZES[id].label}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <Dropdown title="Columnas" size="lg" label="Columnas" trigger={<Columns2 size={ICON_LG} />}>
          {(close) => (
            <>
              <div className="we-menu-title">Insertar bloque en columnas</div>
              {COLUMN_LAYOUTS.map((c) => (
                <MenuItem
                  key={c.id}
                  hint={c.hint}
                  onSelect={() => {
                    close();
                    insertColumns(editor, c.widths, contentWidthPx);
                  }}
                >
                  {c.label}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <Dropdown title="Saltos" size="lg" label="Saltos" trigger={<SeparatorHorizontal size={ICON_LG} />}>
          {(close) => (
            <MenuItem hint="Ctrl+Enter" onSelect={() => { close(); editor.chain().focus().setPageBreak().run(); }}>
              Salto de página
            </MenuItem>
          )}
        </Dropdown>
        <Btn
          title="Guiones automáticos"
          size="lg"
          label="Guiones"
          active={settings.hyphenation}
          onClick={() => onSettings({ hyphenation: !settings.hyphenation })}
        >
          <TextWrap size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Encabezado y pie">
        <HeaderFooterMenus {...props} />
        <PageNumberMenu {...props} />
      </Group>

      <Group label="Párrafo">
        <div className="we-grid2">
          <NumberInput
            label="Sangría izquierda"
            value={s.indentLeftCm}
            unit="cm"
            max={15}
            onCommit={(v) => editor.commands.setParagraphIndents({ indent: Math.round((v / INDENT_STEP_CM) * 1000) / 1000 })}
          />
          <NumberInput
            label="Espacio antes"
            value={s.spaceBefore ?? 0}
            unit="pt"
            step={1}
            max={200}
            onCommit={(v) => editor.commands.setParagraphSpaces({ spaceBefore: v })}
          />
          <NumberInput
            label="Sangría derecha"
            value={s.indentRightCm}
            unit="cm"
            max={15}
            onCommit={(v) => editor.commands.setParagraphIndents({ indentRight: v })}
          />
          <NumberInput
            label="Espacio después"
            value={s.spaceAfter ?? defaultAfter}
            unit="pt"
            step={1}
            max={200}
            onCommit={(v) => editor.commands.setParagraphSpaces({ spaceAfter: v })}
          />
        </div>
      </Group>

      <Group label="Diseño del documento">
        <Dropdown
          title="Colores de los títulos"
          size="lg"
          label="Colores"
          trigger={
            <span className="we-color-icon">
              <Paintbrush2 size={ICON_LG} />
              <span className="we-color-bar" style={{ background: settings.themeColor, width: 20 }} />
            </span>
          }
        >
          {(close) => (
            <>
              {THEME_COLORS.map((t) => (
                <MenuItem
                  key={t.id}
                  active={settings.themeColor.toLowerCase() === t.color}
                  icon={<span className="we-swatch" style={{ background: t.color, width: 14, height: 14 }} />}
                  onSelect={() => {
                    close();
                    onSettings({ themeColor: t.color });
                  }}
                >
                  {t.label}
                </MenuItem>
              ))}
              <MenuSeparator />
              <label className="we-menu-item we-custom-color">
                <input type="color" value={settings.themeColor} onChange={(e) => onSettings({ themeColor: e.target.value })} aria-label="Color personalizado" />
                Color personalizado…
              </label>
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Fondo de página">
        <Dropdown title="Marca de agua" size="lg" label="Marca de agua" active={!!settings.watermark} trigger={<Stamp size={ICON_LG} />}>
          {(close) => (
            <>
              <MenuItem active={!settings.watermark} onSelect={() => { close(); onSettings({ watermark: '' }); }}>
                Sin marca de agua
              </MenuItem>
              {WATERMARKS.map((w) => (
                <MenuItem key={w} active={settings.watermark === w} onSelect={() => { close(); onSettings({ watermark: w }); }}>
                  {w}
                </MenuItem>
              ))}
              <MenuSeparator />
              <form
                className="we-inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  close();
                  onSettings({ watermark: custom.trim().slice(0, 40) });
                }}
              >
                <label>
                  Texto personalizado
                  <input value={custom} maxLength={40} placeholder="Ej.: RESERVADO" onChange={(e) => setCustom(e.target.value)} />
                </label>
                <div className="we-inline-actions">
                  <button type="submit" className="we-primary">Aplicar</button>
                </div>
              </form>
            </>
          )}
        </Dropdown>
        <ColorPicker
          title="Color de página"
          variant="fill"
          icon={<Palette size={ICON} />}
          current={settings.pageColor ?? '#fff2cc'}
          onChange={(c) => onSettings({ pageColor: c })}
        />
      </Group>

      <Group label="Tamaño actual">
        <div className="we-page-info">
          {(() => {
            const d = pageDimensions(settings);
            return `${PAGE_SIZES[settings.size].label.split(' ')[0]} · ${d.width} × ${d.height} cm`;
          })()}
          <br />
          Márgenes: {m.top} · {m.right} · {m.bottom} · {m.left} cm
        </div>
      </Group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tabla (contextual)
// ---------------------------------------------------------------------------

function selectCell(editor: Editor) {
  const info = currentTable(editor);
  if (!info || info.cellRel === null) return;
  const sel = CellSelection.create(editor.state.doc, info.pos + 1 + info.cellRel);
  editor.view.dispatch(editor.state.tr.setSelection(sel));
  editor.view.focus();
}

export function TableTab({ editor, s, contentWidthPx }: RibbonProps) {
  const chain = () => editor.chain().focus();
  const t = s.table;
  const withTable = (fn: (info: NonNullable<ReturnType<typeof currentTable>>) => void) => () => {
    const info = currentTable(editor);
    if (info) fn(info);
  };
  const setTable = (attrs: Record<string, unknown>) => chain().updateAttributes('table', attrs).run();

  return (
    <>
      <Group label="Seleccionar">
        <Dropdown title="Seleccionar" size="lg" label="Seleccionar" trigger={<MousePointerClick size={ICON_LG} />}>
          {(close) => (
            <>
              <MenuItem onSelect={() => { close(); selectCell(editor); }}>Celda</MenuItem>
              <MenuItem onSelect={withTable((i) => { close(); selectRowOrColumn(editor, i, 'column'); })}>Columna</MenuItem>
              <MenuItem onSelect={withTable((i) => { close(); selectRowOrColumn(editor, i, 'row'); })}>Fila</MenuItem>
              <MenuItem onSelect={withTable((i) => { close(); selectTable(editor, i); })}>Tabla</MenuItem>
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Filas y columnas">
        <Btn title="Insertar fila arriba" size="lg" label="Arriba" onClick={() => chain().addRowBefore().run()}>
          <BetweenHorizontalStart size={ICON_LG} />
        </Btn>
        <Btn title="Insertar fila abajo" size="lg" label="Abajo" onClick={() => chain().addRowAfter().run()}>
          <BetweenHorizontalEnd size={ICON_LG} />
        </Btn>
        <Btn title="Insertar columna a la izquierda" size="lg" label="Izquierda" onClick={() => chain().addColumnBefore().run()}>
          <BetweenVerticalStart size={ICON_LG} />
        </Btn>
        <Btn title="Insertar columna a la derecha" size="lg" label="Derecha" onClick={() => chain().addColumnAfter().run()}>
          <BetweenVerticalEnd size={ICON_LG} />
        </Btn>
        <Dropdown title="Eliminar" size="lg" label="Eliminar" trigger={<Trash size={ICON_LG} />}>
          {(close) => (
            <>
              <MenuItem onSelect={() => { close(); chain().deleteRow().run(); }}>Eliminar filas</MenuItem>
              <MenuItem onSelect={() => { close(); chain().deleteColumn().run(); }}>Eliminar columnas</MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => { close(); chain().deleteTable().run(); }}>Eliminar tabla</MenuItem>
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Combinar">
        <Btn title="Combinar celdas" size="lg" label="Combinar" disabled={!s.canMerge} onClick={() => chain().mergeCells().run()}>
          <TableCellsMerge size={ICON_LG} />
        </Btn>
        <Btn title="Dividir celda" size="lg" label="Dividir" disabled={!s.canSplit} onClick={() => chain().splitCell().run()}>
          <TableCellsSplit size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Tamaño">
        <div className="we-col we-col-gap">
          <NumberInput
            label="Alto de fila"
            value={t?.rowHeight ?? 0}
            unit="cm"
            step={0.1}
            max={20}
            onCommit={(v) => chain().updateAttributes('tableRow', { height: v > 0 ? v : null }).run()}
          />
          <Row>
            <Btn title="Distribuir columnas" label="Distribuir" onClick={withTable((i) => distributeColumns(editor, i))}>
              <Columns3 size={ICON} />
            </Btn>
            <Dropdown title="Autoajustar" label="Autoajustar" trigger={<Maximize2 size={ICON} />}>
              {(close) => (
                <>
                  <MenuItem onSelect={withTable((i) => { close(); setColumnWidths(editor, i, null); })}>
                    Ajustar al contenido de la página (automático)
                  </MenuItem>
                  <MenuItem onSelect={withTable((i) => { close(); scaleTableTo(editor, i, contentWidthPx); })}>
                    Ajustar al ancho de la página
                  </MenuItem>
                </>
              )}
            </Dropdown>
          </Row>
        </div>
      </Group>

      <Group label="Alineación">
        <div className="we-col">
          <Row>
            <Btn title="Celda: arriba" active={t?.cellVAlign === 'top'} onClick={() => chain().setCellAttribute('verticalAlign', 'top').run()}>
              <AlignVerticalJustifyStart size={ICON} />
            </Btn>
            <Btn title="Celda: centro vertical" active={t?.cellVAlign === 'middle'} onClick={() => chain().setCellAttribute('verticalAlign', 'middle').run()}>
              <AlignVerticalJustifyCenter size={ICON} />
            </Btn>
            <Btn title="Celda: abajo" active={t?.cellVAlign === 'bottom'} onClick={() => chain().setCellAttribute('verticalAlign', 'bottom').run()}>
              <AlignVerticalJustifyEnd size={ICON} />
            </Btn>
          </Row>
          <Row>
            <Btn title="Tabla a la izquierda" active={t?.align === 'left'} onClick={() => setTable({ align: 'left' })}>
              <TextAlignStart size={ICON} />
            </Btn>
            <Btn title="Tabla centrada" active={t?.align === 'center'} onClick={() => setTable({ align: 'center' })}>
              <TextAlignCenter size={ICON} />
            </Btn>
            <Btn title="Tabla a la derecha" active={t?.align === 'right'} onClick={() => setTable({ align: 'right' })}>
              <TextAlignEnd size={ICON} />
            </Btn>
          </Row>
        </div>
      </Group>

      <Group label="Estilos de tabla" className="we-group-tblstyles">
        <div className="we-tblstyle-gallery" role="listbox" aria-label="Estilos de tabla">
          {TABLE_STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              role="option"
              aria-selected={t?.style === st.id}
              title={st.label}
              className={`we-tblstyle ${t?.style === st.id ? 'is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTable({ tableStyle: st.id, borders: st.id === 'minimal' ? 'horizontal' : t?.borders ?? 'all' })}
            >
              <span className={`we-tblstyle-preview we-tblstyle-${st.id}`} aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
              <span className="we-tblstyle-name">{st.label}</span>
            </button>
          ))}
        </div>
        <div className="we-col we-col-gap we-tblstyle-options">
          <Check label="Fila de encabezado" checked={!!t?.headerRow} onChange={() => chain().toggleHeaderRow().run()} />
          <Check label="Primera columna" checked={!!t?.headerCol} onChange={() => chain().toggleHeaderColumn().run()} />
          <Check label="Filas con bandas" checked={!!t?.banded} onChange={(v) => setTable({ banded: v })} />
        </div>
      </Group>

      <Group label="Bordes y sombreado">
        <div className="we-col">
          <Row>
            <ColorPicker
              title="Sombreado de celda"
              variant="fill"
              icon={<PaintBucket size={ICON} />}
              current={t?.cellBg ?? '#d9ead3'}
              onChange={(c) => chain().setCellAttribute('backgroundColor', c).run()}
            />
            <Dropdown title="Bordes" label="Bordes" trigger={<Grid3x3 size={ICON} />}>
              {(close) => (
                <>
                  {(
                    [
                      ['all', 'Todos los bordes'],
                      ['outer', 'Bordes exteriores'],
                      ['inner', 'Bordes interiores'],
                      ['horizontal', 'Solo líneas horizontales'],
                      ['none', 'Sin bordes'],
                    ] as const
                  ).map(([id, label]) => (
                    <MenuItem key={id} active={t?.borders === id} onSelect={() => { close(); setTable({ borders: id }); }}>
                      {label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Dropdown>
          </Row>
          <Row>
            <ColorPicker
              title="Color de borde"
              icon={<Frame size={ICON} />}
              current={t?.borderColor ?? '#8c8c8c'}
              onChange={(c) => setTable({ borderColor: c })}
            />
          </Row>
        </div>
      </Group>
    </>
  );
}
