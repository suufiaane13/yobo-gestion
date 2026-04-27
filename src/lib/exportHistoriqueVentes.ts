/**
 * Export des ventes (historique) pour le gérant — CSV téléchargeable,
 * « PDF » via aperçu d’impression (choisir l’imprimante PDF du système).
 */

import { client } from './yoboClientMessages'
import { orderStatusLabelFr } from './orderStatus'
import { isTauriRuntime } from './isTauriRuntime'
import { writeYoboDocumentsTextExport } from './yoboDocumentsExports'

export type HistoriqueSessionExport = {
  id: number
  openedAt: string
  closedAt: string
  openingAmount: number
  salesTotal: number
  cashierName: string
}

export type HistoriqueCommandeExport = {
  id: number
  time: string
  total: number
  /** État SQLite : validated | cancelled | modified */
  status: string
  cashier: string
  items: string
  cashSessionId?: number | null
}

/**
 * Si toutes les commandes ont le même cashSessionId (y compris toutes sans session),
 * la session n’est affichée qu’une fois (sous-titre / ligne d’en-tête), pas en colonne répétée.
 * `mixed` = plusieurs sessions différentes → colonne par ligne.
 */
function commandesUniqueCashSessionId(
  rows: HistoriqueCommandeExport[],
): number | null | 'mixed' | 'empty' {
  if (rows.length === 0) return 'empty'
  const first = rows[0].cashSessionId ?? null
  for (let i = 1; i < rows.length; i++) {
    const v = rows[i].cashSessionId ?? null
    if (v !== first) return 'mixed'
  }
  return first
}

