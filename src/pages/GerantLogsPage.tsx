import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { YoboAlphaInput } from '../components/YoboKeyboardInputs'
import { YoboPagination } from '../components/YoboPagination'
import { downloadLogsCsv } from '../lib/exportLogsCsv'
import { formatDateHeureFr } from '../lib/formatDateHeureFr'
import { clampPage, getTotalPages } from '../lib/pagination'
import { logDevError, userFacingErrorMessage } from '../lib/userFacingError'
import { client } from '../lib/yoboClientMessages'
import {
  LOG_TYPES_REFERENCE_FR,
  logActionLabelFr,
  logTypeLabelFr,
} from '../lib/logLabelsFr'
import { useYoboStore } from '../store'
import { YoboModal } from '../components/YoboAppModals'

type LogEntryDto = {
  id: number
  userId: number | null
  userName: string | null
  actionType: string
  action: string
  description: string | null
  meta: string | null
  createdAt: string
}

type TableCountRow = { name: string; count: number }
type AppMetaRow = { key: string; value: string }

type DbDiagnostics = {
  integrityOk: boolean
  integrityDetail: string
  foreignKeyViolations: string[]
  tableCounts: TableCountRow[]
  appMeta: AppMetaRow[]
  anomalies: string[]
  sqliteVersion: string
  dbPageSize: number
  dbPageCount: number
  dbSizeBytes: number
  journalMode: string
  foreignKeysEnabled: boolean
  ordersValidated: number
  ordersCancelled: number
  ordersModified: number
}

type DevDiagSection = 'all' | 'health' | 'data' | 'controls'
type AnomalyLevel = 'all' | 'blocking' | 'warning' | 'info'

function formatBytesFr(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1024) return `${Math.round(n)} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`
}

function anomalySeverity(line: string): Exclude<AnomalyLevel, 'all'> {
  const l = line.toLowerCase()
  if (
    l.includes('corrompue') ||
    l.includes('≠ ok') ||
    l.includes('violation') ||
    l.includes('potentiellement')
  ) {
    return 'blocking'
  }
  if (l.includes('orphelin') || l.includes('inexistant')) return 'warning'
  return 'info'
}

function anomalyDotClass(sev: Exclude<AnomalyLevel, 'all'>): string {
  if (sev === 'blocking') return 'bg-[var(--danger)]'
  if (sev === 'warning') return 'bg-amber-500'
  return 'bg-[var(--accent)]'
}

type LogsInnerTab = 'activity' | 'dev'

type LogsListPageResponse = {
  items: LogEntryDto[]
  total: number
}

function parseMetaValue(meta: string | null | undefined, key: string): string | null {
  if (!meta) return null
  const regex = new RegExp(`${key}=([^\\s]+)`, 'i')
  const match = meta.match(regex)
  if (match) return match[1].replace(/_/g, ' ')
  return null
}

