import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './isTauriRuntime'

export type YoboExportKind = 'csv' | 'logs' | 'qr' | 'pdf' | 'sql' | 'images' | 'backups'

export async function writeYoboDocumentsTextExport(input: {
  userId: number
  kind: YoboExportKind
  filename: string
  content: string
}): Promise<string> {
  if (!isTauriRuntime()) throw new Error('not_tauri')
  return await invoke<string>('exports_write_text_file', {
    input: {
      userId: input.userId,
      kind: input.kind,
      filename: input.filename,
      content: input.content,
    },
  })
}

export async function writeYoboDocumentsBytesExport(input: {
  userId: number
  kind: YoboExportKind
  filename: string
  bytes: number[]
}): Promise<string> {
  if (!isTauriRuntime()) throw new Error('not_tauri')
  return await invoke<string>('exports_write_bytes_file', {
    input: {
      userId: input.userId,
      kind: input.kind,
      filename: input.filename,
      bytes: input.bytes,
    },
  })
}

