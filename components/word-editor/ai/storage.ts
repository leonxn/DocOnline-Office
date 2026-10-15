import type { QuickAction } from './prompts';
import type { AiConnection } from './types';

/**
 * Conexión de IA y acciones rápidas del usuario, guardadas en SU navegador.
 * Con "Recordar" se usa localStorage; si no, sessionStorage (se borra al cerrar la pestaña).
 * Todo va en try/catch: en modo privado o con el almacenamiento bloqueado, simplemente no se guarda.
 */
const CONNECTION_KEY = 'doconline-office:ai-connection';
const ACTIONS_KEY = 'doconline-office:ai-actions';

export function loadConnection(): AiConnection | null {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const raw = store().getItem(CONNECTION_KEY);
      if (raw) return JSON.parse(raw) as AiConnection;
    } catch {
      // almacenamiento no disponible
    }
  }
  return null;
}

export function saveConnection(connection: AiConnection | null) {
  try {
    localStorage.removeItem(CONNECTION_KEY);
    sessionStorage.removeItem(CONNECTION_KEY);
    if (connection) (connection.remember ? localStorage : sessionStorage).setItem(CONNECTION_KEY, JSON.stringify(connection));
  } catch {
    // almacenamiento no disponible: la conexión dura mientras la página esté abierta
  }
}

export function loadCustomActions(): QuickAction[] {
  try {
    const raw = localStorage.getItem(ACTIONS_KEY);
    return raw ? (JSON.parse(raw) as QuickAction[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomActions(actions: QuickAction[]) {
  try {
    localStorage.setItem(ACTIONS_KEY, JSON.stringify(actions));
  } catch {
    // almacenamiento no disponible
  }
}
