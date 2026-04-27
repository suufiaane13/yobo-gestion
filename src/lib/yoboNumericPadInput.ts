export type YoboPadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back' | 'clear'

/** Saisie montant style FR : virgule décimale, max 2 chiffres après la virgule. */
export function applyPadKeyMadAmount(prev: string, key: YoboPadKey): string {
  if (key === 'clear') return ''
  if (key === 'back') return prev.slice(0, -1)
  if (key === ',') {
    if (prev.includes(',')) return prev
    return prev === '' ? '0,' : `${prev},`
  }
  if (key < '0' || key > '9') return prev
  const [intRaw, frac] = prev.split(',')
  if (prev.includes(',')) {
    const f = frac ?? ''
    if (f.length >= 2) return prev
    return `${intRaw},${f}${key}`
  }
  if (intRaw.length >= 8) return prev
  return `${intRaw}${key}`
}

export function applyPadKeyPin(prev: string, key: YoboPadKey, maxLen: number): string {
  if (key === 'clear') return ''
  if (key === 'back') return prev.slice(0, -1)
  if (key === ',') return prev
  if (key < '0' || key > '9') return prev
  if (prev.length >= maxLen) return prev
  return `${prev}${key}`
}
