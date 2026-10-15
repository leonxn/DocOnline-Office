'use client';

import type { Editor } from '@tiptap/react';
import { ArrowUp, Check, ClipboardCopy, FileInput, History, PanelRightClose, Plug, Replace, Sparkles, Square, TextSelect } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { markdownToHtml } from '../ai/markdown';
import { CHAT_SUGGESTIONS, type ContextScope } from '../ai/prompts';
import type { AiChat, ChatEntry } from '../ai/useAiChat';
import { PROVIDER_LABEL } from '../ai/types';

interface Props {
  chat: AiChat;
  /** Editor donde se insertan los resultados (documento o encabezado/pie en edición). */
  editor: Editor;
  onClose: () => void;
  onConnect: () => void;
  notify: (msg: string) => void;
}

const SCOPE_LABEL: Record<ContextScope | 'auto', string> = {
  auto: 'Selección o documento',
  selection: 'Solo la selección',
  document: 'Todo el documento',
  none: 'Sin el documento',
};

function AssistantMessage({ entry, editor, notify }: { entry: ChatEntry; editor: Editor; notify: (m: string) => void }) {
  const html = useMemo(() => markdownToHtml(entry.display), [entry.display]);
  const [copied, setCopied] = useState(false);

  if (entry.error) {
    return (
      <div className="we-chat-msg is-error" role="alert">
        {entry.error}
      </div>
    );
  }

  const insert = () => {
    const { to } = editor.state.selection;
    editor.chain().focus().setTextSelection(to).insertContent(html).run();
    notify('Insertado en el documento');
  };

  const replace = () => {
    const r = entry.replace;
    if (!r) return;
    // Solo si el texto original sigue igual en ese lugar (el documento pudo cambiar)
    let current = '';
    try {
      current = r.editor.state.doc.textBetween(r.from, r.to, '\n\n');
    } catch {
      current = '';
    }
    if (current !== r.original) {
      notify('El texto original cambió. Selecciónalo de nuevo o usa Insertar.');
      return;
    }
    r.editor.chain().focus().insertContentAt({ from: r.from, to: r.to }, html).run();
    notify('Texto reemplazado');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify('No se pudo copiar al portapapeles');
    }
  };

  return (
    <div className="we-chat-msg is-assistant">
      {entry.display ? (
        <div className="we-chat-md" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="we-chat-typing" aria-label="Escribiendo">
          <span />
          <span />
          <span />
        </div>
      )}
      {!entry.streaming && entry.display && (
        <div className="we-chat-actions">
          {entry.replace && (
            <button type="button" onClick={replace} title="Reemplazar el texto seleccionado por este resultado">
              <Replace size={13} /> Reemplazar
            </button>
          )}
          <button type="button" onClick={insert} title="Insertar en la posición del cursor">
            <FileInput size={13} /> Insertar
          </button>
          <button type="button" onClick={copy} title="Copiar">
            {copied ? <Check size={13} /> : <ClipboardCopy size={13} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  );
}

export function AiPanel({ chat, editor, onClose, onConnect, notify }: Props) {
  const [input, setInput] = useState('');
  const [scope, setScope] = useState<ContextScope | 'auto'>('auto');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mantener visible el último mensaje
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chat.entries]);

  const submit = () => {
    const text = input.trim();
    if (!text || chat.running) return;
    setInput('');
    chat.send({ instruction: text, scope });
  };

  return (
    <aside className="we-side we-side-right we-ai-panel" aria-label="Chat de IA">
      <div className="we-side-head">
        <strong>Chat de IA</strong>
        <div className="we-side-tools">
          <button type="button" className="we-icon-btn" aria-label="Nuevo chat" data-tip="Nuevo chat" onClick={chat.clear} disabled={!chat.entries.length}>
            <History size={16} />
          </button>
          <button type="button" className="we-icon-btn" aria-label="Cerrar panel" data-tip="Cerrar" onClick={onClose}>
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>

      <div className="we-chat-list" ref={listRef}>
        {!chat.entries.length ? (
          <div className="we-chat-empty">
            <div className="we-chat-logo" aria-hidden="true">
              <Sparkles size={28} />
            </div>
            <p>Tu asistente de IA para documentos</p>
            {!chat.ready && (
              <button type="button" className="we-primary we-connect-cta" onClick={onConnect}>
                <Plug size={14} /> Conectar Claude o Gemini
              </button>
            )}
          </div>
        ) : (
          chat.entries.map((entry) =>
            entry.role === 'user' ? (
              <div key={entry.id} className="we-chat-msg is-user">
                {entry.display}
              </div>
            ) : (
              <AssistantMessage key={entry.id} entry={entry} editor={editor} notify={notify} />
            ),
          )
        )}
      </div>

      {!chat.entries.length && chat.ready && (
        <div className="we-chat-chips">
          {CHAT_SUGGESTIONS.map((s) => (
            <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chat.runAction(s)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="we-chat-input">
        <textarea
          ref={inputRef}
          rows={2}
          placeholder={chat.ready ? 'Pregunta lo que quieras…' : 'Conecta tu cuenta para empezar'}
          value={input}
          disabled={!chat.ready}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="we-chat-input-bar">
          <label className="we-chat-scope" title="Qué texto del documento se envía con tu pregunta">
            <TextSelect size={14} />
            <select value={scope} onChange={(e) => setScope(e.target.value as ContextScope | 'auto')} aria-label="Contexto">
              {(Object.keys(SCOPE_LABEL) as (ContextScope | 'auto')[]).map((k) => (
                <option key={k} value={k}>
                  {SCOPE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <span className="we-chat-spacer" />
          {chat.ready && chat.connection ? (
            <select
              className="we-chat-model"
              aria-label={`Modelo de ${PROVIDER_LABEL[chat.connection.provider]}`}
              value={chat.connection.model}
              onChange={(e) => chat.setModel(e.target.value)}
            >
              {chat.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <button type="button" className="we-link-btn" onClick={onConnect}>
              Conectar
            </button>
          )}
          {chat.running ? (
            <button type="button" className="we-chat-send is-stop" aria-label="Detener" onClick={chat.stop}>
              <Square size={13} />
            </button>
          ) : (
            <button type="button" className="we-chat-send" aria-label="Enviar" disabled={!input.trim() || !chat.ready} onClick={submit}>
              <ArrowUp size={15} />
            </button>
          )}
        </div>
      </div>
      <p className="we-chat-foot">La IA puede cometer errores. Revisa la información importante.</p>
    </aside>
  );
}
