/**
 * Point d’entrée types applicatifs : réexporte les modules par domaine.
 * Préférer `import from './core' | './cash' | …` dans le code interne si tu veux des dépendances explicites.
 */
export type { Role, Theme, ThemePreference, Tab, BitmapData } from './core'
export type { AuthLoginResponse } from './auth'
export type { CatalogCategory, CatalogProduct, CatalogResponse } from './catalog'
export type {
  CartItem,
  GerantOrdersKpis,
  OrderItem,
  OrderTicketDetailDto,
  OrderTicketLineDto,
  OrderTicketPrintDto,
  SessionOrderDetailForPrint,
} from './orders'

export type {
  CashSessionCloseDto,
  CashSessionClosedRow,
  CashSessionDto,
  CashSessionOpenHistoriqueRow,
  CashSessionOpenTotalsDto,
} from './cash'
export type { CaissierDto, UserProfileDto } from './users'
export { caissierFromApiRow } from './users'
export type { HistoryDateJma } from './history'
