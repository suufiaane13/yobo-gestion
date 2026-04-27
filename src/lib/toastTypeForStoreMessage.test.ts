import { describe, expect, it } from 'vitest'
import { toastTypeForStoreMessage } from './toastTypeForStoreMessage'

describe('toastTypeForStoreMessage', () => {
  it('validations → warning', () => {
    expect(toastTypeForStoreMessage('Indique ton nom.')).toBe('warning')
    expect(toastTypeForStoreMessage('Choisis une taille : S.')).toBe('warning')
    expect(toastTypeForStoreMessage('Ouvre d’abord ta caisse.')).toBe('warning')
    expect(toastTypeForStoreMessage('Le code PIN doit avoir entre 4 et 6 chiffres.')).toBe('warning')
  })

  it('échecs → error', () => {
    expect(toastTypeForStoreMessage('Les commandes ne s’affichent pas.')).toBe('error')
    expect(toastTypeForStoreMessage('Connexion refusée.')).toBe('error')
  })
})