function fileStamp(): string {
  const d = new Date()
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

function escapeCsvCell(raw: string): string {
  const s = String(raw)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function downloadUtf8Csv(userId: number | null, filename: string, csvContent: string) {
  if (isTauriRuntime() && userId != null) {
    await writeYoboDocumentsTextExport({
      userId,
      kind: 'csv',
      filename,
      // BOM + contenu pour Excel
      content: `\uFEFF${csvContent}`,
    })
    return
  }
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Formate une date/heure DB pour CSV (brut + lisible court). */
function fmtCell(iso: string): string {
  if (!iso?.trim()) return ''
  return iso.trim().replace('T', ' ')
}

export async function exportHistoriqueSessionsCsv(
  userId: number | null,
  rows: HistoriqueSessionExport[],
  label = 'sessions',
) {
  const header = [
    'N° session',
    'Ouverture',
    'Fermeture',
    'Fond caisse (MAD)',
    'Ventes session (MAD)',
    'Caissier',
  ]
  const lines = [
    header.map(escapeCsvCell).join(';'),
    ...rows.map((s) =>
      [
        String(s.id),
        fmtCell(s.openedAt),
        fmtCell(s.closedAt),
        String(s.openingAmount),
        String(Math.round(s.salesTotal * 100) / 100),
        s.cashierName ?? '',
      ]
        .map(escapeCsvCell)
        .join(';'),
    ),
  ]
  await downloadUtf8Csv(userId, `yobo-${label}-${fileStamp()}.csv`, lines.join('\r\n'))
}

export async function exportHistoriqueCommandesCsv(
  userId: number | null,
  rows: HistoriqueCommandeExport[],
  label = 'commandes',
) {
  const sessionMode = commandesUniqueCashSessionId(rows)
  const sessionOnceLine =
    sessionMode !== 'mixed' && sessionMode !== 'empty'
      ? `Session caisse;${sessionMode != null ? String(sessionMode) : '—'}`
      : null

  const header =
    sessionMode === 'mixed'
      ? ['N° commande', 'Date / heure', 'Montant (MAD)', 'Statut', 'Caissier', 'N° session', 'Détail']
      : ['N° commande', 'Date / heure', 'Montant (MAD)', 'Statut', 'Caissier', 'Détail']

  const dataLines = rows.map((o) => {
    const base = [
      String(o.id),
      fmtCell(o.time),
      String(o.total),
      orderStatusLabelFr(o.status),
      o.cashier ?? '',
      ...(sessionMode === 'mixed'
        ? [o.cashSessionId != null ? String(o.cashSessionId) : '—']
        : []),
      o.items ?? '',
    ]
    return base.map(escapeCsvCell).join(';')
  })

  const lines = [
    ...(sessionOnceLine ? [sessionOnceLine] : []),
    header.map(escapeCsvCell).join(';'),
    ...dataLines,
  ]
  await downloadUtf8Csv(userId, `yobo-${label}-${fileStamp()}.csv`, lines.join('\r\n'))
}

/** Colonnes alignées à droite (montants, n° compacts). */
function buildPrintableTable(
  headers: string[],
  bodyRows: string[][],
  rightAlignColIndexes: number[] = [],
): string {
  const right = new Set(rightAlignColIndexes)
  const th = headers
    .map((h, i) => `<th${right.has(i) ? ' class="yobo-pdf-col--num"' : ''}>${escapeHtml(h)}</th>`)
    .join('')
  const trs = bodyRows
    .map(
      (cells) =>
        `<tr>${cells
          .map((c, i) => `<td${right.has(i) ? ' class="yobo-pdf-col--num"' : ''}>${escapeHtml(c)}</td>`)
          .join('')}</tr>`,
    )
    .join('')
  return `<div class="yobo-pdf-table-card"><table class="yobo-pdf-table"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Titre hero : « YOBO » en couleur accent (comme l’app), reste échappé. */
function pdfHeroTitle(title: string): string {
  const t = title.trim()
  const prefix = /^YOBO\s*—\s*/i
  if (prefix.test(t)) {
    const rest = t.replace(prefix, '').trim()
    return `<span class="yobo-pdf-accent-word">YOBO</span><span class="yobo-pdf-title-rest"> — ${escapeHtml(rest)}</span>`
  }
  return escapeHtml(t)
}

function buildPrintableFullHtml(title: string, subtitle: string, tableHtml: string): string {
  const css = `
    :root {
      --y-pdf-text: #1c1c1c;
      --y-pdf-muted: #5a5a5a;
      --y-pdf-bg: #ecebe9;
      --y-pdf-card: #ffffff;
      --y-pdf-surface: #f5f4f2;
      --y-pdf-border: #c6c6c6;
      --y-pdf-accent: #f0850a;
      --y-pdf-accent-soft: rgba(240, 133, 10, 0.14);
      --y-pdf-accent-ink: #4d2600;
      --y-pdf-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.18);
      --y-sans: Inter, system-ui, 'Segoe UI', Roboto, sans-serif;
      --y-label: Manrope, Inter, system-ui, 'Segoe UI', Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px 18px 28px;
      font-family: var(--y-sans);
      font-size: 13px;
      line-height: 1.45;
      color: var(--y-pdf-text);
      background: var(--y-pdf-bg);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .yobo-pdf-wrap {
      max-width: 920px;
      margin: 0 auto;
    }
    .yobo-pdf-hero {
      position: relative;
      background: var(--y-pdf-card);
      border-radius: 16px;
      padding: 18px 20px 20px;
      margin-bottom: 18px;
      border: 1px solid color-mix(in oklab, var(--y-pdf-border) 85%, transparent);
      box-shadow: var(--y-pdf-shadow);
      overflow: hidden;
    }
    .yobo-pdf-hero::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--y-pdf-accent) 0%, #ffb347 100%);
    }
    .yobo-pdf-brand {
      font-family: var(--y-label);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--y-pdf-accent);
      margin-bottom: 6px;
    }
    .yobo-pdf-hero h1 {
      font-family: var(--y-label);
      font-size: 1.35rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin: 0 0 6px;
      color: var(--y-pdf-text);
    }
    .yobo-pdf-accent-word { color: var(--y-pdf-accent); }
    .yobo-pdf-title-rest { color: var(--y-pdf-text); }
    .yobo-pdf-sub {
      margin: 0;
      font-size: 12px;
      color: var(--y-pdf-muted);
      font-weight: 600;
    }
    .yobo-pdf-table-card {
      background: var(--y-pdf-card);
      border-radius: 14px;
      border: 1px solid color-mix(in oklab, var(--y-pdf-border) 80%, transparent);
      box-shadow: var(--y-pdf-shadow);
      overflow: hidden;
    }
    .yobo-pdf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    .yobo-pdf-table thead th {
      font-family: var(--y-label);
      text-align: left;
      font-weight: 800;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--y-pdf-muted);
      background: var(--y-pdf-surface);
      padding: 11px 12px;
      border-bottom: 1px solid var(--y-pdf-border);
    }
    .yobo-pdf-table tbody td {
      padding: 10px 12px;
      vertical-align: top;
      border-bottom: 1px solid color-mix(in oklab, var(--y-pdf-border) 55%, transparent);
    }
    .yobo-pdf-table tbody tr:nth-child(even) td {
      background: color-mix(in oklab, var(--y-pdf-accent-soft) 35%, var(--y-pdf-card));
    }
    .yobo-pdf-table tbody tr:last-child td {
      border-bottom: none;
    }
    .yobo-pdf-col--num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    thead .yobo-pdf-col--num { text-align: right; }
    .yobo-pdf-foot {
      margin-top: 16px;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      color: var(--y-pdf-muted);
      font-family: var(--y-label);
      letter-spacing: 0.04em;
    }
    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      .yobo-pdf-wrap { max-width: none; }
      .yobo-pdf-hero,
      .yobo-pdf-table-card {
        box-shadow: none;
        border-radius: 0;
        border: none;
      }
      .yobo-pdf-hero::before { border-radius: 0; }
      .yobo-pdf-table thead th {
        background: var(--y-pdf-surface) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page { margin: 14mm 12mm; size: A4 portrait; }
    }
  `
  return (
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${css}</style></head><body>` +
    `<div class="yobo-pdf-wrap">` +
    `<header class="yobo-pdf-hero">` +
    `<div class="yobo-pdf-brand">YOBO Gestion</div>` +
    `<h1>${pdfHeroTitle(title)}</h1>` +
    `<p class="yobo-pdf-sub">${escapeHtml(subtitle)}</p>` +
    `</header>` +
    tableHtml +
    `<p class="yobo-pdf-foot">Export historique · document généré pour archivage ou PDF</p>` +
    `</div></body></html>`
  )
}

