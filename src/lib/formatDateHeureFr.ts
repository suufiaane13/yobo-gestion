/**
 * Formate une date/heure (SQLite `YYYY-MM-DD HH:MM:SS`, ISO, etc.)
 * en libellé français du type : lun 12 jan 2026 à 12h 33min
 */
const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] as const
const MOIS_COURTS = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'août',
  'sep',
  'oct',
  'nov',
  'déc',
] as const


export function parseVersDate(input: string): Date | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // SQLite / classique : 2026-01-12 12:33:45 ou 2026-01-12T12:33:45
  const m = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i,
  )
  if (m) {
    // Si la chaîne contient un suffixe timezone (`Z` ou `+02:00`), on laisse JS gérer la conversion.
    // Sinon, on parse en local (SQLite classique sans timezone).
    const hasTz = /Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)
    if (hasTz) {
      const fromIso = new Date(trimmed)
      return Number.isNaN(fromIso.getTime()) ? null : fromIso
    }

    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const h = Number(m[4])
    const min = Number(m[5])
    const s = m[6] != null ? Number(m[6]) : 0
    const dt = new Date(y, mo - 1, d, h, min, s)
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  const fromIso = new Date(trimmed)
  return Number.isNaN(fromIso.getTime()) ? null : fromIso
}

export function formatDateHeureFr(input: string | null | undefined): string {
  if (input == null || String(input).trim() === '') return '—'
  const s = String(input)
  const d = parseVersDate(s)
  if (!d) return s.trim()

  const now = new Date()
  // On base "aujourd'hui/hier" sur la journée locale (pas UTC), sinon ça peut décaler autour de minuit.
  const dayKey = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
  const dayDiff = Math.round((dayKey(d) - dayKey(now)) / 86400000)

  const wd = JOURS_COURTS[d.getDay()]
  const day = d.getDate()
  const monthShort = MOIS_COURTS[d.getMonth()]
  const year = d.getFullYear()
  const h = d.getHours()
  const min = d.getMinutes()
  const minStr = min.toString().padStart(2, '0')

  const timePart = `${h}h ${minStr}min`

  if (dayDiff === 0) return `aujourd'hui à ${timePart}`
  if (dayDiff === -1) return `hier à ${timePart}`
  if (dayDiff === 1) return `demain à ${timePart}`

  // Pour les jours proches, on préfère le jour de la semaine.
  if (dayDiff >= -6 && dayDiff <= 6) return `${wd} à ${timePart}`

  return `${wd} ${day} ${monthShort} ${year} à ${timePart}`
}

/** Heure locale seule (ex. `14h 05min`) pour colonnes « Heure » dans les tableaux. */
export function formatHeureFr(input: string | null | undefined): string {
  if (input == null || String(input).trim() === '') return '—'
  const d = parseVersDate(String(input))
  if (!d) return String(input).trim()
  const h = d.getHours()
  const min = d.getMinutes()
  const minStr = min.toString().padStart(2, '0')
  return `${h}h ${minStr}min`
}

/**
 * Libellé date identique à la barre de titre (YoboTitleBar) et aux tickets thermiques.
 */
export function formatTitleBarDateLineFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
