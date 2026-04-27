/**
 * Export CSV des journaux d’activité (gérant).
 */

import { logActionLabelFr, logTypeLabelFr } from './logLabelsFr'
import { isTauriRuntime } from './isTauriRuntime'
import { writeYoboDocumentsTextExport } from './yoboDocumentsExports'

export type LogCsvRow = {
  id: number
  userId: number | null
  userName: string | null
  actionType: string
  action: string
  description: string | null
  meta: string | null
  createdAt: string
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

function fmtCell(iso: string): string {
  if (!iso?.trim()) return ''
  return iso.trim().replace('T', ' ')
}

/** Télécharge un CSV UTF-8 (séparateur `;`, BOM) pour Excel / tableur. */
export async function downloadLogsCsv(userId: number | null, rows: LogCsvRow[]) {
  const header = [
    'N°',
    'Date / heure',
    'Catégorie',
    'Action (code)',
    'Action (libellé)',
    'Détail',
    'Utilisateur',
    'Méta',
  ]
  const lines = [
    header.map(escapeCsvCell).join(';'),
    ...rows.map((l) =>
      [
        String(l.id),
        fmtCell(l.createdAt),
        logTypeLabelFr(l.actionType),
        l.action,
        logActionLabelFr(l.actionType, l.action, l.meta),
        l.description ?? '',
        l.userName ?? 'Anonyme',
        l.meta ?? '',
      ]
        .map(escapeCsvCell)
        .join(';'),
    ),
  ]
  const content = `\uFEFF${lines.join('\r\n')}`

  if (isTauriRuntime() && userId != null) {
    await writeYoboDocumentsTextExport({
      userId,
      kind: 'logs',
      filename: `yobo-journaux-${fileStamp()}.csv`,
      content,
    })
    return
  }

  const blob = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yobo-journaux-${fileStamp()}.csv`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
