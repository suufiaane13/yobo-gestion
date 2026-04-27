import type { ToastType } from '../store/yobo-store-state'

/**
 * Toasts : validation / rappels → warning ; blocage ou échec → error.
 * Les libellés correspondent à `yoboClientMessages` (Indique, Ouvre d’abord, etc.).
 */
export function toastTypeForStoreMessage(message: string): ToastType {
  const m = message.trim()
  if (!m) return 'error'

  const warningPatterns = [
    /^Indique\b/i,
    /^Choisis\b/i,
    /^Ouvre d’abord\b/i,
    /^Le code PIN doit\b/i,
    /^Les deux nouveaux codes\b/i,
    /^Ajoute au moins\b/i,
    /^Cette taille ne convient pas\b/i,
    /^Nom enregistré\b/i,
    /^Utilise uniquement\b/i,
    /^Ne saisis pas deux fois\b/i,
    /^Combinaisons possibles\b/i,
  ]

  for (const re of warningPatterns) {
    if (re.test(m)) return 'warning'
  }

  return 'error'
}
