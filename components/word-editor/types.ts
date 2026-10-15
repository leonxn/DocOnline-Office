import type { JSONContent } from '@tiptap/react';

export type PageSizeId = 'A4' | 'Carta' | 'Oficio' | 'A5';
export type Orientation = 'portrait' | 'landscape';

/** Márgenes en centímetros. */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Contenido enriquecido de un encabezado o pie (JSON del editor). `null` = vacío. */
export type HeaderFooterContent = JSONContent | null;

export type HeaderFooterKind = 'header' | 'footer';
/** default = todas las páginas (o las impares si hay pares distintas). */
export type HeaderFooterVariant = 'default' | 'first' | 'even';

export interface PageSettings {
  size: PageSizeId;
  orientation: Orientation;
  margins: Margins;
  header: HeaderFooterContent;
  footer: HeaderFooterContent;
  /** Usados solo si `differentFirst` está activo. */
  firstHeader: HeaderFooterContent;
  firstFooter: HeaderFooterContent;
  /** Usados solo si `differentOddEven` está activo (páginas pares). */
  evenHeader: HeaderFooterContent;
  evenFooter: HeaderFooterContent;
  differentFirst: boolean;
  differentOddEven: boolean;
  /** Distancia del encabezado al borde superior y del pie al inferior, cm. */
  headerDistance: number;
  footerDistance: number;
  /** Color de fondo de las hojas (null = blanco). */
  pageColor: string | null;
  /** Texto de marca de agua en diagonal ('' = sin marca). */
  watermark: string;
  /** Separación automática de palabras con guiones. */
  hyphenation: boolean;
  /** Color de los títulos del documento (Diseño → Colores). */
  themeColor: string;
}

/** Clave de `PageSettings` que guarda cada encabezado/pie. */
export function headerFooterKey(kind: HeaderFooterKind, variant: HeaderFooterVariant) {
  const base = kind === 'header' ? 'Header' : 'Footer';
  return (variant === 'default' ? kind : `${variant}${base}`) as
    | 'header'
    | 'footer'
    | 'firstHeader'
    | 'firstFooter'
    | 'evenHeader'
    | 'evenFooter';
}

/** Qué variante corresponde a la hoja `index` (0 = primera). */
export function variantForPage(settings: PageSettings, index: number): HeaderFooterVariant {
  if (settings.differentFirst && index === 0) return 'first';
  if (settings.differentOddEven && (index + 1) % 2 === 0) return 'even';
  return 'default';
}

/** Lo que el editor entrega y recibe: guárdalo tal cual en tu BD (columna JSON). */
export interface WordDocument {
  title: string;
  json: JSONContent;
  html: string;
  settings: PageSettings;
}

/** Tamaños en centímetros (ancho x alto en vertical). */
export const PAGE_SIZES: Record<PageSizeId, { label: string; width: number; height: number }> = {
  A4: { label: 'A4 (21 × 29,7 cm)', width: 21, height: 29.7 },
  Carta: { label: 'Carta (21,59 × 27,94 cm)', width: 21.59, height: 27.94 },
  Oficio: { label: 'Oficio (21,59 × 35,56 cm)', width: 21.59, height: 35.56 },
  A5: { label: 'A5 (14,8 × 21 cm)', width: 14.8, height: 21 },
};

export const MARGIN_PRESETS: { id: string; label: string; margins: Margins }[] = [
  { id: 'normal', label: 'Normal', margins: { top: 2.5, right: 3, bottom: 2.5, left: 3 } },
  { id: 'estrecho', label: 'Estrecho', margins: { top: 1.27, right: 1.27, bottom: 1.27, left: 1.27 } },
  { id: 'moderado', label: 'Moderado', margins: { top: 2.54, right: 1.91, bottom: 2.54, left: 1.91 } },
  { id: 'ancho', label: 'Ancho', margins: { top: 2.54, right: 5.08, bottom: 2.54, left: 5.08 } },
];

export const DEFAULT_SETTINGS: PageSettings = {
  size: 'A4',
  orientation: 'portrait',
  margins: MARGIN_PRESETS[0].margins,
  header: null,
  footer: null,
  firstHeader: null,
  firstFooter: null,
  evenHeader: null,
  evenFooter: null,
  differentFirst: false,
  differentOddEven: false,
  headerDistance: 1.25,
  footerDistance: 1.25,
  pageColor: null,
  watermark: '',
  hyphenation: false,
  themeColor: '#1f3a5f',
};

/** Paletas de Diseño → Colores (color de los títulos). */
export const THEME_COLORS: { id: string; label: string; color: string }[] = [
  { id: 'institucional', label: 'Azul institucional', color: '#1f3a5f' },
  { id: 'azul', label: 'Azul', color: '#1d5fc4' },
  { id: 'verde', label: 'Verde', color: '#1d6b40' },
  { id: 'vino', label: 'Vino', color: '#7b1e2b' },
  { id: 'morado', label: 'Morado', color: '#5b2c83' },
  { id: 'naranja', label: 'Naranja', color: '#b4541a' },
  { id: 'gris', label: 'Escala de grises', color: '#3b4048' },
  { id: 'negro', label: 'Negro', color: '#000000' },
];

/** Convierte texto plano (formato antiguo) en contenido de encabezado/pie. */
export function textToHeaderFooter(text: string, align: 'left' | 'center' | 'right' = 'center'): HeaderFooterContent {
  if (!text) return null;
  return {
    type: 'doc',
    content: text.split(/\r?\n/).map((line) => ({
      type: 'paragraph',
      attrs: { textAlign: align },
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

/** Un encabezado/pie está vacío si no tiene texto ni elementos (imágenes, campos, tablas). */
export function isHeaderFooterEmpty(content: HeaderFooterContent): boolean {
  if (!content) return true;
  const walk = (n: JSONContent): boolean =>
    (n.type === 'text' && !!n.text?.trim()) ||
    ['image', 'pageNumber', 'pageCount', 'table', 'horizontalRule'].includes(n.type ?? '') ||
    (n.content ?? []).some(walk);
  return !walk(content);
}

export function pageDimensions(settings: PageSettings) {
  const { width, height } = PAGE_SIZES[settings.size];
  return settings.orientation === 'portrait' ? { width, height } : { width: height, height: width };
}

export const FONT_FAMILIES = [
  'Arial',
  'Calibri',
  'Cambria',
  'Courier New',
  'Garamond',
  'Georgia',
  'Helvetica',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

export const DEFAULT_FONT = 'Arial';
export const DEFAULT_FONT_SIZE = 11;

export const LINE_SPACINGS = ['1', '1.15', '1.5', '2', '2.5', '3'];
