import { parseVersDate } from './formatDateHeureFr'
import type { HistoryDateJma } from '../types/yoboApp'

/** « Du » : mois et année courants ; jour (J) vide jusqu’à saisie. */
export function historyJmaDuDefault(): HistoryDateJma {
  const now = new Date()
  return {
    j: '',
    m: String(now.getMonth() + 1).padStart(2, '0'),
    a: String(now.getFullYear()),
  }
}

/** « Au » : jour, mois et année = date du jour (saisie complète). */
export function historyJmaAuDefault(): HistoryDateJma {
  const now = new Date()
  return {
    j: String(now.getDate()).padStart(2, '0'),
    m: String(now.getMonth() + 1).padStart(2, '0'),
    a: String(now.getFullYear()),
  }
}

/** j/m/a complets et date calendaire valide → `YYYY-MM-DD`, sinon `null`. */
export function historyJmaToYmd(p: HistoryDateJma): string | null {
  const j = p.j.trim()
  const m = p.m.trim()
  const a = p.a.trim()
  if (j === '' || m === '' || a === '') return null
  const dj = Number.parseInt(j, 10)
  const dm = Number.parseInt(m, 10)
  const da = Number.parseInt(a, 10)
  if (!Number.isFinite(dj) || !Number.isFinite(dm) || !Number.isFinite(da)) return null
  if (da < 1900 || da > 2100) return null
  if (dm < 1 || dm > 12) return null
  if (dj < 1 || dj > 31) return null
  const dt = new Date(da, dm - 1, dj)
  if (dt.getFullYear() !== da || dt.getMonth() !== dm - 1 || dt.getDate() !== dj) return null
  return `${String(da).padStart(4, '0')}-${String(dm).padStart(2, '0')}-${String(dj).padStart(2, '0')}`
}

/** Jour civil local (YYYY-MM-DD) à partir d’une date/heure SQLite — l’heure est ignorée pour le « jour de session ». */
export function localCalendarYmdFromDbDateTime(input: string): string | null {
  const dt = parseVersDate(input)
  if (!dt) return null
  const y = dt.getFullYear()
  const m = dt.getMonth() + 1
  const d = dt.getDate()
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Heure locale seule (ex. 14h 05min), pour cartes session. */
export function formatHeureSeuleFr(input: string): string {
  const dt = parseVersDate(input)
  if (!dt) return '—'
  const h = dt.getHours()
  const min = dt.getMinutes()
  return `${h}h ${min.toString().padStart(2, '0')}min`
}

/** Jour civil local court (ex. mer. 21 mars 2026), pour cartes session. */
export function formatSessionCalendarDayFr(input: string): string {
  const dt = parseVersDate(input)
  if (!dt) return '—'
  try {
    return dt.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}
