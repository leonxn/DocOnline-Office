'use client';

import { ExternalLink, KeyRound, Loader2, Server, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { verifyConnection } from '../ai/providers';
import type { AiChat } from '../ai/useAiChat';
import { PROVIDER_LABEL, defaultModels, type AiOptions, type AiProvider } from '../ai/types';

interface Props {
  chat: AiChat;
  options: AiOptions;
  onClose: () => void;
}

const KEY_LINKS: Record<AiProvider, { url: string; text: string; placeholder: string }> = {
  anthropic: { url: 'https://console.anthropic.com/settings/keys', text: 'Crear una clave en la consola de Anthropic', placeholder: 'sk-ant-…' },
  gemini: { url: 'https://aistudio.google.com/apikey', text: 'Crear una clave en Google AI Studio', placeholder: 'AIza…' },
};

/** Diálogo para conectar la cuenta de Claude o Gemini del usuario (o elegir modelo del servidor). */
export function AiConnectDialog({ chat, options, onClose }: Props) {
  const providers: AiProvider[] = options.providers?.length ? options.providers : ['anthropic', 'gemini'];
  const [provider, setProvider] = useState<AiProvider>(chat.connection?.provider ?? providers[0]);
  const [apiKey, setApiKey] = useState('');
  const [remember, setRemember] = useState(chat.connection?.remember ?? true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('input, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const connected = chat.ready && chat.connection;

  async function connect() {
    setError(undefined);
    if (chat.usesEndpoint) {
      const models = defaultModels(provider);
      chat.connect({ provider, model: models[0].id, apiKey: '', remember: true }, models);
      onClose();
      return;
    }
    const key = apiKey.trim();
    if (!key) return setError('Pega tu clave de API.');
    setChecking(true);
    try {
      const models = await verifyConnection(provider, key);
      chat.connect({ provider, model: models[0].id, apiKey: key, remember }, models);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="we-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="we-modal" role="dialog" aria-modal="true" aria-labelledby="we-ai-connect-title" ref={dialogRef}>
        <div className="we-modal-head">
          <h2 id="we-ai-connect-title">Conectar IA</h2>
          <button type="button" className="we-icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {connected && (
          <div className="we-ai-status">
            Conectado a <strong>{PROVIDER_LABEL[chat.connection!.provider]}</strong>
            {chat.usesEndpoint ? ' a través del servidor de tu organización.' : chat.connection!.remember ? ' (clave guardada en este navegador).' : ' (solo en esta sesión).'}
            {!chat.usesEndpoint && (
              <button type="button" className="we-link-btn" onClick={() => chat.disconnect()}>
                Desconectar
              </button>
            )}
          </div>
        )}

        <fieldset className="we-provider-pick">
          <legend>Proveedor</legend>
          {providers.map((p) => (
            <label key={p} className={`we-provider ${provider === p ? 'is-active' : ''}`}>
              <input type="radio" name="we-provider" checked={provider === p} onChange={() => setProvider(p)} />
              <span className="we-provider-name">{PROVIDER_LABEL[p]}</span>
              <span className="we-provider-desc">{p === 'anthropic' ? 'Opus 5.5, Sonnet 5.5 y Haiku 5.5' : 'Modelos Gemini de Google'}</span>
            </label>
          ))}
        </fieldset>

        {chat.usesEndpoint ? (
          <p className="we-modal-note">
            <Server size={14} /> Las solicitudes van al servidor de tu organización; no necesitas una clave propia.
          </p>
        ) : (
          <>
            <label className="we-field">
              <span>
                <KeyRound size={14} /> Clave de API de {PROVIDER_LABEL[provider]}
              </span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={KEY_LINKS[provider].placeholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
              />
            </label>
            <a className="we-modal-link" href={KEY_LINKS[provider].url} target="_blank" rel="noopener noreferrer">
              {KEY_LINKS[provider].text} <ExternalLink size={12} />
            </a>
            <label className="we-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Recordar en este navegador
            </label>
            <p className="we-modal-note">
              La clave se guarda solo en tu navegador y se usa para hablar directamente con {PROVIDER_LABEL[provider]}. El uso se
              cobra a tu cuenta de {provider === 'anthropic' ? 'Anthropic' : 'Google'}. No la uses en equipos compartidos.
            </p>
          </>
        )}

        {error && (
          <p className="we-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="we-modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="we-primary" disabled={checking} onClick={connect}>
            {checking ? (
              <>
                <Loader2 size={14} className="we-spin" /> Verificando…
              </>
            ) : (
              'Conectar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
