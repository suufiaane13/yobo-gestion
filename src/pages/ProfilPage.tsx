import { useEffect, useState } from 'react'
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
  const [activeSection, setActiveSection] = useState<'profil' | 'settings'>('profil')
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
  const isGerant = role === 'gerant'

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.4)] ring-1 ring-[var(--border)]">
            {/* User Preview Header */}
            <div className="border-b border-[var(--border)] bg-[var(--surface)] p-6 text-center">
              <div className="mx-auto mb-3 flex items-center justify-center">
                {profileUserProfile?.avatar ? (
                  <YoboAvatarDisplay id={profileUserProfile.avatar} size="lg" className="ring-4 ring-[var(--card)]" />
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
            <nav className="p-2">
              <button
                onClick={() => setActiveSection('profil')}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black transition-all ${activeSection === 'profil' ? 'bg-[var(--accent)] text-[#4d2600] shadow-md' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text-h)]'}`}
              >
                <span className="material-symbols-outlined text-[20px]">account_circle</span>
                Mon Profil
              </button>
              <button
                onClick={() => setActiveSection('settings')}
                className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black transition-all ${activeSection === 'settings' ? 'bg-[var(--accent)] text-[#4d2600] shadow-md' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text-h)]'}`}
              >
                <span className="material-symbols-outlined text-[20px]">settings</span>
                Réglages App
              </button>
            </nav>
          </div>

          {/* Support/Info box */}
          <div className="mt-4 p-4 text-center text-[10px] font-bold text-[var(--muted)] opacity-50">
            YOBO {appVersion ? `v${appVersion}` : ''}<br />Design & Performance
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="min-w-0 flex-1 space-y-6">
          {activeSection === 'profil' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* PERSONAL INFO CARD */}
              <section className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.5)] ring-1 ring-[var(--border)]">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-h)]">
                    <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">badge</span>
                    Informations personnelles
                  </h3>
                </div>
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

                      {/* AVATAR PICKER SECTION */}
                      <div className="border-t border-[var(--border)] border-dashed pt-6">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Choisir un avatar</label>
                        <div className="mt-4">
                          <YoboAvatarPicker />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <span className="text-xs font-bold text-[var(--muted)]">Le changement de nom est réservé au gérant.</span>
                      </div>
                      
                      <div className="border-t border-[var(--border)] border-dashed pt-6">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Choisir un avatar</label>
                        <div className="mt-4">
                          <YoboAvatarPicker />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* SECURITY CARD */}
              <section className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.5)] ring-1 ring-[var(--border)]">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-h)]">
                    <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">lock_reset</span>
                    Sécurité & Code PIN
                  </h3>
                </div>
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
              </section>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* DISPLAY SETTINGS */}
              <section className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.5)] ring-1 ring-[var(--border)]">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-h)]">
                    <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">palette</span>
                    Apparence & Interface
                  </h3>
                </div>
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
              </section>

              {/* UPDATER SECTION (Gerant Only) */}
              {isGerant && isTauriRuntime() && (
                <section className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.5)] ring-1 ring-[var(--border)]">
                  <div className="border-b border-[var(--border)] px-6 py-4">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-h)]">
                      <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">system_update</span>
                      Mise à jour du système
                    </h3>
                  </div>
                  <div className="p-6">
                    <YoboUpdater />
                  </div>
                </section>
              )}

              {/* PRINTER SETTINGS (Gerant Only in layout but logic handled) */}
              {isGerant && isTauriRuntime() && (
                <section className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.5)] ring-1 ring-[var(--border)]">
                  <div className="border-b border-[var(--border)] px-6 py-4">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-h)]">
                      <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">print</span>
                      Configuration Imprimantes
                    </h3>
                  </div>
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
                </section>
              )}

              {/* DATA & BACKUP (Gerant Only) */}
              {isGerant && isTauriRuntime() && userId !== null && (
                <section className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.5)] ring-1 ring-[var(--border)]">
                  <div className="border-b border-[var(--border)] px-6 py-4">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-h)]">
                      <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">database</span>
                      Données & Maintenance
                    </h3>
                  </div>
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
                    <div className="rounded-2xl bg-red-500/5 p-5 ring-1 ring-red-500/20">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500">
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
                            className="h-11 rounded-xl bg-red-500 px-6 text-xs font-black text-white hover:brightness-110 transition-all flex items-center justify-center gap-2"
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
                                  className="accent-red-500 rounded"
                                  checked={dbPurgeSelection[opt.key]}
                                  onChange={e => setDbPurgeSelection(s => ({ ...s, [opt.key]: e.target.checked }))}
                                />
                                <span className="text-xs font-black text-[var(--text-h)]">{opt.label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-red-500">Tapez "supprimer" pour valider l'effacement définitif</label>
                            <YoboAlphaInput
                              className="yobo-input w-full border-red-500/30 text-center font-black"
                              value={dbPurgeWord}
                              onValueChange={setDbPurgeWord}
                              placeholder="supprimer"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setDbPurgePinVerified(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-[var(--muted)]">Annuler</button>
                            <button
                              className="flex-[2] py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20"
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
                </section>
              )}

            </div>
          )}
        </main>
      </div>

    </>
  )
}
