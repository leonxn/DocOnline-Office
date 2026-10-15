/** Atributos de los objetos gráficos (forma, gráfico, SmartArt). Se guardan en el JSON del documento. */

export type GraphicWrap = 'inline' | 'left' | 'right';
export type GraphicAlign = 'left' | 'center' | 'right';

interface Box {
  /** px a escala 1 */
  width: number;
  height: number;
  /** En línea con el texto: alineación del bloque. */
  align: GraphicAlign;
  /** `left`/`right` = ajuste cuadrado (el texto rodea el objeto). */
  wrap: GraphicWrap;
}

export interface ShapeAttrs extends Box {
  kind: string;
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  /** pt */
  strokeWidth: number;
  strokeDash: 'solid' | 'dash' | 'dot' | 'dashDot';
  strokeOpacity: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  shadow: boolean;
  text: string;
  textColor: string;
  /** pt */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  textAlign: 'left' | 'center' | 'right';
  textValign: 'top' | 'middle' | 'bottom';
  /** Contorno del texto (estilo WordArt). */
  textOutline: string | null;
  fontFamily: string;
}

export type ChartType =
  | 'column'
  | 'columnStacked'
  | 'columnPercent'
  | 'bar'
  | 'barStacked'
  | 'line'
  | 'lineMarkers'
  | 'area'
  | 'areaStacked'
  | 'pie'
  | 'doughnut'
  | 'scatter'
  | 'radar'
  | 'combo';

export interface ChartSeries {
  name: string;
  /** `null` en JSON = celda vacía. */
  values: number[];
  color?: string;
}

export interface ChartAttrs extends Box {
  chartType: ChartType;
  title: string;
  categories: string[];
  series: ChartSeries[];
  showLegend: boolean;
  showValues: boolean;
  showGrid: boolean;
  /** Relleno del área del gráfico (`null` = transparente). */
  bgFill: string | null;
  bgOpacity: number;
  /** Borde del área del gráfico (`null` = sin borde). */
  borderColor: string | null;
  /** pt */
  borderWidth: number;
  borderDash: 'solid' | 'dash' | 'dot' | 'dashDot';
  borderOpacity: number;
}

export type SmartArtLayout =
  | 'list-basic'
  | 'list-vertical'
  | 'process-basic'
  | 'process-chevron'
  | 'process-vertical'
  | 'cycle-basic'
  | 'cycle-donut'
  | 'hierarchy-org'
  | 'relationship-venn'
  | 'relationship-radial'
  | 'matrix-basic'
  | 'pyramid-basic'
  | 'pyramid-inverted';

export interface SmartArtItem {
  text: string;
  /** 0 = nivel principal, 1 = sub-elemento… */
  level: number;
}

export interface SmartArtAttrs extends Box {
  layout: SmartArtLayout;
  items: SmartArtItem[];
  color: string;
  style: 'fill' | 'outline';
}

export type GraphicType = 'shape' | 'chart' | 'smartart';

export const DEFAULT_SHAPE: Omit<ShapeAttrs, 'kind'> = {
  width: 180,
  height: 120,
  align: 'center',
  wrap: 'inline',
  fill: '#5b9bd5',
  fillOpacity: 1,
  stroke: '#41719c',
  strokeWidth: 1,
  strokeDash: 'solid',
  strokeOpacity: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
  shadow: false,
  text: '',
  textColor: '#ffffff',
  fontSize: 11,
  bold: false,
  italic: false,
  textAlign: 'center',
  textValign: 'middle',
  textOutline: null,
  fontFamily: 'Arial',
};

/** Paleta de series (como la de Office). */
export const CHART_COLORS = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e', '#636363', '#997300'];

