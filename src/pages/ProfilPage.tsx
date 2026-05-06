import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { useShallow } from 'zustand/shallow'
import { YoboAlphaInput, YoboNumericInput } from '../components/YoboKeyboardInputs'
import { SpinnerIcon } from '../components/icons/SpinnerIcon'
import type { ThemePreference } from '../types/yoboApp'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import { createBackupNow } from '../lib/backups'
import { logDevError, userFacingErrorMessage } from '../lib/userFacingError'
import { client } from '../lib/yoboClientMessages'
import { capitalizeFirstLetter, firstLetterUpper } from '../lib/yoboStrings'
import { useYoboStore } from '../store'
import { YoboUpdater } from '../components/YoboUpdater'
import { YoboAvatarPicker, YoboAvatarDisplay } from '../components/YoboAvatarPicker'

const THEME_PREF_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'manual', label: 'Manuel (clair / sombre)', hint: 'Bouton dans la barre de titre ou ci-dessous.' },
  { value: 'auto_hour', label: 'Automatique (heure)', hint: 'Clair de 7 h à 21 h, sombre la nuit.' },
]

type ProfilCardId =
  | 'profilInfo'
  | 'profilSecurity'
  | 'prefDisplay'
  | 'prefCaisse'
  | 'estUpdater'
  | 'estTickets'
  | 'estData'

const PROFIL_CARD_DEFAULT_OPEN: Record<ProfilCardId, boolean> = {
  profilInfo: false,
  profilSecurity: false,
  prefDisplay: false,
  prefCaisse: false,
  estUpdater: false,
  estTickets: false,
  estData: false,
}

