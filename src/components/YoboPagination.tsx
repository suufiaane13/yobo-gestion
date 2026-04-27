import { useMemo } from 'react'
import {
  YOBO_PAGE_SIZE_OPTIONS,
  clampPage,
  getTotalPages,
  getVisiblePageItems,
  paginationRangeLabel,
} from '../lib/pagination'

export type YoboPaginationProps = {
  /** Page courante (1-based). */
  page: number
  /** Nombre total d’éléments (liste filtrée). */
  totalItems: number
  /** Taille de page. */
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  /** Options du sélecteur ; défaut = YOBO_PAGE_SIZE_OPTIONS */
  pageSizeOptions?: readonly number[]
  className?: string
  /** Masque tout le bloc si totalItems === 0 (après le seuil minItemsToShow). */
  hideWhenEmpty?: boolean
  /** Affiche la pagination seulement si totalItems ≥ cette valeur (défaut 8). */
  minItemsToShow?: number
}

export function YoboPagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = YOBO_PAGE_SIZE_OPTIONS,
  className = '',
  hideWhenEmpty = true,
  minItemsToShow = 8,
}: YoboPaginationProps) {
  const totalPages = useMemo(() => getTotalPages(totalItems, pageSize), [totalItems, pageSize])
  const safePage = useMemo(() => clampPage(page, totalPages), [page, totalPages])
  const range = useMemo(
    () => paginationRangeLabel(safePage, pageSize, totalItems),
    [safePage, pageSize, totalItems],
  )
  const items = useMemo(() => getVisiblePageItems(safePage, totalPages), [safePage, totalPages])

  if (minItemsToShow > 0 && totalItems < minItemsToShow) return null

  if (hideWhenEmpty && totalItems === 0) return null

  return (
    <nav
      className={`yobo-pagination ${className}`.trim()}
      aria-label="Pagination"
    >
      <p className="yobo-pagination__meta">
        {totalItems === 0 ? (
          <span>Aucun élément</span>
        ) : (
          <>
            <span className="tabular-nums">
              {range.from}–{range.to}
            </span>
            <span className="yobo-pagination__meta-sep"> sur </span>
            <span className="tabular-nums">{range.total}</span>
          </>
        )}
      </p>
      <div className="yobo-pagination__row">
        <div className="yobo-pagination__pages">
          <button
            type="button"
            className="yobo-pagination__btn yobo-pagination__btn--nav"
            disabled={safePage <= 1 || totalItems === 0}
            aria-label="Page précédente"
            onClick={() => onPageChange(safePage - 1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="yobo-pagination__btn-text">Préc.</span>
          </button>
          {items.map((item, idx) =>
            item === 'gap' ? (
              <span key={`g-${idx}`} className="yobo-pagination__gap" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`yobo-pagination__btn yobo-pagination__btn--num ${
                  item === safePage ? 'yobo-pagination__btn--active' : ''
                }`}
                aria-label={`Page ${item}`}
                aria-current={item === safePage ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            className="yobo-pagination__btn yobo-pagination__btn--nav"
            disabled={safePage >= totalPages || totalItems === 0}
            aria-label="Page suivante"
            onClick={() => onPageChange(safePage + 1)}
          >
            <span className="yobo-pagination__btn-text">Suiv.</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 18l6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        {onPageSizeChange ? (
          <label className="yobo-pagination__size">
            <span className="yobo-pagination__size-label">Par page</span>
            <select
              className="yobo-pagination__select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Nombre d’éléments par page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </nav>
  )
}
