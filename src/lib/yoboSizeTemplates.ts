/**
 * Tailles standard YOBO pour produits multi-tailles.
 * Combinaisons finales autorisées : S+L · S+M+L · S+M+L+XL
 */
import { client } from './yoboClientMessages'
export const YOBO_STD_SIZES = ['S', 'M', 'L', 'XL'] as const
export type YoboStdSize = (typeof YOBO_STD_SIZES)[number]

function setsEqual(a: Set<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  return [...a].every((x) => b.has(x))
}

/** États possibles pendant la construction (y compris liste vide). */
const PROGRESS_SETS: ReadonlyArray<ReadonlySet<string>> = [
  new Set<string>(),
  new Set<string>(['S']),
  new Set<string>(['S', 'L']),
  new Set<string>(['S', 'M']),
  new Set<string>(['S', 'M', 'L']),
  new Set<string>(['S', 'M', 'L', 'XL']),
]

/** Combinaisons valides pour enregistrer le produit. */
const FINAL_SETS: ReadonlyArray<ReadonlySet<string>> = [
  new Set<string>(['S', 'L']),
  new Set<string>(['S', 'M', 'L']),
  new Set<string>(['S', 'M', 'L', 'XL']),
]

export function normalizeStdSizeLabel(raw: string): string | null {
  const t = raw.trim().toUpperCase()
  if (t === '') return null
  if ((YOBO_STD_SIZES as readonly string[]).includes(t)) return t
  return null
}

export function isValidYoboMultiSizeProgress(labelSet: Set<string>): boolean {
  return PROGRESS_SETS.some((p) => setsEqual(labelSet, p))
}

/** Erreur utilisateur ou null si la combinaison finale est valide. */
export function validateYoboMultiSizeLabelsFinal(labels: string[]): string | null {
  const normalized: string[] = []
  for (const raw of labels) {
    const n = normalizeStdSizeLabel(raw)
    if (n === null) {
      return client.val.menuSizeAllowedOnly
    }
    normalized.push(n)
  }
  if (new Set(normalized).size !== normalized.length) {
    return client.val.menuSizeDup
  }
  const set = new Set(normalized)
  const ok = FINAL_SETS.some((allowed) => setsEqual(set, allowed))
  if (!ok) {
    return client.val.menuSizeCombo
  }
  return null
}

export function sortSizeEntriesByStdOrder<T extends { label: string; price: number }>(entries: T[]): T[] {
  const rank = (l: string) => {
    const n = normalizeStdSizeLabel(l)
    return n ? (YOBO_STD_SIZES as readonly string[]).indexOf(n) : 999
  }
  return [...entries].sort((a, b) => rank(a.label) - rank(b.label))
}
