import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { YoboAppContextMenu } from './components/YoboAppContextMenu'
import { YoboAppNavBar } from './components/YoboAppNavBar'
import { YoboAppModals } from './components/YoboAppModals'
import { YoboTitleBar } from './components/YoboTitleBar'
import { isTauriRuntime } from './lib/isTauriRuntime'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { YoboToastStack } from './components/YoboToastStack'
import { capitalizeFirstLetter } from './lib/yoboStrings'
import { CaissePage } from './pages/CaissePage'
import { DashboardPage } from './pages/DashboardPage'
import { HistoriquePage } from './pages/HistoriquePage'
import { LoginPage } from './pages/LoginPage'
import { LogsPage } from './pages/LogsPage'
import { MenuPage } from './pages/MenuPage'
import { ProfilPage } from './pages/ProfilPage'
import { UtilisateursPage } from './pages/UtilisateursPage'
import { QrPage } from './pages/QrPage'
import { useYoboObscureLoginShell } from './hooks/useYoboObscureLoginShell'
import { YoboProfilWelcomeGate } from './components/YoboProfilWelcomeModal'
import { YoboSessionEntrySplash } from './components/YoboSessionEntrySplash'
import { useYoboStore, YoboStoreEffects } from './store'

/** Durée du fondu écran login → splash logo (ms) — alignée sur `.login-shell-exit-layer` */
const LOGIN_SHELL_EXIT_MS = 320

type LoginShellPhase = 'gate' | 'exiting' | 'done'

export default function App() {
  const authed = useYoboStore((s) => s.authed)
  const logoutFadePending = useYoboStore((s) => s.logoutFadePending)
  const [loginShellPhase, setLoginShellPhase] = useState<LoginShellPhase>('gate')

  useEffect(() => {
    if (!logoutFadePending || !authed) return
    const t = window.setTimeout(() => {
      useYoboStore.getState().logout()
    }, LOGIN_SHELL_EXIT_MS)
    return () => window.clearTimeout(t)
  }, [logoutFadePending, authed])

  useEffect(() => {
    if (!authed) setLoginShellPhase('gate')
  }, [authed])

  useLayoutEffect(() => {
    if (!authed || loginShellPhase !== 'gate') return
    setLoginShellPhase('exiting')
  }, [authed, loginShellPhase])

  useEffect(() => {
    if (loginShellPhase !== 'exiting') return
    const t = window.setTimeout(() => setLoginShellPhase('done'), LOGIN_SHELL_EXIT_MS)
    return () => window.clearTimeout(t)
  }, [loginShellPhase])

  const appShellReady = authed && loginShellPhase === 'done'
  const showLoginShell = !authed || loginShellPhase !== 'done'
  const userId = useYoboStore((s) => s.userId)
  const obscureLoginShell = useYoboObscureLoginShell(authed)
  const tab = useYoboStore((s) => s.tab)
  const role = useYoboStore((s) => s.role)
  const identifier = useYoboStore((s) => s.identifier)
  const theme = useYoboStore((s) => s.theme)
  const avatar = useYoboStore((s) => s.avatar)
  const themePreference = useYoboStore((s) => s.themePreference)
  const toggleTheme = useYoboStore((s) => s.toggleTheme)
  const requestLogout = useYoboStore((s) => s.requestLogout)
  const setExitConfirmOpen = useYoboStore((s) => s.setExitConfirmOpen)

  const title = useMemo(() => {
    if (tab === 'dashboard') return 'Accueil'
    if (tab === 'caisse') return 'Caisse des ventes'
    if (tab === 'menu') return 'Gestion du menu'
    if (tab === 'historique') return 'Historique des ventes'
    if (tab === 'qr') return 'QR'
    if (tab === 'logs') return 'Journaux & diagnostic'
    if (tab === 'profil') return 'Profil'
    return 'Gestion utilisateurs'
  }, [tab])

  const isDesktopShell = isTauriRuntime()
  const titleBarIdentifier =
    identifier.trim().length > 0 ? capitalizeFirstLetter(identifier) : '—'

  return (
    <div
      className={`flex flex-col bg-[var(--bg)] ${
        isDesktopShell
          ? 'h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden'
          : 'min-h-[100dvh] min-h-[100svh]'
      }`}
    >
      <YoboStoreEffects />
      {isDesktopShell ? (
        <YoboTitleBar
          badgeText={titleBarIdentifier}
          badgeKind={role === 'gerant' ? 'gerant' : 'caissier'}
          avatar={avatar}
          theme={theme}
          themeToggleEnabled={themePreference === 'manual'}
          authed={authed}
          onToggleTheme={toggleTheme}
          onLogout={requestLogout}
          onCloseRequest={() => {
            if (authed) {
              setExitConfirmOpen(true)
            } else {
              void getCurrentWindow().close()
            }
          }}
        />
      ) : null}
      <YoboToastStack />
      {authed ? <YoboSessionEntrySplash /> : null}
      {authed ? <YoboProfilWelcomeGate key={userId ?? 'u'} /> : null}
      <div
        className={
          isDesktopShell
            ? `flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${appShellReady ? 'flex-row' : 'flex-col'}`
            : 'flex min-h-0 flex-1 flex-col'
        }
      >
        {/* Réserve l’espace de la sidebar fixe (w-64) pour que le contenu ne soit jamais sous la barre */}
        {appShellReady && isDesktopShell ? (
          <div className="w-64 shrink-0 bg-transparent" aria-hidden />
        ) : null}
        <div
          className={`flex min-h-0 flex-1 flex-col text-[var(--text-h)] ${
            appShellReady
              ? isDesktopShell
                ? 'min-w-0 pr-6 pt-6 pb-12 xl:pr-8'
                : 'p-6 pb-12'
              : 'min-h-0 min-w-0 flex-1 flex-col p-0'
          }`}
        >
          {showLoginShell ? (
            <div
              className={
                loginShellPhase === 'exiting'
                  ? 'login-shell-exit-layer flex min-h-0 min-w-0 flex-1 flex-col'
                  : 'min-h-0 min-w-0 flex flex-1 flex-col p-0'
              }
            >
              <LoginPage />
            </div>
          ) : null}
          {appShellReady ? (
            <div
              className={`${
                isDesktopShell
                  ? 'min-w-0 w-full pl-4 sm:pl-6 pb-12 md:pb-16'
                  : 'mx-auto w-full max-w-6xl pb-12 md:pb-16'
              }${logoutFadePending ? ' yobo-app-logout-fade' : ''}`}
            >
              <YoboAppNavBar />
              <div className="mb-4 text-sm uppercase tracking-wide text-[var(--muted)]">{title}</div>

              {tab === 'dashboard' ? <DashboardPage /> : null}
              {tab === 'caisse' ? <CaissePage /> : null}
              {tab === 'historique' ? <HistoriquePage /> : null}
              {tab === 'menu' ? <MenuPage /> : null}
              {tab === 'qr' && role === 'gerant' ? <QrPage /> : null}
              {tab === 'logs' && role === 'gerant' ? <LogsPage /> : null}
              {tab === 'profil' ? <ProfilPage /> : null}
              {tab !== 'dashboard' &&
              tab !== 'caisse' &&
              tab !== 'historique' &&
              tab !== 'menu' &&
              tab !== 'qr' &&
              tab !== 'logs' &&
              tab !== 'profil' ? (
                <UtilisateursPage />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {authed ? <YoboAppModals /> : null}
      {obscureLoginShell ? (
        <div className="yobo-login-privacy-veil" aria-hidden role="presentation" />
      ) : null}
      <YoboAppContextMenu />
    </div>
  )
}
