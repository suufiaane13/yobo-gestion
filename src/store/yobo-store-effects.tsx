import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import { YOBO_APP_MIN_LOGICAL_SIZE } from '../lib/yoboTauriWindowLayout'
import { toastTypeForStoreMessage } from '../lib/toastTypeForStoreMessage'
import { logDevError, userFacingErrorMessage } from '../lib/userFacingError'
import { client } from '../lib/yoboClientMessages'
import { MENU_ITEMS } from '../data/menuFallback'
import {
  filterClosedSessionsForHistorique,
  orderMatchesHistoriqueFilters,
} from '../lib/historiqueFilters'
import { clampPage, getTotalPages } from '../lib/pagination'
import { getSingleVariantEntry } from '../lib/productSizes'
import type {
  CashSessionClosedRow,
  CashSessionDto,
  OrderItem,
  Theme,
  ThemePreference,
  UserProfileDto,
} from '../types/yoboApp'
import { useYoboStore } from './yobo-store'

function applyYoboDocumentTheme(theme: Theme, themePreference: ThemePreference) {
  let resolved: Theme = theme
  if (themePreference === 'auto_hour') {
    const h = new Date().getHours()
    resolved = h >= 7 && h < 21 ? 'light' : 'dark'
  }
  document.documentElement.setAttribute('data-theme', resolved)
}

