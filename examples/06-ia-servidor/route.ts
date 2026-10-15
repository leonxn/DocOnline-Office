/**
 * Ejemplo 6 — Servidor de IA para producción (Next.js Route Handler).
 * Cópialo a `app/api/ia/route.ts` y usa el editor así:
 *
 *   <WordEditor ai={{ endpoint: '/api/ia' }} />
 *
 * Las claves viven SOLO en el servidor (variables de entorno). El navegador nunca las ve, y
 * tú decides quién puede usar la IA (agrega tu propia verificación de sesión abajo).
 *
 *   ANTHROPIC_API_KEY=sk-ant-...   # para Claude
 *   GEMINI_API_KEY=AIza...         # para Gemini (opcional)
 *
 * Si solo ofreces uno de los dos, indícalo en el editor:
 *   <WordEditor ai={{ endpoint: '/api/ia', providers: ['anthropic'] }} />
 */
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import type { AiRequest } from '@/components/word-editor'; // en tu proyecto: from 'doconline-office'

export const runtime = 'nodejs';

/** Modelos permitidos: evita que alguien pida otro modelo más caro. */
const ALLOWED = {
  anthropic: new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']),
  gemini: (model: string) => /^gemini-[\w.-]+$/.test(model),
};

const MAX_INPUT_CHARS = 600_000;

export async function POST(req: Request) {
  // TODO: verifica aquí la sesión del usuario (cookie, JWT…) y devuelve 401 si no está autorizado.

  let body: AiRequest;
  try {
    body = (await req.json()) as AiRequest;
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }
  const { provider, model, system, messages } = body;
  if (!Array.isArray(messages) || !messages.length || typeof system !== 'string') {
    return new Response('Solicitud incompleta', { status: 400 });
  }
  const size = system.length + messages.reduce((n, m) => n + String(m.content ?? '').length, 0);
  if (size > MAX_INPUT_CHARS) return new Response('El texto es demasiado largo', { status: 413 });

  const cleanMessages = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();

  if (provider === 'anthropic') {
    if (!ALLOWED.anthropic.has(model)) return new Response('Modelo no permitido', { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return new Response('Falta ANTHROPIC_API_KEY en el servidor', { status: 500 });
    const client = new Anthropic(); // lee ANTHROPIC_API_KEY
    // Si el modelo declina por seguridad, el servidor reintenta con otro (Haiku no lo admite)
    const fallback = model !== 'claude-haiku-5-5';
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        system,
        messages: cleanMessages,
        output_config: { effort: 'medium' },
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      },
      { signal: req.signal },
    );
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            }
            const final = await stream.finalMessage();
            if (final.stop_reason === 'refusal') {
              controller.enqueue(encoder.encode('\n\n_(Claude no respondió a esta solicitud por sus políticas de uso.)_'));
            }
            controller.close();
          } catch (err) {
            const message = err instanceof Anthropic.APIError ? `Error de Claude (${err.status ?? 'red'})` : 'Error al generar la respuesta';
            controller.enqueue(encoder.encode(`\n\n_(${message})_`));
            controller.close();
          }
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }

  if (provider === 'gemini') {
    if (!ALLOWED.gemini(model)) return new Response('Modelo no permitido', { status: 400 });
    if (!process.env.GEMINI_API_KEY) return new Response('Falta GEMINI_API_KEY en el servidor', { status: 500 });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const stream = await ai.models.generateContentStream({
      model,
      contents: cleanMessages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      config: { systemInstruction: system, abortSignal: req.signal },
    });
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
          } catch {
            controller.enqueue(encoder.encode('\n\n_(Error al generar la respuesta)_'));
          }
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }

  return new Response('Proveedor no soportado', { status: 400 });
}
