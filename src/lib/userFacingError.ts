/**
 * Erreurs Tauri / JS : en production, message simple pour le client uniquement.
 * En développement, message serveur affiché seulement s’il semble « grand public ».
 */

const MAX_LEN = 480

const TECHNICAL_HINT =
  /sql|sqlite|rusqlite|database|constraint|UNIQUE|FOREIGN KEY|no such table|disk I\/O|I\/O error|0x[0-9a-f]{4,}|undefined|TypeError|ReferenceError|panic|ECONNREFUSED|ENOENT|internal error|IPC|webview|thread|stack trace/i

export function logDevError(context: string, error: unknown): void {
  if (import.meta.env.DEV) console.error(`[yobo] ${context}`, error)
}

function extractRawErrorString(error: unknown): string | null {
  if (typeof error === 'string') {
    const t = error.trim()
    return t || null
  }
  if (error instanceof Error) {
    const t = error.message.trim()
    return t || null
  }
  if (error != null && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message
    if (typeof m === 'string') {
      const t = m.trim()
      return t || null
    }
    if (m != null) {
      const t = String(m).trim()
      return t && t !== 'undefined' ? t : null
    }
  }
  return null
}

function looksTechnical(message: string): boolean {
  return TECHNICAL_HINT.test(message) || message.length > 280
}

/**
 * @param clientFallback — utiliser `client.error.*` ou `client.val.*` depuis `yoboClientMessages`.
 */
export function userFacingErrorMessage(error: unknown, clientFallback: string): string {
  const raw = extractRawErrorString(error)
  if (!raw || looksTechnical(raw)) {
    return clientFallback
  }

  // Même en production, on peut afficher un message serveur si (et seulement si)
  // il ressemble à un message "grand public" (pas technique, pas trop long).
  if (raw.length > MAX_LEN) {
    return `${raw.slice(0, MAX_LEN - 1)}…`
  }
  return raw
}
