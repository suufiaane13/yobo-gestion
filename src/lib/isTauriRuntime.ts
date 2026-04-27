/** True quand l’app tourne dans le shell Tauri (pas le navigateur seul). */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
