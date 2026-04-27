/** Tailles de page proposées dans l’UI (tableaux / listes). */
export const YOBO_PAGE_SIZE_OPTIONS = [8, 12, 20, 50] as const

export function getTotalPages(totalItems: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const n = Math.max(0, totalItems)
  return Math.max(1, Math.ceil(n / size))
}

/** `page` est 1-based. */
export function paginateSlice<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const totalPages = getTotalPages(items.length, size)
  const p = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  const start = (p - 1) * size
  return items.slice(start, start + size)
}

export function clampPage(page: number, totalPages: number): number {
  const tp = Math.max(1, totalPages)
  return Math.min(Math.max(1, page), tp)
}

/** Indices affichés « du x au y » (1-based inclus). */
export function paginationRangeLabel(
  page: number,
  pageSize: number,
  totalItems: number,
): { from: number; to: number; total: number } {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const total = Math.max(0, totalItems)
  if (total === 0) return { from: 0, to: 0, total: 0 }
  const tp = getTotalPages(total, size)
  const p = clampPage(page, tp)
  const from = (p - 1) * size + 1
  const to = Math.min(p * size, total)
  return { from, to, total }
}

/**
 * Numéros de page à afficher avec ellipses logiques.
 * Ex. [1, 'gap', 4, 5, 6, 'gap', 12]
 */
export function getVisiblePageItems(
  currentPage: number,
  totalPages: number,
): Array<number | 'gap'> {
  const tp = Math.max(1, totalPages)
  const cur = clampPage(currentPage, tp)
  if (tp <= 7) {
    return Array.from({ length: tp }, (_, i) => i + 1)
  }
  const set = new Set<number>()
  set.add(1)
  set.add(tp)
  for (let i = cur - 1; i <= cur + 1; i++) {
    if (i >= 1 && i <= tp) set.add(i)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out: Array<number | 'gap'> = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('gap')
    out.push(p)
    prev = p
  }
  return out
}
