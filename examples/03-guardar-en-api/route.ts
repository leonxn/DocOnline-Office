/**
 * Ejemplo 3 (backend) — Route Handler de Next.js para guardar documentos.
 * Cópialo a `app/api/documentos/[id]/route.ts`.
 *
 * Usa un Map en memoria para que el ejemplo funcione sin base de datos.
 * En tu proyecto reemplázalo por tu BD (una columna JSON/JSONB para `json` y `settings`).
 */
import { NextResponse } from 'next/server';
import type { WordDocument } from '@/components/word-editor';

const documentos = new Map<string, WordDocument>();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const doc = documentos.get(id);
  if (!doc) {
    // Documento nuevo: el editor acepta HTML o un WordDocument parcial
    return NextResponse.json({ title: 'Documento nuevo', html: '<p></p>' });
  }
  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as Partial<WordDocument>;
  if (!body.json || body.json.type !== 'doc') {
    return NextResponse.json({ message: 'Documento inválido' }, { status: 400 });
  }
  documentos.set(id, {
    title: String(body.title ?? 'Sin título').slice(0, 200),
    json: body.json,
    html: String(body.html ?? ''),
    settings: body.settings!,
  });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
