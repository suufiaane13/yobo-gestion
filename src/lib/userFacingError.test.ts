import { describe, expect, it, vi } from 'vitest'
import { logDevError, userFacingErrorMessage } from './userFacingError'

describe('userFacingErrorMessage', () => {
  const fallback = 'Message simple client.'

  it('en test / dev : message court non technique conservé', () => {
    const out = userFacingErrorMessage('Ouvre la caisse avant de valider.', fallback)
    if (import.meta.env.PROD) {
      expect(out).toBe(fallback)
    } else {
      expect(out).toBe('Ouvre la caisse avant de valider.')
    }
  })

  it('message technique → fallback (hors prod)', () => {
    expect(userFacingErrorMessage(new Error('SQLITE constraint failed'), fallback)).toBe(fallback)
    expect(userFacingErrorMessage('no such table: orders', fallback)).toBe(fallback)
  })

  it('Error avec message safe', () => {
    const out = userFacingErrorMessage(new Error('PIN vide.'), fallback)
    if (import.meta.env.PROD) {
      expect(out).toBe(fallback)
    } else {
      expect(out).toBe('PIN vide.')
    }
  })

  it('objet avec message', () => {
    const out = userFacingErrorMessage({ message: 'Rôle invalide.' }, fallback)
    if (import.meta.env.PROD) {
      expect(out).toBe(fallback)
    } else {
      expect(out).toBe('Rôle invalide.')
    }
  })
})

describe('logDevError', () => {
  it('en prod ne log pas', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logDevError('ctx', new Error('x'))
    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalled()
    } else {
      expect(spy).not.toHaveBeenCalled()
    }
    spy.mockRestore()
  })
})
