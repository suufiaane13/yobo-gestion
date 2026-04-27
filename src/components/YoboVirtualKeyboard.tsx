import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import type { YoboPadKey } from '../lib/yoboNumericPadInput'
import { applyPadKeyMadAmount, applyPadKeyPin } from '../lib/yoboNumericPadInput'
import { getCurrentWindow } from '@tauri-apps/api/window'

type Layout = 'alpha' | 'sym' | 'numpad'
type KeyType =
  | 'del'
  | 'shift'
  | 'caps'
  | 'tab'
  | 'space'
  | 'clear'
  | 'switchSym'
  | 'switchAlpha'

type KeyDef = {
  l?: string
  s?: string
  k?: string
  t?: KeyType
  w?: 'w44' | 'w52' | 'w60' | 'w72' | 'w90'
}

const WIDTH_MAP: Record<NonNullable<KeyDef['w']>, string> = {
  w44: '4.2rem',
  w52: '5rem',
  w60: '5.8rem',
  w72: '7rem',
  w90: '8.8rem',
}

/** Disposition AZERTY (France) : rangées A Z E R T Y… / Q S D F G… / W X C V B N… */
const ALPHA_LAYOUT: KeyDef[][] = [
  [{ l: '1' }, { l: '2' }, { l: '3' }, { l: '4' }, { l: '5' }, { l: '6' }, { l: '7' }, { l: '8' }, { l: '9' }, { l: '0' }],
  [{ k: 'Tab', t: 'tab', w: 'w44' }, { l: 'a' }, { l: 'z' }, { l: 'e' }, { l: 'r' }, { l: 't' }, { l: 'y' }, { l: 'u' }, { l: 'i' }, { l: 'o' }, { l: 'p' }],
  [{ k: 'Verr', t: 'caps', w: 'w52' }, { l: 'q' }, { l: 's' }, { l: 'd' }, { l: 'f' }, { l: 'g' }, { l: 'h' }, { l: 'j' }, { l: 'k' }, { l: 'l' }, { l: 'm' }, { k: '⌫', t: 'del', w: 'w52' }],
  [{ k: '⇧', t: 'shift', w: 'w60' }, { l: 'w' }, { l: 'x' }, { l: 'c' }, { l: 'v' }, { l: 'b' }, { l: 'n' }, { l: ',', s: '?' }, { l: '.', s: ':' }],
  [{ k: '&@#', t: 'switchSym', w: 'w52' }, { k: 'Espace', t: 'space', w: 'w90' }, { k: '✕ Vider', t: 'clear', w: 'w60' }],
]

const SYM_LAYOUT: KeyDef[][] = [
  [{ l: '!' }, { l: '@' }, { l: '#' }, { l: '$' }, { l: '%' }, { l: '^' }, { l: '&' }, { l: '*' }, { l: '(' }, { l: ')' }, { l: '+' }, { l: '=' }],
  [{ l: '-' }, { l: '_' }, { l: '/' }, { l: '\\' }, { l: '|' }, { l: ':' }, { l: ';' }, { l: '"' }, { l: "'" }, { l: '?' }, { l: '.' }, { l: ',' }],
  [{ l: '[' }, { l: ']' }, { l: '{' }, { l: '}' }, { l: '<' }, { l: '>' }, { l: '€' }, { l: '£' }, { l: '¥' }, { k: '⌫', t: 'del', w: 'w52' }],
  [{ k: 'AZERTY', t: 'switchAlpha', w: 'w60' }, { k: 'Espace', t: 'space', w: 'w90' }],
]

const NUMPAD_PIN_LAYOUT: KeyDef[][] = [
  [{ l: '1' }, { l: '2' }, { l: '3' }],
  [{ l: '4' }, { l: '5' }, { l: '6' }],
  [{ l: '7' }, { l: '8' }, { l: '9' }],
  [{ k: 'C', t: 'clear' }, { l: '0' }, { k: '⌫', t: 'del' }],
]

