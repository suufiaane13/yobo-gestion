import { describe, expect, it } from 'vitest'
import { parseMadAmountRaw } from './parseMad'

describe('parseMadAmountRaw', () => {
  it('accepte point et virgule', () => {
    expect(parseMadAmountRaw('12.5')).toBe(12.5)
    expect(parseMadAmountRaw('12,5')).toBe(12.5)
  })

  it('ignore les espaces', () => {
    expect(parseMadAmountRaw(' 1 234,56 ')).toBe(1234.56)
  })

  it('rejette vide, négatif et non nombre', () => {
    expect(parseMadAmountRaw('')).toBeNull()
    expect(parseMadAmountRaw('   ')).toBeNull()
    expect(parseMadAmountRaw('-1')).toBeNull()
    expect(parseMadAmountRaw('abc')).toBeNull()
  })

  it('arrondit à 2 décimales', () => {
    expect(parseMadAmountRaw('10.999')).toBe(11)
    expect(parseMadAmountRaw('0.001')).toBe(0)
  })
})
