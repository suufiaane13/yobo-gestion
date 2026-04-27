import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './isTauriRuntime'

export async function exportCatalogCsvToDocuments(userId: number): Promise<string> {
  if (!isTauriRuntime()) throw new Error('Export catalogue disponible uniquement sur Desktop.')
  return await invoke<string>('catalog_export_csv_to_documents', { input: { userId } })
}

export async function importCatalogCsvPickDialog(userId: number): Promise<string> {
  if (!isTauriRuntime()) throw new Error('Import catalogue disponible uniquement sur Desktop.')
  return await invoke<string>('catalog_import_csv_pick_dialog', { input: { userId } })
}