/**
 * Impression / PDF sans nouvelle fenêtre (évite le blocage des pop-ups).
 * Charte proche de l’app YOBO (thème clair, accent, cartes arrondies).
 */
function printViaHiddenIframe(title: string, subtitle: string, tableHtml: string) {
  const fullHtml = buildPrintableFullHtml(title, subtitle, tableHtml)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Aperçu impression YOBO')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'

  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument
  if (!win || !doc) {
    iframe.remove()
    throw new Error('print_iframe_unavailable')
  }

  doc.open()
  doc.write(fullHtml)
  doc.close()

  let fallbackRemove = 0
  const cleanup = () => {
    window.clearTimeout(fallbackRemove)
    if (iframe.parentNode) iframe.remove()
  }
  fallbackRemove = window.setTimeout(cleanup, 120_000)
  win.addEventListener('afterprint', cleanup, { once: true })

  window.setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
      cleanup()
      throw new Error('print_failed')
    }
  }, 0)
}

/** Message utilisateur pour les erreurs d’impression PDF (sans pop-up). */
export function historiquePdfPrintUserError(e: unknown): string {
  if (!(e instanceof Error)) return client.error.exportPdf
  switch (e.message) {
    case 'print_iframe_unavailable':
      return client.warn.pdfTryCsv
    case 'print_failed':
      return client.warn.pdfRetry
    default:
      return client.error.exportPdf
  }
}

export function exportHistoriqueSessionsPdfPrint(rows: HistoriqueSessionExport[]) {
  const headers = [
    'N°',
    'Ouverture',
    'Fermeture',
    'Fond caisse',
    'Ventes',
    'Caissier',
  ]
  const body = rows.map((s) => [
    String(s.id),
    fmtCell(s.openedAt),
    fmtCell(s.closedAt),
    `${s.openingAmount} MAD`,
    `${Math.round(s.salesTotal * 100) / 100} MAD`,
    s.cashierName ?? '',
  ])
  printViaHiddenIframe(
    'YOBO — Sessions caisse',
    `${rows.length} session(s) — « Enregistrer au format PDF » depuis la boîte d’impression`,
    buildPrintableTable(headers, body, [3, 4]),
  )
}

