import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { MENU_ITEMS } from '../data/menuFallback'
import { formatDateHeureFr } from '../lib/formatDateHeureFr'
import { parseMadAmountRaw } from '../lib/parseMad'
import {
  formatSizeLabelForDisplay,
  getSingleVariantEntry,
  isBlankSizeKey,
  sortSizePairsForDisplay,
} from '../lib/productSizes'
import { canRequestOrderCancel, orderStatusLabelFr } from '../lib/orderStatus'
import { capitalizeFirstLetter } from '../lib/yoboStrings'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useYoboStore } from '../store'
import { SpinnerIcon } from './icons/SpinnerIcon'
import { YoboAlphaInput, YoboAlphaTextarea, YoboNumericInput } from './YoboKeyboardInputs'
import { YoboModal } from './YoboModal'
export { YoboModal }

type LogoutGuardInfo = { sessionId: number | null }

export function YoboAppModals() {
  const tab = useYoboStore((s) => s.tab)
  const role = useYoboStore((s) => s.role)
  const menuCat = useYoboStore((s) => s.menuCat)
  const menuCatKey = useYoboStore((s) => s.menuCatKey)
  const catalogItemsByCat = useYoboStore((s) => s.catalogItemsByCat)

  const {
    selectedItem,
    selectedSize,
    setSelectedItem,
    setSelectedSize,
    posModalQty,
    setPosModalQty,
    setPosModalLineNote,
    addToCart,
    cart,
    cashRenduModalOpen,
    closeCashRenduModal,
    cashReceivedStr,
    setCashReceivedStr,
    orderSubmitLoading,
    confirmCashRenduAndValidate,
    bumpCashReceived,
    cashCloseModalOpen,
    setCashCloseModalOpen,
    cashCloseLoading,
    submitCashClose,
    cashCloseAmountStr,
    setCashCloseAmountStr,
    cashCloseComment,
    setCashCloseComment,
    cashSession,
    cashCloseSummary,
    setCashCloseSummary,
    orderDetailTarget,
    setOrderDetailTarget,
    resetPinTarget,
    setResetPinTarget,
    resetPinValue,
    setResetPinValue,
    resetCaissierPin,
    busyResetPinUserId,
    setResetPinError,
    profileNamePinModalOpen,
    setProfileNamePinModalOpen,
    profileNamePin,
    setProfileNamePin,
    profileNameLoading,
    submitProfileNameChange,
    setProfileNameError,
    deactivateUserTarget,
    setDeactivateUserTarget,
    confirmDeactivateUser,
    busyDeactivateUserId,
    setDeactivateUserError,
    userId,
    orderCancelModalOpen,
    orderCancelReason,
    orderCancelLoading,
    orderCancelAuthPin = '',
    orderCancelAuthError = null,
    setOrderCancelModalOpen,
    setOrderCancelReason,
    setOrderCancelAuthPin,
    submitOrderCancel,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    startLogoutTransition,
    discountModalOpen,
    setDiscountModalOpen,
    discountAuthModalOpen,
    setDiscountAuthModalOpen,
    discountAuthPin,
    setDiscountAuthPin,
    discountAuthLoading,
    discountAuthError,
    submitDiscountAuth,
    applyDiscount,
    setPosModalHasGratine,
    posModalGratines,
    setPosModalGratineAtIndex,
    posModalNotes,
    setPosModalNoteAtIndex,
    gratinePrice,
    ticketPreviewHtml,
    ticketPreviewModalOpen,
    setTicketPreviewModalOpen,
    deliveryModalOpen,
    setDeliveryModalOpen,
    confirmDeliveryInfo,
    orderCustomerPhone,
    orderCustomerAddress,
    setOrderCustomerPhone,
    setOrderCustomerAddress,
    exitConfirmOpen,
    setExitConfirmOpen,
    validateOrder,
  } = useYoboStore(
    useShallow((s) => ({
      selectedItem: s.selectedItem,
      selectedSize: s.selectedSize,
      setSelectedItem: s.setSelectedItem,
      setSelectedSize: s.setSelectedSize,
      posModalQty: s.posModalQty,
      setPosModalQty: s.setPosModalQty,
      setPosModalLineNote: s.setPosModalLineNote,
      addToCart: s.addToCart,
      cart: s.cart,
      cashRenduModalOpen: s.cashRenduModalOpen,
      closeCashRenduModal: s.closeCashRenduModal,
      cashReceivedStr: s.cashReceivedStr,
      setCashReceivedStr: s.setCashReceivedStr,
      orderSubmitLoading: s.orderSubmitLoading,
      confirmCashRenduAndValidate: s.confirmCashRenduAndValidate,
      bumpCashReceived: s.bumpCashReceived,
      cashCloseModalOpen: s.cashCloseModalOpen,
      setCashCloseModalOpen: s.setCashCloseModalOpen,
      cashCloseLoading: s.cashCloseLoading,
      submitCashClose: s.submitCashClose,
      cashCloseAmountStr: s.cashCloseAmountStr,
      setCashCloseAmountStr: s.setCashCloseAmountStr,
      cashCloseComment: s.cashCloseComment,
      setCashCloseComment: s.setCashCloseComment,
      cashSession: s.cashSession,
      cashCloseSummary: s.cashCloseSummary,
      setCashCloseSummary: s.setCashCloseSummary,
      orderDetailTarget: s.orderDetailTarget,
      setOrderDetailTarget: s.setOrderDetailTarget,
      resetPinTarget: s.resetPinTarget,
      setResetPinTarget: s.setResetPinTarget,
      resetPinValue: s.resetPinValue,
      setResetPinValue: s.setResetPinValue,
      resetCaissierPin: s.resetCaissierPin,
      busyResetPinUserId: s.busyResetPinUserId,
      setResetPinError: s.setResetPinError,
      profileNamePinModalOpen: s.profileNamePinModalOpen,
      setProfileNamePinModalOpen: s.setProfileNamePinModalOpen,
      profileNamePin: s.profileNamePin,
      setProfileNamePin: s.setProfileNamePin,
      profileNameLoading: s.profileNameLoading,
      submitProfileNameChange: s.submitProfileNameChange,
      setProfileNameError: s.setProfileNameError,
      deactivateUserTarget: s.deactivateUserTarget,
      setDeactivateUserTarget: s.setDeactivateUserTarget,
      confirmDeactivateUser: s.confirmDeactivateUser,
      busyDeactivateUserId: s.busyDeactivateUserId,
      setDeactivateUserError: s.setDeactivateUserError,
      userId: s.userId,
      orderCancelModalOpen: s.orderCancelModalOpen,
      orderCancelReason: s.orderCancelReason,
      orderCancelLoading: s.orderCancelLoading,
      orderCancelAuthPin: s.orderCancelAuthPin,
      orderCancelAuthError: s.orderCancelAuthError,
      setOrderCancelModalOpen: s.setOrderCancelModalOpen,
      setOrderCancelReason: s.setOrderCancelReason,
      setOrderCancelAuthPin: s.setOrderCancelAuthPin,
      submitOrderCancel: s.submitOrderCancel,
      logoutConfirmOpen: s.logoutConfirmOpen,
      setLogoutConfirmOpen: s.setLogoutConfirmOpen,
      startLogoutTransition: s.startLogoutTransition,
      discountModalOpen: s.discountModalOpen,
      setDiscountModalOpen: s.setDiscountModalOpen,
      discountAuthModalOpen: s.discountAuthModalOpen,
      setDiscountAuthModalOpen: s.setDiscountAuthModalOpen,
      discountAuthPin: s.discountAuthPin,
      setDiscountAuthPin: s.setDiscountAuthPin,
      discountAuthLoading: s.discountAuthLoading,
      discountAuthError: s.discountAuthError,
      submitDiscountAuth: s.submitDiscountAuth,
      applyDiscount: s.applyDiscount,
      setPosModalHasGratine: s.setPosModalHasGratine,
      posModalGratines: s.posModalGratines,
      setPosModalGratineAtIndex: s.setPosModalGratineAtIndex,
      posModalNotes: s.posModalNotes,
      setPosModalNoteAtIndex: s.setPosModalNoteAtIndex,
      gratinePrice: s.gratinePrice,
      ticketPreviewHtml: s.ticketPreviewHtml,
      ticketPreviewModalOpen: s.ticketPreviewModalOpen,
      setTicketPreviewModalOpen: s.setTicketPreviewModalOpen,
      deliveryModalOpen: s.deliveryModalOpen,
      setDeliveryModalOpen: s.setDeliveryModalOpen,
      confirmDeliveryInfo: s.confirmDeliveryInfo,
      orderCustomerPhone: s.orderCustomerPhone,
      orderCustomerAddress: s.orderCustomerAddress,
      setOrderCustomerPhone: s.setOrderCustomerPhone,
      setOrderCustomerAddress: s.setOrderCustomerAddress,
      exitConfirmOpen: s.exitConfirmOpen,
      setExitConfirmOpen: s.setExitConfirmOpen,
      validateOrder: s.validateOrder,
    })),
  )

  const hasCatalog = Object.keys(catalogItemsByCat).length > 0
  const currentItems = hasCatalog ? (catalogItemsByCat[menuCatKey] ?? []) : MENU_ITEMS[menuCat]
  const currentSelectedItem = selectedItem === null ? null : currentItems[selectedItem]
  const posModalSingleVariant = Boolean(
    currentSelectedItem && getSingleVariantEntry(currentSelectedItem.sizes) !== null,
  )

  const canCancelOpenOrder = useMemo(() => {
    if (!orderDetailTarget) return false
    return canRequestOrderCancel({
      order: orderDetailTarget,
      cashSession,
      currentUserId: userId,
      role,
    })
  }, [orderDetailTarget, cashSession, userId, role])

  const orderDetailLines = orderDetailTarget?.itemLines ?? []
  const logoutGuardInfo: LogoutGuardInfo = { sessionId: cashSession?.id ?? null }

  const cartTotal =
    Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
  const cartTotalCents = Math.round(cartTotal * 100)
  const cashReceivedParsed = parseMadAmountRaw(cashReceivedStr)
  const cashReceivedCents = cashReceivedParsed === null ? null : Math.round(cashReceivedParsed * 100)
  const cashRenduMontant =
    cashReceivedParsed === null
      ? null
      : Math.max(0, Math.round((cashReceivedParsed - cartTotal) * 100) / 100)
  const cashRenduCanConfirm =
    cashReceivedCents !== null &&
    cashReceivedCents >= cartTotalCents &&
    cart.length > 0 &&
    !orderSubmitLoading
  
  const [activePosTab, setActivePosTab] = useState(0)

  useEffect(() => {
    setActivePosTab((t) => (t >= posModalQty ? 0 : t))
  }, [posModalQty])

  return (
    <>
      <YoboModal
        open={tab === 'caisse' && selectedItem !== null && !!currentSelectedItem}
        onClose={() => {
          setSelectedItem(null)
          setSelectedSize(null)
          setPosModalQty(1)
          setPosModalLineNote('')
          setPosModalHasGratine(false)
          setActivePosTab(0)
        }}
        title={currentSelectedItem?.name ?? 'Produit'}
        headerEmoji={currentSelectedItem?.emoji}
        subtitle={
          posModalSingleVariant
            ? 'Ajuste la quantité puis ajoute au panier.'
            : 'Choisis une taille et la quantité, puis ajoute au panier.'
        }
        maxWidthClass="max-w-2xl"
        footer={
          <div className="flex w-full gap-3">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost min-w-0 flex-1 py-4"
              onClick={() => {
                setSelectedItem(null)
                setSelectedSize(null)
                setPosModalQty(1)
                setPosModalLineNote('')
                setPosModalHasGratine(false)
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">close</span>
                Annuler
              </span>
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary min-w-0 flex-1 py-4 whitespace-nowrap"
              onClick={() => addToCart()}
              disabled={selectedSize === null}
            >
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                Ajouter au panier
              </span>
            </button>
          </div>
        }
      >
        {currentSelectedItem ? (
          <div className="grid min-w-0 grid-cols-1 gap-8 md:grid-cols-[1fr_1.4fr]">
            {/* Left Column: Size & Qty */}
            <div className="min-w-0 space-y-6">
              <div>
                <div className="yobo-modal-label mb-3">Taille / Variante</div>
                {posModalSingleVariant ? (
                  (() => {
                    const one = getSingleVariantEntry(currentSelectedItem.sizes)
                    if (!one) return null
                    const [sz, price] = one
                    return (
                      <div
                        className="yobo-size-chip yobo-size-chip--active w-full cursor-default select-none"
                        aria-current="true"
                      >
                        <div className="text-sm font-bold text-[var(--accent)]">
                          {isBlankSizeKey(sz) ? 'Prix unique' : formatSizeLabelForDisplay(sz)}
                        </div>
                        <div className="text-xs text-[var(--muted)]">{`${price} MAD`}</div>
                      </div>
                    )
                  })()
                ) : (
                  (() => {
                    const sizePairs = sortSizePairsForDisplay(Object.entries(currentSelectedItem.sizes))
                    const n = sizePairs.length
                    /** Dernière carte seule sur la ligne (nombre de tailles impair) → centrée comme une carte du dessus. */
                    const lastCentered = n % 2 === 1
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {sizePairs.map(([size, price], idx) => (
                          <button
                            key={size === '' ? '__yobo-single' : size}
                            type="button"
                            className={`yobo-size-chip ${
                              selectedSize === size ? 'yobo-size-chip--active' : ''
                            } ${lastCentered && idx === n - 1 ? 'col-span-2 justify-self-center w-[calc(50%-0.25rem)]' : ''}`}
                            onClick={() => setSelectedSize(size)}
                          >
                            <div className="text-sm font-bold text-[var(--accent)]">
                              {isBlankSizeKey(size) ? 'Prix unique' : formatSizeLabelForDisplay(size)}
                            </div>
                            <div className="text-xs text-[var(--muted)]">{`${price} MAD`}</div>
                          </button>
                        ))}
                      </div>
                    )
                  })()
                )}
              </div>

              <div>
                <div className="yobo-modal-label mb-3">Quantité</div>
                <div
                  className={`yobo-pos-qty-stepper yobo-pos-qty-stepper--modal mx-auto ${!posModalSingleVariant && selectedSize === null ? 'yobo-pos-qty-stepper--locked' : ''}`}
                >
                  <button
                    type="button"
                    className="yobo-pos-qty-btn"
                    aria-label="Diminuer"
                    disabled={!posModalSingleVariant && selectedSize === null}
                    onClick={() => setPosModalQty((q) => Math.max(1, q - 1))}
                  >
                    −
                  </button>
                  <YoboNumericInput
                    variant="pin"
                    maskPin={false}
                    keyboardMaxLen={2}
                    className="yobo-pos-qty-input"
                    disabled={!posModalSingleVariant && selectedSize === null}
                    value={String(posModalQty)}
                    onValueChange={(v) => {
                      const raw = v.replace(/\D/g, '')
                      if (raw === '') {
                        setPosModalQty(1)
                        return
                      }
                      setPosModalQty(Math.min(99, Math.max(1, parseInt(raw, 10) || 1)))
                    }}
                  />
                  <button
                    type="button"
                    className="yobo-pos-qty-btn"
                    aria-label="Augmenter"
                    disabled={!posModalSingleVariant && selectedSize === null}
                    onClick={() => setPosModalQty((q) => Math.min(99, q + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Config & Notes */}
            <div className="min-w-0">
              <div className="yobo-modal-label mb-3">Configuration & Notes</div>

              <div className="flex min-h-0 min-w-0 flex-col">
                {/* Onglets Plat 1 … N — défilement horizontal si beaucoup de cartes */}
                <div className="mb-4 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth touch-pan-x px-1 pt-1 pb-2">
                  {Array.from({ length: posModalQty }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePosTab(idx)}
                      className={`inline-flex min-w-[3rem] shrink-0 flex-col items-center justify-center rounded-xl border-2 px-3 py-1.5 transition-all ${
                        activePosTab === idx
                          ? 'border-[#4d2600]/45 bg-[var(--accent)] text-[#4d2600] shadow-md'
                          : 'border-transparent bg-[var(--card)] text-[var(--muted)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]'
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase opacity-60">Plat</span>
                      <span className="text-sm font-black">{idx + 1}</span>
                    </button>
                  ))}
                </div>

                <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                  {(() => {
                    const idx = activePosTab < posModalQty ? activePosTab : 0
                    const isTacos = menuCat === 'tacos' || menuCatKey === 'tacos'
                    const isG = posModalGratines[idx]
                    const note = posModalNotes[idx] ?? ''

                    return (
                      <div key={idx} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm ring-1 ring-black/5">
                        <div className="space-y-4">
                          {isTacos && (
                            <button
                              type="button"
                              onClick={() => setPosModalGratineAtIndex(idx, !isG)}
                              className={`yobo-size-chip w-full ${isG ? 'yobo-size-chip--active' : ''}`}
                            >
                              <div className="text-sm font-bold text-[var(--accent)]">Gratiné</div>
                              <div className="text-xs text-[var(--muted)]">+{gratinePrice} MAD</div>
                            </button>
                          )}

                          <div className="space-y-2">
                            <div className="ml-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
                              Note pour l&apos;article #{idx + 1}
                            </div>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-3 top-3.5 text-[20px] text-[var(--muted)]">
                                edit_note
                              </span>
                              <YoboAlphaTextarea
                                className="yobo-modal-field min-h-[120px] w-full !pl-10 !pt-3"
                                autoComplete="off"
                                placeholder="Sauce algérienne, sans oignons, etc."
                                value={note}
                                onValueChange={(v) => setPosModalNoteAtIndex(idx, v)}
                                keyboardMaxLength={200}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </YoboModal>

      <YoboModal
        open={cashRenduModalOpen && tab === 'caisse'}
        onClose={closeCashRenduModal}
        title="Espèces"
        headerEmoji="💵"
        subtitle={`Total ${cartTotal} MAD — montant reçu du client.`}
        maxWidthClass="max-w-sm"
        footer={
          <div className="flex flex-col gap-2 w-full">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost w-full"
              onClick={() => {
                closeCashRenduModal()
                void validateOrder(null)
              }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">skip_next</span>
                Continuer sans calculer
              </span>
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary w-full"
              disabled={!cashRenduCanConfirm}
              onClick={() => void confirmCashRenduAndValidate()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {orderSubmitLoading ? <SpinnerIcon size={16} /> : null}
                {orderSubmitLoading ? 'Envoi...' : 'Valider'}
              </span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="yobo-modal-label" htmlFor="cash-received">
              Montant reçu (MAD)
            </label>
            <YoboNumericInput
              id="cash-received"
              className="yobo-modal-field mt-1 w-full tabular-nums"
              variant="decimal"
              autoComplete="off"
              placeholder="0"
              value={cashReceivedStr}
              onValueChange={setCashReceivedStr}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && cashRenduCanConfirm) {
                  e.preventDefault()
                  void confirmCashRenduAndValidate()
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[20, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="yobo-modal-btn yobo-modal-btn--ghost w-full text-sm"
                  onClick={() => bumpCashReceived(n)}
                >
                  +{n}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="yobo-modal-btn yobo-modal-btn--ghost w-full text-sm"
                onClick={() => bumpCashReceived(200)}
              >
                +200
              </button>
              <button
                type="button"
                className="yobo-modal-btn yobo-modal-btn--ghost w-full text-sm font-semibold"
                onClick={() => setCashReceivedStr(String(cartTotal))}
              >
                Exact
              </button>
            </div>
          </div>
          {cashReceivedCents !== null && cashReceivedCents < cartTotalCents ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Montant insuffisant : il manque{' '}
              <span className="font-bold tabular-nums">
                {Math.round(cartTotalCents - cashReceivedCents) / 100} MAD
              </span>
              .
            </div>
          ) : null}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
            <div className="text-xs font-medium text-[var(--muted)]">Rendu à donner</div>
            <div
              className={`mt-1 text-2xl font-extrabold tabular-nums ${
                cashRenduMontant === null ? 'text-[var(--muted)]' : 'text-[var(--accent)]'
              }`}
            >
              {cashRenduMontant === null ? '—' : `${cashRenduMontant} MAD`}
            </div>
          </div>
        </div>
      </YoboModal>

      <YoboModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title="Déconnexion"
        subtitle={logoutGuardInfo.sessionId != null ? `Caisse ouverte · session #${logoutGuardInfo.sessionId}` : 'Voulez-vous vraiment vous déconnecter ?'}
        headerEmoji="⚠️"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => setLogoutConfirmOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--danger"
              onClick={() => {
                startLogoutTransition()
              }}
            >
              Se déconnecter
            </button>
          </div>
        }
      >
        {logoutGuardInfo.sessionId != null && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--card))] p-3 text-sm text-[var(--text-h)]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Caisse ouverte</div>
              <p className="mt-1 leading-relaxed">
                Une session caisse est encore ouverte. Idéalement, ferme la caisse avant de te déconnecter.
              </p>
            </div>
          </div>
        )}
      </YoboModal>

      <YoboModal
        open={exitConfirmOpen}
        onClose={() => setExitConfirmOpen(false)}
        title="Fermer l'application"
        subtitle="Voulez-vous vraiment quitter YOBO ?"
        headerEmoji="🚪"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => setExitConfirmOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--danger"
              onClick={() => {
                void getCurrentWindow().close()
              }}
            >
              Quitter
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Toutes les ventes validées sont enregistrées. Assurez-vous d'avoir fermé votre session si nécessaire.
        </p>
      </YoboModal>

      <YoboModal
        open={cashCloseModalOpen}
        onClose={() => {
          if (!cashCloseLoading) setCashCloseModalOpen(false)
        }}
        title="Fermer la caisse"
        headerEmoji="🔒"
        subtitle="Compte les espèces en caisse et saisis le montant réel. La recette de la session est calculée automatiquement."
        maxWidthClass="max-w-sm"
        footer={
          <div className="flex w-full flex-wrap gap-2">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost min-w-[6rem] flex-1"
              disabled={cashCloseLoading}
              onClick={() => setCashCloseModalOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary min-w-[8rem] flex-1"
              disabled={cashCloseLoading}
              onClick={() => void submitCashClose()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {cashCloseLoading ? <SpinnerIcon size={16} /> : null}
                <span className="material-symbols-outlined text-[18px]">task_alt</span>
                {cashCloseLoading ? 'Fermeture…' : 'Valider'}
              </span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {cashSession ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
              Fond de départ :{' '}
              <span className="font-bold tabular-nums text-[var(--text-h)]">
                {cashSession.openingAmount} MAD
              </span>
            </div>
          ) : null}
          <div>
            <label className="yobo-modal-label" htmlFor="cash-close-amount">
              Montant compté en caisse (MAD)
            </label>
            <YoboNumericInput
              id="cash-close-amount"
              className="yobo-modal-field mt-1 w-full tabular-nums"
              variant="decimal"
              autoComplete="off"
              placeholder="0"
              value={cashCloseAmountStr}
              onValueChange={setCashCloseAmountStr}
            />
          </div>
          <div>
            <label className="yobo-modal-label" htmlFor="cash-close-comment">
              Commentaire (optionnel)
            </label>
            <YoboAlphaInput
              id="cash-close-comment"
              className="yobo-modal-field mt-1 w-full"
              autoComplete="off"
              placeholder="Optionnel"
              value={cashCloseComment}
              onValueChange={setCashCloseComment}
              keyboardMaxLength={500}
            />
          </div>
        </div>
      </YoboModal>

      <YoboModal
        open={cashCloseSummary !== null}
        onClose={() => setCashCloseSummary(null)}
        title="Caisse fermée"
        headerEmoji="✅"
        subtitle="Récapitulatif de la session."
        maxWidthClass="max-w-sm"
        footer={
          <button
            type="button"
            className="yobo-modal-btn yobo-modal-btn--primary w-full"
            onClick={() => setCashCloseSummary(null)}
          >
            OK
          </button>
        }
      >
        {cashCloseSummary ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-[var(--muted)]">Commandes</span>
              <span className="font-semibold tabular-nums">{cashCloseSummary.ordersCount}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[var(--muted)]">Recette (ventes)</span>
              <span className="font-bold tabular-nums text-[var(--accent)]">
                {cashCloseSummary.salesTotal} MAD
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[var(--muted)]">Fond départ</span>
              <span className="tabular-nums">{cashCloseSummary.openingAmount} MAD</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[var(--muted)]">Théorique en caisse</span>
              <span className="font-semibold tabular-nums">{cashCloseSummary.theoretical} MAD</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[var(--muted)]">Montant compté</span>
              <span className="tabular-nums">{cashCloseSummary.closingAmount} MAD</span>
            </div>
            <div
              className={`flex justify-between gap-2 rounded-lg border px-3 py-2 font-bold tabular-nums ${
                Math.abs(cashCloseSummary.gap) < 0.005
                  ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent)]'
                  : cashCloseSummary.gap > 0
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/40 bg-red-500/10 text-red-200'
              }`}
            >
              <span>Écart</span>
              <span>
                {cashCloseSummary.gap > 0 ? '+' : ''}
                {Math.round(cashCloseSummary.gap * 100) / 100} MAD
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)]">Fermée le {cashCloseSummary.closedAt}</p>
          </div>
        ) : null}
      </YoboModal>

      <YoboModal
        open={!!orderDetailTarget}
        onClose={() => {
          setOrderCancelModalOpen(false)
          setOrderCancelReason('')
          setOrderDetailTarget(null)
        }}
        title={orderDetailTarget ? `Commande #${orderDetailTarget.id}` : 'Commande'}
        subtitle={
          orderDetailTarget
            ? (() => {
                const base = `${capitalizeFirstLetter(orderDetailTarget.cashier)} · ${formatDateHeureFr(orderDetailTarget.time)}`
                const phone = orderDetailTarget.customerPhone?.trim()
                return phone ? `${base} - ${phone}` : base
              })()
            : ''
        }
        headerEmoji="🧾"
        maxWidthClass="max-w-3xl w-[min(100vw-1.5rem,52rem)]"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {canCancelOpenOrder ? (
              <button
                type="button"
                className="yobo-modal-btn yobo-modal-btn--danger-outline"
                onClick={() => {
                  setOrderCancelReason('')
                  setOrderCancelModalOpen(true)
                }}
              >
                Annuler la commande
              </button>
            ) : null}
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => {
                setOrderCancelModalOpen(false)
                setOrderCancelReason('')
                setOrderDetailTarget(null)
              }}
            >
              Fermer
            </button>
          </div>
        }
      >
        {orderDetailTarget ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="min-h-0 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Montant total</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-[var(--accent)] sm:text-3xl">
                  {orderDetailTarget.total}{' '}
                  <span className="text-sm font-bold text-[var(--muted)] sm:text-base">MAD</span>
                </div>
              </div>
              <div className="min-h-0 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Statut</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                      orderDetailTarget.status === 'validated'
                        ? 'border-[color-mix(in_oklab,var(--success)_35%,var(--border))] bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]'
                        : orderDetailTarget.status === 'cancelled'
                          ? 'border-[color-mix(in_oklab,var(--danger)_42%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_12%,var(--card))] text-[var(--danger)]'
                          : orderDetailTarget.status === 'modified'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                            : 'border-[color-mix(in_oklab,var(--muted)_55%,var(--border))] bg-[color-mix(in_oklab,var(--muted)_10%,transparent)] text-[var(--muted)]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {orderDetailTarget.status === 'validated'
                        ? 'check_circle'
                        : orderDetailTarget.status === 'cancelled'
                          ? 'cancel'
                          : orderDetailTarget.status === 'modified'
                            ? 'edit_note'
                            : 'help'}
                    </span>
                    {orderStatusLabelFr(orderDetailTarget.status)}
                  </span>
                </div>
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Articles
                </h3>
              </div>
              
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {orderDetailLines.map((line, idx) => {
                  const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
                  const unit = Number(line.price) || 0
                  const lineTotal = Math.round(unit * qty * 100) / 100
                  const hasGratine = !!(line as { hasGratine?: boolean }).hasGratine
                  const category = line.categoryLabel?.trim() || 'AUTRES'

                  return (
                    <div
                      key={`${line.name}-${idx}`}
                      className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm transition-all hover:ring-1 hover:ring-[var(--accent-border)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 text-2xl leading-none" aria-hidden>
                          {line.emoji || '📦'}
                        </span>
                        <div className="min-w-0 flex-1">
                          {/* Catégorie Mentionnée dans la carte */}
                          <div className="text-[8px] font-black uppercase tracking-widest text-[var(--accent)] opacity-60">
                            {category}
                          </div>
                          <div className="font-bold leading-tight text-[var(--text-h)]">{line.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {line.size?.trim() && (
                              <span className="text-[10px] font-semibold text-[var(--muted)]">
                                {formatSizeLabelForDisplay(line.size)}
                              </span>
                            )}
                            {hasGratine && (
                              <span className="yobo-gr-index">
                                GRATINÉ 🧀
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {line.lineNote?.trim() && (
                        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs italic leading-relaxed text-[var(--text-h)]">
                          {line.lineNote.trim()}
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-[var(--border)] pt-2">
                        <div className="text-[11px] text-[var(--muted)]">
                          <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-bold tabular-nums text-[var(--text-h)]">
                            ×{qty}
                          </span>
                          <span className="ml-1.5 tabular-nums">{unit} MAD</span>
                        </div>
                        <div className="text-xs font-black tabular-nums text-[var(--accent)]">
                          {lineTotal} MAD
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {orderDetailLines.length === 0 && (
                <div className="py-8 text-center text-xs italic text-[var(--muted)]">
                  Aucun article trouvé.
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                  Informations Générales
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    orderDetailTarget.orderType === 'livraison'
                      ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20'
                      : orderDetailTarget.orderType === 'emporter'
                        ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {orderDetailTarget.orderType === 'livraison'
                      ? 'delivery_dining'
                      : orderDetailTarget.orderType === 'emporter'
                        ? 'takeout_dining'
                        : 'restaurant'}
                  </span>
                  {orderDetailTarget.orderType === 'livraison'
                    ? 'Livraison'
                    : orderDetailTarget.orderType === 'emporter'
                      ? 'Emporter'
                      : 'Sur place'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">Session</div>
                  <div className="mt-1 text-sm font-black text-[var(--text-h)] tabular-nums">
                    {orderDetailTarget.cashSessionId != null ? (
                      <span className="text-[var(--accent)]">#{orderDetailTarget.cashSessionId}</span>
                    ) : (
                      <span className="opacity-30">—</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">Caissier</div>
                  <div className="mt-1 truncate text-sm font-black text-[var(--text-h)]">
                    {capitalizeFirstLetter(orderDetailTarget.cashier)}
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm sm:col-span-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">Date & Heure</div>
                  <div className="mt-1 text-sm font-black text-[var(--text-h)]">
                    {formatDateHeureFr(orderDetailTarget.time)}
                  </div>
                </div>
              </div>

              {orderDetailTarget.orderType === 'livraison' && (
                <div className="space-y-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    Coordonnées Livraison
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-400/60">Téléphone</div>
                      <div className="mt-1 text-base font-black text-[var(--text-h)] tabular-nums">
                        {orderDetailTarget.customerPhone?.trim() ? (
                          <span className="text-indigo-400">{orderDetailTarget.customerPhone}</span>
                        ) : (
                          <span className="text-[var(--muted)] italic text-xs font-normal">Non renseigné</span>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-400/60">Adresse</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm font-bold leading-relaxed text-[var(--text-h)]">
                        {orderDetailTarget.customerAddress?.trim() ? (
                          orderDetailTarget.customerAddress
                        ) : (
                          <span className="text-[var(--muted)] italic text-xs font-normal">Non renseignée</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {orderDetailTarget.status === 'cancelled' && orderDetailTarget.cancelReason ? (
              <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--card))] p-4 text-sm">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Raison d&apos;annulation
                </div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[var(--text-h)]">
                  {orderDetailTarget.cancelReason}
                </p>
              </div>
            ) : null}

            {orderDetailTarget.orderComment ? (
              <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] p-4 text-sm">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Note de commande
                </div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[var(--text-h)]">
                  {orderDetailTarget.orderComment}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </YoboModal>

      <YoboModal
        open={orderCancelModalOpen && !!orderDetailTarget}
        onClose={() => {
          if (orderCancelLoading) return
          setOrderCancelModalOpen(false)
        }}
        title="Confirmer l'annulation"
        subtitle={orderDetailTarget ? `Commande #${orderDetailTarget.id}` : ''}
        headerEmoji="⚠️"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              disabled={orderCancelLoading}
              onClick={() => setOrderCancelModalOpen(false)}
            >
              Retour
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--danger"
              disabled={
                orderCancelLoading ||
                !orderCancelReason.trim() ||
                (role === 'caissier' && !(orderCancelAuthPin || '').trim())
              }
              onClick={() => void submitOrderCancel()}
            >
              <span className="inline-flex items-center gap-2">
                {orderCancelLoading ? <SpinnerIcon size={16} /> : null}
                Confirmer l&apos;annulation
              </span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Indique la raison (obligatoire). Elle restera visible dans l&apos;historique pour cette commande.
          </p>
          <div>
            <label className="yobo-modal-label" htmlFor="order-cancel-reason">
              Raison de l&apos;annulation
            </label>
            <YoboAlphaInput
              id="order-cancel-reason"
              className="yobo-modal-field mt-1 w-full"
              autoComplete="off"
              value={orderCancelReason}
              onValueChange={setOrderCancelReason}
              placeholder="Ex. client parti, erreur de saisie…"
              disabled={orderCancelLoading}
              keyboardMaxLength={500}
            />
          </div>

          {role === 'caissier' && (
            <div className="border-t border-[var(--border)] border-dashed pt-4">
              <label className="yobo-modal-label" htmlFor="order-cancel-auth-pin">
                Autorisation : PIN Gérant
              </label>
              <YoboNumericInput
                id="order-cancel-auth-pin"
                className="yobo-modal-field mt-1 w-full"
                variant="pin"
                keyboardMaxLen={12}
                value={orderCancelAuthPin}
                onValueChange={setOrderCancelAuthPin}
                placeholder="PIN"
                disabled={orderCancelLoading}
              />
              {orderCancelAuthError && (
                <p className="mt-2 text-xs font-bold text-[var(--danger)] animate-in fade-in slide-in-from-top-1">
                  {orderCancelAuthError}
                </p>
              )}
            </div>
          )}
        </div>
      </YoboModal>

      <YoboModal
        open={!!resetPinTarget}
        onClose={() => {
          setResetPinTarget(null)
          setResetPinValue('')
          setResetPinError(null)
        }}
        title={
          resetPinTarget ? `Réinitialiser le PIN - ${capitalizeFirstLetter(resetPinTarget.name)}` : 'Réinitialiser le PIN'
        }
        headerEmoji="🔑"
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => {
                setResetPinTarget(null)
                setResetPinValue('')
                setResetPinError(null)
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary"
              onClick={() => void resetCaissierPin()}
              disabled={
                busyResetPinUserId === resetPinTarget?.id ||
                !resetPinValue.trim() ||
                role !== 'gerant'
              }
            >
              <span className="inline-flex items-center gap-2">
                {busyResetPinUserId === resetPinTarget?.id ? (
                  <SpinnerIcon size={16} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M21 2l-2 2m0 0l-4-4 2-2 4 4ZM7 17a4 4 0 1 1 5.5-3.7l-1.8 1.8-2.6-2.6-1.1 1.1-1.1-1.1L4 15l3 3Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {busyResetPinUserId === resetPinTarget?.id ? 'Mise à jour...' : 'Réinitialiser PIN'}
              </span>
            </button>
          </>
        }
      >
        {resetPinTarget ? (
          <div className="space-y-3">
            <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
              Le PIN du compte sera remplacé. L’ancien PIN ne fonctionnera plus.
            </p>

            <label className="yobo-modal-label" htmlFor="reset-pin">
              Nouveau PIN
            </label>
            <YoboNumericInput
              id="reset-pin"
              className="yobo-modal-field w-full"
              variant="pin"
              keyboardMaxLen={12}
              value={resetPinValue}
              onValueChange={(v) => setResetPinValue(v.replace(/\D/g, '').slice(0, 12))}
              placeholder="1234"
            />
          </div>
        ) : null}
      </YoboModal>

      <YoboModal
        open={profileNamePinModalOpen}
        onClose={() => {
          setProfileNamePinModalOpen(false)
          setProfileNamePin('')
          setProfileNameError(null)
        }}
        title="PIN"
        headerEmoji="🔑"
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => {
                setProfileNamePinModalOpen(false)
                setProfileNamePin('')
                setProfileNameError(null)
              }}
            >
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Annuler
              </span>
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary"
              onClick={() => void submitProfileNameChange()}
              disabled={
                profileNameLoading ||
                !profileNamePin.trim() ||
                profileNamePin.trim().replace(/\D/g, '').length < 4 ||
                profileNamePin.trim().replace(/\D/g, '').length > 6
              }
            >
              <span className="inline-flex items-center gap-2">
                {profileNameLoading ? (
                  <SpinnerIcon size={16} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 6 9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {profileNameLoading ? 'Mise à jour...' : 'Valider'}
              </span>
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Confirme avec ton PIN pour mettre à jour le nom.
          </p>

          <label className="yobo-modal-label" htmlFor="profile-name-pin">
            PIN
          </label>
          <YoboNumericInput
            id="profile-name-pin"
            className="yobo-modal-field w-full"
            variant="pin"
            keyboardMaxLen={6}
            value={profileNamePin}
            onValueChange={(v) => setProfileNamePin(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="1234"
          />
        </div>
      </YoboModal>

      <YoboModal
        open={!!deactivateUserTarget}
        onClose={() => {
          setDeactivateUserTarget(null)
          setDeactivateUserError(null)
        }}
        title={
          deactivateUserTarget
            ? `Désactiver ${capitalizeFirstLetter(deactivateUserTarget.name)} ?`
            : 'Désactiver utilisateur ?'
        }
        headerEmoji="⛔"
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => {
                setDeactivateUserTarget(null)
                setDeactivateUserError(null)
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--danger"
              onClick={() => void confirmDeactivateUser()}
              disabled={busyDeactivateUserId === deactivateUserTarget?.id}
            >
              {busyDeactivateUserId === deactivateUserTarget?.id ? (
                <span className="inline-flex items-center gap-2">
                  <SpinnerIcon size={16} />
                  Désactivation...
                </span>
              ) : (
                'Désactiver'
              )}
            </button>
          </>
        }
      >
        <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
          Cet utilisateur ne pourra plus se connecter tant qu’il restera désactivé.
        </p>
      </YoboModal>
      <YoboModal
        open={discountAuthModalOpen}
        onClose={() => {
          if (discountAuthLoading) return
          setDiscountAuthModalOpen(false)
          setDiscountAuthPin('')
        }}
        title="Autorisation requise"
        headerEmoji="🔐"
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost min-w-[6rem] flex-1"
              disabled={discountAuthLoading}
              onClick={() => {
                setDiscountAuthModalOpen(false)
                setDiscountAuthPin('')
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary min-w-[8rem] flex-1"
              disabled={discountAuthLoading || discountAuthPin.length < 4}
              onClick={() => void submitDiscountAuth()}
            >
              <span className="inline-flex items-center gap-2">
                {discountAuthLoading ? <SpinnerIcon size={16} /> : null}
                Valider
              </span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Seul un PIN Gérant permet d'appliquer une remise globale.
          </p>
          <div>
            <label className="yobo-modal-label" htmlFor="discount-auth-pin">
              PIN Gérant
            </label>
            <YoboNumericInput
              id="discount-auth-pin"
              className="yobo-modal-field mt-1 w-full"
              variant="pin"
              keyboardMaxLen={12}
              value={discountAuthPin}
              onValueChange={setDiscountAuthPin}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && discountAuthPin.length >= 4) {
                  void submitDiscountAuth()
                }
              }}
              placeholder="Saisissez le PIN"
            />
            {discountAuthError ? (
              <p className="mt-2 text-xs font-bold text-[var(--danger)]">{discountAuthError}</p>
            ) : null}
          </div>
        </div>
      </YoboModal>

      <YoboModal
        open={discountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
        title="Appliquer une Remise"
        headerEmoji="🎁"
        maxWidthClass="max-w-[420px]"
        footer={null}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-xl bg-[var(--surface)] border border-[color-mix(in_oklab,var(--success)_30%,var(--border))] transition-colors hover:bg-[color-mix(in_oklab,var(--success)_8%,var(--surface))]"
              onClick={() => applyDiscount('free')}
            >
              <span className="text-sm font-black text-[var(--success)] uppercase tracking-wide">Gratuit</span>
              <span className="text-[10px] font-bold text-[var(--muted)]">-100%</span>
            </button>
            <button
              type="button"
              className="flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-xl bg-[var(--surface)] border border-[color-mix(in_oklab,var(--accent)_30%,var(--border))] transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_8%,var(--surface))]"
              onClick={() => applyDiscount('percent', 50)}
            >
              <span className="text-sm font-black text-[var(--accent)] uppercase tracking-wide">-50%</span>
              <span className="text-[10px] font-bold text-[var(--muted)]">Personnel ou Famille</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost text-sm font-black"
              onClick={() => applyDiscount('percent', 10)}
            >
              -10%
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost text-sm font-black"
              onClick={() => applyDiscount('percent', 15)}
            >
              -15%
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost text-sm font-black"
              onClick={() => applyDiscount('percent', 20)}
            >
              -20%
            </button>
          </div>
        </div>
      </YoboModal>
      
      {/* ===== MODALE APERÇU TICKET ===== */}
      <YoboModal
        open={ticketPreviewModalOpen}
        onClose={() => setTicketPreviewModalOpen(false)}
        title="Aperçu du Ticket"
        headerEmoji="📄"
        maxWidthClass="max-w-[360px]"
        footer={
          <>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost flex-1"
              onClick={() => setTicketPreviewModalOpen(false)}
            >
              Fermer
            </button>
          </>
        }
      >
        <div 
          className="mx-auto bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col" 
          style={{ width: '302px', height: '540px', border: '1px solid rgba(0,0,0,0.05)' }}
        >
          {/* Simulation du ruban de papier découpé en haut */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--surface)] opacity-50 z-10" />
          
          <div 
            className="flex-1 overflow-y-auto bg-[#fffefc] p-7 text-[13px] leading-[1.25] text-black selection:bg-orange-100" 
            style={{ 
              scrollbarWidth: 'thin',
              fontFamily: "'Courier New', Courier, monospace",
              letterSpacing: '-0.3px',
              textRendering: 'optimizeSpeed'
            }}
          >
            {ticketPreviewHtml ? (
              <pre className="whitespace-pre-wrap break-words m-0 [font-variant-ligatures:none]">{ticketPreviewHtml}</pre>
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--muted)] italic">
                Génération de l'aperçu...
              </div>
            )}
          </div>
          
          {/* Simulation du bas du ticket découpé */}
          <div 
            className="h-4 w-full" 
            style={{ 
              background: 'radial-gradient(circle, transparent 70%, #fff 70%) 0 0 / 12px 12px repeat-x',
              transform: 'translateY(6px) rotate(180deg)'
            }} 
          />
        </div>
        <p className="mt-6 text-[11px] font-bold text-center text-[var(--muted)] tracking-widest uppercase opacity-50">
          Simulateur thermique 80mm
        </p>
      </YoboModal>

      {/* ===== MODALE DÉTAILS LIVRAISON ===== */}
      <YoboModal
        open={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title="Détails de la Livraison"
        headerEmoji="🛵"
        maxWidthClass="max-w-[420px]"
        footer={
          <>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost min-w-[6rem] flex-1"
              onClick={() => setDeliveryModalOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary min-w-[8rem] flex-1"
              onClick={() => confirmDeliveryInfo()}
            >
              Continuer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Saisissez les coordonnées du client pour la livraison.
          </p>
          <div className="space-y-3">
            <div>
              <label className="yobo-modal-label" htmlFor="delivery-phone">
                Téléphone (optionnel)
              </label>
              <YoboNumericInput
                id="delivery-phone"
                className="yobo-modal-field mt-1 w-full"
                variant="pin"
                maskPin={false}
                keyboardMaxLen={16}
                value={orderCustomerPhone}
                onValueChange={(v) => setOrderCustomerPhone(v.replace(/[^\d+ ]/g, '').slice(0, 32))}
                placeholder="06 XX XX XX XX"
              />
            </div>
            <div>
              <label className="yobo-modal-label" htmlFor="delivery-address">
                Adresse de livraison
              </label>
              <YoboAlphaTextarea
                id="delivery-address"
                className="yobo-modal-field mt-1 min-h-[5rem] w-full resize-y text-sm leading-relaxed"
                value={orderCustomerAddress}
                onValueChange={(v) => setOrderCustomerAddress(v.slice(0, 180))}
                placeholder="Quartier, rue, immeuble, étage..."
                rows={3}
                keyboardMaxLength={180}
              />
            </div>
          </div>
        </div>
      </YoboModal>

    </>
  )
}
