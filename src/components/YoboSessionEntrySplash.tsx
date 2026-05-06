import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SESSION_ENTRY_SPLASH_FADE_MS } from '../lib/sessionEntrySplash'
import { useYoboStore } from '../store'

const YOBO_BRAND_SRC = '/logo.png'

/**
 * Même écran que le splash initial (logo + points) après une connexion réussie.
 */
export function YoboSessionEntrySplash() {
  const open = useYoboStore((s) => s.sessionEntrySplashOpen)
  const [rendered, setRendered] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    if (open) {
      setRendered(true)
      setExiting(false)
    } else if (rendered) {
      setExiting(true)
      const t = window.setTimeout(() => {
        setRendered(false)
        setExiting(false)
        setLogoReady(false)
      }, SESSION_ENTRY_SPLASH_FADE_MS)
      return () => window.clearTimeout(t)
    }
  }, [open, rendered])

  if (!rendered) return null

  return createPortal(
    <div
      className={`login-page-splash ${exiting ? 'login-page-splash--out' : ''}`}
      style={{ transitionDuration: `${SESSION_ENTRY_SPLASH_FADE_MS}ms` }}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
    >
      <div className="login-page-splash-logo-slot">
        <img
          className="login-page-brand-img login-page-brand-img--splash"
          src={YOBO_BRAND_SRC}
          alt="YOBO"
          decoding="async"
          fetchPriority="high"
          onLoad={() => setLogoReady(true)}
          onError={() => setLogoReady(true)}
        />
      </div>
      {logoReady ? (
        <div className="login-page-splash-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
