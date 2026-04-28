import { useMemo, useState, useRef } from 'react'
import { useShallow } from 'zustand/shallow'
import { YoboNumericInput } from '../components/YoboKeyboardInputs'
import { SpinnerIcon } from '../components/icons/SpinnerIcon'
import { MENU_ITEMS, type MenuFallbackCategory as Category } from '../data/menuFallback'
import { orderCountsTowardRevenue } from '../lib/orderStatus'
import { normalizeCategoryKey } from '../lib/normalizeCategoryKey'
import { getSingleVariantEntry, isBlankSizeKey } from '../lib/productSizes'
import { client } from '../lib/yoboClientMessages'
import { useYoboStore } from '../store'

export function CaissePage() {
  type DisplayMode = 'grid' | 'list'
  const cashSessionLoading = useYoboStore((s) => s.cashSessionLoading)
  const cashSession = useYoboStore((s) => s.cashSession)
  const orders = useYoboStore((s) => s.orders)
  const {
    cashOpeningStr,
    setCashOpeningStr,
    cashStartLoading,
    openCashSessionHandler,
    menuCat,
    setMenuCat,
    menuCatKey,
    setMenuCatKey,
    catalogItemsByCat,
    setSelectedItem,
    setSelectedSize,
    setPosModalQty,
    setPosModalLineNote,
    cart,
    orderType,
    setOrderType,
    bumpCartQty,
    removeCartItem,
    clearCart,
    requestValidateOrder,
    orderSubmitLoading,
    setCashCloseAmountStr,
    setCashCloseComment,
    setCashCloseModalOpen,
    pushToast,
    requestGerantDiscount,
    reorderCatalogCategories,
    reorderProducts,
  } = useYoboStore(
    useShallow((s) => ({
      cashOpeningStr: s.cashOpeningStr,
      setCashOpeningStr: s.setCashOpeningStr,
      cashStartLoading: s.cashStartLoading,
      openCashSessionHandler: s.openCashSessionHandler,
      menuCat: s.menuCat,
      setMenuCat: s.setMenuCat,
      menuCatKey: s.menuCatKey,
      setMenuCatKey: s.setMenuCatKey,
      catalogItemsByCat: s.catalogItemsByCat,
      setSelectedItem: s.setSelectedItem,
      setSelectedSize: s.setSelectedSize,
      setPosModalQty: s.setPosModalQty,
      setPosModalLineNote: s.setPosModalLineNote,
      cart: s.cart,
      orderType: s.orderType,
      setOrderType: s.setOrderType,
      bumpCartQty: s.bumpCartQty,
      removeCartItem: s.removeCartItem,
      clearCart: s.clearCart,
      requestValidateOrder: s.requestValidateOrder,
      orderSubmitLoading: s.orderSubmitLoading,
      setCashCloseAmountStr: s.setCashCloseAmountStr,
      setCashCloseComment: s.setCashCloseComment,
      setCashCloseModalOpen: s.setCashCloseModalOpen,
      pushToast: s.pushToast,
      requestGerantDiscount: s.requestGerantDiscount,
      previewCurrentTicket: s.previewCurrentTicket,
      reorderCatalogCategories: s.reorderCatalogCategories,
      reorderProducts: s.reorderProducts,
    })),
  )

  const catalogCategories = useYoboStore((s) => s.catalogCategories)

  const currentSessionOrdersTotal = useMemo(() => {
    if (!cashSession) return 0
    return orders.reduce((acc, o) => {
      if (o.cashSessionId !== cashSession.id || !orderCountsTowardRevenue(o)) return acc
      return acc + o.total
    }, 0)
  }, [orders, cashSession])

  const cashRegisterTotal = useMemo(() => {
    if (!cashSession) return null
    const total = cashSession.openingAmount + currentSessionOrdersTotal
    return Math.round(total * 100) / 100
  }, [cashSession, currentSessionOrdersTotal])

  const cartTotal =
    Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
  const cartArticleCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const hasCatalog = Object.keys(catalogItemsByCat).length > 0
  const currentItems = useMemo(
    () => (hasCatalog ? (catalogItemsByCat[menuCatKey] ?? []) : MENU_ITEMS[menuCat]),
    [hasCatalog, catalogItemsByCat, menuCatKey, menuCat],
  )

  const categories: Array<[Category, string]> = [
    ['pain_maison', '🥪 Pain Maison'],
    ['calzone', '🥟 Calzone'],
    ['tacos', '🌮 Tacos'],
    ['panini', '🥪 Panini'],
    ['burger', '🍔 Burger'],
    ['pasticcio', '🍝 Pasticcio'],
    ['sandwichs', '🔥 Sandwichs'],
    ['menus_kids', '👶 Kids'],
    ['pizza', '🍕 Pizza'],
    ['pates', '🍝 Pâtes'],
    ['risotto', '🍚 Risotto'],
    ['entrees', '🥗 Entrées'],
    ['plats', '🍽️ Plats'],
    ['crepes', '🧇 Crêpes'],
    ['boissons', '🧃 Boissons'],
    ['jus_mojito', '🥤 Jus & Mojito'],
    ['supplements', '➕ SUPPLÉMENT'],
  ]
  const categoriesFromCatalog: Array<[string, string, number]> = catalogCategories.map((c) => {
    const key = normalizeCategoryKey(c.label)
    const lower = c.label.trim().toLowerCase()
    const isSupplementCat = lower.includes('supplé') || lower.includes('supplement')
    const labelText = isSupplementCat
      ? `${c.emoji} ${c.label.toLocaleUpperCase('fr-FR')}`
      : `${c.emoji} ${c.label}`
    return [key, labelText, c.id]
  })

  // Le type de categoryTabs change pour inclure l'ID optionnel
  const categoryTabs: Array<[string, string, number?]> = hasCatalog ? categoriesFromCatalog : categories
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid')
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [cashCardCollapsed, setCashCardCollapsed] = useState(true)

  // Reorder State
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [selectedProdId, setSelectedProdId] = useState<number | null>(null)
  const [orderTypeErr, setOrderTypeErr] = useState(false)
  const orderTabsRef = useRef<HTMLDivElement>(null)

  const openItemPicker = (itemIndex: number) => {
    setSelectedItem(itemIndex)
    setPosModalLineNote('')
    const it = currentItems[itemIndex]
    const one = it ? getSingleVariantEntry(it.sizes) : null
    setSelectedSize(one ? one[0] : null)
    setPosModalQty(1)
  }

  // --- Drag-to-Scroll Logic for Category Bar ---
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasMoved, setHasMoved] = useState(false)

  const handleScrollStart = (clientX: number) => {
    if (!scrollRef.current) return
    setIsScrolling(true)
    setHasMoved(false) // RESET du flag de mouvement
    setStartX(clientX - scrollRef.current.offsetLeft)
    setScrollLeft(scrollRef.current.scrollLeft)
    // Désactiver la transition pendant le drag manuel
    scrollRef.current.style.scrollBehavior = 'auto'
  }

  const handleScrollMove = (clientX: number) => {
    if (!isScrolling || !scrollRef.current) return
    const x = clientX - scrollRef.current.offsetLeft
    const walk = (x - startX) * 2
    if (Math.abs(walk) > 5) setHasMoved(true)
    scrollRef.current.scrollLeft = scrollLeft - walk
  }

  const handleScrollEnd = () => {
    setIsScrolling(false)
    if (scrollRef.current) {
      scrollRef.current.style.scrollBehavior = 'smooth'
    }
  }

  const scrollToElement = (target: HTMLElement | null) => {
    if (!target || !scrollRef.current) return
    const container = scrollRef.current
    const scrollHalfWidth = container.offsetWidth / 2
    const targetCenter = target.offsetLeft + target.offsetWidth / 2
    container.scrollTo({
      left: targetCenter - scrollHalfWidth,
      behavior: 'smooth'
    })
  }

  const handleCategoryReorder = (id: number, index: number) => {
    if (!hasCatalog || id === null) return
    if (selectedCatId === null) {
      setSelectedCatId(id)
    } else if (selectedCatId === id) {
      setSelectedCatId(null)
    } else {
      const startIndex = catalogCategories.findIndex(c => c.id === selectedCatId)
      if (startIndex !== -1) {
        reorderCatalogCategories(startIndex, index)
        useYoboStore.getState().pushToast('success', 'Catégorie déplacée')
      }
      setSelectedCatId(null)
    }
  }

  const handleProductReorder = (id: number, index: number) => {
    if (!hasCatalog || id === null) return // Gated by hasCatalog
    if (selectedProdId === null) {
      setSelectedProdId(id)
    } else if (selectedProdId === id) {
      setSelectedProdId(null)
    } else {
      // Sécurité : Vérifier que l'élément sélectionné existe toujours dans la catégorie actuelle
      const startIndex = currentItems.findIndex(it => 'id' in it && it.id === selectedProdId)
      if (startIndex !== -1) {
        reorderProducts(menuCatKey, startIndex, index)
        useYoboStore.getState().pushToast('success', 'Produit déplacé')
      }
      setSelectedProdId(null)
    }
  }

  const handleValidateOrder = () => {
    if (!orderType) {
      setOrderTypeErr(true)
      // On remonte vers les choix de type de commande
      orderTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => setOrderTypeErr(false), 800)
      return
    }
    requestValidateOrder()
  }

  if (cashSessionLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">
        <SpinnerIcon size={28} />
        Chargement de la caisse…
      </div>
    )
  }

  if (!cashSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--accent-bg)]">
              <span className="material-symbols-outlined text-3xl text-[var(--accent)]">point_of_sale</span>
            </div>
            <h2 className="mt-4 font-[var(--heading)] text-xl font-black tracking-tight text-[var(--text-h)]">
              Ouvrir la caisse
            </h2>
          </div>

          <div className="mt-6">
            <label className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]" htmlFor="cash-open-amount">
              Montant de départ (MAD)
            </label>
            <YoboNumericInput
              id="cash-open-amount"
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center text-2xl font-black tabular-nums text-[var(--text-h)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              variant="decimal"
              autoComplete="off"
              placeholder="0"
              value={cashOpeningStr}
              onValueChange={setCashOpeningStr}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void openCashSessionHandler()
              }}
            />
          </div>

          <button
            type="button"
            className="mt-5 w-full rounded-full py-3.5 text-sm font-black text-[#4d2600] shadow-lg shadow-[var(--accent-container)]/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
            }}
            disabled={cashStartLoading}
            onClick={() => void openCashSessionHandler()}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {cashStartLoading ? (
                <SpinnerIcon size={16} />
              ) : (
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
              )}
              {cashStartLoading ? 'Ouverture…' : 'Démarrer la caisse'}
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {cashSession ? (
        <div className="mb-3 rounded-xl border border-[var(--accent-border)] bg-[color-mix(in_oklab,var(--accent-bg)_55%,var(--surface))] p-2">
          <div
            className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 ${cashCardCollapsed ? '' : 'mb-1.5'
              }`}
          >
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-bg)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--accent)] ring-1 ring-[var(--accent-border)]">
              <span className="material-symbols-outlined text-[13px]">point_of_sale</span>
              Ouverte
            </span>
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--card)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)] transition-[filter] hover:brightness-110"
                onClick={() => setCashCardCollapsed((v) => !v)}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {cashCardCollapsed ? 'expand_more' : 'expand_less'}
                </span>
                {cashCardCollapsed ? 'Afficher' : 'Réduire'}
              </button>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[10px] font-bold text-white transition-[filter] hover:brightness-110"
                onClick={() => {
                  if (cart.length > 0) {
                    pushToast('warning', client.val.cashCloseCartNotEmpty)
                    return
                  }
                  setCashCloseAmountStr('')
                  setCashCloseComment('')
                  setCashCloseModalOpen(true)
                }}
              >
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Fermer la caisse
              </button>
            </div>
          </div>

          {!cashCardCollapsed && (
            <div className="grid grid-cols-3 gap-1">
              <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                <div className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Départ</div>
                <div className="truncate text-[11px] font-black tabular-nums leading-tight text-[var(--text-h)]">
                  {`${cashSession.openingAmount.toLocaleString()} MAD`}
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                <div className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Ventes</div>
                <div className="truncate text-[11px] font-black tabular-nums leading-tight text-[var(--text-h)]">
                  {`${currentSessionOrdersTotal.toLocaleString()} MAD`}
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] px-2 py-1">
                <div className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Caisse</div>
                <div className="truncate text-[11px] font-black tabular-nums leading-tight text-[var(--accent)]">
                  {`${(cashRegisterTotal ?? 0).toLocaleString()} MAD`}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
      {/* Categories Bar (Full Width) */}
      <div className="relative group transition-all duration-300 mb-4">
        <div
          ref={scrollRef}
          className="hide-scrollbar touch-pan-x overscroll-x-contain select-none flex min-w-0 overflow-x-auto pb-3 cursor-grab active:cursor-grabbing scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onMouseDown={(e) => handleScrollStart(e.pageX)}
          onMouseMove={(e) => handleScrollMove(e.pageX)}
          onMouseUp={handleScrollEnd}
          onMouseLeave={handleScrollEnd}
          onTouchStart={(e) => handleScrollStart(e.touches[0].pageX)}
          onTouchMove={(e) => handleScrollMove(e.touches[0].pageX)}
          onTouchEnd={handleScrollEnd}
        >
          <div className="flex min-w-0 gap-2 px-1 py-1 pointer-events-auto">
            {categoryTabs.map(([catKey, label, catId], index) => {
              const m = /^(\S+)\s+(.+)$/.exec(label.trim())
              const icon = m ? m[1] : '🍽️'
              const title = m ? m[2] : label
              const isActive = hasCatalog ? menuCatKey === catKey : menuCat === catKey
              const dndId = catId !== undefined ? `cat-${catId}` : `fallback-${catKey}`
              const isSelectedToMove = isReorderMode && selectedCatId !== null && selectedCatId === catId
              const isOtherSelected = isReorderMode && selectedCatId !== null && selectedCatId !== catId
              const isBlockedByProduct = isReorderMode && selectedProdId !== null

              return (
                <div
                  key={dndId}
                  id={dndId}
                  className={`relative shrink-0 transition-all duration-300 ${isSelectedToMove ? 'scale-105 z-50' : ''} ${isOtherSelected ? 'opacity-40 grayscale-[0.5]' : ''} ${isBlockedByProduct ? 'pointer-events-none opacity-10 grayscale' : ''}`}
                >
                  <button
                    type="button"
                    className={`flex w-[8.5rem] min-h-[70px] flex-col items-center justify-center rounded-2xl px-3 pt-2 pb-3 font-bold transition-all ${(isActive && !isReorderMode) || isSelectedToMove
                        ? 'bg-[var(--accent)] text-[#4d2600] elevation-sm'
                        : 'bg-[var(--card)] text-[var(--text-h)] hover:brightness-110 shadow-sm border border-transparent'
                      } ${isSelectedToMove ? 'ring-2 ring-[var(--text-h)] ring-offset-2 ring-offset-[var(--background)] scale-105' : ''} ${!hasCatalog || isReorderMode ? 'cursor-default' : 'cursor-pointer'} ${isActive ? 'border-[var(--accent)]' : 'hover:border-[var(--border)]'}`}
                    onClick={(e) => {
                      if (hasMoved || isBlockedByProduct) return // On ne fait rien si c'était un scroll ou bloqué

                      // Scroll to center
                      scrollToElement(e.currentTarget.parentElement)

                      if (isReorderMode) {
                        if (catId !== undefined) handleCategoryReorder(catId, index)
                      }

                      if (hasCatalog) {
                        setMenuCatKey(catKey)
                      } else {
                        setMenuCat(catKey as Category)
                      }
                      setSelectedItem(null)
                      setSelectedSize(null)
                      setPosModalQty(1)
                      setPosModalLineNote('')
                      // On vide la sélection produit si on change de catégorie
                      if (!isReorderMode || selectedCatId === null) {
                        setSelectedProdId(null)
                      }
                    }}
                  >
                      {/* Reorder Indicator for Category */}
                      {isReorderMode && (
                        <div className={`absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full ring-1 ring-black/5 shadow-sm transition-colors ${
                          isActive 
                            ? 'bg-[var(--surface)] text-[var(--muted)]' 
                            : 'bg-[var(--accent)] text-[#4d2600]'
                        }`}>
                          <span className="material-symbols-outlined text-[10px]">drag_pan</span>
                        </div>
                      )}
                      <span className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                        <span className="text-lg leading-none" aria-hidden>
                          {icon}
                        </span>
                        <span className="block whitespace-normal break-words text-center text-[10px] leading-tight sm:text-xs">
                          {title}
                        </span>
                      </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-6">

        {/* Left: products area */}
        <div className="min-w-0 flex flex-col">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-[var(--surface)] p-1 rounded-xl ring-1 ring-[var(--border)]">
              <button
                type="button"
                className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all rounded-lg ${displayMode === 'grid'
                    ? 'bg-[var(--accent)] text-[#4d2600] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text-h)]'
                  }`}
                onClick={() => setDisplayMode('grid')}
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                Grille
              </button>
              <button
                type="button"
                className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all rounded-lg ${displayMode === 'list'
                    ? 'bg-[var(--accent)] text-[#4d2600] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text-h)]'
                  }`}
                onClick={() => setDisplayMode('list')}
              >
                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                Liste
              </button>
            </div>

            {hasCatalog && (
              <button
                type="button"
                className={`px-4 flex items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isReorderMode
                    ? 'bg-[var(--accent)] text-[#4d2600] shadow-md ring-2 ring-[var(--accent)] yobo-reorder-glow'
                    : 'bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text-h)] border border-[var(--border)]'
                  }`}
                onClick={() => {
                  const next = !isReorderMode
                  setIsReorderMode(next)
                  setSelectedCatId(null)
                  setSelectedProdId(null)
                }}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isReorderMode ? 'auto_fix_normal' : 'reorder'}
                </span>
                {isReorderMode ? 'Quitter' : 'Réorganiser'}
              </button>
            )}
          </div>

          {/* Compact Reorder Selection Prompt */}
          {isReorderMode && (selectedCatId !== null || selectedProdId !== null) && (
            <div className="mb-6 flex justify-center animate-in slide-in-from-top-1 fade-in duration-300">
              <div className="bg-[var(--accent)] text-[#4d2600] px-3 py-1.5 rounded-xl flex items-center gap-4 shadow-md border border-[var(--text-h)]/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] animate-bounce">place</span>
                  <span className="font-black text-[9px] uppercase tracking-wider">
                    {selectedCatId !== null ? 'Déplacement Catégorie' : 'Déplacement Produit'} — Touchez la destination
                  </span>
                </div>
                <button 
                  onClick={() => { setSelectedCatId(null); setSelectedProdId(null); }}
                  className="bg-black/5 hover:bg-black/10 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>
          )}

          {displayMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-2 min-h-0">
              {currentItems.map((item, i) => {
                const prodId = 'id' in item ? (item as { id: number }).id : undefined
                const isSelectedToMove = isReorderMode && selectedProdId !== null && selectedProdId === prodId
                const isOtherSelected = isReorderMode && selectedProdId !== null && selectedProdId !== prodId
                const isBlockedByCategory = isReorderMode && selectedCatId !== null

                return (
                  <button
                    key={`${hasCatalog ? menuCatKey : menuCat}-${item.name}-${i}`}
                    type="button"
                    className={`group relative rounded-xl overflow-hidden text-center transition-all ${isSelectedToMove ? 'bg-[var(--accent)] text-[#4d2600] scale-105 z-50 ring-2 ring-[var(--text-h)] ring-offset-2 ring-offset-[var(--background)]' : 'bg-[var(--surface)] text-[var(--text-h)] hover:bg-[var(--card)]'} ${isOtherSelected ? 'opacity-40 grayscale-[0.8]' : ''} ${isBlockedByCategory ? 'pointer-events-none opacity-10 grayscale' : ''} active:scale-[0.98]`}
                    onClick={() => {
                      if (isBlockedByCategory) return
                      if (isReorderMode) {
                        if (prodId !== undefined) handleProductReorder(prodId, i)
                      } else {
                        openItemPicker(i)
                      }
                    }}
                  >
                    <div className="flex min-h-[124px] flex-col items-center justify-center p-4">
                      {/* Reorder Indicator for Product Grid */}
                      {isReorderMode && (
                        <div className={`absolute top-2 right-2 flex size-6 items-center justify-center rounded-full shadow-md transition-transform hover:scale-110 ${
                          isSelectedToMove 
                            ? 'bg-[var(--surface)] text-[var(--muted)]' 
                            : 'bg-[var(--accent)] text-[#4d2600]'
                        }`}>
                          <span className="material-symbols-outlined text-[16px]">open_with</span>
                        </div>
                      )}
                      <div className="text-2xl">{item.emoji}</div>
                      <div className="mt-2 text-lg font-extrabold text-[var(--text-h)] leading-snug">
                        {item.name}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}

          {displayMode === 'list' ? (
            <div className="flex flex-col gap-2 overflow-y-auto pr-2">
              {currentItems.map((item, i) => {
                const prices = Object.values(item.sizes)
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0
                const itemId = hasCatalog && 'id' in item ? (item as { id: number }).id : undefined
                const dndId = itemId !== undefined ? `prod-${itemId}` : `prod-list-${item.name}-${i}`

                const isSelectedToMove = isReorderMode && selectedProdId !== null && selectedProdId === itemId
                const isOtherSelected = isReorderMode && selectedProdId !== null && selectedProdId !== itemId
                const isBlockedByCategory = isReorderMode && selectedCatId !== null

                return (
                  <div
                    key={dndId}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all duration-300 ${isSelectedToMove
                        ? 'bg-[var(--accent)] text-[#4d2600] scale-[1.01] z-50 ring-2 ring-[var(--text-h)]'
                        : 'bg-[var(--surface)] hover:bg-[var(--card)]'
                      } ${isOtherSelected ? 'opacity-40 grayscale-[0.8]' : ''} ${isBlockedByCategory ? 'pointer-events-none opacity-10 grayscale' : ''}`}
                    onClick={() => {
                      if (isBlockedByCategory) return
                      if (isReorderMode) {
                        if (itemId !== undefined) handleProductReorder(itemId, i)
                      } else {
                        openItemPicker(i)
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Reorder Indicator for Product List */}
                        {isReorderMode && (
                          <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm ${
                            isSelectedToMove 
                              ? 'bg-[var(--surface)] text-[var(--muted)]' 
                              : 'bg-[var(--accent)] text-[#4d2600]'
                          }`}>
                            <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
                          </div>
                        )}
                        <div className="text-xl" aria-hidden>
                          {item.emoji}
                        </div>
                        <span className="truncate text-sm font-extrabold text-[var(--text-h)]">{item.name}</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[var(--accent-bg)] px-2.5 py-1 text-xs font-black tabular-nums text-[var(--accent)]">
                      {`${minPrice} MAD`}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}

        </div>

        {/* Right: cart rail */}
        <aside className="w-[400px] overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] shadow-[0_24px_56px_-24px_rgba(0,0,0,0.65)] flex flex-col">
          {/* Order type tabs */}
          <div 
            ref={orderTabsRef}
            className={`p-4 grid grid-cols-3 gap-2 border-b border-[var(--border)] transition-all duration-300 ${orderTypeErr ? 'bg-[var(--accent)]/30 yobo-shake yobo-error-ring shadow-[0_0_20px_var(--accent-bg)]' : 'bg-[color-mix(in_oklab,var(--card)_35%,var(--surface))]'}`}
          >
            <button
              type="button"
              className={`flex min-h-[56px] flex-col items-center justify-center py-2 rounded-xl transition-colors ${orderType === 'sur_place'
                  ? 'bg-[var(--accent-container)] text-[#4d2600]'
                  : 'bg-[var(--card)] text-[var(--muted)] hover:brightness-110'
                }`}
              onClick={() => setOrderType('sur_place')}
            >
              <span className="text-[10px] font-extrabold mt-1 uppercase">Sur place</span>
            </button>
            <button
              type="button"
              className={`flex min-h-[56px] flex-col items-center justify-center py-2 rounded-xl transition-colors ${orderType === 'emporter'
                  ? 'bg-[var(--accent-container)] text-[#4d2600]'
                  : 'bg-[var(--card)] text-[var(--muted)] hover:brightness-110'
                }`}
              onClick={() => setOrderType('emporter')}
            >
              <span className="text-[10px] font-extrabold mt-1 uppercase">Emporter</span>
            </button>
            <button
              type="button"
              className={`flex min-h-[56px] flex-col items-center justify-center py-2 rounded-xl transition-colors ${orderType === 'livraison'
                  ? 'bg-[var(--accent-container)] text-[#4d2600]'
                  : 'bg-[var(--card)] text-[var(--muted)] hover:brightness-110'
                }`}
              onClick={() => setOrderType('livraison')}
            >
              <span className="text-[10px] font-extrabold mt-1 uppercase">Livraison</span>
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-4">
            <div className="text-sm font-extrabold text-[var(--text-h)] uppercase tracking-widest">Commande</div>
            <span className="rounded-full bg-[var(--accent-container)] px-2.5 py-1 text-xs font-black text-[#4d2600]">
              {cartArticleCount}
            </span>
          </div>

          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 pt-2 pb-4">
            {cart.length === 0 ? (
              <div className="flex w-full flex-col items-center rounded-2xl bg-[color-mix(in_oklab,var(--card)_35%,var(--surface))] px-4 py-10 ring-1 ring-[color-mix(in_oklab,var(--border)_80%,transparent)]">
                <div className="mb-3 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-bg)] text-[var(--accent)]">
                  <span className="material-symbols-outlined text-3xl">shopping_basket</span>
                </div>
                <p className="mx-auto w-full max-w-md text-center font-[var(--heading)] text-lg font-black text-[var(--text-h)] uppercase tracking-tight">
                  Panier vide
                </p>
              </div>
            ) : (
              cart.map((item, i) => {
                const lineTotal = Math.round(item.price * item.quantity * 100) / 100
                return (
                  <div key={`${item.name}-${item.size}-${i}`} className="yobo-cart-line">
                    <div className="yobo-cart-line__head">
                      <span className="yobo-cart-line__emoji" aria-hidden>
                        {item.emoji}
                      </span>
                      <div className="yobo-cart-line__info">
                        <div className="yobo-cart-line__name">
                          {item.categoryLabel && (
                            <span className="mr-1 text-[9px] font-bold uppercase opacity-50">
                              {item.categoryLabel} ·
                            </span>
                          )}
                          {item.name}
                          {item.hasGratine && (
                            <span className="yobo-gr-index" title="Gratiné">
                              G 🧀
                            </span>
                          )}
                        </div>
                        <div className="yobo-cart-line__sub">
                          {!isBlankSizeKey(item.size) ? (
                            <span className="yobo-cart-line__size">{`Taille ${item.size}`}</span>
                          ) : null}
                          {!isBlankSizeKey(item.size) ? (
                            <span className="yobo-cart-line__dot" aria-hidden>
                              {' '}
                              ·{' '}
                            </span>
                          ) : null}
                          <span className="tabular-nums">{`${item.price} MAD / pièce`}</span>
                        </div>
                        {item.lineNote?.trim() ? (
                          <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
                            <span className="font-bold text-[var(--text-h)]">Note : </span>
                            {item.lineNote.trim()}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="yobo-cart-line__remove"
                        aria-label="Retirer du panier"
                        onClick={() => removeCartItem(i)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="yobo-cart-line__actions">
                      <div className="yobo-pos-qty-stepper yobo-pos-qty-stepper--compact">
                        <button
                          type="button"
                          className="yobo-pos-qty-btn"
                          aria-label="Diminuer la quantité"
                          onClick={() => bumpCartQty(i, -1)}
                        >
                          −
                        </button>
                        <span className="yobo-cart-line__qty tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          className="yobo-pos-qty-btn"
                          aria-label="Augmenter la quantité"
                          onClick={() => bumpCartQty(i, 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="yobo-cart-line__total">
                        <span className="yobo-cart-line__total-label">Sous-total</span>
                        <span className="yobo-cart-line__total-value tabular-nums">{`${lineTotal} MAD`}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="space-y-3 border-t border-[var(--border)] p-5 bg-[color-mix(in_oklab,var(--card)_30%,var(--surface))]">
            <div className="rounded-xl bg-[var(--card)] px-4 py-3 ring-1 ring-[color-mix(in_oklab,var(--border)_90%,transparent)]">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-[var(--muted)]">Total</span>
                <span className="font-[var(--heading)] text-xl font-black text-[var(--accent)]">{`${cartTotal} MAD`}</span>
              </div>
            </div>
            <button
              type="button"
              className="w-full rounded-2xl py-4 text-[#4d2600] font-black text-lg shadow-lg shadow-[var(--accent-container)]/20 transition hover:brightness-110 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)' }}
              onClick={handleValidateOrder}
              disabled={cart.length === 0 || orderSubmitLoading || !cashSession}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {orderSubmitLoading ? <SpinnerIcon size={16} /> : null}
                <span className="material-symbols-outlined">check_circle</span>
                {orderSubmitLoading ? 'Validation...' : `Valider · ${cartTotal} MAD`}
              </span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-2.5 text-xs font-bold text-[var(--muted)] transition hover:text-[var(--text-h)] disabled:opacity-40"
                onClick={requestGerantDiscount}
                disabled={cart.length === 0}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-[20px]">redeem</span>
                  Remise
                </div>
              </button>
              <button
                type="button"
                className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_5%,var(--card))] px-2 py-2.5 text-xs font-bold text-[var(--danger)] transition hover:brightness-110 disabled:opacity-40"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                  Vider
                </div>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}