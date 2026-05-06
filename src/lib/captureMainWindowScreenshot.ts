import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './isTauriRuntime'

/** Capture PNG de la fenêtre principale (Windows), avec dialogue « Enregistrer sous ». */
export async function captureMainWindowScreenshot(): Promise<
  | { ok: true; path: string }
  | { ok: false; cancelled: boolean; message?: string }
> {
  if (!isTauriRuntime()) {
    return { ok: false, cancelled: false, message: 'Disponible uniquement dans l’application bureau.' }
  }
  try {
    const path = await invoke<string | null>('screenshot_save_main_window')
    if (path == null || path === '') return { ok: false, cancelled: true }
    return { ok: true, path }
  } catch (e) {
    return { ok: false, cancelled: false, message: e instanceof Error ? e.message : String(e) }
  }
}
