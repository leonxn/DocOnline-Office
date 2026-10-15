import { AiError, CLAUDE_MODELS, type AiConnection, type AiModelOption, type AiOptions, type AiRequest } from './types';

/**
 * Llamadas a la IA. Los SDK oficiales se cargan solo cuando se usan (import dinámico), así no
 * pesan en la carga inicial del editor.
 *
 * - Claude: SDK oficial `@anthropic-ai/sdk`.
 * - Gemini: SDK oficial `@google/genai`.
 * - Servidor propio (`endpoint`): POST con el `AiRequest` en JSON; la respuesta es texto en
 *   streaming (ver examples/06-ia-servidor).
 */

const MAX_TOKENS = 64000;

/** Devuelve el texto de la respuesta a medida que llega. */
export async function* streamAi(
  request: AiRequest,
  connection: AiConnection | null,
  options: AiOptions,
  signal: AbortSignal,
): AsyncGenerator<string> {
  if (options.endpoint) {
    yield* streamFromEndpoint(request, options, signal);
    return;
  }
  if (!connection?.apiKey) throw new AiError('Conecta tu cuenta de Claude o Gemini en Herramientas de IA → Conectar.');
  if (request.provider === 'anthropic') yield* streamClaude(request, connection.apiKey, signal);
  else yield* streamGemini(request, connection.apiKey, signal);
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

async function* streamClaude(request: AiRequest, apiKey: string, signal: AbortSignal): AsyncGenerator<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Clave del propio usuario, guardada solo en su navegador: por eso se permite el uso directo
  // desde el navegador. En producción con una clave compartida, usa `endpoint` (servidor).
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  // Si el modelo declina por seguridad, el servidor reintenta con otro modelo (Haiku no lo admite)
  const fallback = request.model !== 'claude-haiku-5-5';

  try {
    const stream = client.beta.messages.stream(
      {
        model: request.model,
        max_tokens: MAX_TOKENS,
        system: request.system,
        messages: request.messages,
        output_config: { effort: 'medium' },
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text;
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new AiError('Claude no respondió a esta solicitud por sus políticas de uso. Reformúlala e intenta de nuevo.');
    }
    if (final.stop_reason === 'max_tokens') yield '\n\n_(La respuesta se cortó por su longitud.)_';
  } catch (err) {
    if (err instanceof AiError || signal.aborted) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new AiError('La clave de Claude no es válida. Revísala en Conectar.');
    if (err instanceof Anthropic.PermissionDeniedError) throw new AiError('Tu clave de Claude no tiene permiso para este modelo.');
    if (err instanceof Anthropic.RateLimitError) throw new AiError('Claude alcanzó el límite de uso de tu cuenta. Espera un momento y reintenta.');
    if (err instanceof Anthropic.APIError) throw new AiError(`Error de Claude (${err.status ?? 'red'}): ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function* streamGemini(request: AiRequest, apiKey: string, signal: AbortSignal): AsyncGenerator<string> {
  const { GoogleGenAI, ApiError } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  try {
    const stream = await ai.models.generateContentStream({
      model: request.model,
      contents: request.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      config: { systemInstruction: request.system, abortSignal: signal },
    });
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  } catch (err) {
    if (signal.aborted) throw err;
    if (err instanceof ApiError) {
      if (err.status === 400 && /API key/i.test(err.message)) throw new AiError('La clave de Gemini no es válida. Revísala en Conectar.');
      if (err.status === 429) throw new AiError('Gemini alcanzó el límite de uso de tu cuenta. Espera un momento y reintenta.');
      throw new AiError(`Error de Gemini (${err.status}): ${err.message}`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Servidor propio
// ---------------------------------------------------------------------------

async function* streamFromEndpoint(request: AiRequest, options: AiOptions, signal: AbortSignal): AsyncGenerator<string> {
  const res = await fetch(options.endpoint!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new AiError(`El servidor de IA respondió ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

// ---------------------------------------------------------------------------
// Verificar la clave y listar modelos
// ---------------------------------------------------------------------------

/** Comprueba la clave (sin gastar tokens) y devuelve los modelos disponibles. */
export async function verifyConnection(provider: AiConnection['provider'], apiKey: string): Promise<AiModelOption[]> {
  if (provider === 'anthropic') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    try {
      const available = new Set<string>();
      for await (const model of client.models.list()) available.add(model.id);
      const known = CLAUDE_MODELS.filter((m) => available.has(m.id));
      return known.length ? known : CLAUDE_MODELS;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new AiError('La clave de Claude no es válida.');
      if (err instanceof Anthropic.APIError) throw new AiError(`No se pudo verificar la clave de Claude (${err.status ?? 'red'}).`);
      throw err;
    }
  }

  const { GoogleGenAI, ApiError } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    const models: AiModelOption[] = [];
    for await (const m of pager) {
      const id = (m.name ?? '').replace(/^models\//, '');
      if (!id.startsWith('gemini') || !m.supportedActions?.includes('generateContent')) continue;
      if (/embedding|image|tts|audio|live/i.test(id)) continue;
      models.push({ id, label: m.displayName ?? id });
    }
    // Primero los alias "latest" y los modelos más nuevos
    models.sort((a, b) => Number(b.id.includes('latest')) - Number(a.id.includes('latest')) || b.id.localeCompare(a.id));
    return models.length ? models : [{ id: 'gemini-flash-latest', label: 'Gemini Flash (última)' }];
  } catch (err) {
    if (err instanceof ApiError) throw new AiError(`La clave de Gemini no es válida o no tiene acceso (${err.status}).`);
    throw err;
  }
}
