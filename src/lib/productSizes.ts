/**
 * Produits à prix unique sans variante « taille ».
 * Stockage : `sizes` JSON avec une seule entrée et une clé vide, ex. `{ "": 45 }`.
 */
import { compareSizeLabelsFr } from './yoboSizeTemplates'

export const YOBO_SINGLE_PRICE_KEY = ''

export function isBlankSizeKey(label: string): boolean {
  return label === YOBO_SINGLE_PRICE_KEY
}

/** Plat standard : un seul prix, sans libellé de taille. */
export function isSinglePriceOnlySizes(sizes: Record<string, number>): boolean {
  const keys = Object.keys(sizes)
  return keys.length === 1 && keys[0] === YOBO_SINGLE_PRICE_KEY
}

/** Une seule variante (ex. M ou G, ou prix unique) → pas de modal de choix au POS. */
export function isSingleVariantSizes(sizes: Record<string, number>): boolean {
  return Object.keys(sizes).length === 1
}

export function getSingleVariantEntry(sizes: Record<string, number>): [string, number] | null {
  const entries = Object.entries(sizes)
  if (entries.length !== 1) return null
  return entries[0]!
}

/** Libellé affiché au POS / tickets (tel qu’enregistré, hors clé prix unique). */
export function formatSizeLabelForDisplay(raw: string): string {
  if (isBlankSizeKey(raw)) return ''
  return raw.trim()
}

/**
 * Trie les paires taille/prix pour l’UI (évite un ordre aléatoire des clés JSON).
 */
export function sortSizePairsForDisplay(pairs: [string, number][]): [string, number][] {
  return [...pairs].sort((a, b) => {
    if (isBlankSizeKey(a[0])) return 1
    if (isBlankSizeKey(b[0])) return -1
    return compareSizeLabelsFr(a[0], b[0])
  })
}