export function GerantLogsPage({ userId }: { userId: number }) {
  const pushToast = useYoboStore((s) => s.pushToast)
  const catalogItemsByCat = useYoboStore((s) => s.catalogItemsByCat)
  const caissiers = useYoboStore((s) => s.caissiers)
  
  const [innerTab, setInnerTab] = useState<LogsInnerTab>('activity')
  const [logs, setLogs] = useState<LogEntryDto[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsExporting, setLogsExporting] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [timePreset, setTimePreset] = useState<'all' | 'today' | '7d' | '30d'>('all')
  const [selectedLog, setSelectedLog] = useState<LogEntryDto | null>(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(true)

  // Maps pour transformer les IDs en NOMS (Produits & Caissiers)
  const productNameMap = useMemo(() => {
    const map = new Map<number, string>()
    Object.values(catalogItemsByCat).forEach(items => {
      items.forEach(item => {
        if (item.id !== undefined) map.set(item.id, item.name)
      })
    })
    return map
  }, [catalogItemsByCat])

  const caissierNameMap = useMemo(() => {
    const map = new Map<number, string>()
    caissiers.forEach(c => map.set(c.id, c.name))
    return map
  }, [caissiers])


  const dateRange = useMemo(() => {
    if (timePreset === 'all') return { start: null, end: null }
    const now = new Date()
    const end = now.toISOString()
    const start = new Date()
    if (timePreset === 'today') start.setHours(0, 0, 0, 0)
    else if (timePreset === '7d') start.setDate(now.getDate() - 7)
    else if (timePreset === '30d') start.setDate(now.getDate() - 30)
    return { start: start.toISOString(), end }
  }, [timePreset])

  const [diag, setDiag] = useState<DbDiagnostics | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagError, setDiagError] = useState<string | null>(null)
  const [devDiagSection, setDevDiagSection] = useState<DevDiagSection>('all')
  const [devTableFilter, setDevTableFilter] = useState('')
  const [devMetaFilter, setDevMetaFilter] = useState('')
  const [devAnomalyLevel, setDevAnomalyLevel] = useState<AnomalyLevel>('all')
  const [devAnomalySearch, setDevAnomalySearch] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 400)
    return () => window.clearTimeout(t)
  }, [search])

  useLayoutEffect(() => {
    setPage(1)
  }, [searchDebounced, categoryFilter, timePreset])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const res = await invoke<LogsListPageResponse>('logs_list_paged', {
        input: {
          userId,
          page,
          pageSize,
          search: searchDebounced.length > 0 ? searchDebounced : null,
          actionType: categoryFilter,
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
      })
      const items = (Array.isArray(res.items) ? res.items : [])
        .filter(item => !item.action.toLowerCase().includes('reorder'))
      
      setLogs(items)
      setLogsTotal(typeof res.total === 'number' ? res.total : 0)
    } catch (e) {
      logDevError('logs_list_paged', e)
      setLogsError(userFacingErrorMessage(e, client.error.loadLogs))
      setLogs([])
      setLogsTotal(0)
    } finally {
      setLogsLoading(false)
    }
  }, [userId, page, pageSize, searchDebounced, categoryFilter, dateRange])

  const exportLogs = useCallback(async () => {
    setLogsExporting(true)
    try {
      const rows = await invoke<LogEntryDto[]>('logs_list_for_export', {
        input: {
          userId,
          search: searchDebounced.length > 0 ? searchDebounced : null,
          limit: 12000,
          actionType: categoryFilter,
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
      })
      await downloadLogsCsv(userId, Array.isArray(rows) ? rows : [])
      pushToast('success', client.success.csvFile)
    } catch (e) {
      logDevError('logs_list_for_export', e)
      pushToast('error', userFacingErrorMessage(e, client.error.exportCsv))
    } finally {
      setLogsExporting(false)
    }
  }, [userId, searchDebounced, categoryFilter, dateRange, pushToast])

  const loadDiag = useCallback(async () => {
    setDiagLoading(true)
    setDiagError(null)
    try {
      const d = await invoke<DbDiagnostics>('logs_db_diagnostics', {
        userId,
      })
      setDiag(d)
    } catch (e) {
      logDevError('logs_db_diagnostics', e)
      setDiagError(userFacingErrorMessage(e, client.error.loadDiag))
      setDiag(null)
    } finally {
      setDiagLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (innerTab === 'dev' && diag === null && !diagLoading) {
      void loadDiag()
    }
  }, [innerTab, diag, diagLoading, loadDiag])

  const filteredDevTableCounts = useMemo(() => {
    if (!diag) return []
    const q = devTableFilter.trim().toLowerCase()
    if (!q) return diag.tableCounts
    return diag.tableCounts.filter((t) => t.name.toLowerCase().includes(q))
  }, [diag, devTableFilter])

  const filteredDevAppMeta = useMemo(() => {
    if (!diag) return []
    const q = devMetaFilter.trim().toLowerCase()
    if (!q) return diag.appMeta
    return diag.appMeta.filter(
      (m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q),
    )
  }, [diag, devMetaFilter])

  const filteredDevAnomalies = useMemo(() => {
    if (!diag) return []
    const textQ = devAnomalySearch.trim().toLowerCase()
    return diag.anomalies.filter((a) => {
      const sev = anomalySeverity(a)
      if (devAnomalyLevel !== 'all' && sev !== devAnomalyLevel) return false
      if (textQ && !a.toLowerCase().includes(textQ)) return false
      return true
    })
  }, [diag, devAnomalyLevel, devAnomalySearch])

  useEffect(() => {
    const tp = getTotalPages(logsTotal, pageSize)
    setPage((p) => {
      const next = clampPage(p, tp)
      return p === next ? p : next
    })
  }, [logsTotal, pageSize])

  const headerKPIs = useMemo(() => {
    return {
      activeLogs: logsTotal,
      dbSize: diag ? formatBytesFr(diag.dbSizeBytes) : "—",
      health: diag ? (diag.integrityOk ? "Sain" : "Alerte") : "Inconnu",
      healthOk: diag ? diag.integrityOk : null,
      loading: logsLoading || diagLoading
    }
  }, [logsTotal, diag, logsLoading, diagLoading])

  return (
    <div className="space-y-6">
      {/* HEADER ACTION BAR (Premium Style) */}
      <div className="rounded-xl border border-[var(--accent-border)] bg-[color-mix(in_oklab,var(--accent-bg)_55%,var(--surface))] p-2">
        <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 ${headerCollapsed ? '' : 'mb-2'}`}>
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-bg)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--accent)] ring-1 ring-[var(--accent-border)]">
            <span className="material-symbols-outlined text-[13px]">monitor_heart</span>
            Système & Logs
          </span>

          <div className="inline-flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-[var(--card)] p-0.5 rounded-lg ring-1 ring-[var(--border)]">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all rounded-md ${innerTab === 'activity'
                  ? 'bg-[var(--accent)] text-[#4d2600] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text-h)]'
                  }`}
                onClick={() => setInnerTab('activity')}
              >
                <span className="material-symbols-outlined text-[14px]">history</span>
                Journaux
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all rounded-md ${innerTab === 'dev'
                  ? 'bg-[var(--accent)] text-[#4d2600] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text-h)]'
                  }`}
                onClick={() => setInnerTab('dev')}
              >
                <span className="material-symbols-outlined text-[14px]">database</span>
                Diagnostic
              </button>
            </div>
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
            {/* KPI ROW */}
            <div className="grid grid-cols-3 gap-1">
              {/* BOX 1: LOGS */}
              <div className={`min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 transition-all ${headerKPIs.loading ? 'animate-pulse' : ''}`}>
                <span className="block truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Activités</span>
                <span className="block truncate text-[11px] font-black text-[var(--text-h)] tabular-nums">
                  {headerKPIs.loading ? (
                    <span className="opacity-40">...</span>
                  ) : (
                    headerKPIs.activeLogs
                  )}
                </span>
              </div>

              {/* BOX 2: DB SIZE */}
              <div className={`min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 transition-all ${headerKPIs.loading ? 'animate-pulse' : ''}`}>
                <span className="block truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Taille Base</span>
                <span className="block truncate text-[11px] font-black text-[var(--accent)] tabular-nums">
                  {headerKPIs.dbSize}
                </span>
              </div>

              {/* BOX 3: HEALTH */}
              <div className={`min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 transition-all ${headerKPIs.loading ? 'animate-pulse' : ''}`}>
                <span className="block truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">État Santé</span>
                <span className={`block truncate text-[11px] font-black tabular-nums transition-colors ${headerKPIs.healthOk === true ? 'text-emerald-500' :
                  headerKPIs.healthOk === false ? 'text-red-500' : 'text-[var(--text-h)]'
                  }`}>
                  {headerKPIs.health}
                </span>
              </div>
            </div>

            {/* ACTION ROW */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--text-h)] transition-all hover:bg-[var(--surface)] hover:text-[var(--accent)]"
                onClick={() => {
                  if (innerTab === 'activity') void loadLogs();
                  else void loadDiag();
                }}
                disabled={headerKPIs.loading}
              >
                <span className={`material-symbols-outlined text-[14px] ${headerKPIs.loading ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                Rafraîchir
              </button>
              {innerTab === 'activity' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-bg)] px-2.5 py-1 text-[9px] font-black uppercase tracking-tight text-[var(--accent)] transition-all hover:brightness-110 disabled:opacity-40 shadow-sm"
                  onClick={() => void exportLogs()}
                  disabled={logsExporting || logsLoading || logsTotal === 0}
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  {logsExporting ? 'Export…' : 'Exporter CSV'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {innerTab === 'activity' ? (
        <div className="border-b border-[var(--border)] px-4 py-4 md:px-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-col gap-6">
              {/* Search and Main Actions */}
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor="logs-search">
                    Rechercher dans les logs
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-[var(--muted)]"
                      aria-hidden
                    >
                      <span className="material-symbols-outlined text-[20px]">search</span>
                    </span>
                    <YoboAlphaInput
                      id="logs-search"
                      autoComplete="off"
                      placeholder="Rechercher une action, un utilisateur ou un détail..."
                      value={search}
                      onValueChange={setSearch}
                      className="yobo-input yobo-input--with-search-icon w-full"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(['all', 'today', '7d', '30d'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${timePreset === id
                        ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]'
                        }`}
                      onClick={() => setTimePreset(id)}
                    >
                      {id === 'all' ? 'Tout' : id === 'today' ? "Aujourd’hui" : id === '7d' ? '7 Jours' : '30 Jours'}
                    </button>
                  ))}
                </div>
              </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`relative rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilter === null
                      ? 'bg-[var(--accent)] text-[#4d2600]'
                      : 'bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text-h)] ring-1 ring-[var(--border)]'
                      }`}
                    onClick={() => setCategoryFilter(null)}
                  >
                    Toutes
                    {categoryFilter === null && logsTotal > 0 && (
                      <span className="ml-2 rounded-md bg-black/10 px-1.5 py-0.5 tabular-nums text-[9px] opacity-70">
                        {logsTotal}
                      </span>
                    )}
                  </button>
                  {LOG_TYPES_REFERENCE_FR.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      className={`relative rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilter === code
                        ? 'bg-[var(--accent)] text-[#4d2600]'
                        : 'bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text-h)] ring-1 ring-[var(--border)]'
                        }`}
                      onClick={() => setCategoryFilter(code)}
                    >
                      {label}
                      {categoryFilter === code && logsTotal > 0 && (
                        <span className="ml-2 rounded-md bg-black/10 px-1.5 py-0.5 tabular-nums text-[9px] opacity-70">
                          {logsTotal}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
            </div>
          </div>
          {logsError ? (
            <p className="mt-4 text-sm text-[var(--danger)]">{logsError}</p>
          ) : null}
          {logsLoading && logs.length === 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl bg-[var(--card)] p-4 ring-1 ring-[color-mix(in_oklab,var(--border)_70%,transparent)]"
                >
                  <div className="h-3 w-24 rounded bg-[var(--surface)]" />
                  <div className="mt-3 h-5 w-20 rounded-full bg-[var(--surface)]" />
                  <div className="mt-3 h-4 w-full rounded bg-[var(--surface)]" />
                  <div className="mt-2 h-3 w-[80%] rounded bg-[var(--surface)]" />
                </div>
              ))}
            </div>
          ) : logsTotal === 0 ? (
            <div className="flex w-full flex-col items-center py-14">
              <div className="mb-4 flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-bg)] text-[var(--accent)]">
                <span className="material-symbols-outlined text-4xl">history</span>
              </div>
              <p className="mx-auto w-full max-w-md text-center font-[var(--heading)] text-lg font-black text-[var(--text-h)]">
                Aucune entrée
              </p>
              <p className="mx-auto mt-2 w-full max-w-md text-center text-xs leading-relaxed text-[var(--muted)] text-pretty">
                Les connexions et actions importantes apparaîtront ici au fur et à mesure.
              </p>
              <button
                type="button"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--card)] px-5 py-2.5 text-xs font-bold text-[var(--text-h)] ring-1 ring-[var(--border)] transition hover:ring-[var(--accent-border)]"
                onClick={() => void loadLogs()}
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Rafraîchir
              </button>
            </div>
          ) : (
            <>
              <div
                className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 ${logsLoading ? 'pointer-events-none opacity-55' : ''}`}
                role="list"
                aria-label="Entrées du journal"
              >
                {logs.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="group relative flex w-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklab,var(--surface)_98%,var(--card))] p-5 text-left transition-all hover:brightness-105 hover:ring-1 hover:ring-[var(--accent)]/30 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] active:scale-[0.99]"
                    onClick={() => setSelectedLog(l)}
                  >
                    {/* Header: Date & Status Badge */}
                    <div className="flex w-full items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">
                          {formatDateHeureFr(l.createdAt)}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${
                            l.actionType === 'order' ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' :
                            (l.actionType === 'auth' || l.actionType === 'user') ? 'bg-amber-500/10 text-amber-500 ring-amber-500/20' :
                            l.actionType === 'cash' ? 'bg-indigo-500/10 text-indigo-500 ring-indigo-500/20' :
                            l.actionType === 'menu' ? 'bg-violet-500/10 text-violet-500 ring-violet-500/20' :
                            (l.actionType === 'profile' || l.actionType === 'settings') ? 'bg-slate-500/10 text-slate-500 ring-slate-500/20' :
                            'bg-[var(--accent-bg)] text-[var(--accent)] ring-[var(--accent-border)]/20'
                          }`}>
                            <span className="material-symbols-outlined text-[13px]">
                              {l.actionType === 'auth' ? 'key' : 
                               l.actionType === 'order' ? 'receipt' : 
                               l.actionType === 'cash' ? 'payments' : 
                               l.actionType === 'menu' ? 'restaurant_menu' :
                               l.actionType === 'user' ? 'group' :
                               l.actionType === 'settings' ? 'settings' :
                               l.actionType === 'profile' ? 'account_circle' :
                               'info'}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {logTypeLabelFr(l.actionType)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)] transition-all group-hover:scale-110 group-hover:text-[var(--accent)]">
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="mt-5 min-w-0">
                      <h4 className="text-[13px] font-black leading-snug text-[var(--text-h)] group-hover:text-[var(--accent)] transition-colors">
                        {logActionLabelFr(l.actionType, l.action, l.meta)}
                      </h4>
                      {(() => {
                        const rawName = parseMetaValue(l.meta, 'name') || parseMetaValue(l.meta, 'label')
                        const id = parseMetaValue(l.meta, 'id')
                        
                        // Tentative de résolution du nom par ID si absent du meta
                        let resolvedName = rawName
                        if (!resolvedName && id) {
                          const numId = Number(id)
                          if (l.actionType === 'menu') {
                            resolvedName = productNameMap.get(numId) || null
                          } else if (l.actionType === 'user' || l.actionType === 'auth') {
                            resolvedName = caissierNameMap.get(numId) || null
                          }
                        }

                        return (
                          <div className="mt-2 space-y-1">
                            {resolvedName && (
                              <p className="text-[11px] font-bold text-[var(--text-h)]">
                                {resolvedName}
                              </p>
                            )}
                            {l.description && (
                              <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)] opacity-80">
                                {l.description}
                              </p>
                            )}
                            {id && !resolvedName && (
                              <p className="text-[9px] text-[var(--muted)] opacity-50">ID: {id}</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Footer: User Identity */}
                    <div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] border-dashed pt-4">
                      <div className="size-6 rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)] flex items-center justify-center shadow-inner">
                        <span className="material-symbols-outlined text-[14px] text-[var(--muted)]">person</span>
                      </div>
                      <span className="text-[10px] font-black text-[var(--text-h)] uppercase tracking-tight">
                        {l.userName ?? 'Anonyme'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <YoboPagination
                page={page}
                totalItems={logsTotal}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                hideWhenEmpty={false}
                className="mt-4"
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6 px-4 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-6 rounded-2xl bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklab,var(--surface)_95%,var(--accent))] p-6 shadow-[0_32px_64px_-16px_rgba(240,133,10,0.1)] ring-1 ring-[var(--accent)]/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-[var(--accent-bg)] px-2 py-0.5 ring-1 ring-[var(--accent)]/20 shadow-sm">
                  <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">MONITEUR SYSTÈME</span>
                </div>
              </div>
              <h4 className="mt-3 text-lg font-black tracking-tighter text-[var(--text-h)]">Diagnostic de la <span className="text-[var(--accent)]">Base de Données</span></h4>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--muted)] opacity-80">
                Analyse temps-réel de l'intégrité, de la structure et des volumes de données SQLite.
              </p>
            </div>
            <button
              type="button"
              className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--card)] px-5 py-3 text-[11px] font-black uppercase tracking-widest text-[var(--text-h)] ring-1 ring-[var(--border)] shadow-sm transition-all hover:bg-[var(--surface)] hover:ring-[var(--accent)]/30 active:scale-95"
              onClick={() => void loadDiag()}
              disabled={diagLoading}
            >
              <span className={`material-symbols-outlined text-[18px] transition-transform group-hover:rotate-180 ${diagLoading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              {diagLoading ? 'Analyse...' : "Relancer l analyse"}
            </button>
          </div>

          {diagError ? <p className="text-sm text-[var(--danger)]">{diagError}</p> : null}
          {diagLoading && !diag ? (
            <div className="space-y-4 py-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-[var(--card)] p-5 ring-1 ring-[color-mix(in_oklab,var(--border)_50%,transparent)]">
                  <div className="h-4 w-40 rounded bg-[var(--surface)]" />
                  <div className="mt-3 h-3 w-60 rounded bg-[var(--surface)]" />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="h-10 rounded-lg bg-[var(--surface)]" />
                    <div className="h-10 rounded-lg bg-[var(--surface)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : diag ? (
            <div className="space-y-8">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)] md:p-5">
                <div className="text-xs font-extrabold tracking-tight text-[var(--text-h)]">Filtres d’affichage</div>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                  Limite les blocs visibles et affine tables, métadonnées et signalements.
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Section du diagnostic">
                  {(
                    [
                      ['all', 'Tout'] as const,
                      ['health', '1 Santé'] as const,
                      ['data', '2 Données'] as const,
                      ['controls', '3 Contrôles'] as const,
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${devDiagSection === id
                        ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--text-h)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]'
                        }`}
                      onClick={() => setDevDiagSection(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {devDiagSection === 'all' || devDiagSection === 'data' ? (
                  <div className="mt-4 grid gap-4 border-t border-[color-mix(in_oklab,var(--border)_55%,transparent)] pt-4 sm:grid-cols-2">
                    <div className="yobo-form-field min-w-0">
                      <label className="yobo-field-label" htmlFor="logs-dev-table-filter">
                        Tables (nom)
                      </label>
                      <YoboAlphaInput
                        id="logs-dev-table-filter"
                        className="yobo-input w-full"
                        placeholder="ex. orders, logs…"
                        value={devTableFilter}
                        onValueChange={setDevTableFilter}
                        autoComplete="off"
                      />
                    </div>
                    <div className="yobo-form-field min-w-0">
                      <label className="yobo-field-label" htmlFor="logs-dev-meta-filter">
                        Métadonnées app_meta
                      </label>
                      <YoboAlphaInput
                        id="logs-dev-meta-filter"
                        className="yobo-input w-full"
                        placeholder="Clé ou valeur…"
                        value={devMetaFilter}
                        onValueChange={setDevMetaFilter}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ) : null}
                {devDiagSection === 'all' || devDiagSection === 'controls' ? (
                  <div className="mt-4 space-y-3 border-t border-[color-mix(in_oklab,var(--border)_55%,transparent)] pt-4">
                    <span className="yobo-field-label" id="logs-dev-anomaly-level-label">
                      Gravité des signalements
                    </span>
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-labelledby="logs-dev-anomaly-level-label"
                    >
                      {(
                        [
                          ['all', 'Tous'] as const,
                          ['blocking', 'Bloquant'] as const,
                          ['warning', 'Avertissement'] as const,
                          ['info', 'Info'] as const,
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${devAnomalyLevel === id
                            ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--text-h)]'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]'
                            }`}
                          onClick={() => setDevAnomalyLevel(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="yobo-form-field min-w-0">
                      <label className="yobo-field-label" htmlFor="logs-dev-anomaly-search">
                        Texte dans le signalement
                      </label>
                      <YoboAlphaInput
                        id="logs-dev-anomaly-search"
                        className="yobo-input w-full"
                        placeholder="Mot-clé…"
                        value={devAnomalySearch}
                        onValueChange={setDevAnomalySearch}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ) : null}
                {devDiagSection === 'all' || devDiagSection === 'health' ? (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] opacity-50">1 · Statuts de Santé</span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {/* Size Box */}
                      <div className="rounded-2xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)] shadow-sm">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">Taille Fichier</span>
                        <div className="mt-2 text-2xl font-black tabular-nums text-[var(--text-h)] tracking-tighter">
                          {formatBytesFr(diag.dbSizeBytes)}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--muted)]">{diag.dbPageCount} pages active</div>
                      </div>
                      {/* SQLite Version */}
                      <div className="rounded-2xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)] shadow-sm">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">Version Moteur</span>
                        <div className="mt-2 text-2xl font-black tracking-tighter text-[var(--text-h)]">
                          {diag.sqliteVersion}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--muted)]">
                          <span className="size-1.5 rounded-full bg-blue-500" />
                          Mode {diag.journalMode}
                        </div>
                      </div>
                      {/* FK Status */}
                      <div className="rounded-2xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)] shadow-sm">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">Clés Étrangères</span>
                        <div className={`mt-2 text-2xl font-black tracking-tighter ${diag.foreignKeysEnabled ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {diag.foreignKeysEnabled ? 'ACTIF' : 'INACTIF'}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--muted)]">PRAGMA enforcement</div>
                      </div>
                      {/* Summary Ops */}
                      <div className="rounded-2xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)] shadow-sm">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">Activité Cumulée</span>
                        <div className="mt-2 text-2xl font-black tracking-tighter text-[var(--text-h)] tabular-nums">
                          {diag.ordersValidated + diag.ordersCancelled}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--muted)]">{diag.ordersValidated} Validées · {diag.ordersCancelled} Annulées</div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className={`overflow-hidden rounded-2xl p-6 ring-1 transition-all ${diag.integrityOk ? 'bg-emerald-500/5 ring-emerald-500/20' : 'bg-red-500/5 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                        }`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <h6 className="text-xs font-black uppercase tracking-widest text-[var(--text-h)]">Vérification Intégrité</h6>
                            <p className="mt-1 text-[10px] text-[var(--muted)]">Scan bas niveau du fichier binaire</p>
                          </div>
                          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black ${diag.integrityOk ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                            <span className={`size-2 rounded-full ${diag.integrityOk ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                            {diag.integrityOk ? 'INTÈGRE' : 'CORROMPU'}
                          </div>
                        </div>
                        <div className="mt-6 rounded-xl bg-black/10 p-3 font-mono text-[10px] text-[var(--muted)] ring-1 ring-white/5 whitespace-pre-wrap leading-relaxed">
                          {diag.integrityDetail}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[var(--card)] p-6 ring-1 ring-[var(--border)] shadow-sm">
                        <h6 className="text-xs font-black uppercase tracking-widest text-[var(--text-h)]">Cohérence Relationnelle</h6>
                        <p className="mt-1 text-[10px] text-[var(--muted)]">Contrôle des liens entre entités</p>

                        <div className="mt-6">
                          {diag.foreignKeyViolations.length === 0 ? (
                            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/5 p-4 ring-1 ring-emerald-500/10">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                                <span className="material-symbols-outlined text-[20px]">verified</span>
                              </div>
                              <div className="text-[11px] font-bold text-emerald-600">Structure parfaitement cohérente.</div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {diag.foreignKeyViolations.map((v, i) => (
                                <div key={i} className="flex items-center gap-3 rounded-xl bg-red-500/5 p-3 ring-1 ring-red-500/10 text-red-600 text-[10px] font-bold">
                                  <span className="material-symbols-outlined text-[16px] opacity-60">warning</span>
                                  {v}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {devDiagSection === 'all' || devDiagSection === 'data' ? (
                  <section className="space-y-3" aria-labelledby="logs-dev-data-heading">
                    <h5 id="logs-dev-data-heading" className="border-b border-[var(--border)] pb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
                      2 · Données stockées
                    </h5>
                    <div className="rounded-2xl bg-[var(--card)] p-6 ring-1 ring-[var(--border)] shadow-sm">
                      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                        <div>
                          <h6 className="text-xs font-black uppercase tracking-widest text-[var(--text-h)]">Volumes par Table</h6>
                          <p className="mt-1 text-[10px] text-[var(--muted)]">Nombre d’enregistrements par entité SQLite</p>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-[var(--muted)] opacity-40">table_chart</span>
                      </div>
                      {filteredDevTableCounts.length === 0 ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">Aucune table trouvée.</p>
                      ) : (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {filteredDevTableCounts.map((t) => (
                            <div
                              key={t.name}
                              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface)] p-2.5 ring-1 ring-inset ring-[var(--border)] shadow-inner transition-all hover:ring-[var(--accent)]/30"
                            >
                              <span className="truncate font-mono text-[10px] font-bold text-[var(--muted)]" title={t.name}>
                                {t.name}
                              </span>
                              <span className="shrink-0 font-black tabular-nums text-[var(--text-h)]">{t.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl bg-[var(--card)] p-6 ring-1 ring-[var(--border)] shadow-sm">
                      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                        <div>
                          <h6 className="text-xs font-black uppercase tracking-widest text-[var(--text-h)]">Métadonnées Application</h6>
                          <p className="mt-1 text-[10px] text-[var(--muted)]">Configuration bas-niveau (table app_meta)</p>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-[var(--muted)] opacity-40">settings_ethernet</span>
                      </div>
                      {diag.appMeta.length === 0 ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">Aucune métadonnée.</p>
                      ) : (
                        <div className="mt-4 grid gap-2 lg:grid-cols-2">
                          {filteredDevAppMeta.map((m) => (
                            <div
                              key={m.key}
                              className="flex flex-col gap-1 rounded-xl bg-[var(--surface)] p-3 ring-1 ring-inset ring-[var(--border)] shadow-inner"
                            >
                              <span className="font-mono text-[9px] font-black uppercase tracking-widest text-[var(--accent)]">{m.key}</span>
                              <span className="break-all text-[11px] font-bold text-[var(--text-h)]">{m.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}

                {devDiagSection === 'all' || devDiagSection === 'controls' ? (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] opacity-50">3 · Contrôles Internes</span>
                    </div>

                    <div className="rounded-2xl bg-[var(--card)] p-6 ring-1 ring-[var(--border)] shadow-sm">
                      <div className="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-3">
                        <div>
                          <h6 className="text-xs font-black uppercase tracking-widest text-[var(--text-h)]">Signalements Automatiques</h6>
                          <p className="mt-1 text-[10px] text-[var(--muted)]">Anomalies métier et erreurs système détectées</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          <span className="size-2 rounded-full bg-amber-500" />
                          <span className="size-2 rounded-full bg-red-500" />
                        </div>
                      </div>

                      {diag.anomalies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-30">
                          <span className="material-symbols-outlined text-[48px]">verified_user</span>
                          <span className="mt-2 text-xs font-bold uppercase tracking-widest">Aucune anomalie détectée</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {filteredDevAnomalies.map((a, i) => {
                            const sev = anomalySeverity(a)
                            return (
                              <div key={`${a}-${i}`} className={`flex items-start gap-4 rounded-xl p-4 transition-all hover:brightness-105 ${sev === 'blocking' ? 'bg-red-500/5 ring-1 ring-red-500/10' :
                                sev === 'warning' ? 'bg-amber-500/5 ring-1 ring-amber-500/10' :
                                  'bg-[var(--surface)]/50 ring-1 ring-[var(--border)]'
                                }`}>
                                <div className={`mt-1 flex size-2 shrink-0 rounded-full ${anomalyDotClass(sev)} ${sev === 'blocking' ? 'animate-pulse' : ''}`} />
                                <div className="min-w-0 flex-1">
                                  <p className={`text-[11px] font-black leading-relaxed ${sev === 'blocking' ? 'text-red-500' :
                                    sev === 'warning' ? 'text-amber-500' :
                                      'text-[var(--text-h)]'
                                    }`}>
                                    {a}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}

                <p className="rounded-lg border border-dashed border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_50%,transparent)] px-3 py-2.5 text-center text-[10px] leading-relaxed text-[var(--muted)]">
                  Outil réservé au diagnostic. En cas d’incohérence, sauvegarde la base depuis Profil puis contacte le
                  support technique.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {selectedLog && (
        <YoboModal
          open={!!selectedLog}
          title="Fiche Événement"
          onClose={() => setSelectedLog(null)}
          maxWidthClass="max-w-xl"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-inset ring-[var(--border)] shadow-inner">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">
                  <span className="material-symbols-outlined text-[14px]">account_circle</span>
                  Identité
                </div>
                <div className="mt-2 text-base font-black tracking-tighter text-[var(--text-h)] truncate">
                  {selectedLog.userName ?? 'Utilisateur Inconnu'}
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-inset ring-[var(--border)] shadow-inner">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  Horodatage
                </div>
                <div className="mt-2 text-sm font-black tabular-nums tracking-tighter text-[var(--text-h)] truncate">
                  {formatDateHeureFr(selectedLog.createdAt)}
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklab,var(--surface)_95%,var(--accent))] p-8 text-center ring-1 ring-[var(--accent)]/20 shadow-[0_32px_64px_-16px_rgba(240,133,10,0.1)]">
              <div className="flex items-center justify-center gap-2">
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ring-inset ${selectedLog.actionType === 'auth' ? 'bg-amber-500/10 text-amber-500 ring-amber-500/20' :
                  selectedLog.actionType === 'order' ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' :
                    selectedLog.actionType === 'cash' ? 'bg-blue-500/10 text-blue-500 ring-blue-500/20' :
                      'bg-[var(--accent-bg)] text-[var(--accent)] ring-[var(--accent-border)]/20'
                  }`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {logTypeLabelFr(selectedLog.actionType)}
                  </span>
                </div>
              </div>
              <h3 className="mt-6 text-2xl font-black leading-tight tracking-tighter text-[var(--text-h)]">
                {logActionLabelFr(selectedLog.actionType, selectedLog.action, selectedLog.meta)}
              </h3>
              {selectedLog.description && (
                <p className="mt-4 text-[13px] font-bold leading-relaxed text-[var(--muted)] opacity-80 max-w-sm mx-auto">
                  {selectedLog.description}
                </p>
              )}
            </div>

            {selectedLog.meta && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] opacity-50">Données Techniques (JSON / Meta)</span>
                </div>
                <div className="max-h-48 overflow-auto rounded-2xl bg-black/30 p-5 font-mono text-[11px] leading-relaxed text-[var(--accent)] shadow-inner ring-1 ring-white/5 scrollbar-thin scrollbar-thumb-white/10">
                  {selectedLog.meta}
                </div>
              </div>
            )}

            <button
              type="button"
              className="w-full rounded-2xl bg-[var(--card)] py-4 text-xs font-black uppercase tracking-[0.2em] text-[var(--text-h)] ring-1 ring-[var(--border)] transition-all hover:ring-[var(--accent)]/50 active:scale-95 shadow-sm"
              onClick={() => setSelectedLog(null)}
            >
              Fermer
            </button>
          </div>
        </YoboModal>
      )}
    </div>
  )
}