export function YoboStoreEffects() {
  const pushToast = useYoboStore((s) => s.pushToast)
  const error = useYoboStore((s) => s.error)
  const setError = useYoboStore((s) => s.setError)
  const authed = useYoboStore((s) => s.authed)
  const setCashRenduModalOpen = useYoboStore((s) => s.setCashRenduModalOpen)
  const tab = useYoboStore((s) => s.tab)
  const cartLength = useYoboStore((s) => s.cart.length)
  const role = useYoboStore((s) => s.role)
  const userId = useYoboStore((s) => s.userId)
  const setCashSession = useYoboStore((s) => s.setCashSession)
  const cashSession = useYoboStore((s) => s.cashSession)
  const setCashSessionLoading = useYoboStore((s) => s.setCashSessionLoading)
  const profileError = useYoboStore((s) => s.profileError)
  const setProfileError = useYoboStore((s) => s.setProfileError)
  const profileSuccess = useYoboStore((s) => s.profileSuccess)
  const setProfileSuccess = useYoboStore((s) => s.setProfileSuccess)
  const caissiersError = useYoboStore((s) => s.caissiersError)
  const setCaissiersError = useYoboStore((s) => s.setCaissiersError)
  const resetPinError = useYoboStore((s) => s.resetPinError)
  const setResetPinError = useYoboStore((s) => s.setResetPinError)
  const deactivateUserError = useYoboStore((s) => s.deactivateUserError)
  const setDeactivateUserError = useYoboStore((s) => s.setDeactivateUserError)
  const profileNameError = useYoboStore((s) => s.profileNameError)
  const setProfileNameError = useYoboStore((s) => s.setProfileNameError)
  const profileUserError = useYoboStore((s) => s.profileUserError)
  const setProfileUserError = useYoboStore((s) => s.setProfileUserError)
  const theme = useYoboStore((s) => s.theme)
  const themePreference = useYoboStore((s) => s.themePreference)
  const setProfileUserLoading = useYoboStore((s) => s.setProfileUserLoading)
  const setProfileUserProfile = useYoboStore((s) => s.setProfileUserProfile)
  const setProfileNameDraft = useYoboStore((s) => s.setProfileNameDraft)
  const setHistoryInnerTab = useYoboStore((s) => s.setHistoryInnerTab)
  const setHistorySessionFilter = useYoboStore((s) => s.setHistorySessionFilter)
  const setHistoryOrderStatusFilter = useYoboStore((s) => s.setHistoryOrderStatusFilter)
  const setHistoryOrderCashierFilter = useYoboStore((s) => s.setHistoryOrderCashierFilter)
  const setHistorySessionsLoading = useYoboStore((s) => s.setHistorySessionsLoading)
  const setHistoryClosedSessions = useYoboStore((s) => s.setHistoryClosedSessions)
  const loadCaissiers = useYoboStore((s) => s.loadCaissiers)
  const loadOrders = useYoboStore((s) => s.loadOrders)
  const refreshHistoryGerantOrders = useYoboStore((s) => s.refreshHistoryGerantOrders)
  const setNewCaissierTheme = useYoboStore((s) => s.setNewCaissierTheme)
  const ordersLength = useYoboStore((s) => (s.role === 'gerant' ? s.ordersTotalCount : s.orders.length))
  const dashboardOrdersPage = useYoboStore((s) => s.dashboardOrdersPage)
  const dashboardOrdersPageSize = useYoboStore((s) => s.dashboardOrdersPageSize)
  const setDashboardOrdersPage = useYoboStore((s) => s.setDashboardOrdersPage)
  const historySessionsPageSize = useYoboStore((s) => s.historySessionsPageSize)
  const setHistorySessionsPage = useYoboStore((s) => s.setHistorySessionsPage)
  const historyOrdersPageSize = useYoboStore((s) => s.historyOrdersPageSize)
  const setHistoryOrdersPage = useYoboStore((s) => s.setHistoryOrdersPage)
  const historySearch = useYoboStore((s) => s.historySearch)
  const historySessionFilter = useYoboStore((s) => s.historySessionFilter)
  const historyOrderStatusFilter = useYoboStore((s) => s.historyOrderStatusFilter)
  const historyOrderCashierFilter = useYoboStore((s) => s.historyOrderCashierFilter)
  const caissiersLength = useYoboStore((s) => s.caissiers.length)
  const caissiersPageSize = useYoboStore((s) => s.caissiersPageSize)
  const setCaissiersPage = useYoboStore((s) => s.setCaissiersPage)
  const selectedItem = useYoboStore((s) => s.selectedItem)
  const menuCatKey = useYoboStore((s) => s.menuCatKey)
  const menuCat = useYoboStore((s) => s.menuCat)
  const catalogItemsByCat = useYoboStore((s) => s.catalogItemsByCat)
  const setSelectedSize = useYoboStore((s) => s.setSelectedSize)
  const setPosModalQty = useYoboStore((s) => s.setPosModalQty)

  const historySessionsSlice = useYoboStore(
    useShallow((s) => ({
      role: s.role,
      historyClosedSessions: s.historyClosedSessions,
    })),
  )

  const historyClosedSessionsFilteredLength = useMemo(() => {
    return filterClosedSessionsForHistorique(
      historySessionsSlice.historyClosedSessions,
      'all',
      historySessionsSlice.role,
    ).length
  }, [historySessionsSlice])

  const historyInnerTab = useYoboStore((s) => s.historyInnerTab)
  const setHistoryGerantOrdersAll = useYoboStore((s) => s.setHistoryGerantOrdersAll)

  const ordersSlice = useYoboStore(
    useShallow((s) => ({
      orders: s.role === 'gerant' ? s.historyGerantOrdersAll : s.orders,
      historySearch: s.historySearch,
      historySessionFilter: s.historySessionFilter,
      historyOrderStatusFilter: s.historyOrderStatusFilter,
      historyOrderCashierFilter: s.historyOrderCashierFilter,
    })),
  )

  const historyOrdersFilteredLength = useMemo(() => {
    const opts = {
      sessionFilter: ordersSlice.historySessionFilter,
      search: ordersSlice.historySearch,
      statusFilter: ordersSlice.historyOrderStatusFilter,
      cashierFilter: ordersSlice.historyOrderCashierFilter,
    }
    return ordersSlice.orders.filter((o: OrderItem) => orderMatchesHistoriqueFilters(o, opts)).length
  }, [ordersSlice])

  const loadTicketSettings = useYoboStore((s) => s.loadTicketSettings)

  useEffect(() => {
    if (!isTauriRuntime()) return
    const html = document.documentElement
    html.setAttribute('data-yobo-desktop-shell', '')
    return () => html.removeAttribute('data-yobo-desktop-shell')
  }, [])

  useEffect(() => {
    applyYoboDocumentTheme(theme, themePreference)
    if (themePreference === 'auto_hour') {
      const reapply = () => {
        const { theme: t, themePreference: p } = useYoboStore.getState()
        applyYoboDocumentTheme(t, p)
      }

      // Windows/Tauri: après veille / app en arrière-plan, les timers peuvent être retardés.
      // On ré-applique aussi au retour de focus/visibilité.
      window.addEventListener('focus', reapply)
      document.addEventListener('visibilitychange', reapply)

      const id = window.setInterval(() => {
        reapply()
      }, 60_000)
      return () => {
        window.removeEventListener('focus', reapply)
        document.removeEventListener('visibilitychange', reapply)
        clearInterval(id)
      }
    }
  }, [theme, themePreference])

  /** Fenêtre Tauri : contraintes + plein écran au démarrage et après connexion (ré-applique si besoin). */
  useEffect(() => {
    if (!isTauriRuntime()) return
    const appWindow = getCurrentWindow()
    void (async () => {
      try {
        await appWindow.setResizable(true)
        await appWindow.setMaximizable(true)
        await appWindow.setMinimizable(true)
        await appWindow.setMinSize(
          new LogicalSize(YOBO_APP_MIN_LOGICAL_SIZE.width, YOBO_APP_MIN_LOGICAL_SIZE.height),
        )
        if (!(await appWindow.isFullscreen())) {
          await appWindow.setFullscreen(true)
        }
      } catch {
        /* permissions / plateforme */
      }
    })()
  }, [authed])

  useEffect(() => {
    if (!authed) return
    void loadTicketSettings()
  }, [authed, loadTicketSettings])

  useEffect(() => {
    if (!error) return
    pushToast(toastTypeForStoreMessage(error), error)
    setError(null)
  }, [error, pushToast, setError])

  useEffect(() => {
    if (!authed) setCashRenduModalOpen(false)
  }, [authed, setCashRenduModalOpen])

  useEffect(() => {
    if (tab !== 'caisse') setCashRenduModalOpen(false)
  }, [tab, setCashRenduModalOpen])

  useEffect(() => {
    if (cartLength === 0) setCashRenduModalOpen(false)
  }, [cartLength, setCashRenduModalOpen])

  useEffect(() => {
    if (!authed || userId === null) {
      setCashSession(null)
      setCashSessionLoading(false)
      return
    }
    let cancelled = false
    setCashSessionLoading(true)
    void (async () => {
      try {
        let sess = await invoke<CashSessionDto | null>('cash_session_current', { userId })
        if (!sess) {
          sess = await invoke<CashSessionDto | null>('cash_session_current_any', {})
        }
        if (!cancelled) setCashSession(sess ?? null)
      } catch (e) {
        logDevError('cash_session_current', e)
        if (!cancelled) {
          setCashSession(null)
          pushToast('error', userFacingErrorMessage(e, client.error.loadCashState))
        }
      } finally {
        if (!cancelled) setCashSessionLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authed, userId, pushToast, setCashSession, setCashSessionLoading])

  useEffect(() => {
    if (!profileError) return
    pushToast(toastTypeForStoreMessage(profileError), profileError)
    setProfileError(null)
  }, [profileError, pushToast, setProfileError])

  useEffect(() => {
    if (!profileSuccess) return
    pushToast('success', profileSuccess)
    setProfileSuccess(null)
  }, [profileSuccess, pushToast, setProfileSuccess])

  useEffect(() => {
    if (!caissiersError) return
    pushToast(toastTypeForStoreMessage(caissiersError), caissiersError)
    setCaissiersError(null)
  }, [caissiersError, pushToast, setCaissiersError])

  useEffect(() => {
    if (!resetPinError) return
    pushToast(toastTypeForStoreMessage(resetPinError), resetPinError)
    setResetPinError(null)
  }, [resetPinError, pushToast, setResetPinError])

  useEffect(() => {
    if (!deactivateUserError) return
    pushToast(toastTypeForStoreMessage(deactivateUserError), deactivateUserError)
    setDeactivateUserError(null)
  }, [deactivateUserError, pushToast, setDeactivateUserError])

  useEffect(() => {
    if (!profileNameError) return
    pushToast(toastTypeForStoreMessage(profileNameError), profileNameError)
    setProfileNameError(null)
  }, [profileNameError, pushToast, setProfileNameError])

  useEffect(() => {
    if (!profileUserError) return
    pushToast(toastTypeForStoreMessage(profileUserError), profileUserError)
    setProfileUserError(null)
  }, [profileUserError, pushToast, setProfileUserError])

  useEffect(() => {
    if (!authed) return
    if (tab !== 'profil') return
    if (userId === null) return

    void (async () => {
      try {
        setProfileUserError(null)
        setProfileUserLoading(true)
        setProfileUserProfile(null)
        const res = await invoke<UserProfileDto>('get_user_profile', {
          role,
          userId,
        })
        setProfileUserProfile(res)
        setProfileNameDraft(res.name)
      } catch (e) {
        logDevError('get_user_profile', e)
        setProfileUserError(userFacingErrorMessage(e, client.error.loadProfile))
      } finally {
        setProfileUserLoading(false)
      }
    })()
  }, [
    authed,
    tab,
    role,
    userId,
    setProfileUserError,
    setProfileUserLoading,
    setProfileUserProfile,
    setProfileNameDraft,
  ])

  useEffect(() => {
    if (!authed || userId === null) {
      setHistoryGerantOrdersAll([])
      return
    }
    if (tab !== 'historique' || role !== 'gerant') {
      setHistoryGerantOrdersAll([])
      return
    }
    if (historyInnerTab !== 'orders') {
      setHistoryGerantOrdersAll([])
      return
    }
    void refreshHistoryGerantOrders()
  }, [authed, tab, role, userId, historyInnerTab, refreshHistoryGerantOrders, setHistoryGerantOrdersAll])

  useEffect(() => {
    if (!authed || userId === null || role !== 'gerant') return
    void loadOrders(userId)
  }, [authed, userId, role, dashboardOrdersPage, dashboardOrdersPageSize, loadOrders])

  useEffect(() => {
    if (!authed || tab !== 'historique' || userId === null) return
    let cancelled = false
    setHistoryInnerTab(role === 'caissier' ? 'orders' : 'sessions')
    setHistorySessionFilter('all')
    setHistoryOrderStatusFilter('all')
    setHistoryOrderCashierFilter('')
    setHistorySessionsLoading(true)
    void (async () => {
      try {
        const rows = await invoke<CashSessionClosedRow[]>('cash_sessions_list_closed', {
          userId,
        })
        if (!cancelled) setHistoryClosedSessions(Array.isArray(rows) ? rows : [])
      } catch (e) {
        logDevError('cash_sessions_list_closed', e)
        if (!cancelled) {
          setHistoryClosedSessions([])
          pushToast('error', userFacingErrorMessage(e, client.error.loadHistorySessions))
        }
      } finally {
        if (!cancelled) setHistorySessionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    authed,
    tab,
    role,
    userId,
    setHistoryInnerTab,
    setHistorySessionFilter,
    setHistoryOrderStatusFilter,
    setHistoryOrderCashierFilter,
    setHistorySessionsLoading,
    setHistoryClosedSessions,
    pushToast,
  ])

  /** Caissier sur le tableau de bord : liste des sessions fermées pour le KPI « CA » (dernière session si caisse fermée), sans toucher au chargement de l’onglet Historique. */
  useEffect(() => {
    if (!authed || userId === null || role !== 'caissier' || tab !== 'dashboard') return
    let cancelled = false
    void (async () => {
      try {
        const rows = await invoke<CashSessionClosedRow[]>('cash_sessions_list_closed', {
          userId,
        })
        if (!cancelled) setHistoryClosedSessions(Array.isArray(rows) ? rows : [])
      } catch (e) {
        logDevError('cash_sessions_list_closed_dashboard', e)
        if (!cancelled) setHistoryClosedSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authed, userId, role, tab, cashSession?.id, setHistoryClosedSessions])

  useEffect(() => {
    if (!authed || tab !== 'utilisateurs' || role !== 'gerant' || userId === null) return
    setNewCaissierTheme('dark')
    void loadCaissiers()
  }, [authed, tab, role, userId, theme, setNewCaissierTheme, loadCaissiers])

  useEffect(() => {
    const tp = getTotalPages(ordersLength, dashboardOrdersPageSize)
    setDashboardOrdersPage((p) => clampPage(p, tp))
  }, [ordersLength, dashboardOrdersPageSize, setDashboardOrdersPage])

  useEffect(() => {
    const tp = getTotalPages(historyClosedSessionsFilteredLength, historySessionsPageSize)
    setHistorySessionsPage((p) => clampPage(p, tp))
  }, [historyClosedSessionsFilteredLength, historySessionsPageSize, setHistorySessionsPage])

  useEffect(() => {
    const tp = getTotalPages(historyOrdersFilteredLength, historyOrdersPageSize)
    setHistoryOrdersPage((p) => clampPage(p, tp))
  }, [historyOrdersFilteredLength, historyOrdersPageSize, setHistoryOrdersPage])

  useEffect(() => {
    setHistoryOrdersPage(1)
  }, [
    historySearch,
    historySessionFilter,
    historyOrderStatusFilter,
    historyOrderCashierFilter,
    setHistoryOrdersPage,
  ])

  useEffect(() => {
    const tp = getTotalPages(caissiersLength, caissiersPageSize)
    setCaissiersPage((p) => clampPage(p, tp))
  }, [caissiersLength, caissiersPageSize, setCaissiersPage])

  const hasCatalog = Object.keys(catalogItemsByCat).length > 0

  useEffect(() => {
    if (tab !== 'caisse' || selectedItem === null) return
    const list = hasCatalog ? (catalogItemsByCat[menuCatKey] ?? []) : MENU_ITEMS[menuCat]
    const item = list[selectedItem]
    if (!item) return
    setPosModalQty(1)
    const one = getSingleVariantEntry(item.sizes)
    setSelectedSize(one ? one[0] : null)
  }, [tab, selectedItem, menuCatKey, menuCat, hasCatalog, catalogItemsByCat, setPosModalQty, setSelectedSize])

  return null
}
