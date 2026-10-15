# Ejemplos

Cada carpeta es un caso de uso listo para copiar a tu proyecto Next.js. Aquí importan el
componente desde `@/components/word-editor` (el código de este repositorio). En tu proyecto,
después de `npm i doconline-office`, cambia esa línea por:

```ts
import { WordEditor } from 'doconline-office';
```

| Ejemplo | Qué muestra |
|---|---|
| [01-basico](01-basico/EditorBasico.tsx) | El editor a pantalla completa con un HTML inicial. |
| [02-formulario](02-formulario/FormularioOficio.tsx) | El editor como campo de un formulario: al enviarlo, el documento viaja como archivo Word o PDF (`name`, `formFormat`) junto con su JSON editable. |
| [03-guardar-en-api](03-guardar-en-api/) | Abrir y guardar en tu API (botón Guardar, Ctrl+S y autoguardado) + el Route Handler de Next.js que lo recibe. |
| [04-solo-lectura](04-solo-lectura/VisorDocumento.tsx) | Mostrar un documento guardado sin poder editarlo (se puede imprimir, buscar y hacer zoom). |
| [05-backend-nestjs](05-backend-nestjs/documentos.controller.ts) | Controlador NestJS y tabla PostgreSQL sugerida para guardar los documentos. |
| [06-ia-servidor](06-ia-servidor/route.ts) | Servidor de IA para producción (Claude y Gemini): el editor usa `ai={{ endpoint: '/api/ia' }}` y las claves quedan en el servidor. |

## Probar un ejemplo en este repositorio

Crea una página que lo importe, por ejemplo `app/prueba/page.tsx`:

```tsx
import EditorBasico from '@/examples/01-basico/EditorBasico';

export default function Page() {
  return <EditorBasico />;
}
```

Luego abre `http://localhost:3005/prueba` con `npm run dev`.

## Qué guardar en la base de datos

El editor entrega un `WordDocument`:

```ts
{
  title: string;      // título del documento
  json: JSONContent;  // contenido exacto del editor → guárdalo siempre (columna JSON)
  html: string;       // para mostrarlo sin el editor o generar PDF en el servidor
  settings: {         // página: tamaño, márgenes, encabezado, pie, marca de agua…
    size, orientation, margins, header, footer, differentFirst, …
  };
}
```

Para volver a abrirlo, pasa el mismo objeto a `initialValue`.
