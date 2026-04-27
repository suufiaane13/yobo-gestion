export type Role = 'gerant' | 'caissier'
export type Theme = 'light' | 'dark'

/** `manual` = `theme` du store ; `auto_hour` = clair 7h–21h, sinon sombre. */
export type ThemePreference = 'manual' | 'auto_hour'
export type Tab =
  | 'dashboard'
  | 'caisse'
  | 'menu'
  | 'historique'
  | 'logs'
  | 'utilisateurs'
  | 'qr'
  | 'profil'

export interface BitmapData {
  data: Uint8Array
  width: number
  height: number
}
