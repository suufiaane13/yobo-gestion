/**
 * Libellés de taille : texte libre (après trim), sans contrainte P/M/G/TG.
 * Ordre d’affichage : tailles courantes en premier, puis ordre alphabétique (fr).
 */
import { client } from './yoboClientMessages'

/** Suggestions courantes pour le menu gérant (non exclusif). */
export const YOBO_STD_SIZES = ['P', 'M', 'G', 'TG'] as const
export type YoboStdSize = (typeof YOBO_STD_SIZES)[number]

/** Raccourcis supplémentaires (S, L, XL, libellés texte possibles via saisie). */
export const YOBO_SIZE_QUICK_PRESETS = ['P', 'M', 'G', 'TG', 'S', 'L', 'XL'] as const

export function trimSizeLabel(raw: string): string | null {
  const t = raw.trim()
  return t === '' ? null : t
}

/** Clé de dédoublonnage (insensible à la casse). */
export function sizeLabelDedupKey(raw: string): string {
  return raw.trim().toLocaleLowerCase('fr-FR')
}

function displayRank(label: string): [number, string] {
  const t = label.trim()
  const u = t.toUpperCase()
  if (u === 'P' || u === 'S') return [0, t]
  if (u === 'M') return [1, t]
  if (u === 'G' || u === 'L') return [2, t]
  if (u === 'TG' || u === 'XL') return [3, t]
  return [100, t]
}

/** Compare deux libellés pour tri catalogue / POS (fr). */
export function compareSizeLabelsFr(a: string, b: string): number {
  const [ra, ka] = displayRank(a)
  const [rb, kb] = displayRank(b)
  if (ra !== rb) return ra - rb
  return ka.localeCompare(kb, 'fr', { sensitivity: 'base' })
}

export function sortSizeEntriesByStdOrder<T extends { label: string; price: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => compareSizeLabelsFr(a.label, b.label))
}

/** Libellés non vides, sans doublon (casse ignorée). */
export function validateYoboMultiSizeLabels(labels: string[]): string | null {
  const keys: string[] = []
  for (const raw of labels) {
    const t = trimSizeLabel(raw)
    if (t === null) {
      return client.val.menuSizeLabel
    }
    keys.push(sizeLabelDedupKey(t))
  }
  if (new Set(keys).size !== keys.length) {
    return client.val.menuSizeDup
  }
  return null
}
