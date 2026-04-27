export type CartItem = {
  emoji: string
  name: string
  size: string
  /** Prix unitaire */
  price: number
  quantity: number
  /** Libellé catégorie (ticket / liste commande) — ex. PIZZA, PAIN MAISON */
  categoryLabel?: string
  /** Note cuisine / client pour cette ligne uniquement (ex. sans olives). */
  lineNote?: string
  /** Supplément gratiné direct (tacos). */
  hasGratine?: boolean
  /** Montant du supplément gratiné au moment de la vente. */
  gratineAmount?: number
}

export type GerantOrdersKpis = {
  orderCount: number
  revenueTotal: number
  revenueToday: number
  /** Semaine civile (lundi → dimanche), timezone locale. */
  revenueWeek: number
  /** Mois civil en cours. */
  revenueMonth: number
  distinctCashiers: number
}

export type OrderItem = {
  id: number
  items: string
  /** Lignes structurées (API Tauri) ; absent sur anciennes données en mémoire. */
  itemLines?: CartItem[]
  total: number
  /** État SQLite : validated | cancelled | modified */
  status: string
  cancelReason?: string | null
  /** Auteur de la commande (permissions annulation caissier). */
  userId: number
  time: string
  cashier: string
  /** Lien vers session caisse (caissier) ; absent pour anciennes commandes ou gérant. */
  cashSessionId?: number | null
  orderType?: string | null
  orderComment?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  receivedAmount?: number | null
  changeAmount?: number | null
}

/** Ligne article telle que stockée (ticket session historique). */
export type OrderTicketLineDto = {
  emoji: string
  name: string
  size: string
  price: number
  quantity: number
  categoryLabel?: string | null
  lineNote?: string | null
  /** Supplément gratiné direct (tacos). */
  hasGratine?: boolean
  /** Montant du supplément gratiné au moment de la vente. */
  gratineAmount?: number
}

export type OrderTicketDetailDto = {
  id: number
  time: string
  total: number
  cashier: string
  receivedAmount?: number | null
  changeAmount?: number | null
  customerPhone?: string | null
  customerAddress?: string | null
  lines: OrderTicketLineDto[]
}

/** Réponse `get_order_ticket_for_print` — même schéma que le détail ticket + session / type. */
export type OrderTicketPrintDto = OrderTicketDetailDto & {
  cashSessionId?: number | null
  orderType?: string | null
  orderComment?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
}

/** Format pour l'affichage de l'historique des commandes détaillées. */
export type SessionOrderDetailForPrint = {
  id: number
  timeIso: string
  total: number
  cashier: string
  lines: {
    name: string
    size: string
    quantity: number
    unitPrice: number
    categoryLabel?: string
    lineNote?: string
    hasGratine: boolean
    gratineAmount?: number
  }[]
  receivedAmount?: number | null
  changeAmount?: number | null
  customerPhone?: string | null
  customerAddress?: string | null
}
