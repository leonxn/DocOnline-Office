/** Proveedores de IA soportados. */
export type AiProvider = 'anthropic' | 'gemini';

export interface AiModelOption {
  id: string;
  label: string;
}

/** Conexión elegida por el usuario (su propia clave) o por el servidor (`endpoint`). */
export interface AiConnection {
  provider: AiProvider;
  model: string;
  /** Clave de API del usuario. Vacía cuando se usa `endpoint` (la clave vive en el servidor). */
  apiKey: string;
  /** Guardar en este navegador (localStorage) o solo durante la sesión. */
  remember: boolean;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Lo que el editor envía a la IA (y a tu servidor, si usas `endpoint`). */
export interface AiRequest {
  provider: AiProvider;
  model: string;
  system: string;
  messages: AiMessage[];
}

/**
 * Opciones de IA del componente (`<WordEditor ai={...} />`).
 * - Sin `endpoint`: cada usuario conecta su propia clave de Claude o Gemini, guardada solo en
 *   su navegador. Bueno para herramientas internas o personales.
 * - Con `endpoint`: el editor envía las solicitudes a tu servidor, que tiene la clave. Es lo
 *   recomendado en producción (ver examples/06-ia-servidor).
 */
export interface AiOptions {
  /** URL de tu servidor que llama a la IA y devuelve el texto en streaming. */
  endpoint?: string;
  /** Cabeceras extra para `endpoint` (por ejemplo, un token de sesión). */
  headers?: Record<string, string>;
  /** Proveedores disponibles en tu servidor (con `endpoint`). Por defecto, ambos. */
  providers?: AiProvider[];
  /** Permite que el usuario conecte su propia clave. Por defecto `true` si no hay `endpoint`. */
  allowUserKeys?: boolean;
}

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: 'Claude',
  gemini: 'Gemini',
};

/** Modelos de Claude actuales. El primero es el predeterminado. */
export const CLAUDE_MODELS: AiModelOption[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
];

/**
 * Gemini: la lista real se pide a la API al conectar (los nombres cambian seguido).
 * Este alias es el respaldo si no se puede listar.
 */
export const GEMINI_FALLBACK_MODELS: AiModelOption[] = [{ id: 'gemini-flash-latest', label: 'Gemini Flash (última)' }];

export function defaultModels(provider: AiProvider): AiModelOption[] {
  return provider === 'anthropic' ? CLAUDE_MODELS : GEMINI_FALLBACK_MODELS;
}

export class AiError extends Error {}