function ProfilCollapsibleCard({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string
  icon: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.5)] ring-1 ring-[var(--border)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 border-b border-[var(--border)] px-6 py-4 text-left transition hover:bg-[var(--surface)]/40"
        aria-expanded={open}
      >
        <h3 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-h)]">
          {icon}
          <span className="truncate">{title}</span>
        </h3>
        <span
          className={`material-symbols-outlined shrink-0 text-[22px] text-[var(--accent)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          expand_more
        </span>
      </button>
      {open ? <div className="animate-in fade-in duration-200">{children}</div> : null}
    </section>
  )
}

/** Navigation latérale Profil : compte utilisateur · préférences locales · réglages magasin (gérant bureau). */
type ProfilNavSection = 'profil' | 'preferences' | 'establishment'

export function ProfilPage() {
  const role = useYoboStore((s) => s.role)
  const userId = useYoboStore((s) => s.userId)
  const theme = useYoboStore((s) => s.theme)
  const themePreference = useYoboStore((s) => s.themePreference)
  const setThemePreference = useYoboStore((s) => s.setThemePreference)
  const toggleTheme = useYoboStore((s) => s.toggleTheme)
  const pushToast = useYoboStore((s) => s.pushToast)
  const loadCatalog = useYoboStore((s) => s.loadCatalog)
  const loadCaissiers = useYoboStore((s) => s.loadCaissiers)
  const loadOrders = useYoboStore((s) => s.loadOrders)
  const loadTicketSettings = useYoboStore((s) => s.loadTicketSettings)
  const clearCart = useYoboStore((s) => s.clearCart)
  const setCashSession = useYoboStore((s) => s.setCashSession)
  const ticketShopLabel = useYoboStore((s) => s.ticketShopLabel)
  const ticketShopPhone = useYoboStore((s) => s.ticketShopPhone)
  const ticketPrinterA = useYoboStore((s) => s.ticketPrinterA)
  const ticketPrinterB = useYoboStore((s) => s.ticketPrinterB)
  const setTicketPrinterA = useYoboStore((s) => s.setTicketPrinterA)
  const setTicketPrinterB = useYoboStore((s) => s.setTicketPrinterB)
  const testPrinter = useYoboStore((s) => s.testPrinter)
  const saveTicketShopSettings = useYoboStore((s) => s.saveTicketShopSettings)
  const cashRenduEnabled = useYoboStore((s) => s.cashRenduEnabled)
  const setCashRenduEnabled = useYoboStore((s) => s.setCashRenduEnabled)
  const virtualKeyboardEnabled = useYoboStore((s) => s.virtualKeyboardEnabled)
  const setVirtualKeyboardEnabled = useYoboStore((s) => s.setVirtualKeyboardEnabled)
  const [activeSection, setActiveSection] = useState<ProfilNavSection>('profil')
  const [dbBusy, setDbBusy] = useState<'backup' | 'restore' | null>(null)
  const [dbPurgePin, setDbPurgePin] = useState('')
  const [dbPurgePinVerified, setDbPurgePinVerified] = useState(false)
  const [dbPurgeWord, setDbPurgeWord] = useState('')
  const [dbPurgeBusy, setDbPurgeBusy] = useState(false)
  const [dbPurgeSelection, setDbPurgeSelection] = useState({
    orders: true,
    logs: true,
    cashSessions: true,
    caissiers: true,
    catalogDelete: false,
  })
  const [ticketDraftLabel, setTicketDraftLabel] = useState('')
  const [ticketDraftPhone, setTicketDraftPhone] = useState('')
  const [ticketSaving, setTicketSaving] = useState(false)
  const [printers, setPrinters] = useState<string[]>([])
  const [appVersion, setAppVersion] = useState('')
  const [socialModal, setSocialModal] = useState<{ type: 'github' | 'instagram'; url: string; label: string } | null>(null)
  const socialRef = useRef<HTMLDivElement>(null)
  const socialIconRowRef = useRef<HTMLDivElement>(null)
  const socialGithubBtnRef = useRef<HTMLButtonElement>(null)
  const socialInstagramBtnRef = useRef<HTMLButtonElement>(null)
  const [socialQrArrowLeftPx, setSocialQrArrowLeftPx] = useState<number | null>(null)

  const SOCIAL_QR_PANEL_W_PX = 188

  const updateSocialQrArrowPosition = useCallback(() => {
    if (!socialModal) {
      setSocialQrArrowLeftPx(null)
      return
    }
    const row = socialIconRowRef.current
    const btn = socialModal.type === 'github' ? socialGithubBtnRef.current : socialInstagramBtnRef.current
    if (!row || !btn) return
    const rowRect = row.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    const iconCenterX = btnRect.left + btnRect.width / 2 - rowRect.left
    setSocialQrArrowLeftPx(iconCenterX - rowRect.width / 2 + SOCIAL_QR_PANEL_W_PX / 2)
  }, [socialModal])
  const [profilCardOpen, setProfilCardOpen] = useState<Record<ProfilCardId, boolean>>(() => ({ ...PROFIL_CARD_DEFAULT_OPEN }))
  const toggleProfilCard = (id: ProfilCardId) => {
    setProfilCardOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    if (!socialModal) return
    const onDown = (e: MouseEvent) => {
      if (socialRef.current && !socialRef.current.contains(e.target as Node)) {
        setSocialModal(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSocialModal(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [socialModal])

  useLayoutEffect(() => {
    updateSocialQrArrowPosition()
  }, [updateSocialQrArrowPosition])

  useEffect(() => {
    if (!socialModal) return
    const onResize = () => updateSocialQrArrowPosition()
    window.addEventListener('resize', onResize)
    const row = socialIconRowRef.current
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined' && row) {
      ro = new ResizeObserver(onResize)
      ro.observe(row)
    }
    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [socialModal, updateSocialQrArrowPosition])

  useEffect(() => {
    if (isTauriRuntime()) {
      void getVersion().then(setAppVersion)
    }
  }, [])

  useEffect(() => {
    if (role !== 'gerant') return
    setTicketDraftLabel(ticketShopLabel)
    setTicketDraftPhone(ticketShopPhone)
  }, [role, ticketShopLabel, ticketShopPhone])

  useEffect(() => {
    if (role !== 'gerant' || !isTauriRuntime()) return
    void (async () => {
      try {
        const res = await invoke<string[]>('printers_list')
        setPrinters(Array.isArray(res) ? res : [])
      } catch (e) {
        logDevError('printers_list_native', e)
        setPrinters([])
      }
    })()
  }, [role])

  const isGerant = role === 'gerant'
  const showEstablishmentNav = isGerant && isTauriRuntime()

  useEffect(() => {
    if (activeSection === 'establishment' && !showEstablishmentNav) {
      setActiveSection('preferences')
    }
  }, [activeSection, showEstablishmentNav])

  const {
    profileNameDraft,
    setProfileNameDraft,
    setProfileNameError,
    setProfileNamePin,
    setProfileNamePinModalOpen,
    profileUserLoading,
    profileOldPin,
    setProfileOldPin,
    setProfileOldVerified,
    setProfileNewPin,
    setProfileNewPinConfirm,
    verifyProfilePin,
    profileLoading,
    profileOldVerified,
    profileNewPin,
    profileNewPinConfirm,
    submitProfilePasswordChange,
    profileUserProfile,
  } = useYoboStore(
    useShallow((s) => ({
      profileNameDraft: s.profileNameDraft,
      setProfileNameDraft: s.setProfileNameDraft,
      setProfileNameError: s.setProfileNameError,
      setProfileNamePin: s.setProfileNamePin,
      setProfileNamePinModalOpen: s.setProfileNamePinModalOpen,
      profileUserLoading: s.profileUserLoading,
      profileOldPin: s.profileOldPin,
      setProfileOldPin: s.setProfileOldPin,
      setProfileOldVerified: s.setProfileOldVerified,
      setProfileError: s.setProfileError,
      setProfileSuccess: s.setProfileSuccess,
      setProfileNewPin: s.setProfileNewPin,
      setProfileNewPinConfirm: s.setProfileNewPinConfirm,
      verifyProfilePin: s.verifyProfilePin,
      profileLoading: s.profileLoading,
      profileOldVerified: s.profileOldVerified,
      profileNewPin: s.profileNewPin,
      profileNewPinConfirm: s.profileNewPinConfirm,
      submitProfilePasswordChange: s.submitProfilePasswordChange,
      profileUserProfile: s.profileUserProfile,
      previewCashCloseTicketMockup: s.previewCashCloseTicketMockup,
    })),
  )

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* SIDEBAR NAVIGATION */}
        <aside
          className={`w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-4 ${socialModal ? 'relative z-[45]' : ''}`}
        >
          <div className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.4)] ring-1 ring-[var(--border)]">
            {/* User Preview Header */}
            <div className="border-b border-[var(--border)] bg-[var(--surface)] p-6 text-center">
              <div className="mx-auto mb-3 flex items-center justify-center">
                {profileUserProfile?.avatar ? (
                  <YoboAvatarDisplay id={profileUserProfile.avatar} size="xl" className="ring-4 ring-[var(--card)]" />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-container)] text-2xl font-black text-white shadow-lg ring-4 ring-[var(--card)] transition-all duration-300 hover:scale-110 hover:rotate-3 active:scale-90 cursor-pointer">
                    {profileUserProfile ? firstLetterUpper(profileUserProfile.name) : <span className="material-symbols-outlined text-3xl">person</span>}
                  </div>
                )}
              </div>
              <div className="truncate text-sm font-black tracking-tight text-[var(--text-h)]">
                {profileUserProfile ? capitalizeFirstLetter(profileUserProfile.name) : 'Utilisateur'}
              </div>
              <div className="mt-1">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${isGerant ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : 'bg-[var(--border)] text-[var(--muted)]'}`}>
                  {isGerant ? 'Gérant' : 'Caissier'}
                </span>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="space-y-1 p-2">
              <button
                type="button"
                onClick={() => setActiveSection('profil')}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black transition-all ${activeSection === 'profil' ? 'bg-[var(--accent)] text-[#4d2600] shadow-md' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text-h)]'}`}
              >
                <span className="material-symbols-outlined text-[20px]">account_circle</span>
                Mon profil
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('preferences')}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black transition-all ${activeSection === 'preferences' ? 'bg-[var(--accent)] text-[#4d2600] shadow-md' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text-h)]'}`}
              >
                <span className="material-symbols-outlined text-[20px]">tune</span>
                Préférences
              </button>
              {showEstablishmentNav ? (
                <button
                  type="button"
                  onClick={() => setActiveSection('establishment')}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black transition-all ${activeSection === 'establishment' ? 'bg-[var(--accent)] text-[#4d2600] shadow-md' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text-h)]'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">storefront</span>
                  Établissement
                </button>
              ) : null}
            </nav>
          </div>

          {/* Carte application / développeur — même langage visuel que la carte profil */}
          <div ref={socialRef} className="relative mt-2">
            <div className="rounded-2xl bg-[var(--card)] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.4)] ring-1 ring-[var(--border)] overflow-visible">
              <div className="rounded-t-2xl border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">developer_mode</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-h)]">YOBO</span>
                  {appVersion ? (
                    <span className="text-[9px] font-bold tabular-nums text-[var(--muted)]">v{appVersion}</span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-center justify-center">
                  <span className="inline-flex rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--accent)]">
                    Application
                  </span>
                </div>
              </div>

              <div className="rounded-b-2xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Développé par</span>
                  <div ref={socialIconRowRef} className="relative flex shrink-0 items-center gap-1.5">
                    <button
                      ref={socialGithubBtnRef}
                      type="button"
                      onClick={() =>
                        setSocialModal((s) =>
                          s?.type === 'github' ? null : { type: 'github', url: 'https://github.com/suufiaane13', label: 'GitHub' },
                        )
                      }
                      className="group flex size-9 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] hover:ring-[var(--accent)]/35"
                      aria-label="GitHub"
                      aria-expanded={socialModal?.type === 'github'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" className="transition-transform group-hover:scale-110" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                    </button>
                    <button
                      ref={socialInstagramBtnRef}
                      type="button"
                      onClick={() =>
                        setSocialModal((s) =>
                          s?.type === 'instagram' ? null : { type: 'instagram', url: 'https://instagram.com/suuf.iaane', label: 'Instagram' },
                        )
                      }
                      className="group flex size-9 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)] transition-all hover:bg-[color-mix(in_oklab,#E1306C_12%,var(--surface))] hover:text-[#E1306C] hover:ring-[#E1306C]/35"
                      aria-label="Instagram"
                      aria-expanded={socialModal?.type === 'instagram'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" className="transition-transform group-hover:scale-110" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                      </svg>
                    </button>

                    {socialModal ? (
                      <div
                        className="absolute left-1/2 top-full z-[60] mt-1.5 w-[188px] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="social-qr-title"
                      >
                        <div className="relative">
                        <div className="relative z-[1] overflow-hidden rounded-xl bg-[var(--card)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-[var(--border)]">
                          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                            <span id="social-qr-title" className="truncate text-[10px] font-black uppercase tracking-wider text-[var(--text-h)]">
                              {socialModal.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSocialModal(null)}
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--text-h)]"
                              aria-label="Fermer"
                            >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </div>
                          <div className="p-3 pt-2">
                            <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">Scanner pour nous suivre</p>
                            <div className="mx-auto flex aspect-square w-[148px] items-center justify-center rounded-lg bg-white p-3 shadow-inner ring-1 ring-black/5">
                              <QRCodeSVG value={socialModal.url} size={116} level="H" includeMargin={false} />
                            </div>
                          </div>
                        </div>
                          {/* Queue alignée sur le centre de l’icône (mesure DOM) */}
                          <div
                            className="pointer-events-none absolute -top-[15px] z-[2] -translate-x-1/2 [filter:drop-shadow(0_-2px_6px_color-mix(in_oklab,var(--accent)_35%,transparent))]"
                            style={{
                              left: socialQrArrowLeftPx != null ? `${socialQrArrowLeftPx}px` : '50%',
                            }}
                            aria-hidden
                          >
                            {/* Queue plus longue vers les icônes (petit écart mt-1.5 sous la rangée) */}
                            <div className="h-0 w-0 border-x-[11px] border-b-[13px] border-x-transparent border-b-[color-mix(in_oklab,var(--accent)_55%,var(--border))]" />
                            <div className="absolute left-1/2 top-[2px] h-0 w-0 -translate-x-1/2 border-x-[10px] border-b-[12px] border-x-transparent border-b-[var(--card)]" />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="min-w-0 flex-1 space-y-6">
          {activeSection === 'profil' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ProfilCollapsibleCard
                title="Informations personnelles"
                icon={<span className="material-symbols-outlined text-[18px] text-[var(--accent)]">badge</span>}
                open={profilCardOpen.profilInfo}
                onToggle={() => toggleProfilCard('profilInfo')}
              >
                <div className="p-6">
                  {isGerant ? (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Nom affiché</label>
                          <YoboAlphaInput
                            className="yobo-input mt-1.5 w-full font-bold"
                            value={profileNameDraft}
                            onValueChange={setProfileNameDraft}
                            placeholder="Votre nom"
                            keyboardMaxLength={80}
                          />
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-container)] px-6 text-xs font-black text-[#4d2600] shadow-lg shadow-[var(--accent)]/10 transition hover:brightness-110 disabled:opacity-40"
                          onClick={() => {
                            setProfileNameError(null)
                            setProfileNamePin('')
                            setProfileNamePinModalOpen(true)
                          }}
                          disabled={profileUserLoading || !profileNameDraft.trim()}
                        >
                          <span className="material-symbols-outlined text-[18px]">done_all</span>
                          Mettre à jour
                        </button>
                      </div>

                      <div className="border-t border-[var(--border)] border-dashed pt-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                          Choisir un avatar
                        </label>
                        <div className="mt-2">
                          <YoboAvatarPicker />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                    <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_oklab,var(--border)_85%,transparent)] bg-[var(--surface)] p-4 shadow-sm">
                      <span className="material-symbols-outlined text-[20px] text-[var(--muted)] opacity-60">info</span>
                      <p className="m-0 text-xs font-bold text-[var(--muted)] leading-relaxed">
                        Le changement de nom est réservé au gérant pour garantir l&apos;intégrité des rapports.
                      </p>
                    </div>

                      <div className="border-t border-[var(--border)] border-dashed pt-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                          Choisir un avatar
                        </label>
                        <div className="mt-2">
                          <YoboAvatarPicker />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ProfilCollapsibleCard>

              <ProfilCollapsibleCard
                title="Sécurité & Code PIN"
                icon={<span className="material-symbols-outlined text-[18px] text-[var(--accent)]">lock_reset</span>}
                open={profilCardOpen.profilSecurity}
                onToggle={() => toggleProfilCard('profilSecurity')}
              >
                <div className="p-6">
                  <div className="grid gap-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Code PIN Actuel</label>
                        <YoboNumericInput
                          className="yobo-input mt-1.5 w-full text-center text-xl font-black tracking-[0.5em] tabular-nums"
                          variant="pin"
                          keyboardMaxLen={6}
                          value={profileOldPin}
                          onValueChange={(v) => {
                            setProfileOldPin(v.replace(/\D/g, '').slice(0, 6))
                            setProfileOldVerified(false)
                            setProfileNewPin('')
                            setProfileNewPinConfirm('')
                          }}
                          placeholder="••••••"
                        />
                      </div>
                      {!profileOldVerified && (
                        <button
                          type="button"
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-6 text-xs font-black text-[var(--text-h)] shadow-sm transition hover:bg-[var(--card)] hover:border-[var(--accent)]/50"
                          onClick={() => void verifyProfilePin()}
                          disabled={!profileOldPin.trim() || profileLoading}
                        >
                          {profileLoading ? <SpinnerIcon size={16} /> : <span className="material-symbols-outlined text-[18px]">verified_user</span>}
                          Vérifier
                        </button>
                      )}
                    </div>

                    {profileOldVerified && (
                      <div className="grid gap-6 border-t border-[var(--border)] border-dashed pt-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Nouveau PIN</label>
                            <YoboNumericInput
                              className="yobo-input mt-1.5 w-full text-center text-xl font-black tracking-[0.5em] tabular-nums"
                              variant="pin"
                              keyboardMaxLen={6}
                              value={profileNewPin}
                              onValueChange={(v) => setProfileNewPin(v.replace(/\D/g, '').slice(0, 6))}
                              placeholder="4-6 chiffres"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Confirmation</label>
                            <YoboNumericInput
                              className="yobo-input mt-1.5 w-full text-center text-xl font-black tracking-[0.5em] tabular-nums"
                              variant="pin"
                              keyboardMaxLen={6}
                              value={profileNewPinConfirm}
                              onValueChange={(v) => setProfileNewPinConfirm(v.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Confirmer"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-container)] px-6 text-sm font-black text-[#4d2600] shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-110 disabled:opacity-40"
                          onClick={() => void submitProfilePasswordChange()}
                          disabled={profileLoading || !profileNewPin.trim() || profileNewPin !== profileNewPinConfirm}
                        >
                          <span className="material-symbols-outlined">shield</span>
                          Sauvegarder le nouveau PIN
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </ProfilCollapsibleCard>
            </div>
          )}

          {activeSection === 'preferences' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ProfilCollapsibleCard
                title="Affichage"
                icon={<span className="material-symbols-outlined text-[18px] text-[var(--accent)]">palette</span>}
                open={profilCardOpen.prefDisplay}
                onToggle={() => toggleProfilCard('prefDisplay')}
              >
                <div className="p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col justify-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Mode d’affichage</label>
                      <select
                        className="yobo-input mt-2 w-full font-bold"
                        value={themePreference}
                        onChange={(e) => setThemePreference(e.target.value as ThemePreference)}
                      >
                        {THEME_PREF_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {themePreference === 'manual' && (
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 text-xs font-black text-[var(--text-h)] transition hover:border-[var(--accent)]/50"
                          onClick={() => toggleTheme()}
                        >
                          <span className="material-symbols-outlined text-[20px]">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                          {theme === 'dark' ? 'Passer en Mode Clair' : 'Passer en Mode Sombre'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </ProfilCollapsibleCard>

              {isGerant && isTauriRuntime() && (
                <ProfilCollapsibleCard
                  title="Caisse & saisie"
                  icon={<span className="material-symbols-outlined text-[18px] text-[var(--accent)]">point_of_sale</span>}
                  open={profilCardOpen.prefCaisse}
                  onToggle={() => toggleProfilCard('prefCaisse')}
                >
                  <div className="space-y-4 p-6">
                    <div className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                          Rendu d&apos;espèces à la caisse
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Saisie du montant reçu et du rendu avant validation (désactiver pour valider directement).
                        </p>
                      </div>
                      <label className="flex shrink-0 cursor-pointer items-center gap-3">
                        <span className="text-xs font-bold text-[var(--text-h)]">{cashRenduEnabled ? 'Activé' : 'Désactivé'}</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={cashRenduEnabled}
                            onChange={(e) => {
                              const next = e.target.checked
                              const prev = cashRenduEnabled
                              setCashRenduEnabled(next)
                              void (async () => {
                                const ok = await saveTicketShopSettings(ticketDraftLabel, ticketDraftPhone)
                                if (!ok) setCashRenduEnabled(prev)
                              })()
                            }}
                          />
                          <div className="h-7 w-12 rounded-full border border-[var(--border)] bg-[var(--card)] peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] transition-colors" />
                          <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-[var(--muted)] transition-transform peer-checked:translate-x-5 peer-checked:bg-[#4d2600]" />
                        </div>
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                          Clavier tactile YOBO
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Désactive pour utiliser uniquement le clavier système (physique ou OS).
                        </p>
                      </div>
                      <label className="flex shrink-0 cursor-pointer items-center gap-3">
                        <span className="text-xs font-bold text-[var(--text-h)]">
                          {virtualKeyboardEnabled ? 'Activé' : 'Désactivé'}
                        </span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={virtualKeyboardEnabled}
                            onChange={(e) => {
                              const next = e.target.checked
                              const prev = virtualKeyboardEnabled
                              setVirtualKeyboardEnabled(next)
                              void (async () => {
                                const ok = await saveTicketShopSettings(ticketDraftLabel, ticketDraftPhone)
                                if (!ok) setVirtualKeyboardEnabled(prev)
                              })()
                            }}
                          />
                          <div className="h-7 w-12 rounded-full border border-[var(--border)] bg-[var(--card)] peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] transition-colors" />
                          <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-[var(--muted)] transition-transform peer-checked:translate-x-5 peer-checked:bg-[#4d2600]" />
                        </div>
                      </label>
                    </div>
                  </div>
                </ProfilCollapsibleCard>
              )}
            </div>
          )}

          {activeSection === 'establishment' && showEstablishmentNav && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {isGerant && isTauriRuntime() && (
                <ProfilCollapsibleCard
                  title="Mise à jour du système"
                  icon={<span className="material-symbols-outlined text-[18px] text-[var(--accent)]">system_update</span>}
                  open={profilCardOpen.estUpdater}
                  onToggle={() => toggleProfilCard('estUpdater')}
                >
                  <div className="p-6">
                    <YoboUpdater />
                  </div>
                </ProfilCollapsibleCard>
              )}

              {isGerant && isTauriRuntime() && (
                <ProfilCollapsibleCard
                  title="Tickets & imprimantes"
                  icon={<span className="material-symbols-outlined text-[18px] text-[var(--accent)]">print</span>}
                  open={profilCardOpen.estTickets}
                  onToggle={() => toggleProfilCard('estTickets')}
                >
                  <div className="p-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">En-tête Ticket</label>
                        <YoboAlphaInput
                          className="yobo-input mt-1.5 w-full font-bold"
                          value={ticketDraftLabel}
                          onValueChange={setTicketDraftLabel}
                          placeholder="Ex: YOBO SNACK"
                          keyboardMaxLength={80}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Téléphone</label>
                        <YoboNumericInput
                          className="yobo-input mt-1.5 w-full font-bold text-center"
                          variant="pin"
                          maskPin={false}
                          keyboardMaxLen={10}
                          value={ticketDraftPhone}
                          onValueChange={(v) => setTicketDraftPhone(v.replace(/\D/g, '').slice(0, 10))}
                          placeholder="06..."
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
                      <div className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] opacity-50 text-center">Routage des impressions</div>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase text-[var(--text-h)]">Imprimante A (Client)</label>
                          <select className="yobo-input w-full font-bold" value={ticketPrinterA} onChange={(e) => setTicketPrinterA(e.target.value)}>
                            <option value="">— Désactivée</option>
                            {printers.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          {ticketPrinterA.trim() && (
                            <button onClick={() => void testPrinter(ticketPrinterA)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-[10px] font-black uppercase text-[var(--muted)] transition hover:text-[var(--accent)] hover:border-[var(--accent)]">
                              <span className="material-symbols-outlined text-[14px]">play_arrow</span> Tester A
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase text-[var(--text-h)]">Imprimante B (Cuisine)</label>
                          <select className="yobo-input w-full font-bold" value={ticketPrinterB} onChange={(e) => setTicketPrinterB(e.target.value)}>
                            <option value="">— Désactivée</option>
                            {printers.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          {ticketPrinterB.trim() && (
                            <button onClick={() => void testPrinter(ticketPrinterB)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-[10px] font-black uppercase text-[var(--muted)] transition hover:text-[var(--accent)] hover:border-[var(--accent)]">
                              <span className="material-symbols-outlined text-[14px]">play_arrow</span> Tester B
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-container)] px-6 text-xs font-black text-[#4d2600] shadow-lg shadow-[var(--accent)]/10 transition hover:brightness-110"
                        onClick={() => {
                          setTicketSaving(true)
                          void (async () => {
                            try { await saveTicketShopSettings(ticketDraftLabel, ticketDraftPhone) } finally { setTicketSaving(false) }
                          })()
                        }}
                        disabled={ticketSaving}
                      >
                        {ticketSaving ? <SpinnerIcon size={14} /> : <span className="material-symbols-outlined text-[18px]">save</span>}
                        Enregistrer les paramètres
                      </button>
                    </div>
                  </div>
                </ProfilCollapsibleCard>
              )}

              {isGerant && isTauriRuntime() && userId !== null && (
                <ProfilCollapsibleCard
                  title="Données & Maintenance"
                  icon={<span className="material-symbols-outlined text-[18px] text-[var(--accent)]">database</span>}
                  open={profilCardOpen.estData}
                  onToggle={() => toggleProfilCard('estData')}
                >
                  <div className="p-6 space-y-6">
                    {/* Backup Buttons */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <button
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]/50 group"
                        onClick={() => {
                          setDbBusy('backup')
                          void (async () => {
                            try {
                              await invoke<string>('database_save_backup_dialog', { userId })
                              pushToast('success', client.success.dbBackupSaved)
                            } catch (e) {
                              logDevError('database_save_backup_dialog', e)
                              const msg = userFacingErrorMessage(e, client.error.dbBackup)
                              if (!/annulé/i.test(msg)) pushToast('error', msg)
                            } finally { setDbBusy(null) }
                          })()
                        }}
                        disabled={dbBusy !== null}
                      >
                        <span className="material-symbols-outlined text-2xl text-[var(--accent)] group-hover:scale-110 transition-transform">cloud_upload</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-center">Exporter DB</span>
                      </button>

                      <button
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]/50 group"
                        onClick={() => {
                          setDbBusy('backup')
                          void (async () => {
                            try {
                              const out = await createBackupNow(userId)
                              pushToast('success', `Backup créé: ${out}`)
                            } catch (e) {
                              logDevError('backups_create_now', e)
                              pushToast('error', userFacingErrorMessage(e, client.error.dbBackup))
                            } finally { setDbBusy(null) }
                          })()
                        }}
                        disabled={dbBusy !== null}
                      >
                        <span className="material-symbols-outlined text-2xl text-[var(--accent)] group-hover:scale-110 transition-transform">history</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-center">Auto Backup</span>
                      </button>

                      <button
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]/50 group"
                        onClick={() => {
                          setDbBusy('restore')
                          void (async () => {
                            try {
                              await invoke('database_restore_pick_dialog', { userId })
                              pushToast('success', client.success.dbRestoreDone)
                            } catch (e) {
                              logDevError('database_restore_pick_dialog', e)
                              const msg = userFacingErrorMessage(e, client.error.dbRestore)
                              if (!/annulé/i.test(msg)) pushToast('error', msg)
                            } finally { setDbBusy(null) }
                          })()
                        }}
                        disabled={dbBusy !== null}
                      >
                        <span className="material-symbols-outlined text-2xl text-[var(--accent)] group-hover:scale-110 transition-transform">restore</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] text-center">Restaurer</span>
                      </button>
                    </div>

                    {/* Purge Section (Alert Style) */}
                    <div className="rounded-2xl bg-[color-mix(in_oklab,var(--danger)_5%,transparent)] p-5 ring-1 ring-[color-mix(in_oklab,var(--danger)_20%,transparent)]">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--danger)]">
                        <span className="material-symbols-outlined text-[18px]">warning</span>
                        Zone de Danger
                      </div>
                      {!dbPurgePinVerified ? (
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-[var(--muted)]">Confirmer avec votre PIN</label>
                            <YoboNumericInput
                              className="yobo-input mt-1 w-full text-center tracking-[0.3em] font-black"
                              variant="pin"
                              keyboardMaxLen={6}
                              value={dbPurgePin}
                              onValueChange={(v) => setDbPurgePin(v.replace(/\D/g, '').slice(0, 6))}
                              placeholder="••••"
                            />
                          </div>
                          <button
                            className="h-11 rounded-xl bg-[var(--danger)] px-6 text-xs font-black text-white hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--danger)]/20"
                            onClick={() => {
                              const pin = dbPurgePin.trim().replace(/\D/g, '')
                              if (pin.length < 4 || pin.length > 6) { pushToast('error', client.val.pinLength); return; }
                              setDbPurgeBusy(true)
                              void (async () => {
                                try {
                                  await invoke('verify_user_pin', { role: 'gerant', userId, pin })
                                  setDbPurgePinVerified(true)
                                  setDbPurgeWord('')
                                } catch (e) { pushToast('error', userFacingErrorMessage(e, client.error.profileWrongPin)) } finally { setDbPurgeBusy(false) }
                              })()
                            }}
                            disabled={dbPurgeBusy}
                          >
                            {dbPurgeBusy ? <SpinnerIcon size={14} /> : <span className="material-symbols-outlined text-[16px]">lock_open</span>}
                            Déverrouiller
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {(
                              [
                                { key: 'orders' as const, label: 'Commandes' },
                                { key: 'logs' as const, label: 'Journaux' },
                                { key: 'cashSessions' as const, label: 'Sessions' },
                                { key: 'caissiers' as const, label: 'Caissiers' },
                                { key: 'catalogDelete' as const, label: 'Menu Complet' },
                              ] as const
                            ).map(opt => (
                              <label key={opt.key} className="flex items-center gap-3 p-3 rounded-xl border border-red-500/10 bg-white/5 cursor-pointer hover:bg-red-500/10 transition-colors">
                                <input
                                  type="checkbox"
                                  className="accent-[var(--danger)] rounded"
                                  checked={dbPurgeSelection[opt.key]}
                                  onChange={e => setDbPurgeSelection(s => ({ ...s, [opt.key]: e.target.checked }))}
                                />
                                <span className="text-xs font-black text-[var(--text-h)]">{opt.label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[var(--danger)]">Tapez &quot;supprimer&quot; pour valider l&apos;effacement définitif</label>
                            <YoboAlphaInput
                              className="yobo-input w-full border-[color-mix(in_oklab,var(--danger)_30%,transparent)] text-center font-black"
                              value={dbPurgeWord}
                              onValueChange={setDbPurgeWord}
                              placeholder="supprimer"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setDbPurgePinVerified(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-[var(--muted)]">Annuler</button>
                            <button
                              className="flex-[2] py-3 rounded-xl bg-[var(--danger)] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[var(--danger)]/20"
                              onClick={() => {
                                const noneSelected = !dbPurgeSelection.orders && !dbPurgeSelection.logs && !dbPurgeSelection.cashSessions && !dbPurgeSelection.caissiers && !dbPurgeSelection.catalogDelete
                                if (noneSelected) { pushToast('error', 'Sélectionnez au moins un élément.'); return; }
                                if (dbPurgeWord !== 'supprimer') { pushToast('error', 'Veuillez taper le mot de confirmation.'); return; }
                                setDbPurgeBusy(true)
                                void (async () => {
                                  try {
                                    await invoke('database_purge_selected_data', { userId, pin: dbPurgePin, confirmationWord: dbPurgeWord, selection: dbPurgeSelection })
                                    setDbPurgePinVerified(false); setDbPurgePin(''); setDbPurgeWord('');
                                    setCashSession(null); clearCart();
                                    await Promise.all([loadCatalog(), loadCaissiers(), loadTicketSettings(), loadOrders(userId)])
                                    pushToast('success', client.success.dbPurgeDone)
                                  } catch (e) { pushToast('error', userFacingErrorMessage(e, client.error.dbPurge)) } finally { setDbPurgeBusy(false) }
                                })()
                              }}
                            >
                              Effacer Définitivement
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </ProfilCollapsibleCard>
              )}

            </div>
          )}
        </main>
      </div>

    </>
  )
}
