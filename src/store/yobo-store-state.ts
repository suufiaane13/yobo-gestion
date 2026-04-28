import type { CatalogCategory } from '../types/catalog'
import type { HistoryOrderStatusFilter } from '../lib/historiqueFilters'
import type {
  CaissierDto,
  CartItem,
  CashSessionCloseDto,
  CashSessionClosedRow,
  CashSessionDto,
  GerantOrdersKpis,
  OrderItem,
  Role,
  Tab,
  Theme,
  ThemePreference,
  UserProfileDto,
  BitmapData
} from '../types/yoboApp'
import type { MenuFallbackCategory as Category, MenuFallbackItem as MenuItem } from '../data/menuFallback'

export type ToastType = 'error' | 'warning' | 'success'
export type ToastItem = { id: string; type: ToastType; message: string }
export type PrintLogEntry = { time: string; msg: string; type: 'info' | 'error' | 'success' }

export interface YoboState {
  authed: boolean
  role: Role
  identifier: string
  pin: string
  theme: Theme
  avatar: string | null
  /** Comment choisir clair/sombre quand ce n’est pas piloté uniquement par `theme`. */
  themePreference: ThemePreference
  error: string | null
  userId: number | null
  tab: Tab
  menuCat: Category
  menuCatKey: string
  catalogCategories: CatalogCategory[]
  catalogItemsByCat: Record<string, MenuItem[]>
  selectedItem: number | null
  selectedSize: string | null
  posModalQty: number
  /** Note optionnelle pour la ligne en cours d’ajout (modal taille / quantité). */
  posModalLineNote: string
  /** Type commande POS ; `null` = rien choisi (obliger l’utilisateur avant validation). */
  orderType: 'sur_place' | 'emporter' | 'livraison' | null
  /** Note optionnelle attachée à la commande en cours. */
  orderComment: string
  /** Infos client (surtout livraison) — optionnelles. */
  orderCustomerPhone: string
  orderCustomerAddress: string
  cart: CartItem[]
  cashRenduModalOpen: boolean
  cashReceivedStr: string
  orderSubmitLoading: boolean
  cashSession: CashSessionDto | null
  cashSessionLoading: boolean
  cashOpeningStr: string
  cashStartLoading: boolean
  cashCloseModalOpen: boolean
  cashCloseAmountStr: string
  cashCloseComment: string
  cashCloseLoading: boolean
  cashCloseSummary: CashSessionCloseDto | null
  orders: OrderItem[]
  ordersTotalCount: number
  gerantOrdersKpis: GerantOrdersKpis | null
  historyGerantOrdersAll: OrderItem[]
  historyGerantOrdersLoading: boolean
  orderDetailTarget: OrderItem | null
  /** Modale raison d’annulation (par-dessus le détail commande). */
  orderCancelModalOpen: boolean
  orderCancelReason: string
  orderCancelLoading: boolean
  ordersLoading: boolean
  loginLoading: boolean
  toasts: ToastItem[]
  resetPinTarget: CaissierDto | null
  resetPinValue: string
  busyResetPinUserId: number | null
  resetPinError: string | null
  deactivateUserTarget: CaissierDto | null
  busyDeactivateUserId: number | null
  deactivateUserError: string | null
  historySearch: string
  historySessionFilter: string
  historyOrderStatusFilter: HistoryOrderStatusFilter
  /** Nom exact du caissier (liste déroulante) ; vide = tous. */
  historyOrderCashierFilter: string
  historyInnerTab: 'sessions' | 'orders'
  historyClosedSessions: CashSessionClosedRow[]
  historySessionsLoading: boolean
  profileOldPin: string
  profileOldVerified: boolean
  profileNewPin: string
  profileNewPinConfirm: string
  profileLoading: boolean
  profileError: string | null
  profileSuccess: string | null
  profileUserProfile: UserProfileDto | null
  profileUserLoading: boolean
  profileUserError: string | null
  profileNameDraft: string
  profileNamePinModalOpen: boolean
  profileNamePin: string
  profileNameLoading: boolean
  profileNameError: string | null
  caissiers: CaissierDto[]
  caissiersError: string | null
  caissiersLoading: boolean
  dashboardOrdersPage: number
  dashboardOrdersPageSize: number
  historySessionsPage: number
  historySessionsPageSize: number
  historyOrdersPage: number
  historyOrdersPageSize: number
  caissiersPage: number
  caissiersPageSize: number
  addingCaissier: boolean
  newCaissierName: string
  newCaissierPin: string
  newCaissierTheme: Theme
  busyToggleUserId: number | null
  /** En-tête et téléphone sur les tickets thermiques (app_meta, éditable gérant). */
  ticketShopLabel: string
  ticketShopPhone: string
  /** Deux boîtes d’impression successives si activé (réglage gérant). */
  /** Impression native Windows (option B1): imprimantes fixes. */
  ticketPrinterA: string
  ticketPrinterB: string
  printLogs: PrintLogEntry[]
  /** Confirmation déconnexion si caisse ouverte. */
  logoutConfirmOpen: boolean
  /** Réductions gérant */
  discountModalOpen: boolean
  discountAuthModalOpen: boolean
  discountAuthPin: string
  discountAuthLoading: boolean
  discountAuthError: string | null
  /** Flag pour le supplément gratiné dans la modal d'ajout (Tacos). */
  posModalHasGratine: boolean
  /** États gratinés individuels si quantité > 1. */
  posModalGratines: boolean[]
  /** Notes individuelles si quantité > 1. */
  posModalNotes: string[]
  /** APERÇU TICKET (Simulateur thermique) */
  ticketPreviewHtml: string | null
  ticketPreviewModalOpen: boolean
  /** MODALE LIVRAISON (Tél/Adresse) */
  deliveryModalOpen: boolean
  /** Confirmation de fermeture de l'application. */
  exitConfirmOpen: boolean
  gratinePrice: number
  /** Données bitmap du logo pour impression thermique. */
  ticketLogo: BitmapData | null
  /** Pour l'installation forcée après 7 jours */
  updateFirstSeenAt: string | null
  updateVersionSeen: string | null
}

