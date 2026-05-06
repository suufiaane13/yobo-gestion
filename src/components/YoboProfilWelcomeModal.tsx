import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/shallow'
import type { ThemePreference } from '../types/yoboApp'
import {
  PROFIL_WELCOME_SESSION_PENDING,
  hasSeenProfilWelcome,
  markProfilWelcomeSeen,
} from '../lib/profilWelcomeStorage'
import { useYoboStore } from '../store'
import { YoboAvatarPicker } from './YoboAvatarPicker'

const THEME_PREF_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'manual', label: 'Manuel (clair / sombre)' },
  { value: 'auto_hour', label: 'Automatique (heure)' },
]

function YoboProfilWelcomeModal({ userId, onCompleted }: { userId: number; onCompleted: () => void }) {
  const { theme, themePreference, setThemePreference, toggleTheme, avatar, pushToast } = useYoboStore(
    useShallow((s) => ({
      theme: s.theme,
      themePreference: s.themePreference,
      setThemePreference: s.setThemePreference,
      toggleTheme: s.toggleTheme,
      avatar: s.avatar,
      pushToast: s.pushToast,
    })),
  )

  const canFinish = Boolean(String(avatar ?? '').trim())

  const handleFinish = () => {
    if (!canFinish) {
      pushToast('warning', 'Choisis un avatar pour continuer.')
      return
    }
    markProfilWelcomeSeen(userId)
    try {
      sessionStorage.removeItem(PROFIL_WELCOME_SESSION_PENDING)
    } catch {
      /* ignore */
    }
    onCompleted()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      className="yobo-modal-backdrop !z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yobo-profil-welcome-title"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="yobo-modal-panel !max-h-[min(92vh,760px)] w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="yobo-modal-accent-bar" aria-hidden />
        <div className="yobo-modal-inner">
          <div className="yobo-modal-header">
            <span className="yobo-modal-emoji" aria-hidden>
              👋
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="yobo-profil-welcome-title" className="yobo-modal-title">
                Bienvenue dans YOBO
              </h3>
              <p className="yobo-modal-subtitle">
                Choisis ton avatar et comment tu préfères le thème clair ou sombre.
              </p>
            </div>
          </div>

          <div className="yobo-modal-body max-h-[min(72vh,560px)] overflow-y-auto">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Ton avatar</p>
                <YoboAvatarPicker immediatePersist />
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Affichage</label>
                <select
                  className="yobo-input mt-2 w-full font-bold"
                  value={themePreference}
                  onChange={(e) => setThemePreference(e.target.value as ThemePreference)}
                >
                  {THEME_PREF_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {themePreference === 'manual' ? (
                  <button
                    type="button"
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-xs font-black text-[var(--text-h)] transition hover:border-[var(--accent)]/50"
                    onClick={() => toggleTheme()}
                  >
                    <span className="material-symbols-outlined text-[20px]">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                    {theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="yobo-modal-footer border-t border-[var(--border)]">
            <button
              type="button"
              disabled={!canFinish}
              onClick={handleFinish}
              className="yobo-modal-btn yobo-modal-btn--primary w-full justify-center py-3 text-sm shadow-lg shadow-[var(--accent)]/15 disabled:opacity-45"
            >
              <span className="material-symbols-outlined text-[22px]">rocket_launch</span>
              C&apos;est parti !
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Modale d’accueil : avatar manquant (obligatoire) ou première validation après connexion (thème + rappel). */
export function YoboProfilWelcomeGate() {
  const authed = useYoboStore((s) => s.authed)
  const userId = useYoboStore((s) => s.userId)
  const avatar = useYoboStore((s) => s.avatar)
  const [dismissed, setDismissed] = useState(false)

  const shouldShow = useMemo(() => {
    if (dismissed || !authed || userId == null) return false
    const noAvatar = !String(avatar ?? '').trim()
    let pending = false
    try {
      pending = sessionStorage.getItem(PROFIL_WELCOME_SESSION_PENDING) === '1'
    } catch {
      /* ignore */
    }
    const seen = hasSeenProfilWelcome(userId)
    return noAvatar || (pending && !seen)
  }, [authed, userId, avatar, dismissed])

  if (!shouldShow || userId == null) return null

  return (
    <YoboProfilWelcomeModal
      userId={userId}
      onCompleted={() => {
        setDismissed(true)
      }}
    />
  )
}
