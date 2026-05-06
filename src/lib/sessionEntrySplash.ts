/** Aligné sur `LoginPage` (durée min. du premier splash). */
const MIN_MS = 2000
const MIN_MS_REDUCED = 450

export const SESSION_ENTRY_SPLASH_FADE_MS = 480

export function sessionEntrySplashMinMs(): number {
  if (typeof window === 'undefined') return MIN_MS
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? MIN_MS_REDUCED : MIN_MS
}
