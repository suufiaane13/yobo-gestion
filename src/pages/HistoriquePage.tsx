import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useShallow } from 'zustand/shallow'
import { YoboAlphaInput } from '../components/YoboKeyboardInputs'
import { YoboPagination } from '../components/YoboPagination'
import {
  capitalizeFirstLetter,
  orderCountsTowardRevenue,
  orderStatusLabelFr,
  exportHistoriqueCommandesCsv,
  exportHistoriqueCommandesPdfHtmlFile,
  exportHistoriqueCommandesPdfPrint,
  exportHistoriqueSessionsCsv,
  exportHistoriqueSessionsPdfHtmlFile,
  exportHistoriqueSessionsPdfPrint,
  formatHeureFr,
  formatHeureSeuleFr,
  formatSessionCalendarDayFr,
  historiquePdfPrintUserError,
  isTauriRuntime,
  logDevError,
  orderTicketDetailsFromApi,
  printCashCloseTicket,
  printOrderTicket,
  ticketPrintUserError,
  userFacingErrorMessage,
  client,
  distinctCashierNamesFromOrders,
  filterClosedSessionsForHistorique,
  orderMatchesHistoriqueFilters,
  paginateSlice,
} from '../lib'
import { useYoboStore } from '../store'
import type {
  CashSessionOpenHistoriqueRow,
  OrderItem,
  OrderTicketPrintDto,
} from '../types/yoboApp'
import type { HistoryOrderStatusFilter } from '../lib/historiqueFilters'

const ORDER_STATUS_OPTIONS: { value: HistoryOrderStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'validated', label: 'Validées' },
  { value: 'cancelled', label: 'Annulées' },
]

/** Libellé KPI « nombre » : aligné sur les ventes (validées) sauf filtre Annulées. */
function historiqueOrderCountKpiLabel(statusFilter: HistoryOrderStatusFilter): string {
  return statusFilter === 'cancelled' ? 'Annulées' : 'Validées'
}

function orderTypeForThermal(
  ot: string | null | undefined,
): 'sur_place' | 'emporter' | 'livraison' | undefined {
  if (ot === 'sur_place' || ot === 'emporter' || ot === 'livraison') return ot
  return undefined
}