const NUMPAD_DECIMAL_LAYOUT: KeyDef[][] = [
  [{ l: '1' }, { l: '2' }, { l: '3' }],
  [{ l: '4' }, { l: '5' }, { l: '6' }],
  [{ l: '7' }, { l: '8' }, { l: '9' }],
  [{ k: 'C', t: 'clear' }, { l: '0' }, { k: '⌫', t: 'del' }],
  [{ l: ',' }],
]

type AlphaBinding = {
  kind: 'alpha'
  id: number
  /** Identifiant stable du champ (useId) pour resynchroniser l’aperçu si la valeur change hors clavier. */
  fieldId: string
  getValue: () => string
  setValue: (v: string) => void
  maxLength: number
}

type PinBinding = {
  kind: 'pin'
  id: number
  fieldId: string
  getValue: () => string
  setValue: (v: string) => void
  maxLen: number
  mask: boolean
}

type DecimalBinding = {
  kind: 'decimal'
  id: number
  fieldId: string
  getValue: () => string
  setValue: (v: string) => void
}

type ActiveBinding = AlphaBinding | PinBinding | DecimalBinding

type Ctx = {
  open: (b: Omit<AlphaBinding, 'id'> | Omit<PinBinding, 'id'> | Omit<DecimalBinding, 'id'>) => void
  close: () => void
  /** Si ce champ est celui du clavier ouvert, met l’aperçu à jour (collage, etc.). */
  notifyFieldValue: (fieldId: string, value: string) => void
}

const YoboVirtualKeyboardContext = createContext<Ctx | null>(null)

function mapNumericKeyToPadKey(key: string): YoboPadKey | null {
  if (key === '⌫') return 'back'
  if (key === 'C') return 'clear'
  if (key === ',') return ','
  if (/^[0-9]$/.test(key)) return key as YoboPadKey
  return null
}

function KeyButton({
  def,
  shift,
  caps,
  layout,
  onPress,
}: {
  def: KeyDef
  shift: boolean
  caps: boolean
  layout: Layout
  onPress: (def: KeyDef) => void
}) {
  const [pressed, setPressed] = useState(false)
  const isAlpha = layout === 'alpha'
  const useShift = isAlpha && (shift || caps)

  let label: React.ReactNode = def.k ?? def.l ?? ''
  if (def.l && isAlpha) {
    label = useShift ? def.s ?? def.l.toUpperCase() : def.l
  }

  const isDanger = def.t === 'del'
  const isModifier = ['shift', 'caps', 'tab', 'switchSym', 'switchAlpha', 'clear'].includes(def.t ?? '')
  const isModifierActive = (def.t === 'shift' && shift) || (def.t === 'caps' && caps)

  const style: React.CSSProperties = {
    minHeight: '3.2rem',
    minWidth: def.t === 'space' ? undefined : def.w ? WIDTH_MAP[def.w] : '2.65rem',
    flex: def.t === 'space' ? '1 1 7rem' : !def.w ? '1 1 2.65rem' : undefined,
    borderRadius: '0.56rem',
    border: '1px solid var(--vk-key-border)',
    background: 'var(--vk-key-bg)',
    color: 'var(--vk-key-text)',
    fontSize: '0.88rem',
    fontWeight: 700,
    padding: '0 0.55rem',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    transform: pressed ? 'translateY(1px)' : undefined,
  }

  if (isModifier) {
    style.background = isModifierActive ? 'var(--accent-bg)' : 'var(--vk-key-mod-bg)'
    style.color = isModifierActive ? 'var(--accent)' : 'var(--vk-key-mod-text)'
  }
  if (isDanger) {
    style.color = 'var(--danger)'
    style.borderColor = 'var(--vk-key-danger-border)'
  }

  const tabDisabled = def.t === 'tab'
  if (tabDisabled) {
    style.opacity = 0.38
    style.cursor = 'not-allowed'
  }

  return (
    <button
      type="button"
      disabled={tabDisabled}
      style={style}
      onPointerDown={(e) => {
        e.preventDefault()
        if (tabDisabled) return
        setPressed(true)
        onPress(def)
        window.setTimeout(() => setPressed(false), 120)
      }}
    >
      {label}
    </button>
  )
}

