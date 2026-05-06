const KEY_PREFIX = 'yobo.profil.accueil.v1'

export function hasSeenProfilWelcome(userId: number): boolean {
  try {
    return localStorage.getItem(`${KEY_PREFIX}:${userId}`) === '1'
  } catch {
    return false
  }
}

export function markProfilWelcomeSeen(userId: number): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}:${userId}`, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

export const PROFIL_WELCOME_SESSION_PENDING = 'yobo-profil-welcome-pending'
