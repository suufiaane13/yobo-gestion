import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { CatalogCategory } from '../types/catalog'
import {
  MENU_FALLBACK_CATEGORY_TITLE,
  MENU_ITEMS,
  type MenuFallbackCategory as Category,
  type MenuFallbackItem as MenuItem,
} from '../data/menuFallback'
import { normalizeCategoryKey } from '../lib/normalizeCategoryKey'
import { logDevError, userFacingErrorMessage } from '../lib/userFacingError'
import { client } from '../lib/yoboClientMessages'
import { parseMadAmountRaw } from '../lib/parseMad'
import {
  orderTicketDetailsFromApi,
  type CashCloseTicketInput,
  printCashCloseTicket,
  printOrderTicket,
  printTestTicket,
  ticketPrintUserError,
  buildOrderTicketPreviewText,
  buildCashClosePreviewText,
} from '../lib/ticketPrint'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import { capitalizeFirstLetter, isNonEmpty } from '../lib/yoboStrings'
import {
  caissierFromApiRow,
  type AuthLoginResponse,
  type CaissierDto,
  type CartItem,
  type CashSessionCloseDto,
  type CashSessionDto,
  type CatalogResponse,
  type GerantOrdersKpis,
  type OrderItem,
  type OrderTicketDetailDto,
  type Role,
  type Tab,
  type Theme,
  type ThemePreference,
  type UserProfileDto,
  type BitmapData,
} from '../types/yoboApp'
import { createInitialYoboState, type ToastType, type YoboState, type PrintLogEntry } from './yobo-store-state'

export type { ToastItem, ToastType } from './yobo-store-state'

type PosQtyUpdater = number | ((prev: number) => number)

function normalizeOrderRow(row: OrderItem): OrderItem {
  return {
    ...row,
    cashSessionId:
      row.cashSessionId === undefined || row.cashSessionId === null ? null : Number(row.cashSessionId),
    userId: typeof row.userId === 'number' && Number.isFinite(row.userId) ? row.userId : Number(row.userId ?? 0),
    status: typeof row.status === 'string' && row.status.length > 0 ? row.status : 'validated',
    cancelReason: row.cancelReason ?? null,
    orderComment: row.orderComment ?? null,
    customerPhone: row.customerPhone ?? null,
    customerAddress: row.customerAddress ?? null,
  }
}

