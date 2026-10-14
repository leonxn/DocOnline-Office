import type { JSONContent } from '@tiptap/react';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeightRule,
  Footer,
  Header,
  HeadingLevel,
  ILevelsOptions,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ParagraphChild,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import { INDENT_STEP_CM } from '../extensions/paragraph-format';
import {
  DEFAULT_FONT,
  DEFAULT_FONT_SIZE,
  HeaderFooterContent,
  PAGE_SIZES,
  PageSettings,
  headerFooterKey,
  isHeaderFooterEmpty,
  pageDimensions,
} from '../types';

/**
 * JSON del editor (ProseMirror) → .docx con la librería `docx` (MIT).
 * Cubre texto con formato, títulos, párrafos, listas, tablas, imágenes, enlaces,
 * saltos de página, encabezado, pie y numeración de páginas.
 */

const cmToTwip = (cm: number) => convertMillimetersToTwip(cm * 10);
const CM_PER_PX = 2.54 / 96;

type Block = Paragraph | Table;

interface Ctx {
  /** Ancho útil de la página en px (para escalar imágenes). */
  contentWidthPx: number;
  /** Contador para reiniciar la numeración de cada lista ordenada. */
  listInstance: number;
}

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------

const NAMED: Record<string, string> = { black: '000000', white: 'FFFFFF', red: 'FF0000', yellow: 'FFFF00' };

