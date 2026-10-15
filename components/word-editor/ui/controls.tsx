'use client';

import { ChevronDown } from 'lucide-react';
import {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from 'react';

// ---------------------------------------------------------------------------
// Botón de la cinta
// ---------------------------------------------------------------------------

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  /** Texto del tooltip y del lector de pantalla. */
  title: string;
  /** Atajo que se muestra en el tooltip, p. ej. "Ctrl+B". */
  shortcut?: string;
  active?: boolean;
  /** Muestra el texto junto al ícono. */
  label?: string;
  size?: 'sm' | 'lg';
}

export function Btn({ title, shortcut, active, label, size = 'sm', className = '', children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={`we-btn we-btn-${size} ${active ? 'is-active' : ''} ${className}`}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      data-tip={shortcut ? `${title} (${shortcut})` : title}
      // Evita que el editor pierda la selección al hacer clic en la cinta
      onMouseDown={(e) => e.preventDefault()}
      {...rest}
    >
      {children}
      {label && <span className="we-btn-label">{label}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Popover / menú desplegable
// ---------------------------------------------------------------------------

export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref, close: useCallback(() => setOpen(false), []) };
}

interface DropdownProps {
  title: string;
  /** Contenido del botón (ícono, texto…). */
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  active?: boolean;
  disabled?: boolean;
  align?: 'left' | 'right';
  size?: 'sm' | 'lg';
  label?: string;
  /** Si existe, el botón se divide: la parte izquierda ejecuta esta acción y la flecha abre el menú. */
  onMainClick?: () => void;
  panelClassName?: string;
}

export function Dropdown({
  title,
  trigger,
  children,
  active,
  disabled,
  align = 'left',
  size = 'sm',
  label,
  onMainClick,
  panelClassName = '',
}: DropdownProps) {
  const { open, setOpen, ref, close } = usePopover();
  const panelId = useId();

  return (
    <div className={`we-dropdown ${onMainClick ? 'is-split' : ''}`} ref={ref}>
      {onMainClick ? (
        <>
          <Btn title={title} active={active} disabled={disabled} onClick={onMainClick} size={size} label={label}>
            {trigger}
          </Btn>
          <button
            type="button"
            className="we-split-arrow"
            aria-label={`Más opciones: ${title}`}
            aria-expanded={open}
            aria-controls={panelId}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown size={12} />
          </button>
        </>
      ) : (
        <Btn
          title={title}
          active={active || open}
          disabled={disabled}
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
          size={size}
          label={label}
        >
          {trigger}
          <ChevronDown size={12} className="we-caret" />
        </Btn>
      )}
      {open && (
        <div id={panelId} className={`we-popover we-popover-${align} ${panelClassName}`} role="menu">
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  active,
  icon,
  hint,
  style,
}: {
  children: ReactNode;
  onSelect: () => void;
  active?: boolean;
  icon?: ReactNode;
  hint?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`we-menu-item ${active ? 'is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      style={style}
    >
      <span className="we-menu-icon">{icon}</span>
      <span className="we-menu-text">{children}</span>
      {hint && <span className="we-menu-hint">{hint}</span>}
    </button>
  );
}

export const MenuSeparator = () => <div className="we-menu-sep" role="separator" />;

// ---------------------------------------------------------------------------
// Combo editable (fuente y tamaño): se puede escribir o elegir de la lista
// ---------------------------------------------------------------------------

interface ComboProps {
  title: string;
  value: string;
  options: string[];
  onCommit: (value: string) => void;
  width: number;
  renderOption?: (option: string) => ReactNode;
  inputMode?: 'text' | 'decimal';
}

export function Combo({ title, value, options, onCommit, width, renderOption, inputMode = 'text' }: ComboProps) {
  const { open, setOpen, ref, close } = usePopover();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = (v: string) => {
    close();
    if (v.trim()) onCommit(v.trim());
    else setDraft(value);
  };

  return (
    <div className="we-combo" ref={ref} style={{ width }}>
      <input
        aria-label={title}
        data-tip={title}
        value={draft}
        inputMode={inputMode}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === 'Escape') {
            setDraft(value);
            close();
          }
        }}
        onBlur={() => !open && setDraft(value)}
      />
      <button
        type="button"
        aria-label={`Abrir lista: ${title}`}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="we-popover we-popover-left we-combo-list" role="listbox">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={o === value}
              className={`we-menu-item ${o === value ? 'is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(o)}
            >
              {renderOption ? renderOption(o) : o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selector de color
// ---------------------------------------------------------------------------

const THEME_COLORS = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
];

const HIGHLIGHT_COLORS = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff9900', '#ff0000', '#c9daf8', '#d9d9d9'];

interface ColorPickerProps {
  title: string;
  icon: ReactNode;
  /** Color aplicado con el clic principal (el último elegido). */
  current: string;
  onChange: (color: string | null) => void;
  variant?: 'text' | 'highlight' | 'fill';
}

export function ColorPicker({ title, icon, current, onChange, variant = 'text' }: ColorPickerProps) {
  const palette = variant === 'highlight' ? [HIGHLIGHT_COLORS] : THEME_COLORS;
  const noneLabel = variant === 'text' ? 'Automático' : 'Sin color';

  return (
    <Dropdown
      title={title}
      onMainClick={() => onChange(current)}
      trigger={
        <span className="we-color-icon">
          {icon}
          <span className="we-color-bar" style={{ background: current }} />
        </span>
      }
    >
      {(close) => (
        <div className="we-color-panel">
          <button
            type="button"
            className="we-menu-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(null);
              close();
            }}
          >
            <span className="we-swatch we-swatch-none" /> {noneLabel}
          </button>
          <div className="we-swatches" style={{ gridTemplateColumns: `repeat(${palette[0].length}, 1fr)` }}>
            {palette.flat().map((c) => (
              <button
                key={c}
                type="button"
                className="we-swatch"
                style={{ background: c }}
                aria-label={c}
                title={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c);
                  close();
                }}
              />
            ))}
          </div>
          <label className="we-menu-item we-custom-color">
            <input
              type="color"
              defaultValue={current}
              onChange={(e) => onChange(e.target.value)}
              aria-label="Color personalizado"
            />
            Más colores…
          </label>
        </div>
      )}
    </Dropdown>
  );
}

// ---------------------------------------------------------------------------
// Grupo de la cinta (con su nombre abajo, como en Word)
// ---------------------------------------------------------------------------

export function Group({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`we-group ${className}`} role="group" aria-label={label}>
      <div className="we-group-body">{children}</div>
      <div className="we-group-label">{label}</div>
    </div>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <div className="we-row">{children}</div>;

// ---------------------------------------------------------------------------
// Selector de tamaño de tabla (cuadrícula)
// ---------------------------------------------------------------------------

export function TableGridPicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const ROWS = 8;
  const COLS = 10;
  return (
    <div className="we-grid-picker">
      <div className="we-grid-caption">{hover.r && hover.c ? `Tabla ${hover.c} × ${hover.r}` : 'Insertar tabla'}</div>
      <div className="we-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 16px)` }} onMouseLeave={() => setHover({ r: 0, c: 0 })}>
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const r = Math.floor(i / COLS) + 1;
          const c = (i % COLS) + 1;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${c} columnas por ${r} filas`}
              className={`we-grid-cell ${r <= hover.r && c <= hover.c ? 'is-on' : ''}`}
              onMouseEnter={() => setHover({ r, c })}
              onFocus={() => setHover({ r, c })}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(r, c)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini formulario de los menús (sin <form>: el editor puede estar dentro del formulario
// de la aplicación, y un <form> anidado enviaría ese formulario con Enter)
// ---------------------------------------------------------------------------

export function MiniForm({ className, onSubmit, children }: { className?: string; onSubmit: () => void; children: ReactNode }) {
  const latest = useRef(onSubmit);
  latest.current = onSubmit;
  // Después del render, para usar los valores recién escritos
  const submit = () => setTimeout(() => latest.current(), 0);
  return (
    <div
      role="form"
      className={className}
      onKeyDown={(e) => {
        const t = e.target as HTMLInputElement;
        if (e.key === 'Enter' && t.tagName === 'INPUT' && t.type !== 'checkbox') {
          e.preventDefault();
          submit();
        }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-submit]')) {
          e.preventDefault();
          submit();
        }
      }}
    >
      {children}
    </div>
  );
}
