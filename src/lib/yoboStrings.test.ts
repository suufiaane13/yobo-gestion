import { describe, expect, it } from 'vitest'
import { capitalizeFirstLetter, firstLetterUpper, isNonEmpty } from './yoboStrings'

describe('isNonEmpty', () => {
  it('trim', () => {
    expect(isNonEmpty('a')).toBe(true)
    expect(isNonEmpty('  x  ')).toBe(true)
    expect(isNonEmpty('')).toBe(false)
    expect(isNonEmpty('   ')).toBe(false)
  })
})

describe('capitalizeFirstLetter', () => {
  it('première lettre seulement', () => {
    expect(capitalizeFirstLetter('soufiane')).toBe('Soufiane')
    expect(capitalizeFirstLetter('  ali')).toBe('Ali')
  })

  it('chaîne vide', () => {
    expect(capitalizeFirstLetter('')).toBe('')
    expect(capitalizeFirstLetter('   ')).toBe('')
  })
})

describe('firstLetterUpper', () => {
  it('une lettre majuscule', () => {
    expect(firstLetterUpper('yo')).toBe('Y')
    expect(firstLetterUpper('  z')).toBe('Z')
  })

  it('vide', () => {
    expect(firstLetterUpper('')).toBe('')
  })
})