export function createInitialYoboState(): YoboState {
  return {
    authed: false,
    role: 'caissier',
    identifier: '',
    pin: '',
    theme: 'dark',
    avatar: null,
    themePreference: 'manual',
    error: null,
    userId: null,
    tab: 'dashboard',
    menuCat: 'pain_maison',
    menuCatKey: 'pain_maison',
    catalogCategories: [],
    catalogItemsByCat: {},
    selectedItem: null,
    selectedSize: null,
    posModalQty: 1,
    posModalLineNote: '',
    posModalHasGratine: false,
    posModalGratines: [false],
    posModalNotes: [''],
    orderType: null,
    orderComment: '',
    orderCustomerPhone: '',
    orderCustomerAddress: '',
    cart: [],
    cashRenduModalOpen: false,
    cashReceivedStr: '',
    orderSubmitLoading: false,
    cashSession: null,
    cashSessionLoading: false,
    cashOpeningStr: '',
    cashStartLoading: false,
    cashCloseModalOpen: false,
    cashCloseAmountStr: '',
    cashCloseComment: '',
    cashCloseLoading: false,
    cashCloseSummary: null,
    orders: [],
    ordersTotalCount: 0,
    gerantOrdersKpis: null,
    historyGerantOrdersAll: [],
    historyGerantOrdersLoading: false,
    orderDetailTarget: null,
    orderCancelModalOpen: false,
    orderCancelReason: '',
    orderCancelLoading: false,
    ordersLoading: false,
    loginLoading: false,
    toasts: [],
    resetPinTarget: null,
    resetPinValue: '',
    busyResetPinUserId: null,
    resetPinError: null,
    deactivateUserTarget: null,
    busyDeactivateUserId: null,
    deactivateUserError: null,
    historySearch: '',
    historySessionFilter: 'all',
    historyOrderStatusFilter: 'all',
    historyOrderCashierFilter: '',
    historyInnerTab: 'sessions',
    historyClosedSessions: [],
    historySessionsLoading: false,
    profileOldPin: '',
    profileOldVerified: false,
    profileNewPin: '',
    profileNewPinConfirm: '',
    profileLoading: false,
    profileError: null,
    profileSuccess: null,
    profileUserProfile: null,
    profileUserLoading: false,
    profileUserError: null,
    profileNameDraft: '',
    profileNamePinModalOpen: false,
    profileNamePin: '',
    profileNameLoading: false,
    profileNameError: null,
    caissiers: [],
    caissiersError: null,
    caissiersLoading: false,
    dashboardOrdersPage: 1,
    dashboardOrdersPageSize: 8,
    historySessionsPage: 1,
    historySessionsPageSize: 8,
    historyOrdersPage: 1,
    historyOrdersPageSize: 10,
    caissiersPage: 1,
    caissiersPageSize: 8,
    addingCaissier: false,
    newCaissierName: '',
    newCaissierPin: '',
    newCaissierTheme: 'dark',
    busyToggleUserId: null,
    ticketShopLabel: 'YOBO SNACK',
    ticketShopPhone: '',
    ticketPrinterA: '',
    ticketPrinterB: '',
    printLogs: [],
    logoutConfirmOpen: false,
    discountModalOpen: false,
    discountAuthModalOpen: false,
    discountAuthPin: '',
    discountAuthLoading: false,
    discountAuthError: null,
    ticketPreviewHtml: null,
    ticketPreviewModalOpen: false,
    deliveryModalOpen: false,
    exitConfirmOpen: false,
    gratinePrice: 5,
    ticketLogo: null,
    updateFirstSeenAt: null,
    updateVersionSeen: null,
  }
}
