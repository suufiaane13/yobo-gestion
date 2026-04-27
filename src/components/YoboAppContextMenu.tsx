import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/shallow'
import { useYoboStore } from '../store'

type OpenState = {
  x: number
  y: number
  /** Texte sélectionné au moment du clic droit */
  selection: string
  /** Champ pouvant recevoir « Tout sélectionner » */
  canSelectAll: boolean
}

function isNativeContextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('[data-yobo-native-context]')) return true
  if (target.closest('input, textarea, select')) return true
  if (target.closest('[contenteditable="true"]')) return true
  return false
}

/**
 * Menu contextuel intégré à l’app (hors champs de saisie, qui gardent le menu système).
 */
export function YoboAppContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<OpenState | null>(null)

  const { theme, toggleTheme, pushToast } = useYoboStore(
    useShallow((s) => ({
      theme: s.theme,
      toggleTheme: s.toggleTheme,
      pushToast: s.pushToast,
    })),
  )

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (isNativeContextTarget(e.target)) return

      e.preventDefault()
      const ae = document.activeElement
      const canSelectAll =
        ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement
      const selection = window.getSelection()?.toString() ?? ''
      setOpen({
        x: e.clientX,
        y: e.clientY,
        selection,
        canSelectAll,
      })
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    return () => document.removeEventListener('contextmenu', onContextMenu, true)
  }, [])

  useEffect(() => {
    if (!open) return

    const close = () => setOpen(null)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      close()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', close, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return
    const el = menuRef.current
    const pad = 10
    const rect = el.getBoundingClientRect()
    let x = open.x
    let y = open.y
    if (x + rect.width > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - rect.width - pad)
    if (y + rect.height > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - rect.height - pad)
    if (x < pad) x = pad
    if (y < pad) y = pad
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }, [open])

  const close = () => setOpen(null)

  const copySelection = async () => {
    const text = open?.selection?.trim() ? open.selection : window.getSelection()?.toString() ?? ''
    if (!text.trim()) {
      pushToast('error', 'Rien à copier')
      close()
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      pushToast('success', 'Copié dans le presse-papiers')
    } catch {
      pushToast('error', 'Copie impossible (permissions navigateur)')
    }
    close()
  }

  const selectAllFocused = () => {
    const ae = document.activeElement
    if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) {
      ae.focus()
      ae.select()
      pushToast('success', 'Texte sélectionné')
    }
    close()
  }

  const reloadApp = () => {
    close()
    window.location.reload()
  }

  const onToggleTheme = () => {
    toggleTheme()
    close()
  }

  if (!open) return null

  const hasSelection = open.selection.trim().length > 0

  return createPortal(
    <div
      ref={menuRef}
      className="yobo-context-menu"
      role="menu"
      aria-label="Menu contextuel"
      style={{ position: 'fixed', left: open.x, top: open.y, zIndex: 500 }}
    >
      <button
        type="button"
        role="menuitem"
        className="yobo-context-menu__item"
        disabled={!hasSelection}
        onClick={() => void copySelection()}
      >
        Copier la sélection
      </button>
      <button
        type="button"
        role="menuitem"
        className="yobo-context-menu__item"
        disabled={!open.canSelectAll}
        onClick={selectAllFocused}
      >
        Tout sélectionner (champ actif)
      </button>
      <div className="yobo-context-menu__sep" role="separator" />
      <button type="button" role="menuitem" className="yobo-context-menu__item" onClick={onToggleTheme}>
        {theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
      </button>
      <button type="button" role="menuitem" className="yobo-context-menu__item" onClick={reloadApp}>
        Recharger l’interface
      </button>
      <p className="yobo-context-menu__hint">Maj + clic droit : menu du navigateur</p>
    </div>,
    document.body,
  )
}
