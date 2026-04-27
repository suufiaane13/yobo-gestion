import { describe, expect, it } from 'vitest'
import {
  isValidYoboMultiSizeProgress,
  normalizeStdSizeLabel,
  validateYoboMultiSizeLabelsFinal,
} from './yoboSizeTemplates'

describe('normalizeStdSizeLabel', () => {
  it('accepte S M L XL', () => {
    expect(normalizeStdSizeLabel('s')).toBe('S')
    expect(normalizeStdSizeLabel('xl')).toBe('XL')
  })

  it('rejette inconnu', () => {
    expect(normalizeStdSizeLabel('XXL')).toBeNull()
    expect(normalizeStdSizeLabel('')).toBeNull()
  })
})

describe('isValidYoboMultiSizeProgress', () => {
  it('progressions valides', () => {
    expect(isValidYoboMultiSizeProgress(new Set(['S']))).toBe(true)
    expect(isValidYoboMultiSizeProgress(new Set(['S', 'L']))).toBe(true)
    expect(isValidYoboMultiSizeProgress(new Set(['S', 'M', 'L', 'XL']))).toBe(true)
  })

  it('combinaison interdite en cours', () => {
    expect(isValidYoboMultiSizeProgress(new Set(['M']))).toBe(false)
  })
})

describe('validateYoboMultiSizeLabelsFinal', () => {
  it('combinaisons finales OK', () => {
    expect(validateYoboMultiSizeLabelsFinal(['S', 'L'])).toBeNull()
    expect(validateYoboMultiSizeLabelsFinal(['S', 'M', 'L'])).toBeNull()
    expect(validateYoboMultiSizeLabelsFinal(['S', 'M', 'L', 'XL'])).toBeNull()
  })

  it('doublon', () => {
    const err = validateYoboMultiSizeLabelsFinal(['S', 'S'])
    expect(err).not.toBeNull()
  })

  it('incomplet', () => {
    const err = validateYoboMultiSizeLabelsFinal(['S'])
    expect(err).not.toBeNull()
  })
})
