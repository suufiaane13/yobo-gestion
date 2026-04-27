import { useEffect, useMemo, useRef } from 'react'

type YoboModalProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Grand emoji affiché à côté du titre (ex. produit POS) */
  headerEmoji?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** Largeur max du panneau (Tailwind) */
  maxWidthClass?: string
  /** Style de modal : center (default) ou slide-over à droite (admin). */
  variant?: 'center' | 'slideOverRight'
}

/**
 * Modal alignée sur le design YOBO : bandeau accent, blur, ombres CSS variables.
 */
export function YoboModal({
  open,
  onClose,
  title,
  subtitle,
  headerEmoji,
  children,
  footer,
  maxWidthClass = 'max-w-sm',
  variant = 'center',
}: YoboModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)

  const getFocusable = useMemo(() => {
    return () => {
      const panel = panelRef.current
      if (!panel) return []
      const nodes = panel.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button',
          'input',
          'select',
          'textarea',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      )
      return Array.from(nodes).filter((el) => {
        const style = window.getComputedStyle(el)
        return style.visibility !== 'hidden' && style.display !== 'none' && !el.hasAttribute('disabled')
      })
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const focusables = getFocusable()
      if (focusables.length === 0) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!

      const active = document.activeElement as HTMLElement | null

      // Focus trap : boucle entre première et dernière cible.
      if (e.shiftKey) {
        if (!active || active === first || !panelRef.current?.contains(active)) {
          e.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, getFocusable])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    lastActiveElementRef.current = document.activeElement as HTMLElement | null

    // Pose un focus “propre” dès l’ouverture.
    const t = window.setTimeout(() => {
      const focusables = getFocusable()
      const preferred =
        panelRef.current?.querySelector<HTMLElement>('.yobo-modal-close') ??
        focusables[0] ??
        panelRef.current
      preferred?.focus?.()
    }, 0)
    return () => {
      window.clearTimeout(t)
      lastActiveElementRef.current?.focus?.()
    }
  }, [open, getFocusable])

  if (!open) return null

  const backdropClass =
    variant === 'slideOverRight'
      ? 'yobo-modal-backdrop justify-end'
      : 'yobo-modal-backdrop'

  const panelClass =
    variant === 'slideOverRight'
      ? `yobo-modal-panel yobo-modal-panel--slideover w-full h-full max-h-none ${maxWidthClass} flex flex-col`
      : `yobo-modal-panel w-full ${maxWidthClass}`

  return (
    <div
      className={backdropClass}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yobo-modal-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={panelClass}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="yobo-modal-accent-bar" aria-hidden />
        <div className={variant === 'slideOverRight' ? 'yobo-modal-inner yobo-modal-inner--slideover' : 'yobo-modal-inner'}>
          <div className={variant === 'slideOverRight' ? 'yobo-modal-header yobo-modal-header--slideover' : 'yobo-modal-header'}>
            {headerEmoji ? (
              <span className="yobo-modal-emoji" aria-hidden>
                {headerEmoji}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 id="yobo-modal-title" className="yobo-modal-title">
                {title}
              </h3>
              {subtitle ? <p className="yobo-modal-subtitle">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              className="yobo-modal-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
            </button>
          </div>
          <div className={variant === 'slideOverRight' ? 'yobo-modal-body yobo-modal-body--slideover' : 'yobo-modal-body'}>
            {children}
          </div>
          {footer ? (
            <div className={variant === 'slideOverRight' ? 'yobo-modal-footer yobo-modal-footer--slideover' : 'yobo-modal-footer'}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