export const CHART_TYPES: { id: ChartType; label: string; group: string }[] = [
  { id: 'column', label: 'Columnas agrupadas', group: 'Gráfico de columnas' },
  { id: 'columnStacked', label: 'Columnas apiladas', group: 'Gráfico de columnas' },
  { id: 'columnPercent', label: 'Columnas 100 % apiladas', group: 'Gráfico de columnas' },
  { id: 'line', label: 'Líneas', group: 'Línea' },
  { id: 'lineMarkers', label: 'Líneas con marcadores', group: 'Línea' },
  { id: 'pie', label: 'Circular', group: 'Gráfico circular' },
  { id: 'doughnut', label: 'Anillo', group: 'Gráfico circular' },
  { id: 'bar', label: 'Barras agrupadas', group: 'Barra' },
  { id: 'barStacked', label: 'Barras apiladas', group: 'Barra' },
  { id: 'area', label: 'Área', group: 'Área' },
  { id: 'areaStacked', label: 'Área apilada', group: 'Área' },
  { id: 'scatter', label: 'Dispersión', group: 'XY (Dispersión)' },
  { id: 'radar', label: 'Radial', group: 'Radial' },
  { id: 'combo', label: 'Columnas y líneas', group: 'Combinado' },
];

export const DEFAULT_CHART: Omit<ChartAttrs, 'chartType'> = {
  width: 480,
  height: 290,
  align: 'center',
  wrap: 'inline',
  title: 'Título del gráfico',
  categories: ['Categoría 1', 'Categoría 2', 'Categoría 3', 'Categoría 4'],
  series: [
    { name: 'Serie 1', values: [4.3, 2.5, 3.5, 4.5] },
    { name: 'Serie 2', values: [2.4, 4.4, 1.8, 2.8] },
    { name: 'Serie 3', values: [2, 2, 3, 5] },
  ],
  showLegend: true,
  showValues: false,
  showGrid: true,
  bgFill: '#ffffff',
  bgOpacity: 1,
  borderColor: '#d9d9d9',
  borderWidth: 0.75,
  borderDash: 'solid',
  borderOpacity: 1,
};

export const SMARTART_LAYOUTS: { id: SmartArtLayout; label: string; group: string }[] = [
  { id: 'list-basic', label: 'Lista de bloques básica', group: 'Lista' },
  { id: 'list-vertical', label: 'Lista vertical de viñetas', group: 'Lista' },
  { id: 'process-basic', label: 'Proceso básico', group: 'Proceso' },
  { id: 'process-chevron', label: 'Proceso de cheurones', group: 'Proceso' },
  { id: 'process-vertical', label: 'Proceso vertical', group: 'Proceso' },
  { id: 'cycle-basic', label: 'Ciclo básico', group: 'Ciclo' },
  { id: 'cycle-donut', label: 'Ciclo segmentado', group: 'Ciclo' },
  { id: 'hierarchy-org', label: 'Organigrama', group: 'Jerarquía' },
  { id: 'relationship-venn', label: 'Venn básico', group: 'Relación' },
  { id: 'relationship-radial', label: 'Radial básico', group: 'Relación' },
  { id: 'matrix-basic', label: 'Matriz básica', group: 'Matriz' },
  { id: 'pyramid-basic', label: 'Pirámide básica', group: 'Pirámide' },
  { id: 'pyramid-inverted', label: 'Pirámide invertida', group: 'Pirámide' },
];

/** Contenido inicial de cada tipo de SmartArt. */
export function defaultSmartArtItems(layout: SmartArtLayout): SmartArtItem[] {
  if (layout === 'hierarchy-org') {
    return [
      { text: 'Dirección', level: 0 },
      { text: 'Área 1', level: 1 },
      { text: 'Equipo A', level: 2 },
      { text: 'Área 2', level: 1 },
      { text: 'Área 3', level: 1 },
    ];
  }
  if (layout === 'list-vertical') {
    return [
      { text: 'Primer punto', level: 0 },
      { text: 'Detalle', level: 1 },
      { text: 'Segundo punto', level: 0 },
      { text: 'Detalle', level: 1 },
      { text: 'Tercer punto', level: 0 },
    ];
  }
  const n = layout === 'matrix-basic' ? 4 : layout.startsWith('relationship-venn') ? 3 : layout.startsWith('cycle') ? 5 : layout === 'relationship-radial' ? 5 : 4;
  const names = layout === 'relationship-radial' ? ['Centro', 'Elemento 1', 'Elemento 2', 'Elemento 3', 'Elemento 4'] : Array.from({ length: n }, (_, i) => `Elemento ${i + 1}`);
  return names.map((text) => ({ text, level: 0 }));
}

export const DEFAULT_SMARTART: Omit<SmartArtAttrs, 'layout' | 'items'> = {
  width: 520,
  height: 300,
  align: 'center',
  wrap: 'inline',
  color: '#4472c4',
  style: 'fill',
};
