import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hay otro package-lock.json más arriba (en el Escritorio): fijamos la raíz del proyecto
  outputFileTracingRoot: path.resolve('.'),
  // Sin el indicador flotante de Next.js en desarrollo
  devIndicators: false,
};

export default nextConfig;
