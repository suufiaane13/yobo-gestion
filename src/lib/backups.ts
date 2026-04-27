import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './isTauriRuntime'

export async function createBackupNow(userId: number): Promise<string> {
  if (!isTauriRuntime()) throw new Error('Backup disponible uniquement sur Desktop.')
  return await invoke<string>('backups_create_now', { input: { userId } })
}