/** Après ouverture, le même tap tactile peut se terminer par un clic sur le backdrop (élément au-dessus) : on ignore la fermeture pendant cette fenêtre. */
const BACKDROP_DISMISS_GRACE_MS = 450

function YoboVirtualKeyboardLayerSession({
  active,
  livePreview,
  onClose,
}: {
  active: ActiveBinding
  /** Copie synchrone du texte affiché (le parent ne re-rend pas toujours le provider). */
  livePreview: string
  onClose: () => void
}) {
  const backdropDismissReadyRef = useRef(false)
  const [shift, setShift] = useState(false)
  const [caps, setCaps] = useState(false)
  const [layout, setLayout] = useState<Layout>(() => (active.kind === 'alpha' ? 'alpha' : 'numpad'))

  useEffect(() => {
    backdropDismissReadyRef.current = false
    const t = window.setTimeout(() => {
      backdropDismissReadyRef.current = true
    }, BACKDROP_DISMISS_GRACE_MS)
    return () => {
      window.clearTimeout(t)
      backdropDismissReadyRef.current = false
    }
  }, [active.id])

  const onKeyPress = useCallback(
    (def: KeyDef) => {
      const current = livePreview

      if (def.t === 'del') {
        if (active.kind === 'alpha') active.setValue(current.slice(0, -1))
        else {
          const next =
            active.kind === 'pin'
              ? applyPadKeyPin(current, 'back', active.maxLen)
              : applyPadKeyMadAmount(current, 'back')
          active.setValue(next)
        }
        return
      }
      if (def.t === 'clear') {
        active.setValue('')
        return
      }
      if (def.t === 'space') {
        if (active.kind === 'alpha') active.setValue(`${current} `.slice(0, active.maxLength))
        return
      }
      if (def.t === 'shift') {
        setShift((s) => !s)
        return
      }
      if (def.t === 'caps') {
        setCaps((c) => !c)
        return
      }
      if (def.t === 'switchSym') {
        setLayout('sym')
        return
      }
      if (def.t === 'switchAlpha') {
        setLayout('alpha')
        return
      }
      if (def.t === 'tab') return

      if (!def.l) return

      if (active.kind === 'alpha') {
        const useShift = shift || caps
        const ch = useShift ? def.s ?? def.l.toUpperCase() : def.l
        active.setValue((current + ch).slice(0, active.maxLength))
        if (shift && !caps) setShift(false)
      } else {
        const padKey = mapNumericKeyToPadKey(def.l)
        if (!padKey) return
        const next =
          active.kind === 'pin'
            ? applyPadKeyPin(current, padKey, active.maxLen)
            : applyPadKeyMadAmount(current, padKey)
        active.setValue(next)
      }
    },
    [active, livePreview, shift, caps],
  )

  const title =
    active.kind === 'alpha'
      ? 'Clavier AZERTY'
      : active.kind === 'pin'
        ? 'Clavier numérique (PIN)'
        : 'Clavier numérique (montant)'

  const rows =
    active.kind === 'alpha'
      ? layout === 'sym'
        ? SYM_LAYOUT
        : ALPHA_LAYOUT
      : active.kind === 'pin'
        ? NUMPAD_PIN_LAYOUT
        : NUMPAD_DECIMAL_LAYOUT
  const previewValue =
    active.kind === 'pin' && active.mask
      ? livePreview.length > 0
        ? '•'.repeat(livePreview.length)
        : ''
      : livePreview

  const tryBackdropClose = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      if (e.target !== e.currentTarget) return
      if (!backdropDismissReadyRef.current) return
      onClose()
    },
    [onClose],
  )

  return (
    <div
      className="yobo-vk-overlay fixed inset-0 z-[420] flex flex-col justify-end bg-black/45 backdrop-blur-[1px]"
      role="presentation"
      onPointerDown={tryBackdropClose}
    >
      <div className="yobo-vk-shell mx-auto w-full max-w-[64rem] px-3 pb-3 pt-10 sm:px-5 sm:pb-5">
        <div
          className="yobo-vk-panel max-h-[min(56vh,32rem)] overflow-y-auto"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="yobo-vk-topline" aria-hidden />
          <div className="yobo-vk-header-row">
            <div className="yobo-vk-preview">
              <span className="yobo-vk-preview-label">Saisie</span>
              <span className="yobo-vk-preview-value">{previewValue || '|'}</span>
            </div>
            <button type="button" className="yobo-vk-close" onClick={onClose}>
            Fermer
          </button>
        </div>
          <div className="yobo-vk-grid-wrap">
            {rows.map((row, ri) => (
              <div key={ri} className="yobo-vk-grid-row">
                {row.map((def, ki) => (
                  <KeyButton
                    key={`${ri}-${ki}-${def.k ?? def.l ?? 'k'}`}
                    def={def}
                    shift={shift}
                    caps={caps}
          layout={layout}
                    onPress={onKeyPress}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function YoboVirtualKeyboardLayer({
  active,
  livePreview,
  onClose,
}: {
  active: ActiveBinding | null
  livePreview: string
  onClose: () => void
}) {
  const dismissKeyboard = useCallback(() => {
    onClose()
    window.requestAnimationFrame(() => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur()
    })
  }, [onClose])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        dismissKeyboard()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, dismissKeyboard])

  useEffect(() => {
    if (!active) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [active])

  if (!active) return null

  return (
    <YoboVirtualKeyboardLayerSession
      key={active.id}
      active={active}
      livePreview={livePreview}
      onClose={onClose}
    />
  )
}

let sessionSeq = 0

export function YoboVirtualKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveBinding | null>(null)
  const [livePreview, setLivePreview] = useState('')

  const close = useCallback(() => {
    setActive(null)
    setLivePreview('')
  }, [])

  const lastClosedAtRef = useRef(0)
  const activeFieldIdRef = useRef<string | null>(null)

  const openWithField = useCallback((b: Omit<ActiveBinding, 'id'>) => {
    // Empêcher l'ouverture immédiate après une fermeture (évite le "ghost click" au clic extérieur)
    if (Date.now() - lastClosedAtRef.current < 300) return

    sessionSeq += 1
    const initial = b.getValue()
    activeFieldIdRef.current = b.fieldId
    const binding: ActiveBinding = {
      ...b,
      id: sessionSeq,
      setValue: (v: string) => {
        b.setValue(v)
        setLivePreview(v)
      },
    } as ActiveBinding
    setLivePreview(initial)
    setActive(binding)
  }, [])

  const notifyFieldValue = useCallback((fieldId: string, v: string) => {
    if (activeFieldIdRef.current !== fieldId) return
    setLivePreview(v)
  }, [])

  const closeWrapped = useCallback(() => {
    activeFieldIdRef.current = null
    lastClosedAtRef.current = Date.now()
    close()
  }, [close])

  const value = useMemo(() => ({ open: openWithField, close: closeWrapped, notifyFieldValue }), [openWithField, closeWrapped, notifyFieldValue])

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) closeWrapped()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [closeWrapped])

  useEffect(() => {
    if (!isTauriRuntime()) return
    let unlisten: (() => void) | undefined
    let blurCloseTimer: ReturnType<typeof setTimeout> | undefined
    void getCurrentWindow()
      .onFocusChanged(({ payload }) => {
        if (blurCloseTimer) {
          clearTimeout(blurCloseTimer)
          blurCloseTimer = undefined
        }
        // Sans délai, une courte perte de focus (tactile, clavier OS, etc.) referme le clavier.
        if (!payload) {
          blurCloseTimer = setTimeout(() => {
            blurCloseTimer = undefined
            closeWrapped()
          }, 320)
        }
      })
      .then((u) => {
        unlisten = u
      })
    return () => {
      if (blurCloseTimer) clearTimeout(blurCloseTimer)
      unlisten?.()
    }
  }, [closeWrapped])

  return (
    <YoboVirtualKeyboardContext.Provider value={value}>
      {children}
      <YoboVirtualKeyboardLayer active={active} livePreview={livePreview} onClose={closeWrapped} />
    </YoboVirtualKeyboardContext.Provider>
  )
}

function useVkContext(): Ctx {
  const ctx = useContext(YoboVirtualKeyboardContext)
  if (!ctx) throw new Error('YoboVirtualKeyboardProvider manquant')
  return ctx
}

/** 
 * Détecte si le mouvement tactile est un "tap" ou un "scroll".
 * Si la distance parcourue est > 8px, on considère que c'est un défilement.
 */
function useYoboKeyboardTrigger(openKeyboard: () => void) {
  const startPos = useRef<{ x: number; y: number } | null>(null)

  return useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent) => {
        startPos.current = { x: e.clientX, y: e.clientY }
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (!startPos.current) {
          openKeyboard()
          return
        }
        const dx = e.clientX - startPos.current.x
        const dy = e.clientY - startPos.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        startPos.current = null
        if (dist < 8) {
          openKeyboard()
        }
      },
      // Le focus peut être déclenché par tabulation ou autre : on l'autorise.
      onFocus: (e: React.FocusEvent) => {
        // Si c'est un focus par clic, le PointerUp gère déjà. 
        // Si c'est par clavier (tab), on ouvre.
        if (e.target.matches(':focus-visible')) {
          openKeyboard()
        }
      },
    }),
    [openKeyboard],
  )
}

