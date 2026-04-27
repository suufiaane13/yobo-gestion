/** Parse un montant MAD saisi (virgule ou point, espaces ignorés). */
export function parseMadAmountRaw(input: string): number | null {
  const t = input.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}
