import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useYoboStore } from '../store'
import { SpinnerIcon } from './icons/SpinnerIcon'

/** Délai avant la première répétition après appui maintenu. */
const ARROW_HOLD_REPEAT_DELAY_MS = 360
/** Entre chaque pas en maintien : même défilement fluide qu’un clic (intervalle pour limiter les chevauchements). */
const ARROW_HOLD_REPEAT_INTERVAL_MS = 300

const AVATARS = [
  { id: 'av-crown', icon: 'crown', color: 'from-amber-400 to-orange-600', glow: 'shadow-amber-500/30', label: 'Gérant' },
  { id: 'av-shield', icon: 'shield_person', color: 'from-blue-500 to-indigo-700', glow: 'shadow-blue-500/30', label: 'Admin' },
  { id: 'av-chef', icon: 'restaurant_menu', color: 'from-orange-500 to-red-600', glow: 'shadow-orange-500/30', label: 'Chef' },
  { id: 'av-cash', icon: 'payments', color: 'from-emerald-500 to-teal-700', glow: 'shadow-emerald-500/30', label: 'Caisse' },
  { id: 'av-star', icon: 'grade', color: 'from-purple-500 to-pink-600', glow: 'shadow-purple-500/30', label: 'VIP' },
  { id: 'av-bolt', icon: 'bolt', color: 'from-cyan-400 to-blue-600', glow: 'shadow-cyan-500/30', label: 'Flash' },
  { id: 'av-snack', icon: 'lunch_dining', color: 'from-yellow-500 to-amber-700', glow: 'shadow-yellow-500/30', label: 'Repas' },
  { id: 'av-cafe', icon: 'local_cafe', color: 'from-amber-700 to-stone-800', glow: 'shadow-amber-600/30', label: 'Café' },
  { id: 'av-pizza', icon: 'local_pizza', color: 'from-red-500 to-rose-700', glow: 'shadow-rose-500/30', label: 'Pizza' },
  { id: 'av-sweet', icon: 'icecream', color: 'from-pink-400 to-fuchsia-600', glow: 'shadow-pink-500/30', label: 'Douceur' },
  { id: 'av-fire', icon: 'local_fire_department', color: 'from-red-600 to-orange-600', glow: 'shadow-orange-600/30', label: 'Chaud' },
  { id: 'av-rocket', icon: 'rocket_launch', color: 'from-violet-500 to-fuchsia-700', glow: 'shadow-violet-500/30', label: 'Élite' },
  { id: 'av-fastfood', icon: 'fastfood', color: 'from-lime-500 to-green-800', glow: 'shadow-lime-500/30', label: 'Snack' },
  { id: 'av-plateau', icon: 'set_meal', color: 'from-teal-500 to-emerald-900', glow: 'shadow-teal-500/30', label: 'Plateau' },
  { id: 'av-emporter', icon: 'takeout_dining', color: 'from-sky-500 to-blue-900', glow: 'shadow-sky-500/30', label: 'À emporter' },
  { id: 'av-brunch', icon: 'brunch_dining', color: 'from-orange-400 to-amber-900', glow: 'shadow-orange-400/30', label: 'Brunch' },
  { id: 'av-bakery', icon: 'bakery_dining', color: 'from-amber-300 to-yellow-800', glow: 'shadow-amber-400/30', label: 'Boulangerie' },
  { id: 'av-boisson', icon: 'emoji_food_beverage', color: 'from-sky-400 to-indigo-700', glow: 'shadow-sky-400/30', label: 'Boissons' },
  { id: 'av-nuit', icon: 'nights_stay', color: 'from-indigo-600 to-slate-900', glow: 'shadow-indigo-500/30', label: 'Nuit' },
  { id: 'av-jour', icon: 'wb_sunny', color: 'from-yellow-300 to-orange-500', glow: 'shadow-yellow-400/30', label: 'Matin' },
  { id: 'av-passion', icon: 'favorite', color: 'from-rose-500 to-red-800', glow: 'shadow-rose-500/30', label: 'Passion' },
  { id: 'av-chill', icon: 'sentiment_satisfied', color: 'from-green-400 to-teal-700', glow: 'shadow-green-400/30', label: 'Cool' },
  { id: 'av-party', icon: 'celebration', color: 'from-fuchsia-500 to-purple-900', glow: 'shadow-fuchsia-500/30', label: 'Fête' },
  { id: 'av-ramen', icon: 'ramen_dining', color: 'from-orange-600 to-red-900', glow: 'shadow-orange-600/30', label: 'Ramen' },
  { id: 'av-bol', icon: 'rice_bowl', color: 'from-lime-600 to-emerald-900', glow: 'shadow-lime-600/30', label: 'Bol' },
  { id: 'av-oeuf', icon: 'egg_alt', color: 'from-yellow-200 to-amber-600', glow: 'shadow-amber-400/30', label: 'Œuf' },
  { id: 'av-soupe', icon: 'soup_kitchen', color: 'from-stone-400 to-stone-700', glow: 'shadow-stone-500/30', label: 'Soupe' },
  { id: 'av-grill', icon: 'outdoor_grill', color: 'from-neutral-600 to-zinc-900', glow: 'shadow-neutral-600/30', label: 'Grill' },
  { id: 'av-gateau', icon: 'cake', color: 'from-pink-300 to-rose-700', glow: 'shadow-pink-400/30', label: 'Gâteau' },
  { id: 'av-vin', icon: 'wine_bar', color: 'from-red-800 to-purple-950', glow: 'shadow-red-700/30', label: 'Vin' },
  { id: 'av-biere', icon: 'sports_bar', color: 'from-amber-500 to-yellow-900', glow: 'shadow-amber-500/30', label: 'Bière' },
  { id: 'av-sante', icon: 'nutrition', color: 'from-green-500 to-lime-800', glow: 'shadow-green-500/30', label: 'Salade' },
  { id: 'av-piquant', icon: 'whatshot', color: 'from-red-500 to-orange-800', glow: 'shadow-red-500/30', label: 'Piquant' },
  { id: 'av-frais', icon: 'ac_unit', color: 'from-cyan-300 to-blue-800', glow: 'shadow-cyan-400/30', label: 'Frais' },
  { id: 'av-musique', icon: 'music_note', color: 'from-violet-400 to-purple-900', glow: 'shadow-violet-400/30', label: 'Musique' },
  { id: 'av-luxe', icon: 'diamond', color: 'from-slate-500 to-slate-800', glow: 'shadow-slate-400/30', label: 'Luxe' },
  { id: 'av-equipe', icon: 'groups', color: 'from-blue-400 to-indigo-900', glow: 'shadow-blue-400/30', label: 'Équipe' },
]

