import type { Theme } from './core'

export type CaissierDto = {
  id: number
  name: string
  role: string
  active: boolean
  theme: Theme
  createdAt: string
}

export type UserProfileDto = {
  id: number
  name: string
  role: string
  active: boolean
  createdAt: string
}

/** Tauri / serde peut exposer `createdAt` ou `created_at` selon la config. */
export function caissierFromApiRow(row: unknown): CaissierDto {
  const o = row as Record<string, unknown>
  const createdAt =
    (typeof o.createdAt === 'string' && o.createdAt) ||
    (typeof o.created_at === 'string' && o.created_at) ||
    ''
  return {
    id: Number(o.id),
    name: String(o.name ?? ''),
    role: String(o.role ?? ''),
    active: Boolean(o.active),
    theme: o.theme === 'light' ? 'light' : 'dark',
    createdAt,
  }
}