/** Au focus ou re-clic : ouvre le clavier AZERTY custom. */
export function useYoboAlphaInputProps(value: string, onChange: (v: string) => void, maxLength = 200) {
  const { open, notifyFieldValue } = useVkContext()
  const fieldId = useId()
  const r = useRef({ value, onChange })
  useEffect(() => {
    r.current = { value, onChange }
  }, [value, onChange])

  useEffect(() => {
    notifyFieldValue(fieldId, value)
  }, [fieldId, value, notifyFieldValue])

  const openKeyboard = useCallback(() => {
    open({
      kind: 'alpha',
      fieldId,
      getValue: () => r.current.value,
      setValue: (v: string) => r.current.onChange(v),
      maxLength,
    })
  }, [open, maxLength, fieldId])

  return useYoboKeyboardTrigger(openKeyboard)
}

/** Au focus ou re-clic : pavé numérique PIN (C + ⌫, chiffres). */
export function useYoboPinInputProps(value: string, onChange: (v: string) => void, maxLen: number, mask = true) {
  const { open, notifyFieldValue } = useVkContext()
  const fieldId = useId()
  const r = useRef({ value, onChange })
  useEffect(() => {
    r.current = { value, onChange }
  }, [value, onChange])

  useEffect(() => {
    notifyFieldValue(fieldId, value)
  }, [fieldId, value, notifyFieldValue])

  const openKeyboard = useCallback(() => {
    open({
      kind: 'pin',
      fieldId,
      getValue: () => r.current.value,
      setValue: (v: string) => r.current.onChange(v),
      maxLen,
      mask,
    })
  }, [open, maxLen, fieldId, mask])

  return useYoboKeyboardTrigger(openKeyboard)
}

/** Au focus ou re-clic : pavé montant MAD (`applyPadKeyMadAmount`). */
export function useYoboDecimalInputProps(value: string, onChange: (v: string) => void) {
  const { open, notifyFieldValue } = useVkContext()
  const fieldId = useId()
  const r = useRef({ value, onChange })
  useEffect(() => {
    r.current = { value, onChange }
  }, [value, onChange])

  useEffect(() => {
    notifyFieldValue(fieldId, value)
  }, [fieldId, value, notifyFieldValue])

  const openKeyboard = useCallback(() => {
    open({
      kind: 'decimal',
      fieldId,
      getValue: () => r.current.value,
      setValue: (v: string) => r.current.onChange(v),
    })
  }, [open, fieldId])

  return useYoboKeyboardTrigger(openKeyboard)
}
