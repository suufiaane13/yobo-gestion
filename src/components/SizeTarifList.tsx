import { isBlankSizeKey, sortSizePairsForDisplay } from '../lib/productSizes'

export type TarifEntry = { label: string; price: number }

type SizeTarifListProps = {
  entries: TarifEntry[]
  onRemove: (label: string) => void
  emptyHint?: string
  /** grid3 : 3 colonnes par ligne · inline : toutes les tailles sur une ligne (défilement si besoin) */
  layout?: 'list' | 'grid3' | 'inline'
}

/**
 * Liste tarifaire (taille : prix MAD) — style ticket / grille POS, alignée YOBO.
 */
export function SizeTarifList({
  entries,
  onRemove,
  emptyHint = 'Aucune taille pour l’instant.',
  layout = 'list',
}: SizeTarifListProps) {
  if (entries.length === 0) {
    return <p className="yobo-tarif-empty">{emptyHint}</p>
  }

  if (layout === 'inline') {
    return (
      <ul className="yobo-tarif-list yobo-tarif-list--inline" role="list">
        {entries.map((s) => (
          <li
            key={s.label === '' ? '__single__' : s.label}
            className={`yobo-tarif-inline-item ${isBlankSizeKey(s.label) ? 'yobo-tarif-inline-item--single' : ''}`}
          >
            {isBlankSizeKey(s.label) ? (
              <span className="yobo-tarif-single-label">Prix unique</span>
            ) : (
              <>
                <span className="yobo-tarif-size">{s.label}</span>
                <span className="yobo-tarif-colon" aria-hidden>
                  :
                </span>
              </>
            )}
            <span className="yobo-tarif-inline-amount-wrap">
              <span className="yobo-tarif-amount">{s.price}</span>
              <span className="yobo-tarif-currency"> MAD</span>
            </span>
            <button
              type="button"
              className="yobo-tarif-remove yobo-tarif-remove--inline"
              aria-label={isBlankSizeKey(s.label) ? 'Retirer le prix unique' : `Retirer la taille ${s.label}`}
              onClick={() => onRemove(s.label)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    )
  }

  if (layout === 'grid3') {
    return (
      <ul className="yobo-tarif-list yobo-tarif-list--grid3" role="list">
        {entries.map((s) => (
          <li
            key={s.label === '' ? '__single__' : s.label}
            className={`yobo-tarif-row yobo-tarif-row--grid3 ${isBlankSizeKey(s.label) ? 'yobo-tarif-row--single' : ''}`}
          >
            <div className="yobo-tarif-grid-col yobo-tarif-grid-col--label">
              {isBlankSizeKey(s.label) ? (
                <span className="yobo-tarif-single-label">Prix unique</span>
              ) : (
                <span className="yobo-tarif-size">{s.label}</span>
              )}
            </div>
            <div className="yobo-tarif-grid-col yobo-tarif-grid-col--price">
              <span className="yobo-tarif-colon" aria-hidden>
                :
              </span>
              <span className="yobo-tarif-amount">{s.price}</span>
              <span className="yobo-tarif-currency"> MAD</span>
            </div>
            <div className="yobo-tarif-grid-col yobo-tarif-grid-col--action">
              <button
                type="button"
                className="yobo-tarif-remove"
                aria-label={isBlankSizeKey(s.label) ? 'Retirer le prix unique' : `Retirer la taille ${s.label}`}
                onClick={() => onRemove(s.label)}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="yobo-tarif-list" role="list">
      {entries.map((s) => (
        <li
          key={s.label === '' ? '__single__' : s.label}
          className={`yobo-tarif-row ${isBlankSizeKey(s.label) ? 'yobo-tarif-row--single' : ''}`}
        >
          {isBlankSizeKey(s.label) ? (
            <span className="yobo-tarif-single-label">Prix unique</span>
          ) : (
            <>
              <span className="yobo-tarif-size">{s.label}</span>
              <span className="yobo-tarif-colon" aria-hidden>
                :
              </span>
            </>
          )}
          <span className="yobo-tarif-price">
            <span className="yobo-tarif-amount">{s.price}</span>
            <span className="yobo-tarif-currency"> MAD</span>
          </span>
          <button
            type="button"
            className="yobo-tarif-remove"
            aria-label={isBlankSizeKey(s.label) ? 'Retirer le prix unique' : `Retirer la taille ${s.label}`}
            onClick={() => onRemove(s.label)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

type SizeTarifInlineProps = {
  sizes: Record<string, number>
}

/** Affichage compact des tailles (ex. colonne tableau) — même langage visuel sans bouton. */
export function SizeTarifInline({ sizes }: SizeTarifInlineProps) {
  const pairs = sortSizePairsForDisplay(Object.entries(sizes))
  if (pairs.length === 0) return <span className="text-[var(--muted)]">—</span>

  if (pairs.length === 1 && isBlankSizeKey(pairs[0]![0])) {
    const [, price] = pairs[0]!
    return (
      <div className="yobo-tarif-inline-wrap">
        <span
          className="yobo-tarif-inline-chip yobo-tarif-inline-chip--price-only"
          title="Prix unitaire"
          aria-label={`Prix unitaire, ${price} MAD`}
        >
          <span className="yobo-tarif-inline-price">{price}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="yobo-tarif-inline-wrap">
      {pairs.map(([label, price]) => (
        <span key={label === '' ? '__s' : label} className="yobo-tarif-inline-chip">
          <span className="yobo-tarif-inline-label">{label}</span>
          <span className="yobo-tarif-inline-sep">:</span>
          <span className="yobo-tarif-inline-price">{price}</span>
        </span>
      ))}
    </div>
  )
}
