# Publicar `doconline-office` en npm

Guía para el mantenedor del paquete. Las personas que solo lo usan necesitan únicamente
`npm i doconline-office`.

## Qué se publica

Solo la carpeta `dist/` (el componente compilado), `README.md`, `LICENSE` y `package.json`.
La demo de Next.js, los ejemplos y las capturas **no** se publican.

`dist/` se genera con [tsup](https://tsup.egoist.dev) a partir de `components/word-editor/`
(ver [`tsup.config.ts`](tsup.config.ts)):

- formatos **ESM** (`index.mjs`) y **CommonJS** (`index.js`), con tipos (`index.d.ts`);
- directiva `'use client'` al inicio, para Next.js App Router;
- el CSS de la interfaz va **dentro** del JavaScript y se inyecta al importar;
- React, Tiptap, docx, mammoth y lucide-react quedan como dependencias externas (no se copian
  dentro del paquete);
- `docx` y `mammoth` se cargan solo al exportar o abrir un .docx.

Para ver exactamente qué se va a publicar:

```bash
npm pack --dry-run
```

## Primera publicación

1. Crea una cuenta en [npmjs.com](https://www.npmjs.com/signup) y activa la verificación en dos
   pasos (npm la pide para publicar).
2. Inicia sesión desde la terminal:
   ```bash
   npm login
   ```
3. Publica desde la carpeta del proyecto:
   ```bash
   npm publish
   ```
   Antes de subir, `prepublishOnly` revisa los tipos y compila `dist/`. Si algo falla, no se
   publica nada.
4. Comprueba que aparezca en https://www.npmjs.com/package/doconline-office.

> El nombre `doconline-office` estaba libre al preparar el paquete. Si alguien lo ocupa antes,
> usa un nombre con tu usuario, por ejemplo `@leonxn/doconline-office`: cambia `"name"` en
> `package.json` y publica con `npm publish --access public`.

## Publicar una nueva versión

Usa [versionado semántico](https://semver.org/lang/es/):

| Cambio | Comando | Ejemplo |
|---|---|---|
| Corrección de errores | `npm version patch` | 1.0.0 → 1.0.1 |
| Funciones nuevas compatibles | `npm version minor` | 1.0.1 → 1.1.0 |
| Cambios que rompen el uso actual | `npm version major` | 1.1.0 → 2.0.0 |

```bash
git status                # el árbol de trabajo debe estar limpio
npm version patch         # actualiza package.json, hace commit y crea la etiqueta v1.0.1
npm publish
git push --follow-tags
```

## Con pnpm

Es equivalente:

```bash
pnpm login
pnpm version patch
pnpm publish
git push --follow-tags
```

## Probar el paquete antes de publicar

```bash
npm pack                                  # crea doconline-office-X.Y.Z.tgz
cd ../mi-proyecto-de-prueba
npm i ../DocOnline-Office/doconline-office-X.Y.Z.tgz
```

Luego usa `import { WordEditor } from 'doconline-office'` en una página y verifica que el
editor se vea con estilos, que se pueda escribir y que "Descargar como Word" funcione.

## Instalación desde GitHub (sin publicar en npm)

```bash
npm i github:leonxn/DocOnline-Office
pnpm add github:leonxn/DocOnline-Office
npm i github:leonxn/DocOnline-Office#v1.0.0   # una versión concreta (etiqueta)
```

npm y pnpm ejecutan el script `prepare`, que compila `dist/` en la máquina de quien instala.
