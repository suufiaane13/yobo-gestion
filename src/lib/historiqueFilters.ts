import type { CashSessionClosedRow, OrderItem } from '../types/yoboApp'
import { localCalendarYmdFromDbDateTime } from './historySessionFormats'

/** Période sur la date d’ouverture de session (jour civil local). */
export type HistorySessionPeriodPreset = 'all' | 'today' | '7d' | '30d'

export type HistoryOrderStatusFilter = 'all' | 'validated' | 'cancelled' | 'modified'

function todayYmdLocal(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Filtre sur `openedAt` de session (fermée). */
export function sessionOpenedAtMatchesPreset(openedAt: string, preset: HistorySessionPeriodPreset): boolean {
  if (preset === 'all') return true
  const ymd = localCalendarYmdFromDbDateTime(openedAt)
  if (!ymd) return false
  const today = todayYmdLocal()
  if (preset === 'today') return ymd === today
  const daysBack = preset === '7d' ? 6 : 29
  const minYmd = addDaysToYmd(today, -daysBack)
  return ymd >= minYmd && ymd <= today
}

export function filterClosedSessionsForHistorique(
  rows: CashSessionClosedRow[],
  preset: HistorySessionPeriodPreset,
  role: 'gerant' | 'caissier',
): CashSessionClosedRow[] {
  const filtered = rows.filter((r) => sessionOpenedAtMatchesPreset(r.openedAt, preset))
  return role === 'caissier' ? filtered.slice(0, 7) : filtered
}

export type HistoriqueOrderFilterOpts = {
  sessionFilter: string
  search: string
  statusFilter: HistoryOrderStatusFilter
  /** Chaîne exacte du caissier (affichage) ; vide = tous. */
  cashierFilter: string
}

export function orderMatchesHistoriqueFilters(o: OrderItem, opts: HistoriqueOrderFilterOpts): boolean {
  const sessionIdNum =
    opts.sessionFilter === 'all' ? null : Number.parseInt(opts.sessionFilter, 10)
  if (sessionIdNum !== null && Number.isFinite(sessionIdNum)) {
    if (o.cashSessionId !== sessionIdNum) return false
  }

  if (opts.statusFilter !== 'all' && o.status !== opts.statusFilter) return false

  const cf = opts.cashierFilter.trim()
  if (cf !== '' && (o.cashier ?? '').trim() !== cf) return false

  const q = opts.search.trim().toLowerCase()
  if (q) {
    const idStr = `#${o.id}`.toLowerCase()
    const cashier = (o.cashier ?? '').toLowerCase()
    const items = (o.items ?? '').toLowerCase()
    const phone = String((o as { customerPhone?: string | null }).customerPhone ?? '').toLowerCase()
    const digitsQ = q.replace(/\D/g, '')
    const totalStr = String(o.total)
    const matchId = idStr.includes(q)
    const matchUser = cashier.includes(q)
    const matchItems = items.includes(q)
    const matchPhone = digitsQ.length >= 6 ? phone.replace(/\D/g, '').includes(digitsQ) : phone.includes(q)
    const matchAmount = digitsQ.length > 0 ? totalStr.includes(digitsQ) : false
    if (!matchId && !matchUser && !matchItems && !matchPhone && !matchAmount) return false
  }

  return true
}

export function distinctCashierNamesFromOrders(orders: OrderItem[]): string[] {
  const set = new Set<string>()
  for (const o of orders) {
    const n = (o.cashier ?? '').trim()
    if (n !== '') set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
}
