/** Session ouverte (ligne « session actuelle » — gérant, historique). */
export type CashSessionOpenHistoriqueRow = {
  id: number
  openedAt: string
  openingAmount: number
  cashierName: string
  ordersCount: number
  salesTotal: number
}

export type CashSessionClosedRow = {
  id: number
  openedAt: string
  closedAt: string
  openingAmount: number
  salesTotal: number
  cashierName: string
  /** Même source que le ticket à la fermeture de caisse (réimpression historique). */
  closingAmount: number
  theoretical: number
  gap: number
  ordersCount: number
  comment?: string | null
}

/** Session caisse ouverte (caissier). */
export type CashSessionDto = {
  id: number
  /** Utilisateur qui a ouvert la session (caissier). */
  userId: number
  openingAmount: number
  openedAt: string
}

/** Résumé après fermeture de caisse. */
export type CashSessionCloseDto = {
  sessionId: number
  openingAmount: number
  closingAmount: number
  salesTotal: number
  theoretical: number
  gap: number
  ordersCount: number
  closedAt: string
}