export function HistoriquePage() {
  const tab = useYoboStore((s) => s.tab)
  const role = useYoboStore((s) => s.role)
  const ordersStore = useYoboStore((s) => s.orders)
  const ordersLoadingStore = useYoboStore((s) => s.ordersLoading)
  const historyGerantOrdersAll = useYoboStore((s) => s.historyGerantOrdersAll)
  const historyGerantOrdersLoading = useYoboStore((s) => s.historyGerantOrdersLoading)
  const orders: OrderItem[] = role === 'gerant' ? historyGerantOrdersAll : ordersStore
  const ordersLoading = role === 'gerant' ? historyGerantOrdersLoading : ordersLoadingStore
  const pushToast = useYoboStore((s) => s.pushToast)
  const userId = useYoboStore((s) => s.userId)
  const ticketShopLabel = useYoboStore((s) => s.ticketShopLabel)
  const ticketShopPhone = useYoboStore((s) => s.ticketShopPhone)
  const {
    historySearch,
    setHistorySearch,
    historySessionFilter,
    setHistorySessionFilter,
    historyOrderStatusFilter,
    setHistoryOrderStatusFilter,
    historyOrderCashierFilter,
    setHistoryOrderCashierFilter,
    historyInnerTab,
    setHistoryInnerTab,
    historyClosedSessions,
    historySessionsLoading,
    setOrderDetailTarget,
    historySessionsPage,
    historySessionsPageSize,
    setHistorySessionsPage,
    setHistorySessionsPageSize,
    historyOrdersPage,
    historyOrdersPageSize,
    setHistoryOrdersPage,
    setHistoryOrdersPageSize,
  } = useYoboStore(
    useShallow((s) => ({
      historySearch: s.historySearch,
      setHistorySearch: s.setHistorySearch,
      historySessionFilter: s.historySessionFilter,
      setHistorySessionFilter: s.setHistorySessionFilter,
      historyOrderStatusFilter: s.historyOrderStatusFilter,
      setHistoryOrderStatusFilter: s.setHistoryOrderStatusFilter,
      historyOrderCashierFilter: s.historyOrderCashierFilter,
      setHistoryOrderCashierFilter: s.setHistoryOrderCashierFilter,
      historyInnerTab: s.historyInnerTab,
      setHistoryInnerTab: s.setHistoryInnerTab,
      historyClosedSessions: s.historyClosedSessions,
      historySessionsLoading: s.historySessionsLoading,
      setOrderDetailTarget: s.setOrderDetailTarget,
      historySessionsPage: s.historySessionsPage,
      historySessionsPageSize: s.historySessionsPageSize,
      setHistorySessionsPage: s.setHistorySessionsPage,
      setHistorySessionsPageSize: s.setHistorySessionsPageSize,
      historyOrdersPage: s.historyOrdersPage,
      historyOrdersPageSize: s.historyOrdersPageSize,
      setHistoryOrdersPage: s.setHistoryOrdersPage,
      setHistoryOrdersPageSize: s.setHistoryOrdersPageSize,
    })),
  )

  const [historyThermalPrintOrderId, setHistoryThermalPrintOrderId] = useState<number | null>(null)
  const [openSessionHistorique, setOpenSessionHistorique] = useState<CashSessionOpenHistoriqueRow | null>(null)
  const [activeSessionLoading, setActiveSessionLoading] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(true)

  useEffect(() => {
    if (role !== 'gerant' || userId === null || tab !== 'historique') {
      setOpenSessionHistorique(null)
      return
    }
    setActiveSessionLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const row = await invoke<CashSessionOpenHistoriqueRow | null>('cash_session_open_for_historique', {
          userId,
        })
        if (!cancelled) setOpenSessionHistorique(row ?? null)
      } catch (e) {
        logDevError('cash_session_open_for_historique', e)
        if (!cancelled) setOpenSessionHistorique(null)
      } finally {
        if (!cancelled) setActiveSessionLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, userId, tab, historyInnerTab])

  const historyHasFilters =
    historySearch.trim() !== '' ||
    historySessionFilter !== 'all' ||
    historyOrderStatusFilter !== 'all' ||
    historyOrderCashierFilter.trim() !== ''

  const historyClosedSessionsFiltered = useMemo(() => {
    return filterClosedSessionsForHistorique(historyClosedSessions, 'all', role)
  }, [historyClosedSessions, role])

  const historiqueCashierNames = useMemo(() => distinctCashierNamesFromOrders(orders), [orders])

  useEffect(() => {
    if (role !== 'gerant') return
    if (historyOrderCashierFilter === '') return
    if (historiqueCashierNames.includes(historyOrderCashierFilter)) return
    setHistoryOrderCashierFilter('')
  }, [role, historiqueCashierNames, historyOrderCashierFilter, setHistoryOrderCashierFilter])

  const historySessionsFilteredStats = useMemo(() => {
    const list = historyClosedSessionsFiltered
    const n = list.length
    const totalSales = Math.round(list.reduce((acc, x) => acc + x.salesTotal, 0) * 100) / 100
    const avg = n > 0 ? Math.round((totalSales / n) * 100) / 100 : null
    return { n, totalSales, avg }
  }, [historyClosedSessionsFiltered])

  const historyOrdersFiltered = useMemo(() => {
    const opts = {
      sessionFilter: historySessionFilter,
      search: historySearch,
      statusFilter: historyOrderStatusFilter,
      cashierFilter: role === 'gerant' ? historyOrderCashierFilter : '',
    }
    return orders.filter((o) => orderMatchesHistoriqueFilters(o, opts))
  }, [
    orders,
    historySearch,
    historySessionFilter,
    historyOrderStatusFilter,
    historyOrderCashierFilter,
    role,
  ])

  const historyFilteredStats = useMemo(() => {
    const list = historyOrdersFiltered
    const revenueRows = list.filter((o) => orderCountsTowardRevenue(o))
    const total = Math.round(revenueRows.reduce((acc, o) => acc + o.total, 0) * 100) / 100
    const avg =
      revenueRows.length > 0 ? Math.round((total / revenueRows.length) * 100) / 100 : null
    // Même règle que la base (sessions / clôture) : ventes = commandes « validated » uniquement.
    // Avec filtre « Tous statuts », le tableau liste encore annulations / modifiées, mais le nombre
    // affiché ici suit la recette — comme « Cmd. » sur une ligne de session.
    const n = historyOrderStatusFilter === 'cancelled' ? list.length : revenueRows.length
    return { n, total, avg }
  }, [historyOrdersFiltered, historyOrderStatusFilter])

  const historySessionsPaginated = useMemo(
    () => paginateSlice(historyClosedSessionsFiltered, historySessionsPage, historySessionsPageSize),
    [historyClosedSessionsFiltered, historySessionsPage, historySessionsPageSize],
  )

  const historyOrdersPaginated = useMemo(
    () => paginateSlice(historyOrdersFiltered, historyOrdersPage, historyOrdersPageSize),
    [historyOrdersFiltered, historyOrdersPage, historyOrdersPageSize],
  )

  const headerKPIs = useMemo(() => {
    // If a specific session is selected, we ALWAYS show Order Stats for that session
    if (historySessionFilter !== 'all') {
      return {
        sales: historyFilteredStats.total,
        count: historyFilteredStats.n,
        avg: historyFilteredStats.avg,
        countLabel: historiqueOrderCountKpiLabel(historyOrderStatusFilter),
        avgLabel: 'P. Moyen',
        loading: ordersLoading
      }
    }
    // GLOBAL VIEW: Context changes based on sub-tab
    if (historyInnerTab === 'sessions') {
      return {
        sales: historySessionsFilteredStats.totalSales,
        count: historySessionsFilteredStats.n,
        avg: historySessionsFilteredStats.avg,
        countLabel: 'Sessions',
        avgLabel: 'Panier Moy.',
        loading: historySessionsLoading
      }
    } else {
      // TAB IS ORDERS, FILTER IS ALL -> Show Global Order Stats
      return {
        sales: historyFilteredStats.total,
        count: historyFilteredStats.n,
        avg: historyFilteredStats.avg,
        countLabel: historiqueOrderCountKpiLabel(historyOrderStatusFilter),
        avgLabel: 'P. Moyen',
        loading: ordersLoading
      }
    }
  }, [
    historyInnerTab,
    historySessionFilter,
    historyOrderStatusFilter,
    historyFilteredStats,
    historySessionsFilteredStats,
    historySessionsLoading,
    ordersLoading
  ])

  const showHistoriqueCommandesPanel = role === 'caissier' || historyInnerTab === 'orders'

  return (
    <div>
      {/* HEADER ACTION BAR */}
      <div className="mb-6 rounded-xl border border-[var(--accent-border)] bg-[color-mix(in_oklab,var(--accent-bg)_55%,var(--surface))] p-2">
        <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 ${headerCollapsed ? '' : 'mb-2'}`}>
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-bg)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--accent)] ring-1 ring-[var(--accent-border)]">
            <span className="material-symbols-outlined text-[13px]">history</span>
            Gestion
          </span>

          <div className="inline-flex items-center gap-1.5">
            {role === 'gerant' && (
              <div className="flex items-center gap-1 bg-[var(--card)] p-0.5 rounded-lg ring-1 ring-[var(--border)]">
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all rounded-md ${
                    historyInnerTab === 'sessions'
                      ? 'bg-[var(--accent)] text-[#4d2600] shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--text-h)]'
                  }`}
                  onClick={() => {
                    setHistoryInnerTab('sessions')
                    setHistorySessionFilter('all')
                  }}
                >
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  Sessions
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all rounded-md ${
                    historyInnerTab === 'orders'
                      ? 'bg-[var(--accent)] text-[#4d2600] shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--text-h)]'
                  } ${historySessionFilter === 'all' ? 'cursor-not-allowed opacity-40' : ''}`}
                  disabled={historySessionFilter === 'all'}
                  onClick={() => setHistoryInnerTab('orders')}
                >
                  <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                  Commandes
                </button>
              </div>
            )}
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--card)] px-2 py-1 text-[10px] font-bold text-[var(--muted)] transition-all hover:brightness-110"
              onClick={() => setHeaderCollapsed(!headerCollapsed)}
            >
              <span className="material-symbols-outlined text-[14px]">
                {headerCollapsed ? 'expand_more' : 'expand_less'}
              </span>
              {headerCollapsed ? 'Afficher' : 'Réduire'}
            </button>
          </div>
        </div>

        {!headerCollapsed && (
          <div className="flex flex-col gap-3 border-t border-[var(--accent-border)]/20 pt-2 px-1">
            {role === 'gerant' ? (
              <>
                {/* KPI ROW */}
                <div className="grid grid-cols-3 gap-1">
                  {/* BOX 1: VENTES */}
                  <div className={`min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 transition-all ${headerKPIs.loading ? 'animate-pulse' : ''}`}>
                    <span className="block truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Ventes</span>
                    <span className="block truncate text-[11px] font-black text-[var(--accent)] tabular-nums">
                      {headerKPIs.loading ? (
                        <span className="opacity-40">...</span>
                      ) : (
                        <>
                          {headerKPIs.sales.toLocaleString()}{' '}
                          <span className="text-[8px] font-bold opacity-40">MAD</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* BOX 2: COUNT */}
                  <div className={`min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 transition-all ${headerKPIs.loading ? 'animate-pulse' : ''}`}>
                    <span className="block truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {headerKPIs.countLabel}
                    </span>
                    <span className="block truncate text-[11px] font-black text-[var(--text-h)] tabular-nums">
                      {headerKPIs.loading ? (
                        <span className="opacity-40">...</span>
                      ) : (
                        headerKPIs.count
                      )}
                    </span>
                  </div>

                  {/* BOX 3: AVERAGE */}
                  <div className={`min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 transition-all ${headerKPIs.loading ? 'animate-pulse' : ''}`}>
                    <span className="block truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {headerKPIs.avgLabel}
                    </span>
                    <span className="block truncate text-[11px] font-black text-[var(--text-h)] tabular-nums">
                      {headerKPIs.loading ? (
                        <span className="opacity-40">...</span>
                      ) : (
                        <>
                          {headerKPIs.avg != null
                            ? headerKPIs.avg.toLocaleString()
                            : '—'}{' '}
                          {headerKPIs.avg != null && <span className="text-[8px] font-bold opacity-40">MAD</span>}
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* EXPORT ROW */}
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {historyInnerTab === 'sessions' ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--text-h)] transition-all hover:bg-[var(--surface)] hover:text-[var(--accent)] disabled:opacity-40"
                        disabled={historySessionsLoading || historyClosedSessionsFiltered.length === 0}
                        onClick={async () => {
                          try {
                            await exportHistoriqueSessionsCsv(userId, historyClosedSessionsFiltered)
                            pushToast('success', client.success.csvFile)
                          } catch (e) {
                            pushToast('error', userFacingErrorMessage(e, client.error.exportCsv))
                          }
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">csv</span>
                        CSV
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-bg)] px-2 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--accent)] transition-all hover:brightness-110 disabled:opacity-40 shadow-sm"
                        disabled={historySessionsLoading || historyClosedSessionsFiltered.length === 0}
                        onClick={() => {
                          try {
                            exportHistoriqueSessionsPdfPrint(historyClosedSessionsFiltered)
                            pushToast('success', client.success.printWindow)
                          } catch (e) {
                            pushToast('error', historiquePdfPrintUserError(e))
                          }
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                        PDF
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--text-h)] transition-all hover:bg-[var(--surface)] hover:text-[var(--accent)] disabled:opacity-40"
                        disabled={
                          historySessionsLoading ||
                          historyClosedSessionsFiltered.length === 0 ||
                          !isTauriRuntime() ||
                          userId == null
                        }
                        onClick={() => {
                          if (userId == null) return
                          void (async () => {
                            try {
                              const out = await exportHistoriqueSessionsPdfHtmlFile(userId, historyClosedSessionsFiltered)
                              pushToast('success', `Fichier créé: ${out}`)
                            } catch (e) {
                              pushToast('error', userFacingErrorMessage(e, client.error.exportPdf))
                            }
                          })()
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">description</span>
                        Fichier
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--text-h)] transition-all hover:bg-[var(--surface)] hover:text-[var(--accent)] disabled:opacity-40"
                        disabled={ordersLoading || historyOrdersFiltered.length === 0}
                        onClick={async () => {
                          try {
                            await exportHistoriqueCommandesCsv(userId, historyOrdersFiltered)
                            pushToast('success', client.success.csvFile)
                          } catch (e) {
                            pushToast('error', userFacingErrorMessage(e, client.error.exportCsv))
                          }
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">csv</span>
                        CSV
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-bg)] px-2 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--accent)] transition-all hover:brightness-110 disabled:opacity-40 shadow-sm"
                        disabled={ordersLoading || historyOrdersFiltered.length === 0}
                        onClick={() => {
                          try {
                            exportHistoriqueCommandesPdfPrint(historyOrdersFiltered)
                            pushToast('success', client.success.printWindow)
                          } catch (e) {
                            pushToast('error', historiquePdfPrintUserError(e))
                          }
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                        PDF
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--text-h)] transition-all hover:bg-[var(--surface)] hover:text-[var(--accent)] disabled:opacity-40"
                        disabled={ordersLoading || historyOrdersFiltered.length === 0 || !isTauriRuntime() || userId == null}
                        onClick={() => {
                          if (userId == null) return
                          void (async () => {
                            try {
                              const out = await exportHistoriqueCommandesPdfHtmlFile(userId, historyOrdersFiltered)
                              pushToast('success', `Fichier créé: ${out}`)
                            } catch (e) {
                              pushToast('error', userFacingErrorMessage(e, client.error.exportPdf))
                            }
                          })()
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">description</span>
                        Fichier
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
          {historyInnerTab === 'sessions' && role === 'gerant' ? (
            <>
          <div className="px-5 py-6">
            {activeSessionLoading ? (
               /* PROFESSIONAL SKELETON FOR ACTIVE SESSION */
               <div className="mx-auto max-w-5xl">
                 <div className="mb-3 flex items-center justify-center lg:justify-start">
                    <div className="h-3 w-32 animate-pulse rounded bg-[var(--accent-bg)] opacity-30" />
                 </div>
                 <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--accent-border)]/20 bg-[var(--surface)] p-5 shadow-sm">
                    {/* Skeleton Header */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="h-4 w-24 animate-pulse rounded bg-[var(--border)] opacity-40" />
                        <div className="h-3 w-40 animate-pulse rounded bg-[var(--border)] opacity-20" />
                      </div>
                      <div className="size-9 animate-pulse rounded-xl bg-[var(--accent-bg)] opacity-20" />
                    </div>
                    {/* Skeleton Grid */}
                    <div className="mt-6 grid grid-cols-2 gap-4 border-y border-[var(--border)] border-dashed py-4">
                      <div className="space-y-2">
                        <div className="h-2 w-12 animate-pulse rounded bg-[var(--border)] opacity-30" />
                        <div className="h-6 w-20 animate-pulse rounded bg-[var(--border)] opacity-40" />
                      </div>
                      <div className="border-l border-[var(--border)] border-dashed pl-4 space-y-2">
                        <div className="h-2 w-12 animate-pulse rounded bg-[var(--border)] opacity-30" />
                        <div className="h-6 w-20 animate-pulse rounded bg-[var(--border)] opacity-40" />
                      </div>
                    </div>
                    {/* Skeleton Footer */}
                    <div className="mt-4 flex justify-between items-center">
                      <div className="h-3 w-20 animate-pulse rounded bg-[var(--border)] opacity-20" />
                      <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)] opacity-20" />
                    </div>
                 </div>
               </div>
            ) : openSessionHistorique ? (
              /* INTEGRATED DASHBOARD: FULL WIDTH ACTIVE SESSION */
              <div className="mx-auto max-w-5xl">
                <div className="w-full">
                  <div className="mb-3 flex items-center justify-center lg:justify-start">
                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">
                      <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                      Session actuelle
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="group relative flex w-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklab,var(--surface)_95%,var(--accent))] p-6 text-left transition-all hover:brightness-105 ring-1 ring-[var(--accent)]/20 shadow-[0_32px_64px_-16px_rgba(240,133,10,0.1)] active:scale-[0.99]"
                    onClick={() => {
                      setHistorySessionFilter(String(openSessionHistorique.id))
                      setHistorySearch('')
                      setHistoryInnerTab('orders')
                      setOrderDetailTarget(null)
                    }}
                  >
                    {/* Header: Status & Date */}
                    <div className="flex w-full items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                           <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 ring-1 ring-amber-500/20">
                            <span className="relative flex size-2 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex size-2 rounded-full bg-amber-500"></span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                                ACTIVE
                            </span>
                           </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-black text-[var(--text-h)]">
                          <span className="material-symbols-outlined text-[18px] opacity-40">calendar_month</span>
                          {formatSessionCalendarDayFr(openSessionHistorique.openedAt)}
                        </div>
                      </div>
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-bg)] text-[var(--accent)] ring-1 ring-[var(--accent)]/10 shadow-lg transition-all group-hover:scale-110 group-hover:rotate-6">
                        <span className="material-symbols-outlined text-[24px]">bolt</span>
                      </div>
                    </div>

                    {/* Middle: KPI Grid */}
                    <div className="mt-8 grid grid-cols-2 gap-6 border-y border-[var(--accent)]/10 border-dashed py-6">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">
                          <span className="material-symbols-outlined text-[16px]">payments</span>
                          Chiffre d'Affaire
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-black tabular-nums tracking-tighter text-[var(--accent)]">
                            {Math.round(openSessionHistorique.salesTotal * 100) / 100}
                          </span>
                          <span className="text-xs font-bold text-[var(--muted)] opacity-30">MAD</span>
                        </div>
                      </div>
                      <div className="min-w-0 border-l border-[var(--accent)]/10 border-dashed pl-6">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">
                          <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                          Volume Commandes
                        </div>
                        <div className="mt-2 text-3xl font-black tabular-nums tracking-tighter text-[var(--text-h)]">
                             {openSessionHistorique.ordersCount ?? 0}
                        </div>
                      </div>
                    </div>

                    {/* Footer: User & Start Time */}
                    <div className="mt-6 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--card)] px-2 py-1 ring-1 ring-[var(--border)]">
                            <span className="material-symbols-outlined text-[16px] text-emerald-500 opacity-60">login</span>
                            <span className="text-[11px] font-bold text-[var(--muted)]">{formatHeureSeuleFr(openSessionHistorique.openedAt)}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-2 truncate text-[11px] font-black text-[var(--text-h)] uppercase tracking-tight">
                         <div className="size-8 rounded-xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 flex items-center justify-center shadow-inner">
                            <span className="material-symbols-outlined text-[16px] text-[var(--accent)] opacity-60">person</span>
                         </div>
                         {openSessionHistorique.cashierName}
                       </div>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
               {historySessionsLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-2xl bg-[var(--card)] p-4 ring-1 ring-[color-mix(in_oklab,var(--border)_70%,transparent)]">
                      <div className="h-4 w-16 rounded bg-[var(--surface)]" />
                      <div className="mt-3 h-3 w-24 rounded bg-[var(--surface)]" />
                      <div className="mt-2 h-3 w-20 rounded bg-[var(--surface)]" />
                      <div className="mt-4 h-8 w-full rounded-lg bg-[var(--surface)]" />
                    </div>
                  ))}
                </div>
              ) : historyClosedSessionsFiltered.length === 0 && !(role === 'gerant' && openSessionHistorique) ? (
                <div className="flex w-full flex-col items-center py-20">
                  <div className="mb-4 flex size-20 shrink-0 items-center justify-center rounded-3xl bg-[var(--accent-bg)] text-[var(--accent)]">
                    <span className="material-symbols-outlined text-4xl">event_busy</span>
                  </div>
                  <p className="mx-auto w-full max-w-md text-center font-[var(--heading)] text-xl font-black uppercase tracking-tight text-[var(--text-h)]">
                    Aucune session
                  </p>
                  <p className="mx-auto mt-2 w-full max-w-md text-center text-xs font-medium text-[var(--muted)] opacity-60">
                    Aucune session fermée enregistrée pour le moment.
                  </p>
                </div>
              ) : historyClosedSessionsFiltered.length === 0 && role === 'gerant' && openSessionHistorique ? (
                <p className="mb-4 text-center text-xs leading-relaxed text-[var(--muted)]">
                  Aucune session fermée pour le moment. La session actuelle est affichée ci-dessus.
                </p>
              ) : null}
              {historyClosedSessionsFiltered.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {historySessionsPaginated.map((sess) => (
                        <div
                          key={sess.id}
                          className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-[var(--surface)] p-5 text-left transition-all hover:bg-[var(--card)] ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] shadow-[0_24px_56px_-24px_rgba(0,0,0,0.65)] active:scale-[0.98]"
                          onClick={() => {
                            setHistorySessionFilter(String(sess.id))
                            setHistorySearch('')
                            setHistoryInnerTab('orders')
                            setOrderDetailTarget(null)
                          }}
                        >
                          {/* Header: ID, Date & Status */}
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-black tracking-tighter text-[var(--accent)] bg-[var(--accent-bg)] px-1.5 py-0.5 rounded leading-none">
                                  S-{sess.id}
                                </span>
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/20">
                                  Fermée
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-h)]">
                                <span className="material-symbols-outlined text-[14px] opacity-40">calendar_today</span>
                                {formatSessionCalendarDayFr(sess.openedAt)}
                              </div>
                            </div>
                            <div className="flex size-8 items-center justify-center rounded-xl bg-[var(--card)] ring-1 ring-[var(--border)] group-hover:bg-[var(--accent-bg)] group-hover:text-[var(--accent)] transition-colors">
                              <span className="material-symbols-outlined text-[18px]">history</span>
                            </div>
                          </div>

                          {/* Middle: KPI Grid */}
                          <div className="mt-6 grid grid-cols-2 gap-4 border-y border-[var(--border)] border-dashed py-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">
                                <span className="material-symbols-outlined text-[14px]">payments</span>
                                Ventes
                              </div>
                              <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-xl font-black tabular-nums tracking-tighter text-[var(--accent)]">
                                  {Math.round(sess.salesTotal * 100) / 100}
                                </span>
                                <span className="text-[10px] font-bold text-[var(--muted)] opacity-40">MAD</span>
                              </div>
                            </div>
                            <div className="min-w-0 border-l border-[var(--border)] pl-4">
                              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                Commandes
                              </div>
                              <div className="mt-1 text-xl font-black tabular-nums tracking-tighter text-[var(--text-h)]">
                                {sess.ordersCount}
                              </div>
                            </div>
                          </div>

                          {/* Footer: Times & User */}
                          <div className="mt-4 flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-[10px] font-medium text-[var(--muted)]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] text-emerald-500/60">login</span>
                                    {formatHeureSeuleFr(sess.openedAt)}
                                  </div>
                                  <span className="opacity-20">/</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] text-rose-500/60">logout</span>
                                    {formatHeureSeuleFr(sess.closedAt)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 truncate text-[10px] font-black text-[var(--text-h)] uppercase tracking-tight">
                                   <div className="size-5 rounded-full bg-[var(--card)] ring-1 ring-[var(--border)] flex items-center justify-center">
                                      <span className="material-symbols-outlined text-[12px] opacity-40">person</span>
                                   </div>
                                   {sess.cashierName}
                                </div>
                             </div>
                          </div>

                          <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
                            <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-30">
                              Clôture de session
                            </div>
                            <button
                              type="button"
                              className="group/btn flex h-9 items-center gap-2 rounded-xl bg-[var(--accent-bg)] px-3 text-[var(--accent)] ring-1 ring-[color-mix(in_oklab,var(--accent)_25%,transparent)] transition-all hover:brightness-110 active:scale-95 shadow-sm"
                              title="Imprimer clôture"
                              onClick={(e) => {
                                e.stopPropagation()
                                try {
                                  if (userId === null) return
                                  printCashCloseTicket(
                                    {
                                      shopLabel: ticketShopLabel,
                                      shopPhone: ticketShopPhone,
                                      sessionId: sess.id,
                                      closedAtIso: sess.closedAt,
                                      cashier: sess.cashierName || '—',
                                      openingAmount: sess.openingAmount,
                                      closingAmount: sess.closingAmount,
                                      salesTotal: sess.salesTotal,
                                      theoretical: sess.theoretical,
                                      gap: sess.gap,
                                      ordersCount: sess.ordersCount,
                                      comment: sess.comment ?? null,
                                    }
                                  )
                                  pushToast('success', client.success.ticketPrintStarted)
                                } catch (err) {
                                  logDevError('print_session_close', err)
                                  pushToast('warning', ticketPrintUserError())
                                }
                              }}
                            >
                              <span className="text-[10px] font-black uppercase tracking-widest">Imprimer</span>
                              <span className="material-symbols-outlined text-[18px]">print</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  {role === 'gerant' ? (
                    <YoboPagination
                      page={historySessionsPage}
                      totalItems={historyClosedSessionsFiltered.length}
                      pageSize={historySessionsPageSize}
                      onPageChange={setHistorySessionsPage}
                      onPageSizeChange={setHistorySessionsPageSize}
                    />
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        <div
          className={`border-b border-[var(--border)] px-5 py-6 ${
            showHistoriqueCommandesPanel ? '' : 'hidden'
          }`}
        >


          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm ring-1 ring-black/5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50" htmlFor="history-search">
                  Rechercher
                </label>
                <div className="relative mt-1.5">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-[var(--muted)] opacity-40"
                    aria-hidden
                  >
                    <span className="material-symbols-outlined text-[16px]">search</span>
                  </span>
                  <YoboAlphaInput
                    id="history-search"
                    autoComplete="off"
                    placeholder="ID, caissier, article..."
                    value={historySearch}
                    onValueChange={setHistorySearch}
                    className="yobo-input yobo-input--with-search-icon w-full h-9 text-[11px] font-bold"
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50" htmlFor="history-order-status">
                  Statut
                </label>
                <div className="mt-1.5">
                  <select
                    id="history-order-status"
                    className="yobo-input w-full h-9 text-[11px] font-bold px-3"
                    value={historyOrderStatusFilter}
                    onChange={(e) =>
                      setHistoryOrderStatusFilter(e.target.value as HistoryOrderStatusFilter)
                    }
                  >
                    {ORDER_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {role === 'gerant' ? (
                <div className="lg:col-span-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50" htmlFor="history-order-cashier">
                    Caissier
                  </label>
                  <div className="mt-1.5">
                    <select
                      id="history-order-cashier"
                      className="yobo-input w-full h-9 text-[11px] font-bold px-3"
                      value={historyOrderCashierFilter}
                      onChange={(e) => setHistoryOrderCashierFilter(e.target.value)}
                    >
                      <option value="">Tous les caissiers</option>
                      {historiqueCashierNames.map((name) => (
                        <option key={name} value={name}>
                          {capitalizeFirstLetter(name)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-1 flex items-end">
                   <div className="mb-1 w-full text-[10px] font-bold text-[var(--muted)] italic opacity-40">
                      Filtrage par caissier réservé au gérant.
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={`px-4 py-4 md:px-5 ${showHistoriqueCommandesPanel ? '' : 'hidden'}`}>
          {ordersLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-[var(--card)] p-4 ring-1 ring-[color-mix(in_oklab,var(--border)_70%,transparent)]">
                  <div className="h-4 w-16 rounded bg-[var(--surface)]" />
                  <div className="mt-3 h-3 w-24 rounded bg-[var(--surface)]" />
                  <div className="mt-2 h-3 w-20 rounded bg-[var(--surface)]" />
                </div>
              ))}
            </div>
          ) : historyOrdersFiltered.length === 0 ? (
            <div className="flex w-full flex-col items-center py-20">
              <div className="mb-4 flex size-20 shrink-0 items-center justify-center rounded-3xl bg-[var(--accent-bg)] text-[var(--accent)]">
                <span className="material-symbols-outlined text-4xl">{historyHasFilters ? 'filter_alt_off' : 'shopping_basket'}</span>
              </div>
              <p className="mx-auto w-full max-w-md text-center font-[var(--heading)] text-xl font-black uppercase tracking-tight text-[var(--text-h)]">
                {historyHasFilters ? 'Aucun résultat' : 'Panier vide'}
              </p>
              <p className="mt-2 mx-auto w-full max-w-md text-center text-xs font-medium text-[var(--muted)] opacity-60">
                {historyHasFilters
                  ? 'Ajustez vos filtres ou effectuez une nouvelle recherche.'
                  : "Les ventes validées apparaîtront ici dès qu'elles seront traitées."}
              </p>
            </div>
            ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {historyOrdersPaginated.map((order) => {
                const typeLabel =
                  order.orderType === 'livraison'
                    ? 'Livraison'
                    : order.orderType === 'emporter'
                      ? 'Emporter'
                      : 'Sur place'
                const typeIcon =
                  order.orderType === 'livraison'
                    ? 'delivery_dining'
                    : order.orderType === 'emporter'
                      ? 'takeout_dining'
                      : 'restaurant'

                return (
                  <div
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-[var(--surface)] p-5 text-left transition-all hover:bg-[var(--card)] ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] shadow-[0_24px_56px_-24px_rgba(0,0,0,0.65)] active:scale-[0.98]"
                    onClick={() => setOrderDetailTarget(order)}
                  >
                    {/* Header: ID & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black tracking-tighter text-[var(--text-h)] bg-[color-mix(in_oklab,var(--border)_45%,transparent)] px-1.5 py-0.5 rounded">#{order.id}</span>
                        {order.status !== 'validated' && order.status !== 'cancelled' && (
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                            order.status === 'modified' ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20' : 'bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20'
                          }`}>
                            {orderStatusLabelFr(order.status)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-40">
                        {formatHeureFr(order.time)}
                      </div>
                    </div>

                    {/* Middle: Total & Type */}
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">
                          <span className="material-symbols-outlined text-[16px]">{typeIcon}</span>
                          {typeLabel}
                        </div>
                        <div className="mt-2 truncate text-[11px] font-black text-[var(--text-h)] uppercase tracking-tight">
                          {order.cashier}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black tabular-nums tracking-tight text-[var(--accent)]">
                          {order.total} <span className="text-[10px] font-bold opacity-40">MAD</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Quick Badges (Only if needed) */}
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
                      <div className="flex gap-1.5">
                      </div>
                        
                        <div className="flex gap-2">
                          {order.status === 'cancelled' ? (
                            <div className="flex size-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20" title="Commande annulée">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 6L6 18M6 6L12 12L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                historyThermalPrintOrderId === order.id ||
                                userId == null ||
                                order.status !== 'validated'
                              }
                              className="group/btn flex size-8 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent)] ring-1 ring-[color-mix(in_oklab,var(--accent)_25%,transparent)] transition-all hover:brightness-110 active:scale-95 disabled:hidden"
                              title="Ticket thermique 80 mm"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (userId == null) return
                                const { ticketPrinterA, ticketPrinterB } = useYoboStore.getState()
                                const oid = order.id
                                setHistoryThermalPrintOrderId(oid)
                                void (async () => {
                                  try {
                                    const dto = await invoke<OrderTicketPrintDto>('get_order_ticket_for_print', {
                                      userId,
                                      orderId: oid,
                                    })
                                    const [detail] = orderTicketDetailsFromApi([{
                                      id: dto.id,
                                      time: dto.time,
                                      total: dto.total,
                                      cashier: dto.cashier,
                                      lines: dto.lines,
                                    }])
                                    await printOrderTicket({
                                      shopLabel: ticketShopLabel,
                                      shopPhone: ticketShopPhone,
                                      orderId: dto.id,
                                      timeIso: dto.time,
                                      cashier: dto.cashier,
                                      orderType: orderTypeForThermal(dto.orderType ?? undefined),
                                      comment: dto.orderComment ?? null,
                                      customerPhone: dto.customerPhone ?? null,
                                      customerAddress: dto.customerAddress ?? null,
                                      lines: detail.lines,
                                      total: dto.total,
                                      printerA: ticketPrinterA.trim(),
                                      printerB: ticketPrinterB.trim(),
                                    })
                                    pushToast('success', client.success.ticketPrintStarted)
                                  } catch (err) {
                                    logDevError('print_from_history', err)
                                    pushToast('error', userFacingErrorMessage(err, client.error.loadOrderTicketPrint))
                                  } finally {
                                    setHistoryThermalPrintOrderId(null)
                                  }
                                })()
                              }}
                            >
                              <span className="material-symbols-outlined text-[16px]">print</span>
                            </button>
                          )}
                        </div>
                      </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {showHistoriqueCommandesPanel ? (
          <div className="mt-8">
            <YoboPagination
              page={historyOrdersPage}
              totalItems={historyOrdersFiltered.length}
              pageSize={historyOrdersPageSize}
              onPageChange={setHistoryOrdersPage}
              onPageSizeChange={setHistoryOrdersPageSize}
            />
          </div>
        ) : null}
      </div>
  )
}