export function YoboAvatarPicker({ immediatePersist = false }: { immediatePersist?: boolean } = {}) {
  const currentAvatar = useYoboStore((s) => s.avatar)
  const updateAvatar = useYoboStore((s) => s.updateAvatar)

  const [selectedId, setSelectedId] = useState<string | null>(currentAvatar)
  const [isSaving, setIsSaving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const arrowHoldTimers = useRef<{
    delay: ReturnType<typeof setTimeout> | null
    repeat: ReturnType<typeof setInterval> | null
  }>({ delay: null, repeat: null })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const syncScrollArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const pad = 4
    setCanScrollLeft(scrollLeft > pad)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - pad)
  }, [])

  useLayoutEffect(() => {
    syncScrollArrows()
  }, [syncScrollArrows])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => syncScrollArrows())
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncScrollArrows])

  useEffect(() => () => {
    const h = arrowHoldTimers.current
    if (h.delay) clearTimeout(h.delay)
    if (h.repeat) clearInterval(h.repeat)
  }, [])

  useEffect(() => {
    setSelectedId(currentAvatar)
  }, [currentAvatar])

  const scrollAvatars = useCallback((dir: -1 | 1, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    const first = el.querySelector('button[role="option"]') as HTMLElement | null
    const gap = 8
    const step = first ? first.getBoundingClientRect().width + gap : Math.min(140, el.clientWidth * 0.75)
    el.scrollBy({ left: dir * step, behavior })
  }, [])

  const clearArrowHold = useCallback(() => {
    const h = arrowHoldTimers.current
    if (h.delay) {
      clearTimeout(h.delay)
      h.delay = null
    }
    if (h.repeat) {
      clearInterval(h.repeat)
      h.repeat = null
    }
  }, [])

  const beginArrowHold = useCallback(
    (dir: -1 | 1) => {
      if (dir === -1 && !canScrollLeft) return
      if (dir === 1 && !canScrollRight) return
      clearArrowHold()
      scrollAvatars(dir, 'smooth')
      arrowHoldTimers.current.delay = setTimeout(() => {
        arrowHoldTimers.current.delay = null
        scrollAvatars(dir, 'smooth')
        arrowHoldTimers.current.repeat = setInterval(() => {
          const el = scrollRef.current
          if (!el) {
            clearArrowHold()
            return
          }
          const pad = 4
          if (dir === -1 && el.scrollLeft <= pad) {
            clearArrowHold()
            return
          }
          if (dir === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - pad) {
            clearArrowHold()
            return
          }
          scrollAvatars(dir, 'smooth')
        }, ARROW_HOLD_REPEAT_INTERVAL_MS)
      }, ARROW_HOLD_REPEAT_DELAY_MS)
    },
    [canScrollLeft, canScrollRight, clearArrowHold, scrollAvatars],
  )

  const handleSave = async () => {
    if (!selectedId || selectedId === currentAvatar) return
    setIsSaving(true)
    try {
      await updateAvatar(selectedId)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanged = selectedId !== currentAvatar

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          aria-label="Voir les avatars précédents"
          disabled={!canScrollLeft}
          className="flex size-9 shrink-0 select-none items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-h)] shadow-sm transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:pointer-events-none disabled:opacity-25 sm:size-10"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            beginArrowHold(-1)
          }}
          onPointerUp={(e) => {
            clearArrowHold()
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          }}
          onPointerCancel={(e) => {
            clearArrowHold()
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          }}
        >
          <span className="material-symbols-outlined text-[22px]">chevron_left</span>
        </button>

        <div
          ref={scrollRef}
          onScroll={syncScrollArrows}
          className="min-w-0 flex-1 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex gap-2 overflow-x-auto overflow-y-hidden pb-2 pt-0.5 [-webkit-overflow-scrolling:touch] touch-pan-x"
          role="listbox"
          aria-label="Avatars disponibles"
        >
          {AVATARS.map((av) => (
          <button
            key={av.id}
            type="button"
            role="option"
            aria-selected={selectedId === av.id}
            onClick={() => {
              setSelectedId(av.id)
              if (immediatePersist && av.id !== currentAvatar) {
                void (async () => {
                  setIsSaving(true)
                  try {
                    await updateAvatar(av.id, { quiet: immediatePersist })
                  } finally {
                    setIsSaving(false)
                  }
                })()
              }
            }}
            className={`group relative flex w-[4.75rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 transition-all duration-200 sm:w-[5.125rem] ${
              selectedId === av.id ? '' : 'opacity-65 grayscale hover:opacity-100 hover:grayscale-0'
            }`}
          >
            <div
              className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ring-offset-1 transition-all duration-300 sm:size-12 ${av.color} ${
                selectedId === av.id ? `${av.glow} ring-2 ring-[var(--accent)]` : 'ring-0 hover:brightness-110'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] text-white drop-shadow-sm transition-transform group-hover:scale-105 sm:text-[24px]">
                {av.icon}
              </span>

              {selectedId === av.id && (
                <div className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-[var(--card)] animate-in zoom-in-50 duration-200">
                  <span className="material-symbols-outlined text-[10px] font-bold leading-none">check</span>
                </div>
              )}
            </div>
            <span className="max-w-full truncate text-center text-[8px] font-black uppercase leading-tight tracking-wide text-[var(--muted)] sm:text-[9px]">
              {av.label}
            </span>
          </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Voir les avatars suivants"
          disabled={!canScrollRight}
          className="flex size-9 shrink-0 select-none items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-h)] shadow-sm transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:pointer-events-none disabled:opacity-25 sm:size-10"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            beginArrowHold(1)
          }}
          onPointerUp={(e) => {
            clearArrowHold()
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          }}
          onPointerCancel={(e) => {
            clearArrowHold()
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          }}
        >
          <span className="material-symbols-outlined text-[22px]">chevron_right</span>
        </button>
      </div>

      {!immediatePersist ? (
        <div className="flex justify-end pt-0.5">
          <button
            disabled={!hasChanged || isSaving}
            onClick={handleSave}
            className="yobo-modal-btn yobo-modal-btn--primary min-w-[108px] justify-center py-2 text-xs shadow-lg shadow-[var(--accent)]/10 sm:h-9 sm:min-w-[118px]"
          >
            {isSaving ? (
              <>
                <SpinnerIcon size={14} />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>Enregistrer</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function YoboAvatarDisplay({ id, size = 'md', className = '' }: { id?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const avatar = AVATARS.find((a) => a.id === id) || AVATARS[0]
  
  const sizeClasses = {
    xs: 'size-6 rounded-md',
    sm: 'size-8 rounded-lg',
    md: 'size-10 rounded-xl',
    lg: 'size-14 rounded-2xl',
    xl: 'size-20 rounded-[2.5rem]'
  }

  const iconSizes = {
    xs: 'text-[14px]',
    sm: 'text-[18px]',
    md: 'text-[22px]',
    lg: 'text-[28px]',
    xl: 'text-[40px]'
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br shadow-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer ${sizeClasses[size]} ${avatar.color} ${avatar.glow} ${className}`}
    >
      <span className={`material-symbols-outlined text-white drop-shadow-sm ${iconSizes[size]}`}>
        {avatar.icon}
      </span>
    </div>
  )
}
