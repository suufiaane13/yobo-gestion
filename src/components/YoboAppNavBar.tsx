import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import { useYoboStore } from '../store'
import type { Tab } from '../types/yoboApp'
import {
  NavIconCaisse,
  NavIconChevronDown,
  NavIconDashboard,
  NavIconHistorique,
  NavIconLogs,
  NavIconMenu,
  NavIconProfil,
  NavIconQr,
  NavIconUsers,
} from './YoboNavIcons'

type NavIcon = ComponentType<{ size?: number; className?: string }>

const GERANT_MAIN: [Tab, string, NavIcon][] = [
  ['dashboard', 'Accueil', NavIconDashboard],
  ['caisse', 'Caisse', NavIconCaisse],
  ['historique', 'Historique', NavIconHistorique],
  ['profil', 'Profil', NavIconProfil],
]

const GERANT_GESTION: [Tab, string, NavIcon][] = [
  ['menu', 'Menu', NavIconMenu],
  ['qr', 'QR', NavIconQr],
  ['logs', 'Logs', NavIconLogs],
  ['utilisateurs', 'Utilisateurs', NavIconUsers],
]

const CAISSIER_MAIN: [Tab, string, NavIcon][] = [
  ['caisse', 'Caisse', NavIconCaisse],
  ['historique', 'Historique', NavIconHistorique],
  ['profil', 'Profil', NavIconProfil],
]

export function YoboAppNavBar() {
  const role = useYoboStore((s) => s.role)
  const tab = useYoboStore((s) => s.tab)
  const setTab = useYoboStore((s) => s.setTab)
  const theme = useYoboStore((s) => s.theme)
  const toggleTheme = useYoboStore((s) => s.toggleTheme)
  const requestLogout = useYoboStore((s) => s.requestLogout)
  const isDesktopShell = isTauriRuntime()

  // Hooks (non conditionnels) : même ordre desktop/mobile.
  const [gestionOpen, setGestionOpen] = useState(false)
  const gestionRef = useRef<HTMLDivElement>(null)

  const closeGestion = useCallback(() => setGestionOpen(false), [])

  useEffect(() => {
    if (!gestionOpen) return
    const onDoc = (e: MouseEvent) => {
      if (gestionRef.current?.contains(e.target as Node)) return
      setGestionOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [gestionOpen])

  useEffect(() => {
    if (!gestionOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGestionOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [gestionOpen])

  // Desktop: SideNav fixed (template "Kinetic Monolith" layout).
  if (isDesktopShell) {
    const mainItems = role === 'gerant' ? GERANT_MAIN : CAISSIER_MAIN
    const gestionItems = role === 'gerant' ? GERANT_GESTION : []

    const itemClass = (active: boolean) =>
      `flex w-full items-center gap-3 px-4 py-2.5 rounded-none transition-all ${
        active
          ? 'bg-[var(--accent-bg)] text-[var(--accent)] border-l-4 border-[var(--accent)] translate-x-1'
          : 'text-[var(--muted)] opacity-80 hover:bg-[var(--card)] hover:text-[var(--text-h)]'
      }`

    return (
      <aside className="fixed left-0 top-[40px] bottom-0 w-64 flex flex-col py-6 overflow-y-auto bg-[var(--surface)] shadow-2xl z-40">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="YOBO Gestion"
              className="h-11 w-auto max-w-[calc(100%)] shrink-0 object-contain object-left"
              decoding="async"
            />
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2">
          <div className="px-2 mb-6">
            <button
              type="button"
              className="group flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-container)] px-3 py-2.5 text-[#4d2600] shadow-xl shadow-[var(--accent)]/15 transition-all hover:brightness-110 active:scale-[0.98]"
              onClick={() => setTab('caisse')}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/10 shadow-inner transition-transform group-hover:rotate-90">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest truncate">
                Nouvelle Commande
              </span>
            </button>
          </div>

          {mainItems.map(([k, label, Icon]) => (
            <button key={k} type="button" className={itemClass(tab === k)} onClick={() => setTab(k)}>
              <Icon size={18} />
              <span className="text-sm font-bold">{label}</span>
            </button>
          ))}

          {gestionItems.length > 0 ? (
            <div className="mt-auto pt-6">
              <div className="flex flex-col gap-1">
                {gestionItems.map(([k, label, Icon]) => (
                  <button key={k} type="button" className={itemClass(tab === k)} onClick={() => setTab(k)}>
                    <Icon size={18} />
                    <span className="text-sm font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </nav>
      </aside>
    )
  }

  const navBtnClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
      active
        ? 'bg-[var(--accent)] text-white'
        : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text-h)]'
    }`

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-[var(--accent)]">YO</span>BO
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center gap-1 px-2">
        {role === 'gerant' ? (
          <>
            {GERANT_MAIN.map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                className={navBtnClass(tab === k)}
                onClick={() => {
                  closeGestion()
                  setTab(k)
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
            <div className="relative" ref={gestionRef}>
              <button
                type="button"
                aria-expanded={gestionOpen}
                aria-haspopup="menu"
                className={navBtnClass(GERANT_GESTION.some(([t]) => t === tab))}
                onClick={() => setGestionOpen((o) => !o)}
              >
                Gestion
                <NavIconChevronDown size={12} className="opacity-80" />
              </button>
              {gestionOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
                >
                  {GERANT_GESTION.map(([k, label, Icon]) => (
                    <button
                      key={k}
                      type="button"
                      role="menuitem"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium ${
                        tab === k
                          ? 'bg-[var(--accent-bg)] text-[var(--text-h)]'
                          : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text-h)]'
                      }`}
                      onClick={() => {
                        setTab(k)
                        setGestionOpen(false)
                      }}
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          CAISSIER_MAIN.map(([k, label, Icon]) => (
            <button key={k} type="button" className={navBtnClass(tab === k)} onClick={() => setTab(k)}>
              <Icon size={15} />
              {label}
            </button>
          ))
        )}
      </div>

      {!isDesktopShell ? (
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[var(--accent-bg)] px-2 py-1 text-xs font-semibold text-[var(--accent)]">
            {role === 'gerant' ? 'Gérant' : 'Utilisateur'}
          </span>
          <button
            type="button"
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text-h)] inline-flex items-center gap-1"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            Thème
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] inline-flex items-center gap-1"
            onClick={requestLogout}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M10 17l5-5-5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M21 21V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Déconnexion
          </button>
        </div>
      ) : null}
    </div>
  )
}
