import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { YoboUpdater } from './YoboUpdater'
import { YoboAvatarDisplay } from './YoboAvatarPicker'

type YoboTitleBarProps = {
  /** Ex. « Gérant : Marie » / « Caissier : Ali » */
  badgeText: string
  badgeKind: 'gerant' | 'caissier'
  avatar: string | null
  theme: 'light' | 'dark'
  /** Faux si le thème est piloté automatiquement (ex. heure) : le bouton reste visible mais inactif. */
  themeToggleEnabled?: boolean
  authed: boolean
  onToggleTheme: () => void
  onLogout: () => void
  onCloseRequest: () => void
}

/** Grille 24×24, trait 2, bouts ronds — aligné sur les icônes de navigation YOBO. */
function TitlebarGlyph({ children }: { children: React.ReactNode }) {
  return (
    <svg className="yobo-titlebar__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

function IconThemeSun() {
  return (
    <TitlebarGlyph>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </TitlebarGlyph>
  )
}

function IconThemeMoon() {
  return (
    <TitlebarGlyph>
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </TitlebarGlyph>
  )
}

function IconLogOut() {
  return (
    <TitlebarGlyph>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17l5-5-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </TitlebarGlyph>
  )
}

function IconWinMinimize() {
  return (
    <TitlebarGlyph>
      <path d="M5 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </TitlebarGlyph>
  )
}

function IconFullscreenEnter() {
  return (
    <TitlebarGlyph>
      <path
        d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </TitlebarGlyph>
  )
}

function IconFullscreenExit() {
  return (
    <TitlebarGlyph>
      {/* Flèche coin haut-gauche → vers le centre */}
      <path
        d="M9 9L5 5M9 9H5M9 9V5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Flèche coin haut-droit → vers le centre */}
      <path
        d="M15 9l4-4M15 9h4M15 9V5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Flèche coin bas-gauche → vers le centre */}
      <path
        d="M9 15l-4 4M9 15H5m4 0v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Flèche coin bas-droit → vers le centre */}
      <path
        d="M15 15l4 4M15 15h4m-4 0v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </TitlebarGlyph>
  )
}

function IconClose() {
  return (
    <TitlebarGlyph>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </TitlebarGlyph>
  )
}

/**
 * Barre de titre personnalisée (Tauri, decorations: false).
 * Boutons à droite : [badge] | thème · déconnexion | fenêtre · plein écran | fermer
 */
function formatTitleBarClockParts(d: Date): { hm: string; sec: string; dateLine: string } {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
  
  const formatter = new Intl.DateTimeFormat('fr-FR', options)
  const parts = formatter.formatToParts(d)
  
  const h = parts.find(p => p.type === 'hour')?.value || '00'
  const m = parts.find(p => p.type === 'minute')?.value || '00'
  const s = parts.find(p => p.type === 'second')?.value || '00'
  
  // Construction du libellé date (ex: lun. 12 janv. 2026)
  const weekday = parts.find(p => p.type === 'weekday')?.value || ''
  const day = parts.find(p => p.type === 'day')?.value || ''
  const month = parts.find(p => p.type === 'month')?.value || ''
  const year = parts.find(p => p.type === 'year')?.value || ''
  
  const dateLine = `${weekday} ${day} ${month} ${year}`.replace(/\s+/g, ' ').trim()
  
  return { hm: `${h}:${m}`, sec: s, dateLine }
}

export function YoboTitleBar({
  badgeText,
  badgeKind,
  avatar,
  theme,
  themeToggleEnabled = true,
  authed,
  onToggleTheme,
  onLogout,
  onCloseRequest,
}: YoboTitleBarProps) {
  const appWindow = getCurrentWindow()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [showUpdater, setShowUpdater] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const clock = formatTitleBarClockParts(now)

  useEffect(() => {
    if (!authed) return
    let alive = true
    const tick = async () => {
      try {
        const fs = await appWindow.isFullscreen()
        if (!alive) return
        setIsFullscreen(Boolean(fs))
      } catch {
        // ignore
      }
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 700)

    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [appWindow, authed])

  const titlebarFullscreen = authed && isFullscreen

  return (
    <header
      className={`yobo-titlebar${titlebarFullscreen ? ' yobo-titlebar--fullscreen' : ''}`}
      role="banner"
    >
      <div
        className={`yobo-titlebar__drag ${isFullscreen ? 'yobo-titlebar__drag--disabled' : ''}`}
        {...(!isFullscreen ? { 'data-tauri-drag-region-titlebar': '' } : {})}
      >
        <div className="yobo-titlebar__brand">
          <span className="yobo-titlebar__logo">
            <span className="yobo-titlebar__logo-accent">YO</span>BO
          </span>
        </div>
        <div className="yobo-titlebar__titles">
          <div
            className="yobo-titlebar__clock"
            aria-label={`Heure locale : ${clock.hm}:${clock.sec}, ${clock.dateLine}`}
          >
            <span className="yobo-titlebar__clock-time">
              {clock.hm}
              <span aria-hidden>:</span>
              <span className="yobo-titlebar__clock-sec">{clock.sec}</span>
            </span>
            <span className="yobo-titlebar__clock-date">{clock.dateLine}</span>
          </div>
        </div>
      </div>

      <div className="yobo-titlebar__actions">
        {authed ? (
          <>
            <div
              className={`yobo-titlebar__user-badge ${
                badgeKind === 'gerant'
                  ? 'yobo-titlebar__user-badge--gerant'
                  : 'yobo-titlebar__user-badge--caissier'
              }`}
               title={`${badgeKind === 'gerant' ? 'Gérant' : 'Caissier'} : ${badgeText}`}
            >
              {avatar ? (
                <YoboAvatarDisplay id={avatar} size="xs" className="yobo-titlebar__user-icon !bg-transparent !shadow-none" />
              ) : (
                <span className="material-symbols-outlined yobo-titlebar__user-icon">
                  {badgeKind === 'gerant' ? 'shield_person' : 'person'}
                </span>
              )}
              <span className="yobo-titlebar__user-name">
                {badgeText}
              </span>
            </div>
            <span className="yobo-titlebar__action-sep" aria-hidden />
            <div className="yobo-titlebar__actions-cluster">
              <button
                type="button"
                className={`yobo-titlebar__btn${!themeToggleEnabled ? ' yobo-titlebar__btn--disabled' : ''}`}
                disabled={!themeToggleEnabled}
                aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                title={
                  themeToggleEnabled
                    ? theme === 'dark'
                      ? 'Mode clair'
                      : 'Mode sombre'
                    : 'Thème automatique (réglage dans Profil)'
                }
                onClick={() => {
                  if (!themeToggleEnabled) return
                  onToggleTheme()
                }}
              >
                {theme === 'dark' ? <IconThemeSun /> : <IconThemeMoon />}
              </button>

              <span className="yobo-titlebar__action-sep" aria-hidden />
              
              <div className="yobo-titlebar__updater-wrapper">
                <button
                  type="button"
                  className={`yobo-titlebar__btn ${showUpdater ? 'yobo-titlebar__btn--active' : ''}`}
                  title="Mise à jour"
                  onClick={() => setShowUpdater(!showUpdater)}
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_download</span>
                </button>
                
                {showUpdater && (
                  <div className="yobo-titlebar__updater-dropdown">
                    <YoboUpdater />
                  </div>
                )}
              </div>

              <span className="yobo-titlebar__action-sep" aria-hidden />
              <button
                type="button"
                className="yobo-titlebar__btn"
                aria-label="Déconnexion"
                title="Déconnexion"
                onClick={() => onLogout()}
              >
                <IconLogOut />
              </button>
            </div>
            <span className="yobo-titlebar__action-sep" aria-hidden />
            <div className="yobo-titlebar__actions-cluster">
              <button
                type="button"
                className="yobo-titlebar__btn"
                aria-label="Réduire la fenêtre"
                title="Réduire"
                onClick={() => void appWindow.minimize()}
              >
                <IconWinMinimize />
              </button>
              <span className="yobo-titlebar__action-sep" aria-hidden />
              <button
                type="button"
                className="yobo-titlebar__btn"
                aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                onClick={() => {
                  void (async () => {
                    const fs = await appWindow.isFullscreen()
                    await appWindow.setFullscreen(!fs)
                  })()
                }}
              >
                {isFullscreen ? <IconFullscreenExit /> : <IconFullscreenEnter />}
              </button>
            </div>
            <span className="yobo-titlebar__action-sep" aria-hidden />
          </>
        ) : null}
        <button
          type="button"
          className="yobo-titlebar__btn yobo-titlebar__btn--close"
          aria-label="Fermer la fenêtre"
          title="Fermer"
          onClick={() => onCloseRequest()}
        >
          <IconClose />
        </button>
      </div>
    </header>
  )
}
