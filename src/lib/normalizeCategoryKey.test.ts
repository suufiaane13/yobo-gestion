import { describe, expect, it } from 'vitest'
import { normalizeCategoryKey } from './normalizeCategoryKey'

describe('normalizeCategoryKey', () => {
  it('mots-clés connus', () => {
    expect(normalizeCategoryKey('Pizzas')).toBe('pizza')
    expect(normalizeCategoryKey('nos Burgers')).toBe('burger')
    expect(normalizeCategoryKey('Panini chaud')).toBe('panini')
    expect(normalizeCategoryKey('Crêpes')).toBe('crepe')
    expect(normalizeCategoryKey('Boissons')).toBe('boisson')
    expect(normalizeCategoryKey('Desserts')).toBe('dessert')
  })

  it('sinon slug underscore', () => {
    expect(normalizeCategoryKey('  Salades  ')).toBe('salades')
    expect(normalizeCategoryKey('Plat du jour')).toBe('plat_du_jour')
  })
})
