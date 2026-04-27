/**
 * Produits à prix unique sans variante « taille ».
 * Stockage : `sizes` JSON avec une seule entrée et une clé vide, ex. `{ "": 45 }`.
 */
export const YOBO_SINGLE_PRICE_KEY = ''

export function isBlankSizeKey(label: string): boolean {
  return label === YOBO_SINGLE_PRICE_KEY
}

/** Plat standard : un seul prix, sans libellé de taille. */
export function isSinglePriceOnlySizes(sizes: Record<string, number>): boolean {
  const keys = Object.keys(sizes)
  return keys.length === 1 && keys[0] === YOBO_SINGLE_PRICE_KEY
}

/** Une seule variante (M, L, ou prix unique) → pas de modal de choix au POS. */
export function isSingleVariantSizes(sizes: Record<string, number>): boolean {
  return Object.keys(sizes).length === 1
}

export function getSingleVariantEntry(sizes: Record<string, number>): [string, number] | null {
  const entries = Object.entries(sizes)
  if (entries.length !== 1) return null
  return entries[0]!
}

/** Ordre d’affichage (POS, tableaux) : S → M → L → X → XL → XXL, puis libellés hérités, prix unique en dernier. */
export const YOBO_SIZE_DISPLAY_ORDER = ['S', 'M', 'L', 'X', 'XL', 'XXL'] as const

/**
 * Trie les paires taille/prix pour l’UI (évite L M S dû au parcours aléatoire des clés JSON).
 */
export function sortSizePairsForDisplay(pairs: [string, number][]): [string, number][] {
  const order = YOBO_SIZE_DISPLAY_ORDER as readonly string[]
  const rank = (label: string): number => {
    if (isBlankSizeKey(label)) return 10_000
    const u = label.trim().toUpperCase()
    const i = order.indexOf(u)
    if (i >= 0) return i
    // Plus petit que S (eau, anciens seeds)
    if (u === 'PETITE' || u === 'SMALL' || u === 'MINI') return -1
    // Anciens libellés (ex. démo / imports)
    if (u === 'NORMAL' || u === 'P') return 0
    if (u === 'GRANDE') return 3
    if (u === 'GRAND' || u === 'MAXI' || u === 'G') return 3
    return 500
  }
  return [...pairs].sort((a, b) => {
    const ra = rank(a[0])
    const rb = rank(b[0])
    if (ra !== rb) return ra - rb
    return a[0].localeCompare(b[0], 'fr')
  })
}