export async function exportHistoriqueSessionsPdfHtmlFile(userId: number, rows: HistoriqueSessionExport[]) {
  if (!isTauriRuntime()) throw new Error('Export fichier disponible uniquement sur Desktop.')
  const headers = ['N°', 'Ouverture', 'Fermeture', 'Fond caisse', 'Ventes', 'Caissier']
  const body = rows.map((s) => [
    String(s.id),
    fmtCell(s.openedAt),
    fmtCell(s.closedAt),
    `${s.openingAmount} MAD`,
    `${Math.round(s.salesTotal * 100) / 100} MAD`,
    s.cashierName ?? '',
  ])
  const html = buildPrintableFullHtml(
    'YOBO — Sessions caisse',
    `${rows.length} session(s) — document HTML prêt à imprimer (ou enregistrer en PDF)`,
    buildPrintableTable(headers, body, [3, 4]),
  )
  const ts = new Date()
  const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(
    ts.getHours(),
  ).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`
  const filename = `sessions-${stamp}.html`
  return await writeYoboDocumentsTextExport({
    userId,
    kind: 'pdf',
    filename,
    content: html,
  })
}

export function exportHistoriqueCommandesPdfPrint(rows: HistoriqueCommandeExport[]) {
  const sessionMode = commandesUniqueCashSessionId(rows)
  const sessionLine =
    sessionMode !== 'mixed' && sessionMode !== 'empty'
      ? sessionMode != null
        ? `Session caisse n° ${sessionMode} — `
        : `Session caisse : non renseignée — `
      : ''

  const headers =
    sessionMode === 'mixed'
      ? ['N°', 'Date / heure', 'Montant', 'Statut', 'Caissier', 'N° session', 'Détail']
      : ['N°', 'Date / heure', 'Montant', 'Statut', 'Caissier', 'Détail']

  const body = rows.map((o) => [
    String(o.id),
    fmtCell(o.time),
    `${o.total} MAD`,
    orderStatusLabelFr(o.status),
    o.cashier ?? '',
    ...(sessionMode === 'mixed'
      ? [o.cashSessionId != null ? String(o.cashSessionId) : '—']
      : []),
    o.items ?? '',
  ])

  const sub = `${sessionLine}${rows.length} commande(s) — « Enregistrer au format PDF » depuis la boîte d’impression`
  printViaHiddenIframe(
    'YOBO — Commandes',
    sub,
    buildPrintableTable(headers, body, sessionMode === 'mixed' ? [2, 5] : [2]),
  )
}

export async function exportHistoriqueCommandesPdfHtmlFile(userId: number, rows: HistoriqueCommandeExport[]) {
  if (!isTauriRuntime()) throw new Error('Export fichier disponible uniquement sur Desktop.')
  const sessionMode = commandesUniqueCashSessionId(rows)
  const headers =
    sessionMode === 'mixed'
      ? ['N°', 'Date / heure', 'Montant', 'Statut', 'Caissier', 'N° session', 'Détail']
      : ['N°', 'Date / heure', 'Montant', 'Statut', 'Caissier', 'Détail']
  const body = rows.map((o) => [
    String(o.id),
    fmtCell(o.time),
    `${o.total} MAD`,
    orderStatusLabelFr(o.status),
    o.cashier ?? '',
    ...(sessionMode === 'mixed' ? [o.cashSessionId != null ? String(o.cashSessionId) : '—'] : []),
    o.items ?? '',
  ])
  const html = buildPrintableFullHtml(
    'YOBO — Commandes',
    `${rows.length} commande(s) — document HTML prêt à imprimer (ou enregistrer en PDF)`,
    buildPrintableTable(headers, body, sessionMode === 'mixed' ? [2, 5] : [2]),
  )
  const ts = new Date()
  const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(
    ts.getHours(),
  ).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`
  const filename = `commandes-${stamp}.html`
  return await writeYoboDocumentsTextExport({
    userId,
    kind: 'pdf',
    filename,
    content: html,
  })
}