function toHex(color?: string | null): string | undefined {
  if (!color) return undefined;
  const c = color.trim().toLowerCase();
  if (NAMED[c]) return NAMED[c];
  let m = c.match(/^#([0-9a-f]{6})$/);
  if (m) return m[1].toUpperCase();
  m = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return (m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase();
  m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}

/** "12pt" / "16px" → medios puntos que usa Word */
function toHalfPoints(size?: string | null): number | undefined {
  if (!size) return undefined;
  const n = parseFloat(size);
  if (!n) return undefined;
  const pt = size.endsWith('px') ? n * 0.75 : n;
  return Math.round(pt * 2);
}

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

function paragraphProps(attrs: Record<string, any> = {}) {
  const lineSpacing = attrs.lineSpacing ? parseFloat(attrs.lineSpacing) : undefined;
  return {
    alignment: attrs.textAlign ? ALIGN[attrs.textAlign] : undefined,
    indent:
      attrs.indent || attrs.firstLine || attrs.indentRight
        ? {
            left: attrs.indent ? cmToTwip(attrs.indent * INDENT_STEP_CM) : undefined,
            right: attrs.indentRight ? cmToTwip(attrs.indentRight) : undefined,
            ...(attrs.firstLine > 0 ? { firstLine: cmToTwip(attrs.firstLine) } : {}),
            ...(attrs.firstLine < 0 ? { hanging: cmToTwip(-attrs.firstLine) } : {}),
          }
        : undefined,
    spacing: {
      ...(lineSpacing ? { line: Math.round(lineSpacing * 240) } : {}),
      ...(attrs.spacing === 'none' ? { after: 0 } : {}),
      ...(attrs.spaceBefore != null ? { before: Math.round(attrs.spaceBefore * 20) } : {}),
      ...(attrs.spaceAfter != null ? { after: Math.round(attrs.spaceAfter * 20) } : {}),
    },
    shading: attrs.shading ? { type: ShadingType.CLEAR, fill: toHex(attrs.shading), color: 'auto' } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Texto en línea
// ---------------------------------------------------------------------------

function textRuns(node: JSONContent, extra: Record<string, unknown> = {}): TextRun[] {
  const opts: Record<string, any> = { ...extra };
  for (const mark of node.marks ?? []) {
    const a = mark.attrs ?? {};
    switch (mark.type) {
      case 'bold': opts.bold = true; break;
      case 'italic': opts.italics = true; break;
      case 'underline': opts.underline = {}; break;
      case 'strike': opts.strike = true; break;
      case 'superscript': opts.superScript = true; break;
      case 'subscript': opts.subScript = true; break;
      case 'code': opts.font = 'Courier New'; break;
      case 'highlight': {
        const fill = toHex(a.color) ?? 'FFFF00';
        opts.shading = { type: ShadingType.CLEAR, fill, color: 'auto' };
        break;
      }
      case 'textStyle':
        if (a.color) opts.color = toHex(a.color);
        if (a.fontFamily) opts.font = String(a.fontFamily).split(',')[0].replace(/["']/g, '').trim();
        if (a.fontSize) opts.size = toHalfPoints(a.fontSize);
        break;
    }
  }
  // Las tabulaciones van como elemento propio para que Word las respete
  const parts = (node.text ?? '').split('\t');
  const children: (string | Tab)[] = [];
  parts.forEach((part, i) => {
    if (i > 0) children.push(new Tab());
    if (part) children.push(part);
  });
  return [new TextRun({ ...opts, children })];
}

function inlineChildren(nodes: JSONContent[] = [], extra: Record<string, unknown> = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      const link = node.marks?.find((m) => m.type === 'link');
      const runs = textRuns(node, link ? { ...extra, style: 'Hyperlink' } : extra);
      if (link) out.push(new ExternalHyperlink({ link: link.attrs?.href ?? '', children: runs }));
      else out.push(...runs);
    } else if (node.type === 'hardBreak') {
      out.push(new TextRun({ break: 1 }));
    } else if (node.type === 'pageNumber') {
      out.push(new TextRun({ ...extra, children: [PageNumber.CURRENT] }));
    } else if (node.type === 'pageCount') {
      out.push(new TextRun({ ...extra, children: [PageNumber.TOTAL_PAGES] }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Imágenes: se rasterizan a PNG con canvas (soporta webp/svg/remotas con CORS)
// ---------------------------------------------------------------------------

async function imageParagraph(node: JSONContent, ctx: Ctx): Promise<Paragraph | null> {
  const src: string | undefined = node.attrs?.src;
  if (!src) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    const naturalW = img.naturalWidth || 300;
    const naturalH = img.naturalHeight || 200;
    let width = Number(node.attrs?.width) || naturalW;
    width = Math.min(width, ctx.contentWidthPx);
    const height = Number(node.attrs?.height) && node.attrs?.width
      ? (Number(node.attrs.height) * width) / Number(node.attrs.width)
      : (naturalH * width) / naturalW;

    const canvas = document.createElement('canvas');
    canvas.width = naturalW;
    canvas.height = naturalH;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return null;

    return new Paragraph({
      alignment: ALIGN[node.attrs?.align ?? 'center'],
      children: [
        new ImageRun({
          type: 'png',
          data: new Uint8Array(await blob.arrayBuffer()),
          transformation: { width: Math.round(width), height: Math.round(height) },
          altText: node.attrs?.alt ? { name: node.attrs.alt, description: node.attrs.alt, title: node.attrs.alt } : undefined,
        }),
      ],
    });
  } catch {
    // Imagen remota sin CORS: se deja un aviso en lugar de romper la exportación
    return new Paragraph({ children: [new TextRun({ text: `[Imagen no exportable: ${src.slice(0, 60)}]`, italics: true, color: '888888' })] });
  }
}

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------

const BULLET_CHARS = { disc: ['●', '○', '■'], circle: ['○', '■', '●'], square: ['■', '●', '○'] } as const;
const ORDERED_FORMATS: Record<string, (typeof LevelFormat)[keyof typeof LevelFormat]> = {
  '1': LevelFormat.DECIMAL,
  a: LevelFormat.LOWER_LETTER,
  A: LevelFormat.UPPER_LETTER,
  i: LevelFormat.LOWER_ROMAN,
  I: LevelFormat.UPPER_ROMAN,
};
const NESTED_CYCLE = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];

function numberingConfig() {
  const indent = (level: number) => ({ indent: { left: cmToTwip(1.25 * (level + 1)), hanging: cmToTwip(0.63) } });
  const config: { reference: string; levels: ILevelsOptions[] }[] = [];
  for (const [style, chars] of Object.entries(BULLET_CHARS)) {
    config.push({
      reference: `ul-${style}`,
      levels: Array.from({ length: 9 }, (_, level) => ({
        level,
        format: LevelFormat.BULLET,
        text: chars[level % 3],
        alignment: AlignmentType.LEFT,
        style: { paragraph: indent(level) },
      })),
    });
  }
  for (const [type, format] of Object.entries(ORDERED_FORMATS)) {
    config.push({
      reference: `ol-${type}`,
      levels: Array.from({ length: 9 }, (_, level) => ({
        level,
        format: level === 0 ? format : NESTED_CYCLE[level % 3],
        text: `%${level + 1}.`,
        alignment: AlignmentType.LEFT,
        style: { paragraph: indent(level) },
      })),
    });
  }
  return config;
}

async function listBlocks(list: JSONContent, level: number, ctx: Ctx): Promise<Block[]> {
  const out: Block[] = [];
  const ordered = list.type === 'orderedList';
  const reference = ordered ? `ol-${list.attrs?.type ?? '1'}` : `ul-${list.attrs?.listStyle ?? 'disc'}`;
  // Cada lista ordenada de primer nivel reinicia su numeración
  const instance = ordered && level === 0 ? ++ctx.listInstance : ctx.listInstance;

  for (const item of list.content ?? []) {
    let first = true;
    for (const child of item.content ?? []) {
      if (['bulletList', 'orderedList'].includes(child.type ?? '')) {
        out.push(...(await listBlocks(child, level + 1, ctx)));
      } else if (child.type === 'taskList') {
        out.push(...(await taskListBlocks(child, level + 1, ctx)));
      } else if (first && child.type === 'paragraph') {
        out.push(
          new Paragraph({
            ...paragraphProps(child.attrs),
            numbering: { reference, level, instance },
            children: inlineChildren(child.content),
          }),
        );
        first = false;
      } else {
        // Párrafos extra del mismo ítem: sin viñeta, alineados con el texto
        const blocks = await blockToDocx(child, ctx);
        out.push(...blocks);
      }
    }
  }
  return out;
}

async function taskListBlocks(list: JSONContent, level: number, ctx: Ctx): Promise<Block[]> {
  const out: Block[] = [];
  for (const item of list.content ?? []) {
    const box = item.attrs?.checked ? '☑ ' : '☐ ';
    for (const [i, child] of (item.content ?? []).entries()) {
      if (child.type === 'taskList') {
        out.push(...(await taskListBlocks(child, level + 1, ctx)));
      } else if (child.type === 'paragraph') {
        out.push(
          new Paragraph({
            ...paragraphProps(child.attrs),
            indent: { left: cmToTwip(0.63 * (level + 1)) },
            children: [...(i === 0 ? [new TextRun(box)] : []), ...inlineChildren(child.content)],
          }),
        );
      }
    }
  }
  return out;
}

const TABLE_HEADER_FILL: Record<string, string | undefined> = {
  grid: 'F0F2F5',
  plain: undefined,
  'header-blue': '1D5FC4',
  'header-dark': '2B2F36',
  'banded-blue': '1D5FC4',
  minimal: undefined,
};

function tableBorders(preset: string, color: string) {
  const line = { style: BorderStyle.SINGLE, size: 4, color };
  const none = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  const all = { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line };
  switch (preset) {
    case 'none':
      return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    case 'outer':
      return { ...all, insideHorizontal: none, insideVertical: none };
    case 'inner':
      return { ...all, top: none, bottom: none, left: none, right: none };
    case 'horizontal':
      return { ...all, left: none, right: none, insideVertical: none };
    default:
      return all;
  }
}

const VALIGN: Record<string, (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable]> = {
  top: VerticalAlignTable.TOP,
  middle: VerticalAlignTable.CENTER,
  bottom: VerticalAlignTable.BOTTOM,
};

async function tableBlock(node: JSONContent, ctx: Ctx): Promise<Table> {
  const a = node.attrs ?? {};
  const style: string = a.tableStyle ?? 'grid';
  const headerFill = TABLE_HEADER_FILL[style];
  const darkHeader = style === 'header-blue' || style === 'header-dark' || style === 'banded-blue';
  const banded = a.banded || style === 'banded-blue';
  const borderPreset = style === 'minimal' ? 'horizontal' : style === 'plain' && (a.borders ?? 'all') === 'all' ? 'all' : a.borders ?? 'all';
  const borderColor = toHex(a.borderColor) ?? '8C8C8C';

  // Anchos de columna (px de la primera fila completa → twips)
  const firstRow = node.content?.[0]?.content ?? [];
  const colPx: number[] = [];
  for (const cell of firstRow) {
    const span = cell.attrs?.colspan ?? 1;
    const widths: (number | null)[] = cell.attrs?.colwidth ?? [];
    for (let i = 0; i < span; i++) colPx.push(widths[i] ?? 0);
  }
  const known = colPx.every((w) => w > 0);
  const pxToTwip = (px: number) => cmToTwip(px * CM_PER_PX);

  const rows: TableRow[] = [];
  let bodyIndex = 0;
  for (const row of node.content ?? []) {
    const isHeaderRow = !!row.content?.length && row.content.every((c) => c.type === 'tableHeader');
    const band = banded && !isHeaderRow && bodyIndex++ % 2 === 1;
    const cells: TableCell[] = [];
    for (const cell of row.content ?? []) {
      const isHeader = cell.type === 'tableHeader';
      const children: Block[] = [];
      const extra = isHeader && darkHeader ? { bold: true, color: 'FFFFFF' } : isHeader ? { bold: true } : {};
      for (const child of cell.content ?? []) children.push(...(await blockToDocx(child, ctx, extra)));
      const fill = toHex(cell.attrs?.backgroundColor) ?? (isHeader ? headerFill : band ? 'E8EFFB' : undefined);
      cells.push(
        new TableCell({
          children: children.length ? children : [new Paragraph('')],
          columnSpan: (cell.attrs?.colspan ?? 1) > 1 ? cell.attrs?.colspan : undefined,
          rowSpan: (cell.attrs?.rowspan ?? 1) > 1 ? cell.attrs?.rowspan : undefined,
          shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
          verticalAlign: VALIGN[cell.attrs?.verticalAlign ?? 'top'],
          margins: { top: 60, bottom: 60, left: 110, right: 110 },
        }),
      );
    }
    const height = row.attrs?.height ? { value: cmToTwip(row.attrs.height), rule: HeightRule.ATLEAST } : undefined;
    // Solo marcamos las filas de encabezado (algunos lectores interpretan mal tblHeader="off")
    rows.push(new TableRow({ children: cells, height, ...(isHeaderRow ? { tableHeader: true } : {}) }));
  }

  return new Table({
    rows,
    width: known
      ? { size: pxToTwip(colPx.reduce((x, y) => x + y, 0)), type: WidthType.DXA }
      : { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: known ? colPx.map(pxToTwip) : undefined,
    alignment: a.align === 'center' ? AlignmentType.CENTER : a.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    borders: tableBorders(borderPreset, borderColor),
  });
}

async function blockToDocx(node: JSONContent, ctx: Ctx, extra: Record<string, unknown> = {}): Promise<Block[]> {
  switch (node.type) {
    case 'paragraph':
      return [new Paragraph({ ...paragraphProps(node.attrs), children: inlineChildren(node.content, extra) })];
    case 'heading':
      return [
        new Paragraph({
          ...paragraphProps(node.attrs),
          heading: HEADINGS[(node.attrs?.level ?? 1) - 1],
          children: inlineChildren(node.content, extra),
        }),
      ];
    case 'bulletList':
    case 'orderedList':
      return listBlocks(node, 0, ctx);
    case 'taskList':
      return taskListBlocks(node, 0, ctx);
    case 'blockquote':
      return quoteBlocks(node, ctx);
    case 'codeBlock': {
      const lines = (node.content ?? []).map((t) => t.text ?? '').join('').split('\n');
      return [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
          children: lines.map((line, i) => new TextRun({ text: line, font: 'Courier New', size: 20, break: i > 0 ? 1 : 0 })),
        }),
      ];
    }
    case 'horizontalRule':
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, children: [] })];
    case 'pageBreak':
      return [new Paragraph({ children: [new PageBreak()] })];
    case 'table':
      return [await tableBlock(node, ctx)];
    case 'image': {
      const p = await imageParagraph(node, ctx);
      return p ? [p] : [];
    }
    default:
      return [];
  }
}

/** Los párrafos de una cita llevan sangría, borde izquierdo y cursiva. */
async function quoteBlocks(node: JSONContent, ctx: Ctx): Promise<Block[]> {
  const out: Block[] = [];
  for (const child of node.content ?? []) {
    if (child.type === 'paragraph' || child.type === 'heading') {
      out.push(
        new Paragraph({
          ...paragraphProps(child.attrs),
          indent: { left: cmToTwip(0.5) },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'C8CCD2', space: 8 } },
          children: inlineChildren(child.content, { italics: true }),
        }),
      );
    } else {
      out.push(...(await blockToDocx(child, ctx)));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

async function headerFooterBlocks(content: HeaderFooterContent, ctx: Ctx): Promise<Block[]> {
  const out: Block[] = [];
  if (!content || isHeaderFooterEmpty(content)) return out;
  for (const node of content.content ?? []) out.push(...(await blockToDocx(node, ctx)));
  return out;
}

export async function exportDocx(json: JSONContent, settings: PageSettings, title: string): Promise<Blob> {
  const { width } = pageDimensions(settings);
  const m = settings.margins;
  const ctx: Ctx = { contentWidthPx: (width - m.left - m.right) / CM_PER_PX, listInstance: 0 };

  const children: Block[] = [];
  for (const node of json.content ?? []) children.push(...(await blockToDocx(node, ctx)));

  // Encabezados y pies: predeterminado, primera página y páginas pares (como en Word)
  const make = async (kind: 'header' | 'footer', variant: 'default' | 'first' | 'even') => {
    const blocks = await headerFooterBlocks(settings[headerFooterKey(kind, variant)], ctx);
    const content = blocks.length ? blocks : [new Paragraph('')];
    return kind === 'header' ? new Header({ children: content }) : new Footer({ children: content });
  };
  const variants: ('default' | 'first' | 'even')[] = [
    'default',
    ...(settings.differentFirst ? (['first'] as const) : []),
    ...(settings.differentOddEven ? (['even'] as const) : []),
  ];
  const headers: Record<string, Header> = {};
  const footers: Record<string, Footer> = {};
  for (const v of variants) {
    headers[v] = (await make('header', v)) as Header;
    footers[v] = (await make('footer', v)) as Footer;
  }

  const portrait = PAGE_SIZES[settings.size];
  const pageColor = toHex(settings.pageColor);
  const doc = new Document({
    title,
    creator: 'Editor de documentos',
    evenAndOddHeaderAndFooters: settings.differentOddEven,
    ...(pageColor ? { background: { color: pageColor } } : {}),
    ...(settings.hyphenation ? { hyphenation: { autoHyphenation: true } } : {}),
    styles: {
      default: {
        document: { run: { font: DEFAULT_FONT, size: DEFAULT_FONT_SIZE * 2 }, paragraph: { spacing: { after: 160, line: 276 } } },
        heading1: { run: { size: 40, bold: true, color: '1F3A5F' }, paragraph: { spacing: { before: 240, after: 120 } } },
        heading2: { run: { size: 32, bold: true, color: '1F3A5F' }, paragraph: { spacing: { before: 240, after: 120 } } },
        heading3: { run: { size: 28, bold: true, color: '1F3A5F' }, paragraph: { spacing: { before: 240, after: 120 } } },
        heading4: { run: { size: 24, bold: true, italics: true, color: '1F3A5F' }, paragraph: { spacing: { before: 240, after: 120 } } },
      },
    },
    numbering: { config: numberingConfig() },
    sections: [
      {
        properties: {
          titlePage: settings.differentFirst,
          page: {
            size: {
              width: cmToTwip(portrait.width),
              height: cmToTwip(portrait.height),
              orientation: settings.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: cmToTwip(m.top),
              right: cmToTwip(m.right),
              bottom: cmToTwip(m.bottom),
              left: cmToTwip(m.left),
              header: cmToTwip(settings.headerDistance),
              footer: cmToTwip(settings.footerDistance),
            },
          },
        },
        headers,
        footers,
        children: children.length ? children : [new Paragraph('')],
      },
    ],
  });

  return Packer.toBlob(doc);
}
