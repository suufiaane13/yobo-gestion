import { useMemo } from 'react'
import { YoboAppContextMenu } from './components/YoboAppContextMenu'
import { YoboAppNavBar } from './components/YoboAppNavBar'
import { YoboAppModals } from './components/YoboAppModals'
import { YoboTitleBar } from './components/YoboTitleBar'
import { isTauriRuntime } from './lib/isTauriRuntime'
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
import { useYoboStore, YoboStoreEffects } from './store'

export default function App() {
  const authed = useYoboStore((s) => s.authed)
  const obscureLoginShell = useYoboObscureLoginShell(authed)
  const tab = useYoboStore((s) => s.tab)
  const role = useYoboStore((s) => s.role)
  const identifier = useYoboStore((s) => s.identifier)
  const theme = useYoboStore((s) => s.theme)
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
          theme={theme}
          themeToggleEnabled={themePreference === 'manual'}
          authed={authed}
          onToggleTheme={toggleTheme}
          onLogout={requestLogout}
          onCloseRequest={() => setExitConfirmOpen(true)}
        />
      ) : null}
      <YoboToastStack />
      <div
        className={
          isDesktopShell
            ? `flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${authed ? 'flex-row' : 'flex-col'}`
            : 'flex min-h-0 flex-1 flex-col'
        }
      >
        {/* Réserve l’espace de la sidebar fixe (w-64) pour que le contenu ne soit jamais sous la barre */}
        {authed && isDesktopShell ? (
          <div className="w-64 shrink-0 bg-transparent" aria-hidden />
        ) : null}
        <div
          className={`flex min-h-0 flex-1 flex-col text-[var(--text-h)] ${
            authed
              ? isDesktopShell
                ? 'min-w-0 pr-6 pt-6 pb-12 xl:pr-8'
                : 'p-6 pb-12'
              : 'min-h-0 min-w-0 flex-1 flex-col p-0'
          }`}
        >
          {!authed ? (
            <LoginPage />
          ) : (
            <div
              className={
                isDesktopShell
                  ? 'min-w-0 w-full pl-4 sm:pl-6 pb-12 md:pb-16'
                  : 'mx-auto w-full max-w-6xl pb-12 md:pb-16'
              }
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
          )}
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
