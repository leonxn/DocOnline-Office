'use client';

import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SYSTEM_PROMPT, buildUserMessage, type ContextScope, type QuickAction } from './prompts';
import { streamAi } from './providers';
import { loadConnection, saveConnection } from './storage';
import { AiError, defaultModels, type AiConnection, type AiMessage, type AiModelOption, type AiOptions, type AiProvider } from './types';

/** Límite de texto enviado como contexto (~150 000 palabras). Más que esto se pide usar una selección. */
const MAX_CONTEXT_CHARS = 600_000;
/** Turnos anteriores que se reenvían para que la IA recuerde la conversación. */
const HISTORY_TURNS = 8;

export interface ChatEntry {
  id: number;
  role: 'user' | 'assistant';
  /** Lo que se muestra en el chat. */
  display: string;
  /** Lo que realmente se envió (incluye el texto de trabajo). */
  sent?: string;
  error?: string;
  streaming?: boolean;
  /** Rango original, para "Reemplazar" en acciones que transforman texto. */
  replace?: { editor: Editor; from: number; to: number; original: string };
}

export interface SendOptions {
  instruction: string;
  /** Texto corto para el chat (p. ej. "Resumir"). Por defecto, la instrucción. */
  label?: string;
  scope?: ContextScope | 'auto';
  transforms?: boolean;
}

export interface ConnectionState {
  /** Conexión del usuario (clave propia) o configuración del servidor (`endpoint`). */
  connection: AiConnection | null;
  models: AiModelOption[];
  /** Hay forma de llamar a la IA (clave del usuario o servidor). */
  ready: boolean;
}

export function useAiChat(getEditor: () => Editor | null, options: AiOptions) {
  const usesEndpoint = !!options.endpoint;
  const [connection, setConnection] = useState<AiConnection | null>(null);
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  // Conexión guardada (o la del servidor) al montar
  useEffect(() => {
    if (usesEndpoint) {
      const provider: AiProvider = options.providers?.[0] ?? 'anthropic';
      const saved = loadConnection();
      const model = saved?.provider === provider ? saved.model : defaultModels(provider)[0].id;
      setConnection({ provider, model, apiKey: '', remember: true });
      setModels(defaultModels(provider));
      return;
    }
    const saved = loadConnection();
    if (saved?.apiKey) {
      setConnection(saved);
      setModels(saved.provider === 'anthropic' ? defaultModels('anthropic') : [{ id: saved.model, label: saved.model }]);
    }
  }, [usesEndpoint, options.providers]);

  const connect = useCallback((next: AiConnection, available: AiModelOption[]) => {
    setConnection(next);
    setModels(available);
    saveConnection(usesEndpoint ? { ...next, apiKey: '' } : next);
  }, [usesEndpoint]);

  const disconnect = useCallback(() => {
    setConnection(usesEndpoint ? connection : null);
    if (!usesEndpoint) setModels([]);
    saveConnection(null);
  }, [usesEndpoint, connection]);

  const setModel = useCallback((model: string) => {
    setConnection((c) => {
      if (!c) return c;
      const next = { ...c, model };
      saveConnection(usesEndpoint ? { ...next, apiKey: '' } : next);
      return next;
    });
  }, [usesEndpoint]);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setEntries([]);
  }, []);

  const send = useCallback(
    async ({ instruction, label, scope = 'auto', transforms }: SendOptions) => {
      const editor = getEditor();
      if (!editor || running) return;
      const { from, to, empty } = editor.state.selection;
      const resolved: ContextScope = scope === 'auto' ? (empty ? 'document' : 'selection') : scope;
      const text =
        resolved === 'selection' ? editor.state.doc.textBetween(from, to, '\n\n') : resolved === 'document' ? editor.getText({ blockSeparator: '\n\n' }) : '';

      const userId = ++idRef.current;
      const asstId = ++idRef.current;
      const scopeNote = resolved === 'selection' ? ' · sobre la selección' : resolved === 'document' ? ' · sobre el documento' : '';

      if (text.length > MAX_CONTEXT_CHARS) {
        setEntries((e) => [
          ...e,
          { id: userId, role: 'user', display: (label ?? instruction) + scopeNote },
          {
            id: asstId,
            role: 'assistant',
            display: '',
            error: 'El documento es demasiado largo para enviarlo completo. Selecciona la parte que quieres procesar e intenta de nuevo.',
          },
        ]);
        return;
      }

      const sent = buildUserMessage(instruction, resolved, text);
      const history: AiMessage[] = entries
        .filter((e) => !e.error && !e.streaming && (e.role === 'assistant' ? e.display : e.sent))
        .slice(-HISTORY_TURNS * 2)
        .map((e) => ({ role: e.role, content: e.role === 'user' ? e.sent! : e.display }));

      setEntries((e) => [
        ...e,
        { id: userId, role: 'user', display: (label ?? instruction) + scopeNote, sent },
        {
          id: asstId,
          role: 'assistant',
          display: '',
          streaming: true,
          replace: transforms && resolved === 'selection' ? { editor, from, to, original: text } : undefined,
        },
      ]);
      setRunning(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const update = (patch: Partial<ChatEntry> | ((e: ChatEntry) => Partial<ChatEntry>)) =>
        setEntries((list) => list.map((e) => (e.id === asstId ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch) } : e)));

      try {
        const conn = connection;
        if (!conn) throw new AiError('Conecta tu cuenta de Claude o Gemini en Herramientas de IA → Conectar.');
        let acc = '';
        let last = 0;
        for await (const chunk of streamAi(
          { provider: conn.provider, model: conn.model, system: SYSTEM_PROMPT, messages: [...history, { role: 'user', content: sent }] },
          conn,
          options,
          controller.signal,
        )) {
          acc += chunk;
          // Se agrupan los fragmentos para no redibujar el chat en cada token
          if (performance.now() - last > 60) {
            last = performance.now();
            update({ display: acc });
          }
        }
        update({ display: acc, streaming: false });
      } catch (err) {
        if (controller.signal.aborted) update((e) => ({ streaming: false, display: e.display ? `${e.display}\n\n_(Detenido)_` : '_(Detenido)_' }));
        else update({ streaming: false, error: err instanceof Error ? err.message : String(err) });
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [getEditor, running, entries, connection, options],
  );

  const runAction = useCallback(
    (action: QuickAction, scope: ContextScope | 'auto' = 'auto') =>
      send({ instruction: action.prompt, label: action.label, scope, transforms: action.transforms }),
    [send],
  );

  const state: ConnectionState = {
    connection,
    models: models.length ? models : connection ? defaultModels(connection.provider) : [],
    ready: usesEndpoint || !!connection?.apiKey,
  };

  return { ...state, usesEndpoint, entries, running, send, runAction, stop, clear, connect, disconnect, setModel };
}

export type AiChat = ReturnType<typeof useAiChat>;
