import { createPortal } from 'react-dom'
import { YoboAlphaInput } from './YoboKeyboardInputs'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  YOBO_EMOJI_GROUPS,
  type YoboEmojiGroup,
  type YoboEmojiItem,
  isCatalogEmoji,
} from '../data/yoboEmojis'

type EmojiPickerProps = {
  value: string
  onChange: (emoji: string) => void
  /** Libellé accessibilité / UI */
  label: string
  id?: string
  className?: string
  /** Ouvrir le panneau aligné à droite du bouton (ex. colonnes étroites) */
  alignPanel?: 'start' | 'end'
  /** Masque le libellé visible (utiliser un label externe dans une grille) */
  hideLabel?: boolean
  /** Même hauteur que `.yobo-input` (2.5rem) */
  formRow?: boolean
  /** Masque « Choisir » : emoji centré + chevron (comme colonne Emoji catégories) */
  symbolOnly?: boolean
}

function stripDiacritics(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function matchesQuery(item: YoboEmojiItem, rawQuery: string): boolean {
  const q = rawQuery.trim()
  if (!q) return true
  const tokens = stripDiacritics(q)
    .split(/\s+/)
    .filter(Boolean)
  const hay = stripDiacritics([item.char, ...item.tags].join(' '))
  return tokens.every((t) => hay.includes(t))
}

function filterGroups(query: string): YoboEmojiGroup[] {
  if (!query.trim()) return YOBO_EMOJI_GROUPS
  return YOBO_EMOJI_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => matchesQuery(i, query)),
  })).filter((g) => g.items.length > 0)
}

const PANEL_MAX_W = 352
const PANEL_MARGIN = 12
/** Aligné sur le CSS : min(70vh, 22rem) — utilisé avant mesure du panneau */
const PANEL_DEFAULT_MAX_H_PX = () => Math.min(window.innerHeight * 0.7, 22 * 16)
const PANEL_GAP = 6
const PANEL_MIN_VISIBLE_H = 180

