# DocOnline Office

Editor de documentos **tipo Word** para React y Next.js: hojas reales, encabezado y pie de
página, tablas, regla interactiva, exportación a **.docx** e impresión a **PDF**.

Corre 100 % en el navegador. No necesita servidor de documentos ni licencias de pago. Todas las
dependencias son libres y se pueden usar en proyectos comerciales.

```bash
npm i doconline-office      # o: pnpm add doconline-office  /  yarn add doconline-office
```

```tsx
import { WordEditor } from 'doconline-office';

<div style={{ height: '100vh' }}>
  <WordEditor />
</div>
```

![Editor](https://raw.githubusercontent.com/leonxn/DocOnline-Office/main/docs/screenshots/editor.png)

---

## Contenido

- [Capturas](#capturas)
- [Características](#características)
- [Probarlo en 1 minuto](#probarlo-en-1-minuto)
- [Cómo implementarlo en tu proyecto](#cómo-implementarlo-en-tu-proyecto)
- [Publicar una nueva versión en npm](#publicar-una-nueva-versión-en-npm)
- [Herramientas de IA](#herramientas-de-ia)
- [Guardar y abrir documentos](#guardar-y-abrir-documentos)
- [Referencia del componente](#referencia-del-componente)
- [Ejemplos](#ejemplos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Límites conocidos](#límites-conocidos)
- [Dependencias y licencias](#dependencias-y-licencias)
- [Licencia](#licencia)

---

## Capturas

| Encabezado y pie (doble clic en el margen) | Tablas con estilos, asas y regla de columnas |
|---|---|
| ![Encabezado y pie](https://raw.githubusercontent.com/leonxn/DocOnline-Office/main/docs/screenshots/encabezado-pie.png) | ![Tablas](https://raw.githubusercontent.com/leonxn/DocOnline-Office/main/docs/screenshots/tablas.png) |

| Paginación real (el texto pasa de hoja en hoja) | Menú contextual de tablas |
|---|---|
| ![Paginación](https://raw.githubusercontent.com/leonxn/DocOnline-Office/main/docs/screenshots/paginacion.png) | ![Menú contextual](https://raw.githubusercontent.com/leonxn/DocOnline-Office/main/docs/screenshots/menu-contextual.png) |

| Disposición: sangrías, espaciado y marca de agua | Dentro de un formulario |
|---|---|
| ![Disposición](https://raw.githubusercontent.com/leonxn/DocOnline-Office/main/docs/screenshots/disposicion.png) | ![Formulario](https://raw.githubusercontent.com/leonxn/DocOnline-Office/main/docs/screenshots/formulario.png) |

---

## Características

**La hoja, como en Word**
- **Paginación real.** Hojas separadas; el texto que no cabe pasa a la siguiente línea por línea
  mientras escribes. Las tablas se cortan entre filas y un título nunca queda solo al final de
  una hoja.
- **Regla horizontal interactiva:** arrastra los márgenes y las sangrías (primera línea, izquierda
  y derecha). Con el cursor en una tabla, también los bordes de columna.
- **Regla vertical** para los márgenes superior e inferior.
- Flechas ↑ y ↓ entre hojas, clic en el margen para ubicar el cursor, y Ctrl + rueda para el zoom.

**Encabezado y pie de página**
- **Doble clic** en el margen superior o inferior abre su edición. El texto del documento se
  atenúa y se abre la pestaña *Encabezado y pie*.
- Contenido con formato: negrita, alineación, colores, logo (imagen), tablas sin bordes para
  maquetar, y fecha y hora.
- **Número de página** arriba o abajo, «Página X de Y», o en la posición del cursor.
- Primera página diferente, páginas pares e impares diferentes, y distancia al borde.

**Tablas**
- Cuadrícula o tabla personalizada (filas, columnas y fila de encabezado).
- **⊞** selecciona toda la tabla y la esquina cambia su ancho arrastrando.
- **Pestaña Tabla:**
  - seleccionar celda, fila, columna o tabla;
  - insertar y eliminar filas y columnas, combinar y dividir celdas;
  - alto de fila, distribuir columnas y autoajustar;
  - alineación de celda y de tabla;
  - 6 estilos, fila de encabezado, primera columna y filas con bandas;
  - sombreado de celda, tipos de borde y color de borde.
- **Clic derecho** abre un menú con las acciones de tabla. Mayús + clic derecho abre el menú del
  navegador, con la ortografía.

**Herramientas de IA (Claude o Gemini)**
- **Chat de IA** en un panel lateral, con sugerencias rápidas: resumir, reescribir, simplificar,
  ampliar, revisar, traducir, sugerir título, puntos clave…
- **Acciones directas** sobre la selección (o todo el documento): Resumir, Reescribir (más
  formal, más cercano, más corto o más largo), Traducir, Gramática y ortografía, y Generar
  (resumen ejecutivo, puntos clave, títulos, revisión y tabla de contenido).
- **Acciones rápidas propias:** cada usuario guarda sus instrucciones, por ejemplo «Redactar como
  oficio».
- Las respuestas llegan en tiempo real y se pueden **insertar** en el documento, **reemplazar**
  la selección o **copiar**, conservando el formato (títulos, listas, negritas y tablas).
- **Conexión:** cada usuario pega su clave de **Claude** (Opus 5.5, Sonnet 5.5 o Haiku 5.5) o
  de **Gemini**, o la organización usa su propio servidor y la clave nunca llega al navegador.
  Ver [Herramientas de IA](#herramientas-de-ia).

**Cinta de opciones**
- **Archivo:** nuevo, abrir (.docx, .html, .txt), guardar, descargar .docx o HTML, e imprimir o
  guardar como PDF.
- **Inicio:**
  - fuente, tamaño, MAYÚSCULAS/minúsculas, negrita, cursiva, subrayado, tachado, índices,
    resaltado, color y borrar formato;
  - viñetas, numeración (1, a, A, i, I) y listas de tareas;
  - sangría, interlineado, alineación, sombreado y copiar formato;
  - galería de estilos.
- **Insertar:** tabla, imagen (archivo, URL, pegar o arrastrar), vínculo, línea, salto de página,
  encabezado, pie, número de página, fecha y hora, código y símbolos.
- **Diseño:**
  - márgenes, orientación, tamaño (A4, Carta, Oficio, A5), saltos y guiones automáticos;
  - sangrías y espaciado del párrafo;
  - columnas (bloques de 2 o 3 columnas, o una angosta y una ancha);
  - colores del documento (color de los títulos);
  - marca de agua y color de página.
- **Revisar:** buscar y reemplazar, ortografía del navegador y conteo de palabras.
- **Vista:**
  - panel de **Títulos** para navegar;
  - zoom (lista y porcentaje), ajustar a la página, ajustar al ancho y 100 %;
  - **Múltiples páginas**: todas las hojas en miniatura; un clic en una hoja lleva a ella;
  - **tema claro u oscuro** (o según el sistema);
  - mostrar u ocultar la cinta, la barra de estado, los paneles, las reglas y las marcas ¶;
  - modo lectura y pantalla completa.

**Salida**
- **.docx** nativo, que conserva:
  - encabezados y pies, con primera página y pares distintas;
  - los campos de número de página;
  - tablas con anchos de columna, sombreado y bordes;
  - imágenes, listas, estilos, sangrías y espaciado.
- **Imprimir o PDF:** imprime exactamente las hojas que ves en pantalla.

**Atajos:** Ctrl+B/I/U, Ctrl+Z/Y, Ctrl+S (guardar), Ctrl+P (imprimir), Ctrl+F/H (buscar y
reemplazar), Ctrl+O (abrir), Ctrl+Enter (salto de página), Tab/Mayús+Tab y Esc.

---

## Probarlo en 1 minuto

Requisitos: **Node.js 20 o superior**.

```bash
git clone https://github.com/leonxn/DocOnline-Office.git
cd DocOnline-Office
npm install
npm run dev
```

- `http://localhost:3005`: editor a pantalla completa (el borrador se guarda en el navegador).
- `http://localhost:3005/formulario`: el editor como un campo de formulario.

---

## Cómo implementarlo en tu proyecto

### 1. Instálalo

**Con npm, pnpm o yarn** (recomendado):

```bash
npm i doconline-office
# o
pnpm add doconline-office
# o
yarn add doconline-office
```

- Requiere **React 18 o 19**. Si tu proyecto no lo tiene, instálalo: `npm i react react-dom`.
- Las dependencias (Tiptap, docx, mammoth, lucide-react) se instalan solas.
- **No hay que importar CSS:** los estilos se cargan al importar el componente.

**Directo desde GitHub** (por ejemplo, antes de publicar en npm o para probar la rama `main`):

```bash
npm i github:leonxn/DocOnline-Office
# o
pnpm add github:leonxn/DocOnline-Office
```

Al instalar desde GitHub el paquete se compila en tu máquina (script `prepare`), así que tarda
un poco más.

**Copiando el código** (si quieres modificar el editor dentro de tu proyecto): copia
[`components/word-editor/`](components/word-editor) e instala las dependencias de la sección
`dependencies` del [`package.json`](package.json). En ese caso importa desde tu carpeta
(`@/components/word-editor`) en vez de `doconline-office`.

### 3. Úsalo

**Next.js (App Router).** El editor es un componente de cliente:

```tsx
// app/documentos/nuevo/page.tsx
'use client';

import { WordEditor } from 'doconline-office';

export default function NuevoDocumento() {
  return (
    <div style={{ height: '100vh' }}>
      <WordEditor
        initialValue="<h1>Título</h1><p>Contenido…</p>"
        onSave={async (doc) => {
          await fetch('/api/documentos', { method: 'POST', body: JSON.stringify(doc) });
        }}
      />
    </div>
  );
}
```

El paquete ya trae la directiva `'use client'`, así que también puedes importarlo desde un
componente de servidor; el editor se renderiza en el cliente.

**React con Vite (u otro bundler).** Funciona igual: importa `WordEditor` y dale una altura a su
contenedor.

```tsx
import { WordEditor } from 'doconline-office';

export function App() {
  return (
    <div style={{ height: '100vh' }}>
      <WordEditor />
    </div>
  );
}
```

### 4. Dentro de un formulario

Usa una `ref` para leer el documento al enviar:

```tsx
'use client';
import { useRef } from 'react';
import { WordEditor, type WordEditorHandle } from 'doconline-office';

export function Formulario() {
  const ref = useRef<WordEditorHandle>(null);

  async function enviar() {
    const doc = ref.current!.getDocument();       // { title, json, html, settings }
    const docx = await ref.current!.exportDocx(); // Blob .docx

    const body = new FormData();
    body.append('documento', JSON.stringify(doc));
    body.append('archivo', docx, `${doc.title}.docx`);
    await fetch('/api/oficios', { method: 'POST', body });
  }

  return (
    <>
      <WordEditor ref={ref} height={650} hideTitleBar />
      <button onClick={enviar}>Enviar</button>
    </>
  );
}
```

### 5. Encabezado y número de página por defecto

`initialValue.settings` acepta solo lo que quieras cambiar. Lo demás toma valores por defecto.

```tsx
<WordEditor
  initialValue={{
    html: '<p>Señor(a):</p>',
    settings: {
      margins: { top: 2.5, right: 2.5, bottom: 2.5, left: 3 },
      header: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'MI INSTITUCIÓN', marks: [{ type: 'bold' }] }],
        }],
      },
      footer: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [
            { type: 'text', text: 'Página ' }, { type: 'pageNumber' },
            { type: 'text', text: ' de ' }, { type: 'pageCount' },
          ],
        }],
      },
    },
  }}
/>
```

---

## Publicar una nueva versión en npm

Pasos para el mantenedor del paquete. El detalle está en [PUBLICAR.md](PUBLICAR.md).

```bash
npm login                 # una sola vez
npm version patch         # 1.0.0 → 1.0.1 (minor: funciones nuevas, major: cambios que rompen)
npm publish               # compila, revisa los tipos y publica
git push --follow-tags    # sube el commit y la etiqueta de la versión
```

---

## Herramientas de IA

La pestaña **Herramientas de IA** funciona con **Claude** (Anthropic) o **Gemini** (Google), y
hay dos formas de conectarla:

### A. Cada usuario usa su propia clave (sin configurar nada)

Es el comportamiento por defecto. En *Herramientas de IA → Conectar*, el usuario:

1. elige Claude o Gemini;
2. pega su clave de API, que se crea en
   [console.anthropic.com](https://console.anthropic.com/settings/keys) o
   [aistudio.google.com](https://aistudio.google.com/apikey);
3. el editor la verifica, sin gastar tokens, y la guarda **solo en su navegador**. Con
   «Recordar» desmarcado, se borra al cerrar la pestaña.

El uso se cobra a la cuenta de cada usuario. Sirve para herramientas internas o personales.

### B. Tu servidor tiene la clave (recomendado en producción)

```tsx
<WordEditor ai={{ endpoint: '/api/ia' }} />
```

El editor envía a tu servidor `{ provider, model, system, messages }` y espera el texto en
streaming. En [`examples/06-ia-servidor/route.ts`](examples/06-ia-servidor/route.ts) hay una
ruta lista para Next.js. Usa los SDK oficiales `@anthropic-ai/sdk` y `@google/genai`, permite
solo ciertos modelos y lee las claves de `ANTHROPIC_API_KEY` y `GEMINI_API_KEY`. Así las claves
no salen del servidor y tú controlas quién usa la IA.

| Opción de `ai` | Para |
|---|---|
| `endpoint` | URL de tu servidor de IA. |
| `headers` | Cabeceras extra para tu servidor (por ejemplo, un token de sesión). |
| `providers` | `['anthropic']`, `['gemini']` o ambos: qué ofrece tu servidor. |
| `ai={false}` | Oculta la pestaña de IA. |

**Detalles:**
- Modelos de Claude: Opus 5.5 (predeterminado), Sonnet 5.5 y Haiku 5.5. Los de Gemini se listan
  desde la cuenta del usuario al conectar.
- Con Claude se activa el respaldo automático del servidor: si un modelo declina una solicitud
  por sus políticas, Anthropic la reintenta con otro modelo compatible (Haiku no lo admite).
- Los SDK de IA se cargan solo al usarlos, así que no pesan en la carga inicial del editor.
- Con selección, se envía solo el texto seleccionado; sin selección, todo el documento. En el
  chat se puede elegir.

---

## Guardar y abrir documentos

El editor entrega y recibe un **`WordDocument`**:

```ts
interface WordDocument {
  title: string;        // título del documento
  json: JSONContent;    // contenido exacto del editor → guárdalo siempre
  html: string;         // para mostrarlo sin editor o generar PDF en el servidor
  settings: PageSettings; // tamaño, márgenes, encabezado, pie, marca de agua…
}
```

- **Guarda** el objeto completo, por ejemplo en una columna `jsonb` de PostgreSQL, o `json` y
  `settings` por separado.
- **Abre** pasando el mismo objeto a `initialValue`, y obtendrás el documento idéntico.
- El `html` es opcional; sirve para listados, vistas previas o correos.

En [`examples/03-guardar-en-api`](examples/03-guardar-en-api) hay un Route Handler de Next.js, y
en [`examples/05-backend-nestjs`](examples/05-backend-nestjs) un controlador NestJS con la tabla
SQL sugerida.

---

## Referencia del componente

### Props

| Prop | Tipo | Descripción |
|---|---|---|
| `initialValue` | `string \| WordDocumentInput` | HTML inicial o un documento guardado. `settings` puede ser parcial. |
| `onSave` | `(doc) => void \| Promise<void>` | Botón Guardar y Ctrl+S. Sin `onSave`, Ctrl+S descarga el .docx. |
| `onChange` | `(doc) => void` | Cada cambio de contenido, título o página (con 400 ms de espera). Útil para autoguardar. |
| `readOnly` | `boolean` | Solo lectura: oculta la cinta y permite ver, buscar, hacer zoom e imprimir. |
| `hideTitleBar` | `boolean` | Oculta la barra del título (útil en formularios). |
| `height` | `CSSProperties['height']` | Alto total del editor. Por defecto, `100%` del contenedor. |
| `placeholder` | `string` | Texto guía con el documento vacío. |
| `className` | `string` | Clase extra para la raíz. |
| `ai` | `AiOptions \| false` | Herramientas de IA: sin valor = clave de cada usuario; `{ endpoint }` = tu servidor; `false` = ocultar. |
| `ref` | `Ref<WordEditorHandle>` | Acceso a los métodos de abajo. |

### Métodos (`ref`)

| Método | Devuelve | Para |
|---|---|---|
| `getDocument()` | `WordDocument` | Leer el documento actual (al enviar un formulario). |
| `setDocument(doc)` | `void` | Cargar otro documento (HTML o `WordDocument`). |
| `exportDocx()` | `Promise<Blob>` | Generar el .docx para adjuntarlo o subirlo. |
| `print()` | `void` | Abrir el diálogo de impresión o PDF. |
| `focus()` | `void` | Poner el cursor en el documento. |
| `editor` | `Editor \| null` | La instancia de Tiptap, para comandos avanzados. |

### Estilos

Todas las clases usan el prefijo `we-`, para no chocar con las de tu proyecto. El color
principal se cambia con la variable `--we-accent`:

```css
.we-root { --we-accent: #0f766e; --we-accent-soft: #ccfbf1; }
```

---

## Ejemplos

En la carpeta [`examples/`](examples) hay casos listos para copiar. Importan desde
`@/components/word-editor` (el código de este repositorio); en tu proyecto cambia esa línea por
`from 'doconline-office'`.

| Ejemplo | Qué muestra |
|---|---|
| [01-basico](examples/01-basico/EditorBasico.tsx) | El uso más simple. |
| [02-formulario](examples/02-formulario/FormularioOficio.tsx) | Campo de formulario con encabezado, número de página y envío del .docx. |
| [03-guardar-en-api](examples/03-guardar-en-api) | Abrir y guardar en una API (Guardar, Ctrl+S y autoguardado) + Route Handler. |
| [04-solo-lectura](examples/04-solo-lectura/VisorDocumento.tsx) | Visor de documentos sin edición. |
| [05-backend-nestjs](examples/05-backend-nestjs/documentos.controller.ts) | Backend NestJS y tabla PostgreSQL. |
| [06-ia-servidor](examples/06-ia-servidor/route.ts) | Servidor de IA (Claude y Gemini) para producción: las claves no llegan al navegador. |

---

## Estructura del proyecto

```
components/word-editor/     ← el componente (copia esta carpeta)
├── WordEditor.tsx          componente principal: hojas, reglas, encabezado/pie
├── index.ts                exportaciones públicas
├── types.ts                WordDocument, PageSettings y tamaños de página
├── content-styles.ts       estilos del documento (pantalla, impresión y HTML)
├── word-editor.css         estilos de la interfaz (prefijo we-)
├── ai/                     Herramientas de IA: Claude, Gemini, servidor propio, chat
├── extensions/             paginación, tablas, campos de página, párrafo, búsqueda…
├── io/                     .docx (exportar/importar), impresión y archivos
└── ui/                     cinta de opciones, reglas, menú contextual, tablas…
examples/                   casos de uso para copiar
dist/                       paquete compilado para npm (se genera con `npm run build:lib`)
tsup.config.ts              configuración del build del paquete
app/                        demo (editor completo y formulario)
docs/screenshots/           capturas del README
```

---

## Límites conocidos

- **Paginación:** se calcula en el navegador con las fuentes de la pantalla. Word puede cortar
  una línea antes o después si el equipo tiene otras fuentes. No hay control de líneas viudas
  y huérfanas (salvo para los títulos).
- **Importar .docx:** conserva la estructura (títulos, formato básico, listas, tablas, imágenes,
  vínculos y saltos de página), pero no las fuentes, tamaños y colores exactos, ni el encabezado
  y pie del archivo.
- **Exportar .docx:** la marca de agua no se exporta. Las imágenes de otros sitios solo se
  incluyen si el sitio permite CORS.
- **Pegar con el botón** depende del permiso del navegador; Ctrl+V funciona siempre.
- No incluye control de cambios, comentarios ni coedición en tiempo real. Tiptap permite
  agregarlos con Yjs (MIT).

---

## Dependencias y licencias

| Librería | Uso | Licencia |
|---|---|---|
| [Tiptap 3](https://tiptap.dev) / ProseMirror | motor de edición | MIT |
| [docx](https://docx.js.org) | exportar a .docx | MIT |
| [mammoth](https://github.com/mwilliamson/mammoth.js) | abrir .docx | BSD-2-Clause |
| [lucide-react](https://lucide.dev) | íconos | ISC |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | IA con Claude | MIT |
| [@google/genai](https://github.com/googleapis/js-genai) | IA con Gemini | Apache-2.0 |
| [Next.js](https://nextjs.org) / React | demo | MIT |

Este proyecto no contiene código de OnlyOffice ni de Microsoft Word: es una implementación
propia sobre las librerías de la tabla.

---

## Licencia

[MIT](LICENSE) © 2026 Carlos Leon. Puedes usarlo, modificarlo y distribuirlo, también en
proyectos comerciales, siempre que conserves el aviso de copyright y la licencia.
