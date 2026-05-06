import { describe, expect, it } from 'vitest'
import {
  compareSizeLabelsFr,
  sizeLabelDedupKey,
  trimSizeLabel,
  validateYoboMultiSizeLabels,
} from './yoboSizeTemplates'

describe('trimSizeLabel', () => {
  it('trim et rejette vide', () => {
    expect(trimSizeLabel('  M  ')).toBe('M')
    expect(trimSizeLabel('')).toBeNull()
    expect(trimSizeLabel('   ')).toBeNull()
  })

  it('accepte tout texte non vide', () => {
    expect(trimSizeLabel('XXL')).toBe('XXL')
    expect(trimSizeLabel('Grand')).toBe('Grand')
    expect(trimSizeLabel('🔥')).toBe('🔥')
  })
})

describe('sizeLabelDedupKey', () => {
  it('insensible à la casse', () => {
    expect(sizeLabelDedupKey('M')).toBe(sizeLabelDedupKey('m'))
  })
})

describe('compareSizeLabelsFr', () => {
  it('ordonne P S avant M avant G L avant TG XL', () => {
    expect(compareSizeLabelsFr('P', 'M')).toBeLessThan(0)
    expect(compareSizeLabelsFr('M', 'G')).toBeLessThan(0)
    expect(compareSizeLabelsFr('L', 'TG')).toBeLessThan(0)
  })

  it('libellés arbitraires en dernier, puis locale fr', () => {
    expect(compareSizeLabelsFr('M', 'Zoo')).toBeLessThan(0)
    expect(compareSizeLabelsFr('Abc', 'Abd')).toBeLessThan(0)
  })
})

describe('validateYoboMultiSizeLabels', () => {
  it('accepte combinaisons libres sans doublon', () => {
    expect(validateYoboMultiSizeLabels(['L', 'XL'])).toBeNull()
    expect(validateYoboMultiSizeLabels(['Mini', 'Maxi'])).toBeNull()
    expect(validateYoboMultiSizeLabels(['S'])).toBeNull()
  })

  it('doublon (casse)', () => {
    expect(validateYoboMultiSizeLabels(['m', 'M'])).not.toBeNull()
  })

  it('libellé vide', () => {
    expect(validateYoboMultiSizeLabels([''])).not.toBeNull()
    expect(validateYoboMultiSizeLabels(['  '])).not.toBeNull()
  })
})
