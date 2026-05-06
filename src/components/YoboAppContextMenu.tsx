import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/shallow'
import { useYoboStore } from '../store'

type OpenState = {
  x: number
  y: number
  /** Texte sélectionné au moment du clic droit */
  selection: string
  /** Champ pouvant recevoir « Tout sélectionner » (celui sous le clic, pas le focus au moment du clic menu) */
  selectAllField: HTMLInputElement | HTMLTextAreaElement | null
}

/** Sélection utile au menu : document ou plage dans input / textarea (clic droit sur champ). */
function getTextSelectionForContext(target: EventTarget | null): string {
  const docSel = window.getSelection()?.toString() ?? ''
  if (docSel.trim()) return docSel

  const field =
    target instanceof Element
      ? target.closest('input:not([type="hidden"]), textarea')
      : null
  const input =
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field
      : document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement
        ? document.activeElement
        : null
  if (!input) return ''
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  if (start === end) return ''
  return input.value.slice(Math.min(start, end), Math.max(start, end))
}

function eventTargetToElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target
  if (target instanceof Text) return target.parentElement
  return null
}

/** Types d’input où sélectionner tout le texte est pertinent. */
function asSelectableField(el: HTMLInputElement | HTMLTextAreaElement): HTMLInputElement | HTMLTextAreaElement | null {
  if (el.disabled) return null
  if (el instanceof HTMLTextAreaElement) return el
  const t = el.type
  if (
    t === 'button' ||
    t === 'checkbox' ||
    t === 'radio' ||
    t === 'file' ||
    t === 'submit' ||
    t === 'reset' ||
    t === 'image' ||
    t === 'range' ||
    t === 'color'
  )
    return null
  return el
}

/**
 * Champ sous le DOM (cible événement, label associé, ou pointeur).
 * Dans WebView, `e.target` peut ne pas être l’input — on complète avec elementFromPoint.
 */
function resolveFieldFromDomPoint(el: Element | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (!el) return null
  const direct = el.closest('input:not([type="hidden"]), textarea')
  if (direct instanceof HTMLTextAreaElement || direct instanceof HTMLInputElement) {
    return asSelectableField(direct)
  }
  const lab = el.closest('label')
  if (lab instanceof HTMLLabelElement && lab.control) {
    const c = lab.control
    if (c instanceof HTMLInputElement || c instanceof HTMLTextAreaElement) return asSelectableField(c)
  }
  return null
}

function getSelectAllField(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
): HTMLInputElement | HTMLTextAreaElement | null {
  const fromTarget = resolveFieldFromDomPoint(eventTargetToElement(target))
  if (fromTarget) return fromTarget

  const atPoint = document.elementFromPoint(clientX, clientY)
  const fromPoint = resolveFieldFromDomPoint(atPoint)
  if (fromPoint) return fromPoint

  const ae = document.activeElement
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return asSelectableField(ae)
  return null
}

/**
 * Zones où le menu système reste affiché.
 * Champs input / textarea / select : menu système seulement si le clavier tactile YOBO est activé ;
 * sinon même menu stylé YOBO que sur le reste de l’app.
 */
function isNativeContextTarget(target: EventTarget | null, virtualKeyboardEnabled: boolean): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('[data-yobo-native-context]')) return true
  if (target.closest('[contenteditable="true"]')) return true
  if (target.closest('input, textarea, select')) return virtualKeyboardEnabled
  return false
}

/**
 * Menu contextuel intégré à l’app (champs natifs uniquement lorsque le clavier YOBO est actif).
 */
export function YoboAppContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<OpenState | null>(null)

  const { theme, toggleTheme, pushToast, virtualKeyboardEnabled } = useYoboStore(
    useShallow((s) => ({
      theme: s.theme,
      toggleTheme: s.toggleTheme,
      pushToast: s.pushToast,
      virtualKeyboardEnabled: s.virtualKeyboardEnabled,
    })),
  )

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (isNativeContextTarget(e.target, virtualKeyboardEnabled)) return

      // Bloque systématiquement le menu par défaut (même avec Maj) hors zones natives
      e.preventDefault()
      const selectAllField = getSelectAllField(e.target, e.clientX, e.clientY)
      const selection = getTextSelectionForContext(e.target)
      setOpen({
        x: e.clientX,
        y: e.clientY,
        selection,
        selectAllField,
      })
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    return () => document.removeEventListener('contextmenu', onContextMenu, true)
  }, [virtualKeyboardEnabled])

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
    const field = open?.selectAllField
    if (field && document.body.contains(field)) {
      field.focus()
      field.select()
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
        disabled={!open.selectAllField}
        onClick={selectAllFocused}
      >
        Tout sélectionner
      </button>
      <div className="yobo-context-menu__sep" role="separator" />
      <button type="button" role="menuitem" className="yobo-context-menu__item" onClick={onToggleTheme}>
        {theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
      </button>
      <button type="button" role="menuitem" className="yobo-context-menu__item" onClick={reloadApp}>
        Recharger l’interface
      </button>
    </div>,
    document.body,
  )
}
