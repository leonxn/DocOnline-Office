import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocOnline Office',
  description: 'Editor tipo Word reutilizable para proyectos Next.js',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
