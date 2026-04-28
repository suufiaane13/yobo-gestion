import type { OrderItem } from '../types/yoboApp'
import { useYoboStore } from '../store'
import { useMemo } from 'react'
import { formatHeureFr, parseVersDate } from '../lib/formatDateHeureFr'
import { localCalendarYmdFromDbDateTime } from '../lib/historySessionFormats'
import { orderCountsTowardRevenue } from '../lib/orderStatus'

function localTodayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Lundi de la semaine civile courante (locale). */
function localMondayYmd(): string {
  const d = new Date()
  const diff = (d.getDay() + 6) % 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - diff)
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
}

function localMonthFirstYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatMad(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MAD`
}

function sumValidatedRevenueBetween(orders: OrderItem[], fromYmd: string, toYmd: string): number {
  let sum = 0
  for (const o of orders) {
    if (!orderCountsTowardRevenue(o)) continue
    const ymd = localCalendarYmdFromDbDateTime(o.time)
    if (!ymd || ymd < fromYmd || ymd > toYmd) continue
    sum += o.total
  }
  return Math.round(sum * 100) / 100
}

const HOURLY_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const

export function DashboardPage() {
  const orders = useYoboStore((s) => s.orders)
  const gerantOrdersKpis = useYoboStore((s) => s.gerantOrdersKpis)
  const role = useYoboStore((s) => s.role)
  const cashSession = useYoboStore((s) => s.cashSession)
  const historyClosedSessions = useYoboStore((s) => s.historyClosedSessions)
  const setTab = useYoboStore((s) => s.setTab)
  const setOrderDetailTarget = useYoboStore((s) => s.setOrderDetailTarget)
  const theme = useYoboStore((s) => s.theme)

  const ordersCount =
    role === 'gerant' && gerantOrdersKpis != null
      ? gerantOrdersKpis.orderCount
      : orders.filter((o) => orderCountsTowardRevenue(o)).length

  const caDuJour = useMemo(() => {
    if (cashSession) {
      const sid = cashSession.id
      let sum = 0
      for (const o of orders) {
        if (o.cashSessionId === sid && orderCountsTowardRevenue(o)) sum += o.total
      }
      return Math.round(sum * 100) / 100
    }
    const last = historyClosedSessions[0]
    if (last) {
      return Math.round(last.salesTotal * 100) / 100
    }
    if (role === 'gerant' && gerantOrdersKpis) {
      const v = gerantOrdersKpis.revenueToday
      return v > 0 ? Math.round(v * 100) / 100 : null
    }
    return null
  }, [role, orders, cashSession, historyClosedSessions, gerantOrdersKpis])

  const kpiCaJour = useMemo(() => {
    if (role === 'gerant') {
      if (gerantOrdersKpis == null) return '—'
      return formatMad(Math.round(gerantOrdersKpis.revenueToday * 100) / 100)
    }
    if (caDuJour === null) return '—'
    return formatMad(caDuJour)
  }, [role, gerantOrdersKpis, caDuJour])

  const kpiCaSemaine = useMemo(() => {
    if (role === 'gerant') {
      if (gerantOrdersKpis == null) return '—'
      return formatMad(Math.round(gerantOrdersKpis.revenueWeek * 100) / 100)
    }
    const sum = sumValidatedRevenueBetween(orders, localMondayYmd(), localTodayYmd())
    return formatMad(sum)
  }, [role, gerantOrdersKpis, orders])

  const kpiCaMois = useMemo(() => {
    if (role === 'gerant') {
      if (gerantOrdersKpis == null) return '—'
      return formatMad(Math.round(gerantOrdersKpis.revenueMonth * 100) / 100)
    }
    const sum = sumValidatedRevenueBetween(orders, localMonthFirstYmd(), localTodayYmd())
    return formatMad(sum)
  }, [role, gerantOrdersKpis, orders])

  const hourlyRevenue = useMemo(() => {
    const todayYmd = localTodayYmd()
    const buckets = new Map<number, number>()
    for (const h of HOURLY_SLOTS) buckets.set(h, 0)
    for (const o of orders) {
      if (!orderCountsTowardRevenue(o)) continue
      const ymd = localCalendarYmdFromDbDateTime(o.time)
      if (ymd !== todayYmd) continue
      const d = parseVersDate(o.time ?? '')
      if (!d) continue
      const h = d.getHours()
      if (buckets.has(h)) buckets.set(h, (buckets.get(h) ?? 0) + o.total)
    }
    return HOURLY_SLOTS.map((h) => ({ hour: h, total: buckets.get(h) ?? 0 }))
  }, [orders])

  const maxHourlyRevenue = Math.max(...hourlyRevenue.map((b) => b.total), 1)


  return (
    <>
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-sm text-[var(--muted)] font-bold uppercase tracking-widest transition-all">Performance en temps réel</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-6 py-3 rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--text-h)] font-bold hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)] transition-all inline-flex items-center gap-2 shadow-lg shadow-black/10"
            onClick={() => setTab('historique')}
          >
            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            Historique
          </button>
          <button
            type="button"
            className="px-7 py-3 rounded-full text-[#4d2600] font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[var(--accent-container)]/25 inline-flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
            }}
            onClick={() => setTab('historique')}
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            Exporter
          </button>
        </div>
      </header>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-4">
        {[
          {
            key: 'cadj',
            label: 'CA du jour',
            value: kpiCaJour,
            icon: 'today',
            color: 'var(--accent)',
          },
          {
            key: 'cas',
            label: 'Semaine',
            value: kpiCaSemaine,
            icon: 'date_range',
            color: '#6366f1',
          },
          {
            key: 'cam',
            label: 'Mois',
            value: kpiCaMois,
            icon: 'calendar_month',
            color: '#8b5cf6',
          },
          {
            key: 'cmd',
            label: 'Commandes',
            value: `${ordersCount}`,
            icon: 'receipt_long',
            color: '#ec4899',
          },
        ].map((s) => (
          <div
            key={s.key}
            className="group relative overflow-hidden rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] shadow-[0_20px_48px_-20px_rgba(0,0,0,0.55)] transition-all hover:brightness-110"
          >
            <div className="flex items-center gap-4">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all"
                style={{
                  background: theme === 'light' 
                    ? `color-mix(in_oklab, ${s.color} 22%, white)` 
                    : `color-mix(in_oklab, ${s.color} 15%, transparent)`,
                  color: s.color,
                }}
              >
                <span className="material-symbols-outlined text-[24px]">{s.icon}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">
                  {s.label}
                </div>
                <div className="font-[var(--heading)] text-2xl sm:text-3xl font-black tabular-nums tracking-tighter text-[var(--text-h)] truncate" title={s.value}>
                  {(() => {
                    if (typeof s.value === 'string' && s.value.includes(' MAD')) {
                      const [num] = s.value.split(' MAD')
                      return (
                        <>
                          {num}
                          <span className="ml-2 text-[10px] sm:text-xs font-medium text-[var(--muted)] tracking-normal">MAD</span>
                        </>
                      )
                    }
                    return s.value
                  })()}
                </div>
              </div>
            </div>
            {/* Background decorative icon */}
            <div
              className={`absolute -right-2 -bottom-2 size-20 transition-all group-hover:scale-110 group-hover:rotate-12 ${
                theme === 'light' ? 'opacity-[0.15]' : 'opacity-[0.08]'
              }`}
              style={{ color: s.color }}
            >
              <span className="material-symbols-outlined text-[80px] leading-none">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <section className="lg:col-span-2 bg-[var(--surface)] rounded-2xl p-6 ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] shadow-[0_24px_56px_-24px_rgba(0,0,0,0.65)]">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-black tracking-tight text-[var(--text-h)]">Flux de revenus</h3>
              <p className="text-xs text-[var(--muted)] font-medium mt-1">Répartition horaire des ventes aujourd’hui</p>
            </div>
            <div className="flex gap-4 items-center px-4 py-2 rounded-full bg-[var(--card)] ring-1 ring-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-h)]">Ventes</span>
              </div>
            </div>
          </div>
          <div className="h-64 flex items-end gap-2.5 relative group/chart">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border-b-2 border-[var(--text-h)] w-full" />
              ))}
            </div>
            {hourlyRevenue.map((slot) => {
              const pct = slot.total > 0 ? Math.max((slot.total / maxHourlyRevenue) * 100, 4) : 2
              return (
                <div
                  key={slot.hour}
                  className="group relative flex flex-1 flex-col items-center justify-end h-full"
                >
                  <div
                    className={`w-full rounded-t-xl transition-all duration-700 ease-out cursor-pointer hover:brightness-110 shadow-lg ${
                      slot.total > 0 ? 'opacity-100' : 'opacity-20 translate-y-2'
                    }`}
                    style={{ 
                      height: `${pct}%`,
                      background: slot.total > 0 
                        ? 'linear-gradient(to top, var(--accent) 0%, var(--accent-container) 100%)'
                        : 'var(--card)'
                    }}
                  />
                  {slot.total > 0 && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-xl bg-black/80 backdrop-blur-md px-3 py-2 text-[10px] font-black text-white opacity-0 shadow-2xl transition-all group-hover:-top-14 group-hover:opacity-100 z-10 whitespace-nowrap ring-1 ring-white/10">
                      {slot.total.toLocaleString('fr-FR')} MAD
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/80 rotate-45" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-6 flex text-[10px] text-[var(--muted)] font-black tabular-nums border-t border-[var(--border)] pt-4">
            {hourlyRevenue.map((slot) => (
              <span key={slot.hour} className="flex-1 text-center group-hover:text-[var(--text-h)] transition-colors">
                {`${slot.hour}h`}
              </span>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="bg-[var(--surface)] rounded-2xl p-6 ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] shadow-[0_24px_56px_-24px_rgba(0,0,0,0.65)]">
            <h3 className="text-xl font-black tracking-tight mb-8 text-[var(--text-h)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">speed</span>
              Dernières ventes
            </h3>
            <div className="space-y-5">
              {(() => {
                const last5 = orders.slice(0, 5)
                const maxTotal = Math.max(...last5.map((o) => o.total), 1)
                return last5.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="w-full text-left group"
                    onClick={() => setOrderDetailTarget(order)}
                  >
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-[var(--muted)] mb-2">
                      <span>CMD #{order.id}</span>
                      <span className="text-[var(--text-h)]">{order.total} MAD</span>
                    </div>
                    <div className="h-1.5 bg-[var(--card)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-1000 group-hover:brightness-125"
                        style={{ width: `${Math.round((order.total / maxTotal) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-[color-mix(in_oklab,var(--muted)_60%,transparent)]">
                      {formatHeureFr(order.time)}
                    </div>
                  </button>
                ))
              })()}
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
