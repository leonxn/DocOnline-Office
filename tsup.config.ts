import { defineConfig } from 'tsup';

/**
 * Build de la librería que se publica en npm (`npm run build:lib`).
 * La demo de Next.js no usa este build: importa el código fuente directamente.
 */
export default defineConfig({
  entry: { index: 'components/word-editor/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: 'tsconfig.lib.json',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  target: 'es2020',
  // El editor solo funciona en el navegador: Next.js App Router lo trata como componente de cliente
  banner: { js: "'use client';" },
  // El CSS de la interfaz se inyecta solo al importar el componente (no hay que importar estilos aparte)
  injectStyle: true,
  // React y Tiptap los pone el proyecto que instala el paquete
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
