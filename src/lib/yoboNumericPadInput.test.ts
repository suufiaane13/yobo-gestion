import { describe, expect, it } from 'vitest'
import { applyPadKeyMadAmount, applyPadKeyPin } from './yoboNumericPadInput'

describe('applyPadKeyMadAmount', () => {
  it('append digits and comma FR', () => {
    expect(applyPadKeyMadAmount('', '1')).toBe('1')
    expect(applyPadKeyMadAmount('12', ',')).toBe('12,')
    expect(applyPadKeyMadAmount('12,', '5')).toBe('12,5')
    expect(applyPadKeyMadAmount('12,55', '0')).toBe('12,55')
  })
  it('back and clear', () => {
    expect(applyPadKeyMadAmount('12,3', 'back')).toBe('12,')
    expect(applyPadKeyMadAmount('12', 'clear')).toBe('')
  })
})

describe('applyPadKeyPin', () => {
  it('respects max length', () => {
    expect(applyPadKeyPin('123', '4', 4)).toBe('1234')
    expect(applyPadKeyPin('1234', '5', 4)).toBe('1234')
  })
})