export function EmojiPicker({
  value,
  onChange,
  label,
  id,
  className,
  alignPanel = 'start',
  hideLabel = false,
  formRow = false,
  symbolOnly = false,
}: EmojiPickerProps) {
  const autoId = useId()
  const btnId = id ?? `emoji-picker-${autoId}`
  const panelId = `${btnId}-panel`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)
  const [panelBox, setPanelBox] = useState<{
    top: number
    left: number
    width: number
    maxHeight?: number
  }>({ top: 0, left: 0, width: PANEL_MAX_W })

  const filtered = useMemo(() => filterGroups(query), [query])
  const displayChar = value.trim() || '…'
  const isCustom = Boolean(value.trim()) && !isCatalogEmoji(value.trim())

  const updatePanelPosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = PANEL_MARGIN

    const maxW = Math.min(PANEL_MAX_W, vw - margin * 2)
    let left = alignPanel === 'end' ? r.right - maxW : r.left
    left = Math.max(margin, Math.min(left, vw - maxW - margin))

    const panel = panelRef.current
    const defaultCap = PANEL_DEFAULT_MAX_H_PX()
    const measuredH = panel?.getBoundingClientRect().height ?? 0
    const panelH = measuredH > 40 ? measuredH : defaultCap

    const spaceBelow = vh - r.bottom - margin - PANEL_GAP
    const spaceAbove = r.top - margin - PANEL_GAP

    let top: number
    let maxHeight: number | undefined

    if (panelH <= spaceBelow) {
      top = r.bottom + PANEL_GAP
      maxHeight = undefined
    } else if (panelH <= spaceAbove) {
      top = r.top - panelH - PANEL_GAP
      maxHeight = undefined
    } else if (spaceBelow >= spaceAbove) {
      top = r.bottom + PANEL_GAP
      maxHeight = Math.max(PANEL_MIN_VISIBLE_H, spaceBelow)
    } else {
      const h = Math.max(PANEL_MIN_VISIBLE_H, spaceAbove)
      top = r.top - h - PANEL_GAP
      maxHeight = h
      if (top < margin) {
        top = margin
        maxHeight = Math.max(PANEL_MIN_VISIBLE_H, vh - margin * 2)
      }
    }

    setPanelBox({ top, left, width: maxW, maxHeight })
  }, [alignPanel])

  useLayoutEffect(() => {
    if (!open) return
    // Mesure synchrone avant le premier paint : sinon le panneau apparaît un instant en (0,0).
    updatePanelPosition()
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      updatePanelPosition()
      raf2 = requestAnimationFrame(() => updatePanelPosition())
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [open, updatePanelPosition, query, filtered.length])

  useEffect(() => {
    if (!open) return
    const onWin = () => updatePanelPosition()
    window.addEventListener('scroll', onWin, true)
    window.addEventListener('resize', onWin)
    return () => {
      window.removeEventListener('scroll', onWin, true)
      window.removeEventListener('resize', onWin)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) {
      const clearSearch = window.setTimeout(() => setQuery(''), 0)
      return () => window.clearTimeout(clearSearch)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    lastActiveElementRef.current = document.activeElement as HTMLElement | null
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node
      if (rootRef.current?.contains(node)) return
      if (panelRef.current?.contains(node)) return
      
      // On ne ferme pas si le clic vient du clavier virtuel
      if (node instanceof Element) {
        if (node.closest('.yobo-vk-overlay') || node.closest('.yobo-vk-shell')) {
          return
        }
      }

      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          [
            'a[href]',
            'button',
            'input',
            'select',
            'textarea',
            '[tabindex]:not([tabindex="-1"])',
          ].join(','),
        ),
      ).filter((el) => {
        const style = window.getComputedStyle(el)
        return style.visibility !== 'hidden' && style.display !== 'none' && !el.hasAttribute('disabled')
      })

      if (focusables.length === 0) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (!active || active === first || !panel.contains(active)) {
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
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) return
    // Restore focus vers ce qui avait le focus avant l'ouverture.
    lastActiveElementRef.current?.focus?.()
  }, [open])

  function pick(char: string) {
    onChange(char)
    setOpen(false)
  }

  const rootClass = [
    'yobo-emoji-picker-root',
    formRow ? 'yobo-emoji-picker-root--form' : '',
    symbolOnly ? 'yobo-emoji-picker-root--symbol' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={rootClass}>
      {hideLabel ? (
        <span className="sr-only" id={`${btnId}-label`}>
          {label}
        </span>
      ) : (
        <span className="yobo-modal-label" id={`${btnId}-label`}>
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        id={btnId}
        className="yobo-emoji-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${btnId}-label`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="yobo-emoji-picker-trigger-char" aria-hidden>
          {displayChar}
        </span>
        {!symbolOnly ? <span className="yobo-emoji-picker-trigger-hint">Choisir</span> : null}
        <span className="yobo-emoji-picker-trigger-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              className="yobo-emoji-picker-panel yobo-emoji-picker-panel--portal"
              style={{
                position: 'fixed',
                top: panelBox.top,
                left: panelBox.left,
                width: panelBox.width,
                zIndex: 80,
                ...(panelBox.maxHeight != null ? { maxHeight: `${panelBox.maxHeight}px` } : {}),
              }}
              role="dialog"
              aria-label={label}
            >
              <div className="yobo-emoji-picker-search-wrap">
                <YoboAlphaInput
                  ref={searchRef}
                  className="yobo-emoji-picker-search"
                  placeholder="Rechercher (pizza, café, boisson…)"
                  value={query}
                  onValueChange={setQuery}
                  aria-label="Filtrer les emojis"
                  autoComplete="off"
                  name="yobo-no-save-emoji-search"
                  keyboardMaxLength={48}
                />
              </div>
              {isCustom ? (
                <p className="yobo-emoji-picker-notice">
                  Emoji actuel hors catalogue YOBO — sélectionne un pictogramme ci-dessous pour l’aligner sur la charte.
                </p>
              ) : null}
              <div className="yobo-emoji-picker-scroll">
                {filtered.length === 0 ? (
                  <p className="yobo-emoji-picker-empty mx-auto w-full max-w-md text-center text-pretty">
                    Aucun résultat. Essaie un autre mot-clé.
                  </p>
                ) : (
                  filtered.map((group) => (
                    <section key={group.id} className="yobo-emoji-picker-group">
                      <h4 className="yobo-emoji-picker-group-title">{group.label}</h4>
                      <div className="yobo-emoji-picker-grid">
                        {group.items.map((item) => {
                          const selected = item.char === value.trim()
                          return (
                            <button
                              key={`${group.id}-${item.char}-${item.tags[0] ?? ''}`}
                              type="button"
                              className={`yobo-emoji-picker-cell ${selected ? 'yobo-emoji-picker-cell--selected' : ''}`}
                              title={item.tags.join(', ')}
                              onClick={() => pick(item.char)}
                            >
                              <span className="yobo-emoji-picker-cell-char">{item.char}</span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
              <p className="yobo-emoji-picker-foot">
                Catalogue centralisé — ajoute des entrées dans <code>src/data/yoboEmojis.ts</code>
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