export type YoboActions = {
  pushToast: (type: ToastType, message: string) => void
  dismissToast: (id: string) => void
  removeToast: (id: string) => void
  setError: (v: string | null) => void
  setAuthed: (v: boolean) => void
  setRole: (v: Role) => void
  setIdentifier: (v: string) => void
  setPin: (v: string) => void
  setTheme: (v: Theme) => void
  setThemePreference: (v: ThemePreference) => void
  toggleTheme: () => void
  setTab: (v: Tab) => void
  setMenuCat: (v: Category) => void
  setMenuCatKey: (v: string) => void
  setCatalogCategories: (v: CatalogCategory[]) => void
  setCatalogItemsByCat: (v: Record<string, MenuItem[]>) => void
  setSelectedItem: (v: number | null) => void
  setSelectedSize: (v: string | null) => void
  setPosModalQty: (v: PosQtyUpdater) => void
  setPosModalLineNote: (v: string) => void
  setPosModalNoteAtIndex: (index: number, note: string) => void
  setOrderType: (v: YoboState['orderType']) => void
  setOrderComment: (v: string) => void
  setOrderCustomerPhone: (v: string) => void
  setOrderCustomerAddress: (v: string) => void
  setPosModalHasGratine: (v: boolean) => void
  setPosModalGratineAtIndex: (index: number, val: boolean) => void
  setCart: (v: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void
  setCashRenduModalOpen: (v: boolean) => void
  setCashReceivedStr: (v: string) => void
  setOrderSubmitLoading: (v: boolean) => void
  setCashSession: (v: CashSessionDto | null) => void
  setCashSessionLoading: (v: boolean) => void
  setCashOpeningStr: (v: string) => void
  setCashStartLoading: (v: boolean) => void
  setCashCloseModalOpen: (v: boolean) => void
  setCashCloseAmountStr: (v: string) => void
  setCashCloseComment: (v: string) => void
  setCashCloseLoading: (v: boolean) => void
  setCashCloseSummary: (v: CashSessionCloseDto | null) => void
  setOrders: (v: OrderItem[] | ((prev: OrderItem[]) => OrderItem[])) => void
  setOrdersTotalCount: (v: number) => void
  setGerantOrdersKpis: (v: GerantOrdersKpis | null) => void
  setHistoryGerantOrdersAll: (v: OrderItem[]) => void
  setHistoryGerantOrdersLoading: (v: boolean) => void
  setOrderDetailTarget: (v: OrderItem | null) => void
  setOrderCancelModalOpen: (v: boolean) => void
  setOrderCancelReason: (v: string) => void
  setOrderCancelLoading: (v: boolean) => void
  submitOrderCancel: () => Promise<void>
  setOrdersLoading: (v: boolean) => void
  setLoginLoading: (v: boolean) => void
  setResetPinTarget: (v: CaissierDto | null) => void
  setResetPinValue: (v: string) => void
  setBusyResetPinUserId: (v: number | null) => void
  setResetPinError: (v: string | null) => void
  setDeactivateUserTarget: (v: CaissierDto | null) => void
  setBusyDeactivateUserId: (v: number | null) => void
  setDeactivateUserError: (v: string | null) => void
  setHistorySearch: (v: string) => void
  setHistorySessionFilter: (v: string) => void
  setHistoryOrderStatusFilter: (v: YoboState['historyOrderStatusFilter']) => void
  setHistoryOrderCashierFilter: (v: string) => void
  setHistoryInnerTab: (v: 'sessions' | 'orders') => void
  setHistoryClosedSessions: (v: YoboState['historyClosedSessions']) => void
  setHistorySessionsLoading: (v: boolean) => void
  setProfileOldPin: (v: string) => void
  setProfileOldVerified: (v: boolean) => void
  setProfileNewPin: (v: string) => void
  setProfileNewPinConfirm: (v: string) => void
  setProfileLoading: (v: boolean) => void
  setProfileError: (v: string | null) => void
  setProfileSuccess: (v: string | null) => void
  setProfileUserProfile: (v: UserProfileDto | null) => void
  setProfileUserLoading: (v: boolean) => void
  setProfileUserError: (v: string | null) => void
  setProfileNameDraft: (v: string) => void
  setProfileNamePinModalOpen: (v: boolean) => void
  setProfileNamePin: (v: string) => void
  setProfileNameLoading: (v: boolean) => void
  setProfileNameError: (v: string | null) => void
  updateAvatar: (avatar: string) => Promise<void>
  setAvatar: (avatar: string | null) => void
  setCaissiers: (v: CaissierDto[]) => void
  setCaissiersError: (v: string | null) => void
  setCaissiersLoading: (v: boolean) => void
  setDashboardOrdersPage: (v: number | ((p: number) => number)) => void
  setDashboardOrdersPageSize: (v: number) => void
  setHistorySessionsPage: (v: number | ((p: number) => number)) => void
  setHistorySessionsPageSize: (v: number) => void
  setHistoryOrdersPage: (v: number | ((p: number) => number)) => void
  setHistoryOrdersPageSize: (v: number) => void
  setCaissiersPage: (v: number | ((p: number) => number)) => void
  setCaissiersPageSize: (v: number) => void
  setAddingCaissier: (v: boolean) => void
  setNewCaissierName: (v: string) => void
  setNewCaissierPin: (v: string) => void
  setNewCaissierTheme: (v: Theme) => void
  setBusyToggleUserId: (v: number | null) => void
  setUserId: (v: number | null) => void
  setUpdateSeen: (version: string | null, date: string | null) => void
  setTicketShopLabel: (v: string) => void
  setTicketShopPhone: (v: string) => void
  setTicketPrinterA: (v: string) => void
  setTicketPrinterB: (v: string) => void
  setTicketLogo: (v: BitmapData | null) => void
  loadTicketSettings: () => Promise<void>
  loadTicketLogo: () => Promise<void>
  saveTicketShopSettings: (shopLabel: string, shopPhone: string) => Promise<void>
  setGratinePrice: (v: number) => void
  setLogoutConfirmOpen: (v: boolean) => void
  setExitConfirmOpen: (v: boolean) => void
  requestLogout: () => void
  setTicketPreviewHtml: (v: string | null) => void
  setTicketPreviewModalOpen: (v: boolean) => void
  setDeliveryModalOpen: (v: boolean) => void
  previewCurrentTicket: () => void
  previewOrderById: (orderId: number) => Promise<void>
  previewCashCloseTicketMockup: () => void

  setDiscountModalOpen: (v: boolean) => void
  setDiscountAuthModalOpen: (v: boolean) => void
  setDiscountAuthPin: (v: string) => void
  setDiscountAuthLoading: (v: boolean) => void
  setDiscountAuthError: (v: string | null) => void

  requestGerantDiscount: () => void
  submitDiscountAuth: () => Promise<void>
  applyDiscount: (type: 'percent' | 'amount' | 'free', value?: number) => void

  loadCaissiers: () => Promise<void>
  loadOrders: (nextUserId: number) => Promise<void>
  refreshHistoryGerantOrders: () => Promise<void>
  loadCatalog: () => Promise<void>
  login: () => Promise<void>
  logout: () => void
  addToCart: () => void
  bumpCartQty: (index: number, delta: number) => void
  removeCartItem: (index: number) => void
  clearCart: () => void
  openCashSessionHandler: () => Promise<void>
  submitCashClose: () => Promise<void>
  validateOrder: (received?: number | null) => Promise<void>
  closeCashRenduModal: () => void
  requestValidateOrder: () => void
  confirmCashRenduAndValidate: () => Promise<void>
  bumpCashReceived: (delta: number) => void
  addCaissier: () => Promise<void>
  toggleCaissierActive: (targetUserId: number, nextActive: boolean) => Promise<void>
  resetCaissierPin: () => Promise<void>
  confirmDeactivateUser: () => Promise<void>
  verifyProfilePin: () => Promise<void>
  submitProfilePasswordChange: () => Promise<void>
  submitProfileNameChange: () => Promise<void>
  confirmDeliveryInfo: () => void
  testPrinter: (printerName: string) => Promise<void>
  addPrintLog: (msg: string, type: PrintLogEntry['type']) => void
  clearPrintLogs: () => void
  reorderCatalogCategories: (startIndex: number, endIndex: number) => Promise<void>
  reorderProducts: (categoryKey: string, startIndex: number, endIndex: number) => Promise<void>
}

export type YoboStore = YoboState & YoboActions

const initial = createInitialYoboState()

export const useYoboStore = create<YoboStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initial,

        removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        pushToast: (type, message) => {
          const trimmed = message.trim()
          if (!trimmed) return
          const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
          set((s) => ({ toasts: [...s.toasts, { id, type, message: trimmed }] }))
          window.setTimeout(() => {
            get().removeToast(id)
          }, 4200)
        },

        dismissToast: (id) => get().removeToast(id),

        setError: (v) => set({ error: v }),
        setAuthed: (v) => set({ authed: v }),
        setRole: (v) => set({ role: v }),
        setIdentifier: (v) => set({ identifier: v }),
        setPin: (v) => set({ pin: v }),
        setTheme: (v) => set({ theme: v }),
        setThemePreference: (v) => set({ themePreference: v }),
        toggleTheme: () =>
          set((s) => ({
            themePreference: 'manual',
            theme: s.theme === 'dark' ? 'light' : 'dark',
          })),
        setTab: (v) => {
          if (v === 'historique' && get().role === 'gerant') {
            set({ historyInnerTab: 'sessions' })
          }
          set({ tab: v })
        },
        setMenuCat: (v) => set({ menuCat: v }),
        setMenuCatKey: (v) => set({ menuCatKey: v }),
        setCatalogCategories: (v) => set({ catalogCategories: v }),
        setCatalogItemsByCat: (v) => set({ catalogItemsByCat: v }),
        setSelectedItem: (v) => set({ selectedItem: v, posModalHasGratine: false, posModalGratines: [false], posModalNotes: [''] }),
        setSelectedSize: (v) => set({ selectedSize: v }),
        setPosModalQty: (v) =>
          set((s) => {
            const nextQty = typeof v === 'function' ? (v as (p: number) => number)(s.posModalQty) : v
            const nextGratines = [...s.posModalGratines]
            const nextNotes = [...s.posModalNotes]
            
            if (nextQty > nextGratines.length) {
              const diff = nextQty - nextGratines.length
              for (let i = 0; i < diff; i++) {
                nextGratines.push(s.posModalHasGratine)
                nextNotes.push(s.posModalLineNote)
              }
            } else if (nextQty < nextGratines.length) {
              nextGratines.length = nextQty
              nextNotes.length = nextQty
            }
            
            return {
              posModalQty: nextQty,
              posModalGratines: nextGratines,
              posModalNotes: nextNotes,
            }
          }),
        setPosModalLineNote: (v) =>
          set((s) => ({
            posModalLineNote: v,
            // S'il n'y a qu'un item, on répercute dans le tableau
            posModalNotes: s.posModalQty === 1 ? [v] : s.posModalNotes,
          })),
        setPosModalNoteAtIndex: (index, val) =>
          set((s) => {
            const next = [...s.posModalNotes]
            if (index >= 0 && index < next.length) {
              next[index] = val
            }
            return {
              posModalNotes: next,
              // Cohérence si quantité 1
              posModalLineNote: s.posModalQty === 1 ? val : s.posModalLineNote,
            }
          }),
        setOrderType: (v) => set({ orderType: v }),
        setOrderComment: (v) => set({ orderComment: v }),
        setOrderCustomerPhone: (v) => set({ orderCustomerPhone: v }),
        setOrderCustomerAddress: (v) => set({ orderCustomerAddress: v }),
        setPosModalHasGratine: (v) =>
          set((s) => ({
            posModalHasGratine: v,
            // Si on change le toggle global, on l'applique aussi à l'unité unique pour la cohérence
            posModalGratines: s.posModalQty === 1 ? [v] : s.posModalGratines,
          })),
        setPosModalGratineAtIndex: (index, val) =>
          set((s) => {
            const next = [...s.posModalGratines]
            if (index >= 0 && index < next.length) {
              next[index] = val
            }
            return {
              posModalGratines: next,
              // Pour la cohérence si qty=1
              posModalHasGratine: s.posModalQty === 1 ? val : s.posModalHasGratine,
            }
          }),
        setCart: (v) => set((s) => ({ cart: typeof v === 'function' ? (v as (p: CartItem[]) => CartItem[])(s.cart) : v })),
        setCashRenduModalOpen: (v) => set({ cashRenduModalOpen: v }),
        setCashReceivedStr: (v) => set({ cashReceivedStr: v }),
        setOrderSubmitLoading: (v) => set({ orderSubmitLoading: v }),
        setCashSession: (v) => set({ cashSession: v }),
        setCashSessionLoading: (v) => set({ cashSessionLoading: v }),
        setCashOpeningStr: (v) => set({ cashOpeningStr: v }),
        setCashStartLoading: (v) => set({ cashStartLoading: v }),
        setCashCloseModalOpen: (v) => set({ cashCloseModalOpen: v }),
        setCashCloseAmountStr: (v) => set({ cashCloseAmountStr: v }),
        setCashCloseComment: (v) => set({ cashCloseComment: v }),
        setCashCloseLoading: (v) => set({ cashCloseLoading: v }),
        setCashCloseSummary: (v) => set({ cashCloseSummary: v }),
        setOrders: (v) =>
          set((s) => ({ orders: typeof v === 'function' ? (v as (p: OrderItem[]) => OrderItem[])(s.orders) : v })),
        setOrdersTotalCount: (v) => set({ ordersTotalCount: v }),
        setGerantOrdersKpis: (v) => set({ gerantOrdersKpis: v }),
        setHistoryGerantOrdersAll: (v) => set({ historyGerantOrdersAll: v }),
        setHistoryGerantOrdersLoading: (v) => set({ historyGerantOrdersLoading: v }),
        setOrderDetailTarget: (v) => set({ orderDetailTarget: v }),
        setOrderCancelModalOpen: (v) => set({ orderCancelModalOpen: v }),
        setOrderCancelReason: (v) => set({ orderCancelReason: v }),
        setOrderCancelLoading: (v) => set({ orderCancelLoading: v }),
        submitOrderCancel: async () => {
          const { userId, orderDetailTarget, orderCancelReason, pushToast } = get()
          if (userId === null || orderDetailTarget === null) return
          const reason = orderCancelReason.trim()
          if (!reason) {
            pushToast('error', client.val.orderCancelReason)
            return
          }
          get().setOrderCancelLoading(true)
          try {
            const updated = await invoke<OrderItem>('orders_cancel', {
              userId,
              orderId: orderDetailTarget.id,
              reason,
            })
            const norm = normalizeOrderRow(updated)
            get().setOrders((prev) => prev.map((o) => (o.id === norm.id ? norm : o)))
            get().setHistoryGerantOrdersAll(
              get().historyGerantOrdersAll.map((o) => (o.id === norm.id ? norm : o)),
            )
            get().setOrderDetailTarget(norm)
            get().setOrderCancelModalOpen(false)
            get().setOrderCancelReason('')
            pushToast('success', client.success.orderCancelled)
            await get().loadOrders(userId)
            await get().refreshHistoryGerantOrders()
          } catch (e) {
            logDevError('orders_cancel', e)
            pushToast('error', userFacingErrorMessage(e, client.error.orderCancel))
          } finally {
            get().setOrderCancelLoading(false)
          }
        },
        setOrdersLoading: (v) => set({ ordersLoading: v }),
        setLoginLoading: (v) => set({ loginLoading: v }),
        setResetPinTarget: (v) => set({ resetPinTarget: v }),
        setResetPinValue: (v) => set({ resetPinValue: v }),
        setBusyResetPinUserId: (v) => set({ busyResetPinUserId: v }),
        setResetPinError: (v) => set({ resetPinError: v }),
        setDeactivateUserTarget: (v) => set({ deactivateUserTarget: v }),
        setBusyDeactivateUserId: (v) => set({ busyDeactivateUserId: v }),
        setDeactivateUserError: (v) => set({ deactivateUserError: v }),
        setHistorySearch: (v) => set({ historySearch: v }),
        setHistorySessionFilter: (v) => set({ historySessionFilter: v }),
        setHistoryOrderStatusFilter: (v) => set({ historyOrderStatusFilter: v }),
        setHistoryOrderCashierFilter: (v) => set({ historyOrderCashierFilter: v }),
        setHistoryInnerTab: (v) => set({ historyInnerTab: v }),
        setHistoryClosedSessions: (v) => set({ historyClosedSessions: v }),
        setHistorySessionsLoading: (v) => set({ historySessionsLoading: v }),
        setProfileOldPin: (v) => set({ profileOldPin: v }),
        setProfileOldVerified: (v) => set({ profileOldVerified: v }),
        setProfileNewPin: (v) => set({ profileNewPin: v }),
        setProfileNewPinConfirm: (v) => set({ profileNewPinConfirm: v }),
        setProfileLoading: (v) => set({ profileLoading: v }),
        setProfileError: (v) => set({ profileError: v }),
        setProfileSuccess: (v) => set({ profileSuccess: v }),
        setProfileUserProfile: (v) => set({ profileUserProfile: v }),
        setProfileUserLoading: (v) => set({ profileUserLoading: v }),
        setProfileUserError: (v) => set({ profileUserError: v }),
        setProfileNameDraft: (v) => set({ profileNameDraft: v }),
        setProfileNamePinModalOpen: (v) => set({ profileNamePinModalOpen: v }),
        setProfileNamePin: (v) => set({ profileNamePin: v }),
        setProfileNameLoading: (v) => set({ profileNameLoading: v }),
        setProfileNameError: (v) => set({ profileNameError: v }),
        setAvatar: (v) => set({ avatar: v }),
        updateAvatar: async (avatar: string) => {
          const { role, userId, pushToast } = get()
          if (userId === null) return
          try {
            await invoke('update_user_avatar', { role, userId, avatar })
            set({ avatar })
            if (get().profileUserProfile) {
              set((s) => ({
                profileUserProfile: s.profileUserProfile ? { ...s.profileUserProfile, avatar } : null,
              }))
            }
            pushToast('success', 'Avatar mis à jour !')
          } catch (e) {
            logDevError('update_user_avatar', e)
            pushToast('error', "Échec de la mise à jour de l'avatar.")
          }
        },
        setCaissiers: (v) => set({ caissiers: v }),
        setCaissiersError: (v) => set({ caissiersError: v }),
        setCaissiersLoading: (v) => set({ caissiersLoading: v }),
        setDashboardOrdersPage: (v) =>
          set((s) => ({
            dashboardOrdersPage: typeof v === 'function' ? (v as (p: number) => number)(s.dashboardOrdersPage) : v,
          })),
        setDashboardOrdersPageSize: (v) => set({ dashboardOrdersPageSize: v }),
        setHistorySessionsPage: (v) =>
          set((s) => ({
            historySessionsPage: typeof v === 'function' ? (v as (p: number) => number)(s.historySessionsPage) : v,
          })),
        setHistorySessionsPageSize: (v) => set({ historySessionsPageSize: v }),
        setHistoryOrdersPage: (v) =>
          set((s) => ({
            historyOrdersPage: typeof v === 'function' ? (v as (p: number) => number)(s.historyOrdersPage) : v,
          })),
        setHistoryOrdersPageSize: (v) => set({ historyOrdersPageSize: v }),
        setCaissiersPage: (v) =>
          set((s) => ({
            caissiersPage: typeof v === 'function' ? (v as (p: number) => number)(s.caissiersPage) : v,
          })),
        setCaissiersPageSize: (v) => set({ caissiersPageSize: v }),
        setAddingCaissier: (v) => set({ addingCaissier: v }),
        setNewCaissierName: (v) => set({ newCaissierName: v }),
        setNewCaissierPin: (v) => set({ newCaissierPin: v }),
        setNewCaissierTheme: (v) => set({ newCaissierTheme: v }),
        setBusyToggleUserId: (v) => set({ busyToggleUserId: v }),
        setUserId: (v) => set({ userId: v }),
        setUpdateSeen: (version, date) => set({ updateVersionSeen: version, updateFirstSeenAt: date }),
        setTicketShopLabel: (v) => set({ ticketShopLabel: v }),
        setTicketShopPhone: (v) => set({ ticketShopPhone: v }),
        setTicketPrinterA: (v) => set({ ticketPrinterA: v }),
        setTicketPrinterB: (v) => set({ ticketPrinterB: v }),
        setTicketLogo: (v) => set({ ticketLogo: v }),
        setLogoutConfirmOpen: (v) => set({ logoutConfirmOpen: v }),
        setExitConfirmOpen: (v) => set({ exitConfirmOpen: v }),
        setTicketPreviewHtml: (v) => set({ ticketPreviewHtml: v }),
        setTicketPreviewModalOpen: (v) => set({ ticketPreviewModalOpen: v }),
        setDeliveryModalOpen: (v) => set({ deliveryModalOpen: v }),

        previewCurrentTicket: () => {
          const { cart, orderType, ticketShopLabel, identifier, cashSession } = get()
          if (cart.length === 0) return
          const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
          const commonData = {
            shopLabel: ticketShopLabel,
            orderId: 0,
            timeIso: new Date().toISOString(),
            cashier: identifier,
            cashSessionId: cashSession?.id,
            orderType: orderType || 'sur_place',
            lines: cart.map((c) => ({
              name: c.name,
              size: c.size,
              quantity: c.quantity,
              unitPrice: c.price,
              categoryLabel: c.categoryLabel,
              lineNote: c.lineNote,
              hasGratine: c.hasGratine,
              gratineAmount: c.gratineAmount,
            })),
            customerPhone: get().orderCustomerPhone || null,
            customerAddress: get().orderCustomerAddress || null,
            total: cartTotal,
          }
          const text = buildOrderTicketPreviewText(commonData)
          get().setTicketPreviewHtml(text) // On garde le nom mais on met du texte
          get().setTicketPreviewModalOpen(true)
        },

        previewOrderById: async (orderId) => {
          const { ticketShopLabel } = get()
          try {
            const rows = await invoke<OrderTicketDetailDto[]>('get_order_ticket_details', { orderId })
            if (rows.length === 0) return
            const details = orderTicketDetailsFromApi(rows)[0]
            const commonData = {
              shopLabel: ticketShopLabel,
              orderId: details.id,
              timeIso: details.timeIso,
              cashier: details.cashier,
              cashSessionId: null,
              orderType: (rows[0] as { order_type?: string | null }).order_type || 'sur_place',
              lines: details.lines,
              customerPhone: details.customerPhone || null,
              customerAddress: details.customerAddress || null,
              total: details.total,
            }
            const text = buildOrderTicketPreviewText(commonData)
            get().setTicketPreviewHtml(text)
            get().setTicketPreviewModalOpen(true)
          } catch (e) {
            logDevError('previewOrderById', e)
          }
        },

        previewCashCloseTicketMockup: () => {
          const { ticketShopLabel, ticketShopPhone, identifier } = get()
          const mockup: CashCloseTicketInput = {
            shopLabel: ticketShopLabel,
            shopPhone: ticketShopPhone,
            sessionId: 123,
            cashier: identifier || 'Gérant',
            openingAmount: 150.0,
            salesTotal: 1245.5,
            ordersCount: 42,
            theoretical: 1395.5,
            closingAmount: 1395.5,
            gap: 0,
            comment: 'Ceci est un exemple de clôture',
          }
          const text = buildCashClosePreviewText(mockup)
          get().setTicketPreviewHtml(text)
          get().setTicketPreviewModalOpen(true)
        },

        setDiscountModalOpen: (v) => set({ discountModalOpen: v }),
        setDiscountAuthModalOpen: (v) => set({ discountAuthModalOpen: v }),
        setDiscountAuthPin: (v) => set({ discountAuthPin: v }),
        setDiscountAuthLoading: (v) => set({ discountAuthLoading: v }),
        setDiscountAuthError: (v) => set({ discountAuthError: v }),

        requestGerantDiscount: () => {
          const role = get().role
          if (role === 'gerant') {
            get().setDiscountModalOpen(true)
          } else {
            get().setDiscountAuthPin('')
            get().setDiscountAuthError(null)
            get().setDiscountAuthModalOpen(true)
          }
        },

        submitDiscountAuth: async () => {
          const pin = get().discountAuthPin.trim()
          if (!pin) {
            get().setDiscountAuthError(client.val.loginPin)
            return
          }
          get().setDiscountAuthLoading(true)
          get().setDiscountAuthError(null)
          try {
            await invoke('verify_any_gerant_pin', { pin })
            get().setDiscountAuthModalOpen(false)
            get().setDiscountAuthPin('')
            get().setDiscountModalOpen(true)
          } catch (e) {
            logDevError('verify_any_gerant_pin', e)
            get().setDiscountAuthError('PIN Gérant invalide.')
          } finally {
            get().setDiscountAuthLoading(false)
          }
        },

        applyDiscount: (type, value) => {
          const { cart, cashSession } = get()
          if (cart.length === 0 || !cashSession) return
          let discountAmt = 0
          const subtotalTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

          if (type === 'percent' && value !== undefined) {
            discountAmt = (subtotalTotal * value) / 100
          } else if (type === 'free') {
            discountAmt = subtotalTotal
          } else if (type === 'amount' && value !== undefined) {
            discountAmt = value
          }

          if (discountAmt <= 0) return

          // Prevent discounting more than subtotal
          const finalDiscount = Math.min(subtotalTotal, discountAmt)
          const finalDiscountDisplay = Math.round(finalDiscount * 100) / 100

          const discountItem: CartItem = {
            emoji: '🏷️',
            name: type === 'percent' ? `Remise Globale (-${value}%)` : type === 'free' ? 'Offert (100%)' : 'Remise Globale',
            size: '',
            price: -finalDiscountDisplay,
            quantity: 1,
            categoryLabel: 'Remise',
          }

          get().setCart([...cart, discountItem])
          get().setDiscountModalOpen(false)
        },

        loadTicketSettings: async () => {
          try {
            const r = await invoke<{
              shopLabel: string
              shopPhone: string
              gratinePrice: number
            }>('get_ticket_public_settings')
            const label = typeof r.shopLabel === 'string' && r.shopLabel.trim() ? r.shopLabel.trim() : 'YOBO SNACK'
            const phone = typeof r.shopPhone === 'string' ? r.shopPhone.trim() : ''
            const price = typeof r.gratinePrice === 'number' ? r.gratinePrice : 5
            set({
              ticketShopLabel: label,
              ticketShopPhone: phone,
              gratinePrice: price,
            })
            await get().loadTicketLogo()
          } catch (e) {
            logDevError('get_ticket_public_settings', e)
          }
        },

        loadTicketLogo: async () => {
          if (get().ticketLogo) return
          try {
            const { loadImageToEscposBitmap } = await import('../lib/imageProcessing')
            const logo = await loadImageToEscposBitmap('/logo.png', 384)
            get().setTicketLogo(logo)
          } catch (e) {
            logDevError('loadTicketLogo', e)
          }
        },

        saveTicketShopSettings: async (shopLabel, shopPhone) => {
          const { userId, pushToast, gratinePrice } = get()
          if (userId === null) return
          try {
            await invoke('set_ticket_shop_settings', {
              userId,
              body: {
                shopLabel: shopLabel.trim(),
                shopPhone: shopPhone.trim(),
                gratinePrice,
              },
            })
            await get().loadTicketSettings()
            pushToast('success', client.success.ticketShopSaved)
          } catch (e) {
            logDevError('set_ticket_shop_settings', e)
            pushToast('error', userFacingErrorMessage(e, client.error.ticketShopSave))
          }
        },
        setGratinePrice: (v: number) => set({ gratinePrice: v }),

        loadCaissiers: async () => {
          const { role, userId } = get()
          if (userId === null) return
          try {
            get().setCaissiersLoading(true)
            get().setCaissiersError(null)
            const res = await invoke<unknown[]>('list_caissiers', {
              role,
              userId,
            })
            get().setCaissiers(res.map(caissierFromApiRow))
          } catch (e) {
            logDevError('list_caissiers', e)
            get().setCaissiersError(userFacingErrorMessage(e, client.error.loadCaissiers))
            get().setCaissiers([])
          } finally {
            get().setCaissiersLoading(false)
          }
        },

        loadOrders: async (nextUserId) => {
          const role = get().role
          const dashboardOrdersPage = get().dashboardOrdersPage
          const dashboardOrdersPageSize = get().dashboardOrdersPageSize
          try {
            get().setOrdersLoading(true)
            if (role === 'gerant') {
              const [kpis, page] = await Promise.all([
                invoke<GerantOrdersKpis>('orders_gerant_kpis', { userId: nextUserId }),
                invoke<{ orders: OrderItem[]; total: number }>('list_orders_gerant_page', {
                  userId: nextUserId,
                  limit: dashboardOrdersPageSize,
                  offset: (dashboardOrdersPage - 1) * dashboardOrdersPageSize,
                }),
              ])
              get().setGerantOrdersKpis(kpis)
              get().setOrdersTotalCount(page.total)
              get().setOrders((Array.isArray(page.orders) ? page.orders : []).map((row) => normalizeOrderRow(row)))
            } else {
              const res = await invoke<OrderItem[]>('list_orders', {
                userId: nextUserId,
              })
              get().setGerantOrdersKpis(null)
              get().setOrdersTotalCount(Array.isArray(res) ? res.length : 0)
              get().setOrders((Array.isArray(res) ? res : []).map((row) => normalizeOrderRow(row)))
            }
          } catch (e) {
            logDevError('list_orders', e)
            get().pushToast('error', userFacingErrorMessage(e, client.error.loadOrders))
          } finally {
            get().setOrdersLoading(false)
          }
        },

        refreshHistoryGerantOrders: async () => {
          const { role, userId } = get()
          if (role !== 'gerant' || userId === null) {
            return
          }
          try {
            get().setHistoryGerantOrdersLoading(true)
            const rows = await invoke<OrderItem[]>('list_orders_gerant_all', { userId })
            get().setHistoryGerantOrdersAll((Array.isArray(rows) ? rows : []).map((row) => normalizeOrderRow(row)))
          } catch (e) {
            logDevError('list_orders_gerant_all', e)
            get().pushToast('error', userFacingErrorMessage(e, client.error.loadOrders))
            get().setHistoryGerantOrdersAll([])
          } finally {
            get().setHistoryGerantOrdersLoading(false)
          }
        },

        loadCatalog: async () => {
          try {
            const catalog = await invoke<CatalogResponse>('list_catalog')
            if (catalog.categories.length === 0) return

            const nextMap: Record<string, MenuItem[]> = {}
            const nextCats: CatalogCategory[] = catalog.categories.map((c) => ({ ...c }))
            const byId = new Map<number, string>()
            for (const cat of nextCats) {
              const key = normalizeCategoryKey(cat.label)
              byId.set(cat.id, key)
              nextMap[key] = []
            }

            for (const p of catalog.products) {
              const key = byId.get(p.category_id)
              if (!key) continue
              nextMap[key].push({
                id: p.id,
                emoji: p.emoji,
                name: p.name,
                sizes: p.sizes || {},
                position: p.position,
                active: p.active,
              })
            }

            get().setCatalogCategories(nextCats)
            get().setCatalogItemsByCat(nextMap)
            const firstKey = byId.get(nextCats[0].id) ?? 'pain_maison'
            get().setMenuCatKey(firstKey)
          } catch (e) {
            logDevError('list_catalog', e)
            get().pushToast('warning', userFacingErrorMessage(e, client.error.catalogFallback))
          }
        },

        login: async () => {
          const { identifier, pin, role } = get()
          get().setError(null)
          get().setLoginLoading(true)

          if (!isNonEmpty(identifier)) {
            get().setError(client.val.loginUser)
            get().setLoginLoading(false)
            return
          }
          if (!isNonEmpty(pin)) {
            get().setError(client.val.loginPin)
            get().setLoginLoading(false)
            return
          }

          try {
            const res = await invoke<AuthLoginResponse>('auth_login', {
              identifier: identifier.trim(),
              pin: pin.trim(),
              role,
            })

            get().setTheme(res.theme === 'light' ? 'light' : 'dark')
            get().setAvatar(res.avatar ?? null)
            get().setUserId(res.userId)
            get().setTab(role === 'gerant' ? 'dashboard' : 'caisse')
            get().setAuthed(true)
            await get().loadCatalog()
            if (role !== 'gerant') {
              await get().loadOrders(res.userId)
            }
          } catch (e) {
            logDevError('auth_login', e)
            get().setError(client.error.loginFailed)
          } finally {
            get().setLoginLoading(false)
          }
        },

        logout: () => {
          const { userId, role } = get()
          if (userId !== null && isTauriRuntime()) {
            void invoke('auth_log_logout', { input: { userId, role } }).catch((e) =>
              logDevError('auth_log_logout', e),
            )
          }
          set((s) => ({
            ...s,
            authed: false,
            identifier: '',
            pin: '',
            error: null,
            userId: null,
            tab: 'dashboard',
            cart: [],
            selectedItem: null,
            selectedSize: null,
            posModalQty: 1,
            posModalLineNote: '',
            posModalHasGratine: false,
            menuCatKey: 'pain_maison',
            catalogCategories: [],
            catalogItemsByCat: {},
            cashSession: null,
            cashOpeningStr: '',
            cashCloseModalOpen: false,
            cashCloseAmountStr: '',
            cashCloseComment: '',
            cashCloseSummary: null,
            cashRenduModalOpen: false,
            cashReceivedStr: '',
            orderType: null,
            orderComment: '',
            orderCustomerPhone: '',
            orderCustomerAddress: '',
            orders: [],
            ordersTotalCount: 0,
            gerantOrdersKpis: null,
            historyGerantOrdersAll: [],
            historyGerantOrdersLoading: false,
            orderDetailTarget: null,
            orderCancelModalOpen: false,
            orderCancelReason: '',
            orderCancelLoading: false,
            ticketShopLabel: 'YOBO SNACK',
            ticketShopPhone: '',
            logoutConfirmOpen: false,
          }))
        },

        requestLogout: () => {
          // Toujours demander confirmation pour la déconnexion
          get().setLogoutConfirmOpen(true)
        },

        addToCart: () => {
          const {
            selectedItem,
            selectedSize,
            catalogCategories,
            catalogItemsByCat,
            menuCatKey,
            menuCat,
            posModalQty,
            posModalGratines,
            posModalNotes,
            gratinePrice,
          } = get()
          if (selectedItem === null || selectedSize === null) return
          const hasCatalog = Object.keys(catalogItemsByCat).length > 0
          const sourceItems = hasCatalog ? (catalogItemsByCat[menuCatKey] ?? []) : MENU_ITEMS[menuCat]
          const item = sourceItems[selectedItem]
          const basePrice = item.sizes[selectedSize]
          if (basePrice === undefined) return

          const isTacos = menuCat === 'tacos' || menuCatKey === 'tacos'
          const categoryLabel = hasCatalog
            ? (catalogCategories.find((c) => normalizeCategoryKey(c.label) === menuCatKey)?.label ?? '').trim() ||
              menuCatKey
            : MENU_FALLBACK_CATEGORY_TITLE[menuCat]

          // On va créer un dictionnaire pour grouper les items identiques
          // Key format: "note|hasGratine"
          const groups: Record<string, { quantity: number; note: string; hasGratine: boolean }> = {}

          const qty = Math.min(99, Math.max(1, Math.floor(posModalQty)))

          for (let i = 0; i < qty; i++) {
            const hasGratine = isTacos ? (posModalGratines[i] ?? false) : false
            const rawNote = (posModalNotes[i] ?? '').trim()
            const note = rawNote.length > 0 ? rawNote : ''
            const key = `${note}|${hasGratine}`

            if (!groups[key]) {
              groups[key] = { quantity: 0, note, hasGratine }
            }
            groups[key].quantity++
          }

          const nextItemsToAdd: CartItem[] = Object.values(groups).map((g) => {
            const finalPrice = g.hasGratine ? basePrice + gratinePrice : basePrice
            return {
              emoji: item.emoji,
              name: item.name,
              size: selectedSize,
              price: finalPrice,
              quantity: g.quantity,
              categoryLabel,
              ...(g.note ? { lineNote: g.note } : {}),
              hasGratine: g.hasGratine,
              ...(g.hasGratine ? { gratineAmount: gratinePrice } : {}),
            }
          })

          get().setCart((prev) => [...prev, ...nextItemsToAdd])
          set({
            selectedItem: null,
            selectedSize: null,
            posModalQty: 1,
            posModalLineNote: '',
            posModalHasGratine: false,
            posModalGratines: [false],
            posModalNotes: [''],
          })
        },

        bumpCartQty: (index, delta) => {
          get().setCart((prev) =>
            prev.map((it, i) => {
              if (i !== index) return it
              const q = Math.min(99, Math.max(1, it.quantity + delta))
              return { ...it, quantity: q }
            }),
          )
        },

        removeCartItem: (index) => {
          get().setCart((prev) => prev.filter((_, i) => i !== index))
        },

        clearCart: () => set({ cart: [], orderType: null, orderComment: '' }),

        openCashSessionHandler: async () => {
          const { userId, cashOpeningStr, pushToast } = get()
          if (userId === null) return
          const amt = parseMadAmountRaw(cashOpeningStr)
          if (amt === null) {
            get().setError(client.val.cashOpenAmount)
            return
          }
          get().setCashStartLoading(true)
          try {
            const dto = await invoke<CashSessionDto>('cash_session_start', {
              userId,
              openingAmount: amt,
            })
            get().setCashSession(dto)
            get().setCashOpeningStr('')
            pushToast('success', client.success.cashOpen)
          } catch (e) {
            logDevError('cash_session_start', e)
            get().setError(userFacingErrorMessage(e, client.error.cashOpenFailed))
          } finally {
            get().setCashStartLoading(false)
          }
        },

        submitCashClose: async () => {
          const {
            userId,
            cashCloseAmountStr,
            cashCloseComment,
            identifier,
            pushToast,
          } = get()
          if (userId === null) return
          const amt = parseMadAmountRaw(cashCloseAmountStr)
          if (amt === null) {
            get().setError(client.val.cashCloseAmount)
            return
          }
          get().setCashCloseLoading(true)
          try {
            const closeComment = cashCloseComment.trim() || null
            const summary = await invoke<CashSessionCloseDto>('cash_session_close', {
              userId,
              closingAmount: amt,
              comment: closeComment,
            })
            get().setCashCloseModalOpen(false)
            get().setCashSession(null)
            get().setCashCloseAmountStr('')
            get().setCashCloseComment('')
            await get().loadOrders(userId)
            pushToast('success', client.success.cashClosed)
            try {
              const { ticketShopLabel, ticketShopPhone } = get()
              await printCashCloseTicket({
                shopLabel: ticketShopLabel,
                shopPhone: ticketShopPhone,
                sessionId: summary.sessionId,
                closedAtIso: summary.closedAt,
                cashier: capitalizeFirstLetter(identifier.trim()) || '—',
                openingAmount: summary.openingAmount,
                closingAmount: summary.closingAmount,
                salesTotal: summary.salesTotal,
                theoretical: summary.theoretical,
                gap: summary.gap,
                ordersCount: summary.ordersCount,
                })
                get().setCashCloseSummary(null)
            } catch (e) {
              get().setCashCloseSummary(summary)
              const technicalMsg = e instanceof Error ? e.message : String(e)
              pushToast('warning', `${ticketPrintUserError()} (${technicalMsg})`)
            }
          } catch (e) {
            logDevError('cash_session_close', e)
            get().setError(userFacingErrorMessage(e, client.error.cashCloseFailed))
          } finally {
            get().setCashCloseLoading(false)
          }
        },

        validateOrder: async (receivedParam?: number | null) => {
          const {
            cart,
            userId,
            cashSession,
            pushToast,
            orderType,
            orderCustomerPhone,
            orderCustomerAddress,
          } = get()
          if (cart.length === 0 || userId === null) return
          if (cashSession === null) {
            get().setError(client.error.orderNeedCash)
            return
          }
          if (orderType === null) {
            get().setError(client.val.orderTypeRequired)
            return
          }
          const phone = orderCustomerPhone.trim()
          const addr = orderCustomerAddress.trim()
          get().setOrderSubmitLoading(true)
          try {
            const total =
              Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
            const receivedAmount = receivedParam ?? null
            const changeAmount = receivedAmount !== null ? Math.max(0, receivedAmount - total) : null

            const lines = cart.map((c) => ({
              name: c.name,
              size: c.size,
              quantity: c.quantity,
              unitPrice: c.price,
              categoryLabel: c.categoryLabel,
              lineNote: c.lineNote,
              hasGratine: c.hasGratine,
              gratineAmount: c.gratineAmount,
            }))
            const created = await invoke<OrderItem>('create_order', {
              userId,
              items: cart,
              cashSessionId: cashSession!.id,
              orderType,
              orderComment: null,
              customerPhone: phone.length > 0 ? phone : null,
              customerAddress: addr.length > 0 ? addr : null,
              receivedAmount,
              changeAmount,
            })
            await get().loadOrders(userId)
            set({ cart: [], orderType: null, orderComment: '', orderCustomerPhone: '', orderCustomerAddress: '' })
            try {
              const { ticketShopLabel, ticketShopPhone, ticketPrinterA, ticketPrinterB } = get()
              const ticketInput = {
                shopLabel: ticketShopLabel,
                shopPhone: ticketShopPhone,
                orderId: created.id,
                timeIso: created.time,
                cashier: created.cashier,
                cashSessionId: cashSession.id,
                orderType,
                comment: created.orderComment ?? null,
                customerPhone: created.customerPhone ?? null,
                customerAddress: created.customerAddress ?? null,
                lines,
                total: created.total,
                receivedAmount: created.receivedAmount,
                changeAmount: created.changeAmount,
              } as const
                // Nouvelle impression via plugin (Cuisine B + Client A)
                await printOrderTicket({
                  ...ticketInput,
                  printerA: ticketPrinterA.trim(),
                  printerB: ticketPrinterB.trim(),
                })
            } catch (e) {
              const technicalMsg = e instanceof Error ? e.message : String(e)
              pushToast('warning', `${ticketPrintUserError()} (${technicalMsg})`)
            }
          } catch (e) {
            logDevError('create_order', e)
            const msg = String(e ?? '')
            if (msg.includes('Session caisse') || msg.includes('caisse')) {
              get().setCashSession(null)
            }
            get().setError(userFacingErrorMessage(e, client.error.orderFailed))
          } finally {
            get().setOrderSubmitLoading(false)
          }
        },

        closeCashRenduModal: () => {
          if (get().orderSubmitLoading) return
          get().setCashReceivedStr('')
          get().setCashRenduModalOpen(false)
        },

        requestValidateOrder: () => {
          const { cart, userId, orderSubmitLoading, cashSession, orderType } = get()
          if (cart.length === 0 || userId === null || orderSubmitLoading) return
          if (cashSession === null) {
            get().setError(client.error.orderNeedCash)
            return
          }
          if (orderType === null) {
            get().setError(client.val.orderTypeRequired)
            return
          }
          
          if (orderType === 'livraison') {
            get().setDeliveryModalOpen(true)
          } else {
            get().setCashReceivedStr('')
            get().setCashRenduModalOpen(true)
          }
        },

        confirmDeliveryInfo: () => {
          get().setDeliveryModalOpen(false)
          get().setCashReceivedStr('')
          get().setCashRenduModalOpen(true)
        },

        confirmCashRenduAndValidate: async () => {
          const { cart, userId, orderSubmitLoading, cashReceivedStr } = get()
          if (cart.length === 0 || userId === null || orderSubmitLoading) return
          const total =
            Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
          const received = parseMadAmountRaw(cashReceivedStr)
          const totalCents = Math.round(total * 100)
          const receivedCents = received === null ? null : Math.round(received * 100)
          if (receivedCents === null || receivedCents < totalCents) return
          get().setCashRenduModalOpen(false)
          await get().validateOrder(received)
          get().setCashReceivedStr('')
        },

        bumpCashReceived: (delta) => {
          const cur = parseMadAmountRaw(get().cashReceivedStr) ?? 0
          const next = Math.round((cur + delta) * 100) / 100
          get().setCashReceivedStr(String(next))
        },

        addCaissier: async () => {
          const { userId, role, newCaissierName, newCaissierPin, newCaissierTheme } = get()
          if (userId === null) return
          if (role !== 'gerant') return

          const name = newCaissierName.trim()
          const pin = newCaissierPin.trim()
          if (!name) {
            get().setCaissiersError(client.val.userName)
            return
          }
          if (!pin) {
            get().setCaissiersError(client.val.userPin)
            return
          }

          get().setAddingCaissier(true)
          get().setCaissiersError(null)
          try {
            await invoke('create_caissier', {
              role,
              userId,
              input: {
                name,
                pin,
                theme: newCaissierTheme,
              },
            })
            get().setNewCaissierName('')
            get().setNewCaissierPin('')
            get().setNewCaissierTheme('dark')
            await get().loadCaissiers()
          } catch (e) {
            logDevError('create_caissier', e)
            get().setCaissiersError(userFacingErrorMessage(e, client.error.addUser))
          } finally {
            get().setAddingCaissier(false)
          }
        },

        toggleCaissierActive: async (targetUserId, nextActive) => {
          const { userId, role } = get()
          if (userId === null) return
          if (role !== 'gerant') return

          get().setBusyToggleUserId(targetUserId)
          get().setCaissiersError(null)
          try {
            await invoke('set_caissier_active', {
              role,
              userId,
              targetUserId,
              active: nextActive,
            })
            await get().loadCaissiers()
          } catch (e) {
            logDevError('set_caissier_active', e)
            get().setCaissiersError(userFacingErrorMessage(e, client.error.toggleUser))
          } finally {
            get().setBusyToggleUserId(null)
          }
        },

        resetCaissierPin: async () => {
          const { userId, role, resetPinTarget, resetPinValue } = get()
          if (userId === null) return
          if (role !== 'gerant') return
          if (!resetPinTarget) return

          const pin = resetPinValue.trim().replace(/\D/g, '')
          if (!pin) {
            get().setResetPinError(client.val.resetPinEmpty)
            return
          }

          get().setBusyResetPinUserId(resetPinTarget.id)
          get().setResetPinError(null)
          get().setCaissiersError(null)

          try {
            await invoke('reset_caissier_pin', {
              role,
              userId,
              targetUserId: resetPinTarget.id,
              pin,
            })
            get().setResetPinTarget(null)
            get().setResetPinValue('')
            await get().loadCaissiers()
          } catch (e) {
            logDevError('reset_caissier_pin', e)
            get().setResetPinError(userFacingErrorMessage(e, client.error.resetPin))
          } finally {
            get().setBusyResetPinUserId(null)
          }
        },

        confirmDeactivateUser: async () => {
          const { deactivateUserTarget, userId, role } = get()
          if (!deactivateUserTarget) return
          if (userId === null) return
          if (role !== 'gerant') return

          get().setBusyDeactivateUserId(deactivateUserTarget.id)
          get().setDeactivateUserError(null)
          try {
            await invoke('set_caissier_active', {
              role,
              userId,
              targetUserId: deactivateUserTarget.id,
              active: false,
            })
            await get().loadCaissiers()
            get().setDeactivateUserTarget(null)
          } catch (e) {
            logDevError('set_caissier_active_deactivate', e)
            get().setDeactivateUserError(userFacingErrorMessage(e, client.error.deactivate))
          } finally {
            get().setBusyDeactivateUserId(null)
          }
        },

        verifyProfilePin: async () => {
          const { userId, role, profileOldPin } = get()
          if (userId === null) return
          if (!profileOldPin.trim()) return

          const pin = profileOldPin.trim().replace(/\D/g, '')
          if (!pin) return
          if (pin.length < 4 || pin.length > 6) {
            get().setProfileError(client.val.pinLength)
            return
          }

          get().setProfileLoading(true)
          get().setProfileError(null)
          get().setProfileSuccess(null)
          get().setProfileOldVerified(false)
          try {
            await invoke('verify_user_pin', {
              role,
              userId,
              pin,
            })
            get().setProfileOldVerified(true)
          } catch (e) {
            logDevError('verify_user_pin', e)
            get().setProfileOldVerified(false)
            get().setProfileError(userFacingErrorMessage(e, client.error.profileWrongPin))
          } finally {
            get().setProfileLoading(false)
          }
        },

        submitProfilePasswordChange: async () => {
          const { userId, role, profileOldVerified, profileOldPin, profileNewPin, profileNewPinConfirm } = get()
          if (userId === null) return
          if (!profileOldVerified) return

          const oldPinDigits = profileOldPin.trim().replace(/\D/g, '')
          const newPinDigits = profileNewPin.trim().replace(/\D/g, '')
          const confirmDigits = profileNewPinConfirm.trim().replace(/\D/g, '')

          if (!newPinDigits || !confirmDigits) {
            get().setProfileError(client.val.pinNewRequired)
            return
          }
          if (newPinDigits.length < 4 || newPinDigits.length > 6) {
            get().setProfileError(client.val.pinLength)
            return
          }
          if (newPinDigits !== confirmDigits) {
            get().setProfileError(client.val.pinMismatch)
            return
          }

          get().setProfileLoading(true)
          get().setProfileError(null)
          get().setProfileSuccess(null)
          try {
            await invoke('change_user_password', {
              role,
              userId,
              old_pin: oldPinDigits,
              new_pin: newPinDigits,
            })

            get().setProfileSuccess(client.success.pinSaved)
            get().setProfileOldVerified(false)
            get().setProfileOldPin('')
            get().setProfileNewPin('')
            get().setProfileNewPinConfirm('')
          } catch (e) {
            logDevError('change_user_password', e)
            get().setProfileError(userFacingErrorMessage(e, client.error.profilePinChange))
          } finally {
            get().setProfileLoading(false)
          }
        },

        submitProfileNameChange: async () => {
          const { userId, role, profileNameDraft, profileNamePin } = get()
          if (userId === null) return
          if (role !== 'gerant') return
          const newName = profileNameDraft.trim()
          if (!newName) {
            get().setProfileNameError(client.val.profileName)
            return
          }
          const pin = profileNamePin.trim().replace(/\D/g, '')
          if (!pin || pin.length < 4 || pin.length > 6) {
            get().setProfileNameError(client.val.profilePinModal)
            return
          }

          get().setProfileNameLoading(true)
          get().setProfileNameError(null)
          try {
            await invoke('change_user_name', {
              role,
              userId,
              pin,
              newName,
            })

            get().setProfileNamePinModalOpen(false)
            get().setProfileNamePin('')

            try {
              const res = await invoke<UserProfileDto>('get_user_profile', { role, userId })
              get().setProfileUserProfile(res)
              get().setProfileNameDraft(res.name)
            } catch (e) {
              logDevError('get_user_profile_after_rename', e)
              get().setProfileNameError(
                userFacingErrorMessage(e, client.error.profileNamePartialOk),
              )
            }
          } catch (e) {
            logDevError('change_user_name', e)
            get().setProfileNameError(userFacingErrorMessage(e, client.error.profileNameChange))
          } finally {
            get().setProfileNameLoading(false)
          }
        },

        testPrinter: async (printerName) => {
          const { pushToast } = get()
          if (!printerName.trim()) return
          try {
            await printTestTicket(printerName)
            pushToast('success', client.success.ticketPrintStarted)
          } catch (e) {
            logDevError('testPrinter', e)
            const technicalMsg = e instanceof Error ? e.message : String(e)
            pushToast('error', `Échec du test : ${technicalMsg}`)
          }
        },
        addPrintLog: (msg, type = 'info') => {
          const time = new Date().toLocaleTimeString('fr-FR')
          set((s) => ({
            printLogs: [{ time, msg, type }, ...s.printLogs].slice(0, 50),
          }))
        },

        clearPrintLogs: () => set({ printLogs: [] }),
        reorderCatalogCategories: async (startIndex, endIndex) => {
          const { catalogCategories, userId } = get()
          if (startIndex === endIndex) return

          const next = [...catalogCategories]
          // Échange direct (Swap)
          const temp = next[startIndex]
          next[startIndex] = next[endIndex]
          next[endIndex] = temp

          // Mise à jour des positions selon le nouvel ordre
          const updated = next.map((cat, index) => ({
            ...cat,
            position: index,
          }))

          // Optimistic update
          set({ catalogCategories: updated })

          try {
            await invoke('reorder_categories', {
              userId: userId ?? 0,
              positions: updated.map((c) => ({ id: c.id, position: c.position })),
            })
          } catch (e) {
            logDevError('reorder_categories', e)
            get().pushToast('error', "Échec de la sauvegarde de l'ordre des catégories.")
            // On pourrait rollback ici si nécessaire, mais re-loader le catalogue est plus sûr
            void get().loadCatalog()
          }
        },
        reorderProducts: async (categoryKey, startIndex, endIndex) => {
          const { catalogItemsByCat, userId } = get()
          const items = catalogItemsByCat[categoryKey]
          if (!items || startIndex === endIndex) return

          const next = [...items]
          // Échange direct (Swap)
          const temp = next[startIndex]
          next[startIndex] = next[endIndex]
          next[endIndex] = temp

          // On met à jour le state local immédiatement
          const updatedMap = {
            ...catalogItemsByCat,
            [categoryKey]: next,
          }
          set({ catalogItemsByCat: updatedMap })

          try {
            // Calcul des nouvelles positions pour tous les items de la catégorie
            const positions = next.map((item, index) => {
              return { id: item.id as number, position: index }
            }).filter(p => p.id !== undefined)

            if (positions.length > 0) {
              await invoke('reorder_products', {
                userId: userId ?? 0,
                positions,
              })
            }
          } catch (e) {
            logDevError('reorder_products', e)
            get().pushToast('error', "Échec de la sauvegarde de l'ordre des produits.")
            void get().loadCatalog()
          }
        },
      }),
      {
        name: 'yobo-gestion',
        partialize: (state) => ({
          theme: state.theme,
          themePreference: state.themePreference,
          ticketPrinterA: state.ticketPrinterA,
          ticketPrinterB: state.ticketPrinterB,
          updateFirstSeenAt: state.updateFirstSeenAt,
          updateVersionSeen: state.updateVersionSeen,
        }),
        merge: (persisted, current) => {
          const p = persisted as Partial<YoboState> | undefined
          const raw = p?.themePreference as string | undefined
          let themePreference: YoboState['themePreference'] = current.themePreference
          if (raw === 'manual' || raw === 'auto_hour') themePreference = raw
          else if (raw === 'system') themePreference = 'auto_hour'
          return {
            ...current,
            ...p,
            themePreference,
            ticketPrinterA: typeof p?.ticketPrinterA === 'string' ? p.ticketPrinterA : current.ticketPrinterA,
            ticketPrinterB: typeof p?.ticketPrinterB === 'string' ? p.ticketPrinterB : current.ticketPrinterB,
          }
        },
      },
    ),
    { name: 'YOBO Gestion' },
  ),
)
