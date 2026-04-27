import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { YoboModal } from '../components/YoboModal'
import { YoboPagination } from '../components/YoboPagination'
import { EmojiPicker } from '../components/EmojiPicker'
import { YoboAlphaInput, YoboNumericInput } from '../components/YoboKeyboardInputs'
import { DEFAULT_CATEGORY_EMOJI, DEFAULT_PRODUCT_EMOJI } from '../data/yoboEmojis'
import { YOBO_SINGLE_PRICE_KEY, isSinglePriceOnlySizes, sortSizePairsForDisplay } from '../lib/productSizes'
import { exportCatalogCsvToDocuments, importCatalogCsvPickDialog } from '../lib/catalogCsv'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import {
  isValidYoboMultiSizeProgress,
  normalizeStdSizeLabel,
  sortSizeEntriesByStdOrder,
  validateYoboMultiSizeLabelsFinal,
} from '../lib/yoboSizeTemplates'
import { clampPage, getTotalPages, paginateSlice } from '../lib/pagination'
import { logDevError, userFacingErrorMessage } from '../lib/userFacingError'
import { client } from '../lib/yoboClientMessages'
import type { CatalogCategory } from '../types/catalog'
import { useYoboStore } from '../store/yobo-store'


type ProductDto = {
  id: number
  name: string
  description?: string
  emoji: string
  category_id: number
  sizes: Record<string, number>
  active: boolean
}
type SizeEntry = { label: string; price: number }

export type GerantMenuPageProps = {
  userId: number
  catalogCategories: CatalogCategory[]
  onCatalogChanged: () => Promise<void>
  setError: Dispatch<SetStateAction<string | null>>
}



export function GerantMenuPage({
  userId,
  catalogCategories,
  onCatalogChanged,
  setError,
}: GerantMenuPageProps) {
  const [menuProducts, setMenuProducts] = useState<ProductDto[]>([])
  const [newProductName, setNewProductName] = useState('')
  const [newProductEmoji, setNewProductEmoji] = useState(DEFAULT_PRODUCT_EMOJI)
  const [newProductCategoryId, setNewProductCategoryId] = useState<number | null>(null)
  const [newProductSizeLabel, setNewProductSizeLabel] = useState('S')
  const [newProductSizePrice, setNewProductSizePrice] = useState('')
  const [newProductSinglePrice, setNewProductSinglePrice] = useState(false)
  const [newProductSizeEntries, setNewProductSizeEntries] = useState<SizeEntry[]>([])
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null)
  const [editProductName, setEditProductName] = useState('')
  const [editProductEmoji, setEditProductEmoji] = useState('')
  const [editProductCategoryId, setEditProductCategoryId] = useState<number | null>(null)
  const [editProductSizeEntries, setEditProductSizeEntries] = useState<SizeEntry[]>([])
  const [editProductSizeLabel, setEditProductSizeLabel] = useState('S')
  const [editProductSizePrice, setEditProductSizePrice] = useState('')
  const [editProductSinglePrice, setEditProductSinglePrice] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newCategoryEmoji, setNewCategoryEmoji] = useState(DEFAULT_CATEGORY_EMOJI)
  const [deleteProductTarget, setDeleteProductTarget] = useState<ProductDto | null>(null)
  const [deactivateProductTarget, setDeactivateProductTarget] = useState<ProductDto | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CatalogCategory | null>(null)
  const [menuCatalogPage, setMenuCatalogPage] = useState(1)
  const [menuCatalogPageSize, setMenuCatalogPageSize] = useState(12)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [catalogCsvBusy, setCatalogCsvBusy] = useState<'export' | 'import' | null>(null)
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [showGratineModal, setShowGratineModal] = useState(false)
  const [menuProductSearch, setMenuProductSearch] = useState('')
  const [menuFilterCategoryId, setMenuFilterCategoryId] = useState<number | 'all'>('all')
  const [menuFilterActive, setMenuFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  const gratinePrice = useYoboStore((s) => s.gratinePrice)
  const setGratinePrice = useYoboStore((s) => s.setGratinePrice)
  const ticketShopLabel = useYoboStore((s) => s.ticketShopLabel)
  const ticketShopPhone = useYoboStore((s) => s.ticketShopPhone)
  const saveTicketShopSettings = useYoboStore((s) => s.saveTicketShopSettings)
  const theme = useYoboStore((s) => s.theme)

  const [localGratinePrice, setLocalGratinePrice] = useState(gratinePrice.toString())
  const [isSavingGratine, setIsSavingGratine] = useState(false)

  useEffect(() => {
    setLocalGratinePrice(gratinePrice.toString())
  }, [gratinePrice])

  async function handleSaveGratine() {
    const val = parseFloat(localGratinePrice.replace(',', '.'))
    if (isNaN(val) || val < 0) {
      setError('Veuillez saisir un prix valide pour le gratiné.')
      return
    }
    setIsSavingGratine(true)
    try {
      // On met à jour localement d'abord pour l'UI reactive
      setGratinePrice(val)
      // On persiste via la commande existante (qui sauvegarde aussi shopLabel/Phone)
      await saveTicketShopSettings(ticketShopLabel, ticketShopPhone)
    } catch (e) {
      logDevError('save_gratine_price', e)
    } finally {
      setIsSavingGratine(false)
    }
  }


  async function loadMenuProducts() {
    try {
      const res = await invoke<ProductDto[]>('list_products', { userId })
      setMenuProducts(res)
    } catch (e) {
      logDevError('list_products', e)
      setError(userFacingErrorMessage(e, client.error.menuLoadProducts))
    }
  }

  useEffect(() => {
    void loadMenuProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recharger au changement d'utilisateur
  }, [userId])

  useEffect(() => {
    if (catalogCategories.length === 0) return
    setNewProductCategoryId((prev) => (prev === null ? catalogCategories[0].id : prev))
  }, [catalogCategories])

  function addNewSizeEntry() {
    if (newProductSinglePrice) return
    const normalized = normalizeStdSizeLabel(newProductSizeLabel)
    const price = Number(newProductSizePrice.replace(',', '.'))
    if (!normalized) {
      setError(client.val.menuSizeLabel)
      return
    }
    if (Number.isNaN(price) || price <= 0) {
      setError(client.val.menuPriceSize)
      return
    }
    const next = [
      ...newProductSizeEntries.filter((s) => normalizeStdSizeLabel(s.label) !== normalized),
      { label: normalized, price },
    ]
    const labelSet = new Set(next.map((s) => normalizeStdSizeLabel(s.label)!))
    if (!isValidYoboMultiSizeProgress(labelSet)) {
      setError(client.val.menuSizeOrderNew)
      return
    }
    setNewProductSizeEntries(sortSizeEntriesByStdOrder(next))
    setNewProductSizeLabel('')
    setNewProductSizePrice('')
    setError(null)
  }

  function removeNewSizeEntry(label: string) {
    setNewProductSizeEntries((prev) => prev.filter((s) => s.label !== label))
  }

  function openProductEditor(p: ProductDto) {
    setEditingProduct(p)
    setEditProductName(p.name)
    setEditProductEmoji(p.emoji)
    setEditProductCategoryId(p.category_id)
    setEditProductSinglePrice(isSinglePriceOnlySizes(p.sizes))
    setEditProductSizeEntries(
      sortSizePairsForDisplay(Object.entries(p.sizes)).map(([label, price]) => ({ label, price })),
    )
    setEditProductSizeLabel('S')
    setEditProductSizePrice('')
    setError(null)
  }

  function addEditProductSizeEntry() {
    if (editProductSinglePrice) return
    const normalized = normalizeStdSizeLabel(editProductSizeLabel)
    const price = Number(editProductSizePrice.replace(',', '.'))
    if (!normalized) {
      setError(client.val.menuSizeLabel)
      return
    }
    if (Number.isNaN(price) || price <= 0) {
      setError(client.val.menuPriceSize)
      return
    }
    const next = [
      ...editProductSizeEntries.filter((s) => normalizeStdSizeLabel(s.label) !== normalized),
      { label: normalized, price },
    ]
    const labelSet = new Set(next.map((s) => normalizeStdSizeLabel(s.label)!))
    if (!isValidYoboMultiSizeProgress(labelSet)) {
      setError(client.val.menuSizeOrderEdit)
      return
    }
    setEditProductSizeEntries(sortSizeEntriesByStdOrder(next))
    setEditProductSizeLabel('')
    setEditProductSizePrice('')
    setError(null)
  }

  function removeEditProductSizeEntry(label: string) {
    setEditProductSizeEntries((prev) => prev.filter((s) => s.label !== label))
  }

  async function saveEditedProduct() {
    if (!editingProduct || editProductCategoryId === null) return
    if (!editProductName.trim() || !editProductEmoji.trim()) {
      setError(client.val.menuNameEmoji)
      return
    }
    let sizesParsed: Record<string, number>
    if (editProductSinglePrice) {
      const row = editProductSizeEntries[0]
      const p = row?.price
      if (row === undefined || p === undefined || Number.isNaN(p) || p <= 0) {
        setError(client.val.menuPriceDish)
        return
      }
      sizesParsed = { [YOBO_SINGLE_PRICE_KEY]: p }
    } else {
      if (editProductSizeEntries.length === 0) {
        setError(client.val.menuAddOneSize)
        return
      }
      const finalErr = validateYoboMultiSizeLabelsFinal(editProductSizeEntries.map((s) => s.label))
      if (finalErr) {
        setError(finalErr)
        return
      }
      const sorted = sortSizeEntriesByStdOrder(editProductSizeEntries)
      sizesParsed = Object.fromEntries(sorted.map((s) => [normalizeStdSizeLabel(s.label)!, s.price]))
    }
    try {
      await invoke('update_product', {
        userId,
        input: {
          id: editingProduct.id,
          name: editProductName.trim(),
          description: editingProduct.description ?? null,
          emoji: editProductEmoji.trim(),
          categoryId: editProductCategoryId,
          sizes: sizesParsed,
        },
      })
      setEditingProduct(null)
      setError(null)
      await loadMenuProducts()
      await onCatalogChanged()
    } catch (e) {
      logDevError('update_product', e)
      setError(userFacingErrorMessage(e, client.error.menuUpdateProduct))
    }
  }

  async function onAddCategory() {
    if (!newCategoryLabel.trim() || !newCategoryEmoji.trim()) {
      setError(client.val.menuCategoryLabel)
      return
    }
    try {
      await invoke('add_category', {
        userId,
        input: {
          label: newCategoryLabel.trim(),
          emoji: newCategoryEmoji.trim(),
        },
      })
      setNewCategoryLabel('')
      setNewCategoryEmoji(DEFAULT_CATEGORY_EMOJI)
      setError(null)
      await onCatalogChanged()
    } catch (e) {
      logDevError('add_category', e)
      setError(userFacingErrorMessage(e, client.error.menuAddCategory))
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteCategoryTarget) return
    const id = deleteCategoryTarget.id
    try {
      await invoke('delete_category', { userId, categoryId: id })
      setDeleteCategoryTarget(null)
      setError(null)
      await onCatalogChanged()
    } catch (e) {
      logDevError('delete_category', e)
      setError(userFacingErrorMessage(e, client.error.menuDeleteCategory))
      setDeleteCategoryTarget(null)
    }
  }

  async function onAddProduct() {
    if (!newProductCategoryId || newProductName.trim().length === 0) {
      setError(client.val.menuProductCategory)
      return
    }
    let sizesParsed: Record<string, number>
    if (newProductSinglePrice) {
      const row = newProductSizeEntries[0]
      const p = row?.price
      if (row === undefined || p === undefined || Number.isNaN(p) || p <= 0) {
        setError(client.val.menuPriceStandard)
        return
      }
      sizesParsed = { [YOBO_SINGLE_PRICE_KEY]: p }
    } else {
      if (newProductSizeEntries.length === 0) {
        setError(client.val.menuAddOneSize)
        return
      }
      const finalErr = validateYoboMultiSizeLabelsFinal(newProductSizeEntries.map((s) => s.label))
      if (finalErr) {
        setError(finalErr)
        return
      }
      const sorted = sortSizeEntriesByStdOrder(newProductSizeEntries)
      sizesParsed = Object.fromEntries(sorted.map((s) => [normalizeStdSizeLabel(s.label)!, s.price]))
    }

    try {
      await invoke('add_product', {
        userId,
        input: {
          name: newProductName.trim(),
          description: null,
          emoji: newProductEmoji.trim(),
          categoryId: newProductCategoryId,
          sizes: sizesParsed,
        },
      })
      setNewProductName('')
      setNewProductEmoji(DEFAULT_PRODUCT_EMOJI)
      setNewProductSinglePrice(false)
      setNewProductSizeEntries([])
      setNewProductSizeLabel('S')
      setNewProductSizePrice('')
      setError(null)
      await loadMenuProducts()
      await onCatalogChanged()
    } catch (e) {
      logDevError('add_product', e)
      setError(userFacingErrorMessage(e, client.error.menuAddProduct))
    }
  }

  async function onToggleProductActive(productId: number, active: boolean) {
    try {
      await invoke('set_product_active', {
        userId,
        productId,
        active,
      })
      await loadMenuProducts()
      await onCatalogChanged()
    } catch (e) {
      logDevError('set_product_active', e)
      setError(userFacingErrorMessage(e, client.error.menuProductStatus))
    }
  }

  async function confirmDeactivateProduct() {
    if (!deactivateProductTarget) return
    const id = deactivateProductTarget.id
    try {
      await invoke('set_product_active', { userId, productId: id, active: false })
      setDeactivateProductTarget(null)
      setError(null)
      await loadMenuProducts()
      await onCatalogChanged()
    } catch (e) {
      logDevError('set_product_active_deactivate', e)
      setError(userFacingErrorMessage(e, client.error.menuProductStatus))
      setDeactivateProductTarget(null)
    }
  }

  async function confirmDeleteProduct() {
    if (!deleteProductTarget) return
    const id = deleteProductTarget.id
    try {
      await invoke('delete_product', { userId, productId: id })
      if (editingProduct?.id === id) {
        setEditingProduct(null)
      }
      setDeleteProductTarget(null)
      setError(null)
      await loadMenuProducts()
      await onCatalogChanged()
    } catch (e) {
      logDevError('delete_product', e)
      setError(userFacingErrorMessage(e, client.error.menuDeleteProduct))
      setDeleteProductTarget(null)
    }
  }

  const filteredMenuProducts = useMemo(() => {
    let list = menuProducts
    if (menuFilterCategoryId !== 'all') {
      list = list.filter((p) => p.category_id === menuFilterCategoryId)
    }
    if (menuFilterActive === 'active') list = list.filter((p) => p.active)
    if (menuFilterActive === 'inactive') list = list.filter((p) => !p.active)
    const q = menuProductSearch.trim().toLowerCase()
    if (q) {
      // Recherche du menu: par NOM uniquement (pas emoji ni catégorie)
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [menuProducts, menuFilterCategoryId, menuFilterActive, menuProductSearch])

  const menuProductsPaginated = useMemo(
    () => paginateSlice(filteredMenuProducts, menuCatalogPage, menuCatalogPageSize),
    [filteredMenuProducts, menuCatalogPage, menuCatalogPageSize],
  )

  useEffect(() => {
    const tp = getTotalPages(filteredMenuProducts.length, menuCatalogPageSize)
    setMenuCatalogPage((p) => clampPage(p, tp))
  }, [filteredMenuProducts.length, menuCatalogPageSize])

  useEffect(() => {
    setMenuCatalogPage(1)
  }, [menuProductSearch, menuFilterCategoryId, menuFilterActive])

  const menuStats = useMemo(() => {
    const inactive = menuProducts.filter((p) => !p.active).length
    return {
      categories: catalogCategories.length,
      products: menuProducts.length,
      inactive,
    }
  }, [catalogCategories, menuProducts])

  return (
    <>
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-[var(--text-h)] tracking-tighter uppercase">
            Gestion du Menu
          </h2>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-6 py-3 rounded-full bg-[var(--card)] text-[var(--text-h)] font-bold hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)] transition-all inline-flex items-center gap-2 border border-[var(--border)] shadow-lg shadow-black/10 active:scale-95"
            onClick={() => setShowGratineModal(true)}
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">settings_suggest</span>
            <span className="text-xs uppercase tracking-widest font-black">Gratiné</span>
          </button>
          <button
            type="button"
            className="px-6 py-3 rounded-full bg-[var(--card)] text-[var(--text-h)] font-bold hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)] transition-all inline-flex items-center gap-2 border border-[var(--border)] shadow-lg shadow-black/10 active:scale-95"
            onClick={() => setShowCategoryModal(true)}
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">add_circle</span>
            <span className="text-xs uppercase tracking-widest font-black">Catégorie</span>
          </button>
          <button
            type="button"
            className="px-6 py-3 rounded-full text-[#4d2600] font-black hover:brightness-110 transition-all shadow-xl shadow-[var(--accent-container)]/10 inline-flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
            }}
            onClick={() => setShowArticleModal(true)}
          >
            <span className="material-symbols-outlined">add_circle</span>
            Article
          </button>
        </div>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {(
          [
            {
              icon: 'category' as const,
              label: 'Catégories',
              value: menuStats.categories,
              color: 'var(--accent)',
            },
            {
              icon: 'restaurant_menu' as const,
              label: 'Articles',
              value: menuStats.products,
              color: '#6366f1',
            },
            {
              icon: 'visibility_off' as const,
              label: 'Inactifs',
              value: menuStats.inactive,
              color: '#ec4899',
            },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] shadow-[0_20px_48px_-20px_rgba(0,0,0,0.55)] transition-all hover:brightness-110"
          >
            <div className="flex items-center gap-4">
              <span 
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all"
                style={{
                  background: theme === 'light' 
                    ? `color-mix(in_oklab, ${s.color} 22%, white)` 
                    : `color-mix(in_oklab, ${s.color} 15%, transparent)`,
                  color: s.color,
                }}
              >
                <span className="material-symbols-outlined text-[24px]">{s.icon}</span>
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--muted)]">{s.label}</div>
                <div className="font-[var(--heading)] text-3xl font-black tabular-nums tracking-tighter text-[var(--text-h)]">
                  {s.value}
                </div>
              </div>
            </div>
            <div 
              className={`absolute -right-2 -bottom-2 size-20 transition-all group-hover:scale-110 group-hover:rotate-12 ${
                theme === 'light' ? 'opacity-[0.15]' : 'opacity-[0.08]'
              }`}
              style={{ color: s.color }}
            >
              <span className="material-symbols-outlined text-[80px] leading-none">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>



      <div className="overflow-hidden rounded-3xl bg-[var(--surface)] shadow-[0_32px_64px_-32px_rgba(0,0,0,0.7)] ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)]">
        <div className="border-b border-[var(--border)] px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-black tracking-tight text-[var(--text-h)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[var(--accent)]">inventory_2</span>
                Catalogue Produits
              </h3>
              <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">Gérez vos articles et catégories</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="group inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-xs font-black text-[var(--text-h)] transition-all hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)] active:scale-95 disabled:opacity-40"
                disabled={!isTauriRuntime() || catalogCsvBusy !== null}
                onClick={() => {
                  setCatalogCsvBusy('export')
                  void (async () => {
                    try {
                      const out = await exportCatalogCsvToDocuments(userId)
                      setError(`CSV créé: ${out}`)
                    } catch (e) {
                      logDevError('catalog_export_csv_to_documents', e)
                      setError(userFacingErrorMessage(e, client.error.exportCsv))
                    } finally {
                      setCatalogCsvBusy(null)
                    }
                  })()
                }}
              >
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-y-0.5">download</span>
                Exporter CSV
              </button>
              <button
                type="button"
                className="group inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-bg)] px-5 py-2.5 text-xs font-black text-[var(--text-h)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                disabled={!isTauriRuntime() || catalogCsvBusy !== null}
                onClick={() => {
                  setCatalogCsvBusy('import')
                  void (async () => {
                    try {
                      await importCatalogCsvPickDialog(userId)
                      await onCatalogChanged()
                      await loadMenuProducts()
                      setError('Catalogue importé.')
                    } catch (e) {
                      logDevError('catalog_import_csv_pick_dialog', e)
                      const msg = userFacingErrorMessage(e, 'Import impossible.')
                      if (!/annulé/i.test(msg)) setError(msg)
                    } finally {
                      setCatalogCsvBusy(null)
                    }
                  })()
                }}
              >
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-y-0.5">upload</span>
                Importer CSV
              </button>
              <div className="w-px h-8 bg-[var(--border)] mx-1 hidden sm:block" />
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--card)] text-[var(--text-h)] ring-1 ring-[var(--border)] transition-all hover:ring-[var(--accent-border)] hover:text-[var(--accent)] active:rotate-180 disabled:opacity-30 shadow-sm"
                title="Réinitialiser les filtres"
                disabled={
                  menuProductSearch.trim() === '' &&
                  menuFilterCategoryId === 'all' &&
                  menuFilterActive === 'all'
                }
                onClick={() => {
                  setMenuProductSearch('')
                  setMenuFilterCategoryId('all')
                  setMenuFilterActive('all')
                }}
              >
                <span className="material-symbols-outlined text-[20px]">restart_alt</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              <div className="lg:col-span-7">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] mb-2 block" htmlFor="menu-product-search">
                  Rechercher un article
                </label>
                <div className="relative group">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                    aria-hidden
                  >
                    <span className="material-symbols-outlined text-[22px]">search</span>
                  </span>
                  <YoboAlphaInput
                    id="menu-product-search"
                    autoComplete="off"
                    placeholder="Tapez le nom d'un produit..."
                    value={menuProductSearch}
                    onValueChange={setMenuProductSearch}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-h)] transition-all focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent-border)] outline-none"
                  />
                </div>
              </div>
              
              <div className="lg:col-span-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] mb-2">
                  Statut de visibilité
                </div>
                <div className="flex p-1 bg-[var(--card)] rounded-2xl border border-[var(--border)]">
                  {(
                    [
                      ['all', 'Tous'],
                      ['active', 'Actifs'],
                      ['inactive', 'Inactifs'],
                    ] as const
                  ).map(([k, lab]) => (
                    <button
                      key={k}
                      type="button"
                      className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${
                        menuFilterActive === k
                          ? 'bg-[var(--accent)] text-[#4d2600] shadow-lg shadow-[var(--accent)]/10'
                          : 'text-[var(--muted)] hover:text-[var(--text-h)]'
                      }`}
                      onClick={() => setMenuFilterActive(k)}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                Filtrer par Catégorie
              </div>
              <div className="hide-scrollbar flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
                <button
                  type="button"
                  className={`shrink-0 whitespace-nowrap rounded-2xl border px-6 py-3 text-xs font-black transition-all active:scale-95 ${
                    menuFilterCategoryId === 'all'
                      ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--text-h)] shadow-md'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]'
                  }`}
                  onClick={() => setMenuFilterCategoryId('all')}
                >
                  Toutes
                </button>
                {catalogCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`shrink-0 whitespace-nowrap rounded-2xl border px-6 py-3 text-xs font-black transition-all active:scale-95 flex items-center gap-2 ${
                      menuFilterCategoryId === c.id
                        ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--text-h)] shadow-md'
                        : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]'
                    }`}
                    onClick={() => setMenuFilterCategoryId(c.id)}
                  >
                    <span className="text-lg leading-none">{c.emoji}</span>
                    <span>
                      {(c.label.toLowerCase().includes('supplé') || c.label.toLowerCase().includes('supplement'))
                        ? c.label.toLocaleUpperCase('fr-FR')
                        : c.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
        </div>

        <div className="px-4 pb-2 md:px-5">
                    {menuProducts.length === 0 ? (
                      <div className="flex w-full flex-col items-center py-14">
                        <div className="mb-4 flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-bg)] text-[var(--accent)]">
                          <span className="material-symbols-outlined text-4xl">inventory_2</span>
                        </div>
                        <p className="mx-auto w-full max-w-md text-center font-[var(--heading)] text-lg font-black text-[var(--text-h)]">
                          Catalogue vide
                        </p>
                        <p className="mx-auto mt-2 w-full max-w-md text-center text-xs leading-relaxed text-[var(--muted)] text-pretty">
                          Créez une catégorie puis ajoutez votre premier article.
                        </p>
                        <button
                          type="button"
                          className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black text-[#4d2600] shadow-lg shadow-[var(--accent-container)]/15 transition hover:brightness-110"
                          style={{
                            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
                          }}
                          onClick={() => setShowArticleModal(true)}
                        >
                          <span className="material-symbols-outlined">add_circle</span>
                            Ajouter un produit
                        </button>
                      </div>
                    ) : filteredMenuProducts.length === 0 ? (
                      <div className="flex w-full flex-col items-center py-20">
                        <div className="mb-6 flex size-20 shrink-0 items-center justify-center rounded-3xl bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)] shadow-xl shadow-black/20">
                          <span className="material-symbols-outlined text-5xl">filter_alt_off</span>
                        </div>
                        <p className="mx-auto w-full max-w-md text-center font-[var(--heading)] text-2xl font-black text-[var(--text-h)]">
                          Aucun résultat
                        </p>
                        <p className="mx-auto mt-3 w-full max-w-md text-center text-sm font-medium leading-relaxed text-[var(--muted)] text-pretty opacity-80">
                          Nous n'avons trouvé aucun article correspondant à vos filtres actuels.
                        </p>
                        <button
                          type="button"
                          className="mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-xs font-black text-[var(--text-h)] transition-all hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)] active:scale-95"
                          onClick={() => {
                            setMenuProductSearch('')
                            setMenuFilterCategoryId('all')
                            setMenuFilterActive('all')
                          }}
                        >
                          <span className="material-symbols-outlined text-[20px]">restart_alt</span>
                          Réinitialiser les filtres
                        </button>
                      </div>
                    ) : (
                      <div className="my-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {menuProductsPaginated.map((p) => {
                          const cat = catalogCategories.find((c) => c.id === p.category_id)
                          const catLabel =
                            cat && (cat.label.toLowerCase().includes('supplé') || cat.label.toLowerCase().includes('supplement'))
                              ? cat.label.toLocaleUpperCase('fr-FR')
                              : cat?.label
                          return (
                            <div
                              key={p.id}
                              className={`group relative flex flex-col overflow-hidden rounded-[1.5rem] bg-[var(--card)] ring-1 ring-[color-mix(in_oklab,var(--border)_85%,transparent)] transition-all duration-300 hover:ring-[var(--accent-border)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)] ${
                                !p.active ? 'opacity-60 grayscale-[50%]' : ''
                              }`}
                            >
                              <div className="flex flex-1 flex-col p-3">
                                {/* Header: Emoji + Info Side-by-Side */}
                                <div className="flex items-center gap-2.5 mb-3">
                                  <div className="relative shrink-0">
                                    <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--surface)] text-xl shadow-inner ring-1 ring-[var(--border)] group-hover:scale-105 transition-transform">
                                      {p.emoji}
                                    </div>
                                    <div 
                                      className={`absolute -right-1 -top-1 size-3 rounded-full ring-2 ring-[var(--card)] ${p.active ? 'bg-[var(--success)] shadow-[0_0_8px_var(--success)]' : 'bg-[var(--muted)]'}`}
                                      title={p.active ? 'Actif' : 'Inactif'}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="line-clamp-1 text-[14px] font-black leading-tight tracking-tight text-[var(--text-h)]">
                                      {p.name}
                                    </div>
                                    {cat ? (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[10px] leading-none opacity-80">{cat.emoji}</span>
                                        <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-tighter truncate">{catLabel}</span>
                                      </div>
                                    ) : (
                                      <div className="text-[9px] font-bold text-[var(--muted)] italic">Sans catégorie</div>
                                    )}
                                  </div>
                                </div>

                                {/* Pricing Section: Integrated and Compact */}
                                <div className="mt-auto overflow-hidden rounded-xl bg-[var(--surface)]/50 border border-[var(--border)]/50 transition-colors group-hover:border-[var(--accent-border)]/20">
                                  {(() => {
                                    const entries = sortSizePairsForDisplay(Object.entries(p.sizes))
                                    if (entries.length === 1) {
                                      return (
                                        <div className="py-1.5 flex justify-center">
                                          <div className="flex items-center gap-2 bg-[var(--card)] px-3 py-0.5 rounded-lg border border-[var(--border)] shadow-sm group-hover:border-[var(--accent-border)]/30 transition-colors">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Prix</span>
                                            <span className="text-[13px] font-black tabular-nums text-[var(--accent)] drop-shadow-[0_0_8px_var(--accent-bg)]">
                                              {entries[0]![1]}{' '}
                                              <span className="text-[9px] font-bold opacity-80">MAD</span>
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    }
                                    return (
                                      <div className="p-1.5 flex flex-wrap gap-1.5 justify-center">
                                        {entries.map(([label, price]) => (
                                          <div key={label || '__u'} className="flex items-center gap-1.5 bg-[var(--card)] px-2.5 py-1 rounded-lg border border-[var(--border)] shadow-sm group-hover:border-[var(--accent-border)]/30 transition-colors">
                                            <span className="text-[8px] font-black uppercase text-[var(--muted)]">
                                              {label}
                                            </span>
                                            <span className="text-[12px] font-black tabular-nums text-[var(--accent)] drop-shadow-[0_0_8px_var(--accent-bg)]">
                                              {price} <span className="text-[8px] font-bold opacity-80">MAD</span>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>

                              {/* Footer Actions: Slimmer */}
                              <div className="grid grid-cols-3 border-t border-[var(--border)] bg-[var(--surface)]/30">
                                <button
                                  type="button"
                                  className={`flex items-center justify-center py-2 transition-all active:scale-90 ${
                                    p.active
                                      ? 'text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]'
                                      : 'text-[var(--muted)] hover:text-[var(--success)] hover:bg-[var(--success-bg)]'
                                  }`}
                                  title={p.active ? 'Désactiver' : 'Activer'}
                                  onClick={() =>
                                    p.active ? setDeactivateProductTarget(p) : onToggleProductActive(p.id, true)
                                  }
                                >
                                  <span className="material-symbols-outlined text-[18px]">{p.active ? 'visibility_off' : 'visibility'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex items-center justify-center py-2 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)] transition-all border-x border-[var(--border)] active:scale-90"
                                  title="Modifier"
                                  onClick={() => openProductEditor(p)}
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit_square</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex items-center justify-center py-2 text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-all active:scale-90"
                                  title="Supprimer"
                                  onClick={() => setDeleteProductTarget(p)}
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                </div>
            <YoboPagination
              page={menuCatalogPage}
              totalItems={filteredMenuProducts.length}
              pageSize={menuCatalogPageSize}
              onPageChange={setMenuCatalogPage}
              onPageSizeChange={setMenuCatalogPageSize}
            />
      </div>
      {/* ── Modal : Ajouter une catégorie ── */}
      <YoboModal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Nouvelle catégorie"
        subtitle="Créez un rayon pour vos articles."
        headerEmoji="📂"
        maxWidthClass="max-w-lg"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="flex-1 px-6 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] font-black text-sm transition-all hover:bg-[var(--card)] active:scale-95"
              onClick={() => setShowCategoryModal(false)}
            >
              Fermer
            </button>
            <button
              type="button"
              className="flex-[2] px-6 py-3.5 rounded-2xl text-[#4d2600] font-black text-sm transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-[var(--accent)]/20"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
              }}
              onClick={() => {
                onAddCategory()
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                Ajouter la catégorie
              </span>
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Catégories existantes</div>
            <div className="flex flex-wrap gap-2.5">
              {catalogCategories.length === 0 ? (
                <div className="w-full py-8 text-center bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)]">
                  <p className="text-xs font-bold text-[var(--muted)]">
                    Aucune catégorie enregistrée.
                  </p>
                </div>
              ) : (
                catalogCategories.map((c) => (
                  <div
                    key={c.id}
                    className="group/cat inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] pl-2 pr-1.5 py-1.5 text-xs font-black text-[var(--text-h)] transition-all hover:border-[var(--accent-border)]"
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--surface)] text-sm shadow-sm">{c.emoji}</span>
                    <span className="max-w-[120px] truncate">{c.label}</span>
                    <button
                      type="button"
                      className="ml-1 size-7 flex items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                      onClick={() => setDeleteCategoryTarget(c)}
                      title={`Supprimer ${c.label}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--text-h)]" htmlFor="new-category-label">
                          Nom de la catégorie
                        </label>
                        <YoboAlphaInput
                          id="new-category-label"
                          value={newCategoryLabel}
                          onValueChange={setNewCategoryLabel}
              className="yobo-input w-full"
                          placeholder="Ex. Tapas, Salades…"
                          autoComplete="off"
                        />
                      </div>
          <div>
            <span className="mb-1.5 block text-xs font-bold text-[var(--text-h)]">Emoji</span>
                        <EmojiPicker
                          hideLabel
                          formRow
                          symbolOnly
                          label="Emoji de la catégorie"
                          value={newCategoryEmoji}
                          onChange={setNewCategoryEmoji}
                        />
                      </div>
        </div>
      </YoboModal>

      {/* ── Modal : Ajouter un article ── */}
      <YoboModal
        open={showArticleModal}
        onClose={() => setShowArticleModal(false)}
        title="Nouvel article"
        subtitle="Ajoutez un produit à votre catalogue."
        headerEmoji="🍽️"
        maxWidthClass="max-w-lg"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="flex-1 px-6 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] font-black text-sm transition-all hover:bg-[var(--card)] active:scale-95"
              onClick={() => setShowArticleModal(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="flex-[2] px-6 py-3.5 rounded-2xl text-[#4d2600] font-black text-sm transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-[var(--accent)]/20"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
              }}
              onClick={() => {
                onAddProduct()
                setShowArticleModal(false)
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                Enregistrer l'article
              </span>
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--text-h)]" htmlFor="new-product-category">
              Catégorie
            </label>
            <select
              id="new-product-category"
              value={newProductCategoryId ?? ''}
              onChange={(e) => setNewProductCategoryId(Number(e.target.value))}
              className="yobo-input w-full"
            >
              {catalogCategories.map((c) => (
                <option key={c.id} value={c.id}>{`${c.emoji} ${
                  (c.label.toLowerCase().includes('supplé') || c.label.toLowerCase().includes('supplement'))
                    ? c.label.toLocaleUpperCase('fr-FR')
                    : c.label
                }`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--text-h)]" htmlFor="new-product-name">
              Nom produit
            </label>
            <YoboAlphaInput
              id="new-product-name"
              value={newProductName}
              onValueChange={setNewProductName}
              className="yobo-input w-full"
              placeholder="Ex. Margherita"
              autoComplete="off"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-bold text-[var(--text-h)]">Emoji</span>
            <EmojiPicker
              hideLabel
              formRow
              symbolOnly
              label="Emoji du produit"
              value={newProductEmoji}
              onChange={setNewProductEmoji}
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Grille Tarifaire</span>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={!newProductSinglePrice}
                    onChange={(e) => {
                      const withSizes = e.target.checked
                      setNewProductSinglePrice(!withSizes)
                      if (withSizes) {
                        setNewProductSizeEntries([])
                        setNewProductSizeLabel('S')
                        setNewProductSizePrice('')
                      } else {
                        const fromMulti = Number(newProductSizePrice.replace(',', '.')) || newProductSizeEntries[0]?.price || 50
                        setNewProductSizeEntries([{ label: YOBO_SINGLE_PRICE_KEY, price: fromMulti > 0 ? fromMulti : 50 }])
                      }
                      setError(null)
                    }}
                  />
                  <div className="w-10 h-5 bg-[var(--card)] rounded-full border border-[var(--border)] peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)] transition-all"></div>
                  <div className="absolute left-1 top-1 w-3 h-3 bg-[var(--muted)] rounded-full peer-checked:translate-x-5 peer-checked:bg-[#4d2600] transition-all"></div>
                </div>
                <span className="text-[11px] font-bold text-[var(--muted)] group-hover:text-[var(--text-h)] transition-colors">Plusieurs tailles</span>
              </label>
            </div>

            <div className="rounded-2xl bg-[var(--surface)] p-4 border border-[var(--border)] shadow-inner">
              {newProductSinglePrice ? (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Prix Fixe (MAD)</label>
                  <div className="relative">
                    <YoboNumericInput
                      id="new-product-unique-price"
                      value={
                        newProductSizeEntries[0]?.label === YOBO_SINGLE_PRICE_KEY 
                          ? (newProductSizeEntries[0]?.price === 0 ? '' : String(newProductSizeEntries[0]?.price))
                          : ''
                      }
                      onValueChange={(v) => {
                        const n = Number(v.replace(',', '.'))
                        setNewProductSizeEntries([{ label: YOBO_SINGLE_PRICE_KEY, price: Number.isFinite(n) && n >= 0 ? n : 0 }])
                      }}
                      variant="decimal"
                      keyboardMaxLen={10}
                      className="yobo-input w-full pl-4 pr-12 h-12 text-lg font-black text-[var(--accent)]"
                      placeholder=""
                      autoComplete="off"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-black text-xs pointer-events-none">MAD</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Presets de taille</span>
                    <div className="flex flex-wrap gap-2">
                      {['S', 'M', 'L', 'XL'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewProductSizeLabel(s)}
                          className={`px-4 py-1.5 rounded-xl border text-[11px] font-black transition-all ${
                            newProductSizeLabel === s 
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-[#4d2600] shadow-lg shadow-[var(--accent)]/20' 
                            : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-h)] hover:border-[var(--accent-border)]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Saisie Rapide</span>
                    <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                      <YoboAlphaInput
                        value={newProductSizeLabel}
                        onValueChange={setNewProductSizeLabel}
                        className="yobo-input h-11 text-center font-bold"
                        placeholder="Taille"
                        autoComplete="off"
                      />
                      <div className="relative">
                        <YoboNumericInput
                          value={newProductSizePrice}
                          onValueChange={setNewProductSizePrice}
                          variant="decimal"
                          className="yobo-input h-11 pl-3 pr-10 font-black text-[var(--accent)]"
                          placeholder=""
                          autoComplete="off"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] font-black text-[9px]">MAD</span>
                      </div>
                      <button
                        type="button"
                        onClick={addNewSizeEntry}
                        className="flex size-11 items-center justify-center rounded-xl bg-[var(--accent)] text-[#4d2600] shadow-lg shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined font-black">add</span>
                      </button>
                    </div>
                  </div>

                    {newProductSizeEntries.length > 0 && (
                      <div className="pt-4 border-t border-[var(--border)]/50">
                        <span className="mb-2.5 block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Tailles configurées</span>
                        <div className="flex flex-wrap gap-2">
                          {newProductSizeEntries.map((entry, idx) => (
                            <div
                              key={`${entry.label}-${idx}`}
                              className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)] group animate-in zoom-in-95 duration-200"
                            >
                              <span className="text-[10px] font-black text-[var(--muted)]">{entry.label}</span>
                              <span className="text-xs font-black text-[var(--accent)]">{entry.price} <span className="text-[8px] opacity-60">MAD</span></span>
                              <button
                                type="button"
                                onClick={() => removeNewSizeEntry(entry.label)}
                                className="size-5 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">close</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </YoboModal>

      <YoboModal
        open={!!editingProduct}
        onClose={() => {
          setEditingProduct(null)
          setError(null)
        }}
        title="Modifier le produit"
        subtitle="Catégorie, nom, emoji et grille tarifaire."
        headerEmoji="✏️"
        variant="center"
        maxWidthClass="max-w-3xl w-[min(100vw-1.5rem,52rem)]"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => {
                setEditingProduct(null)
                setError(null)
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary"
              onClick={saveEditedProduct}
            >
              Enregistrer
            </button>
          </div>
        }
      >
        {editingProduct ? (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Informations</h4>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="yobo-modal-label" htmlFor="edit-prod-cat">
                    Catégorie
                  </label>
                  <select
                    id="edit-prod-cat"
                    className="yobo-modal-field w-full min-w-0"
                    value={editProductCategoryId ?? ''}
                    onChange={(e) => setEditProductCategoryId(Number(e.target.value) || null)}
                  >
                    {catalogCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${c.emoji} ${
                          (c.label.toLowerCase().includes('supplé') || c.label.toLowerCase().includes('supplement'))
                            ? c.label.toLocaleUpperCase('fr-FR')
                            : c.label
                        }`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="yobo-modal-label" htmlFor="edit-prod-name">
                    Nom
                  </label>
                  <YoboAlphaInput
                    id="edit-prod-name"
                    className="yobo-modal-field"
                    value={editProductName}
                    onValueChange={setEditProductName}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <span className="yobo-modal-label">Emoji</span>
                  <EmojiPicker
                    id="edit-prod-emoji"
                    hideLabel
                    formRow
                    symbolOnly
                    label="Emoji du produit"
                    value={editProductEmoji}
                    onChange={setEditProductEmoji}
                    alignPanel="end"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Grille Tarifaire</h4>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!editProductSinglePrice}
                      onChange={(e) => {
                        const withSizes = e.target.checked
                        setEditProductSinglePrice(!withSizes)
                        if (withSizes) {
                          setEditProductSizeEntries([])
                          setEditProductSizeLabel('S')
                          setEditProductSizePrice('')
                        } else {
                          const p = editProductSizeEntries[0]?.price ?? (Number(editProductSizePrice.replace(',', '.')) || 50)
                          setEditProductSizeEntries([{ label: YOBO_SINGLE_PRICE_KEY, price: p > 0 ? p : 50 }])
                        }
                        setError(null)
                      }}
                    />
                    <div className="w-10 h-5 bg-[var(--surface)] rounded-full border border-[var(--border)] peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)] transition-all"></div>
                    <div className="absolute left-1 top-1 w-3 h-3 bg-[var(--muted)] rounded-full peer-checked:translate-x-5 peer-checked:bg-[#4d2600] transition-all"></div>
                  </div>
                  <span className="text-[11px] font-bold text-[var(--muted)] group-hover:text-[var(--text-h)] transition-colors">Plusieurs tailles</span>
                </label>
              </div>

              <div className="rounded-2xl bg-[var(--surface)] p-4 border border-[var(--border)] shadow-inner">
                {editProductSinglePrice ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Prix Fixe (MAD)</label>
                    <div className="relative">
                      <YoboNumericInput
                        id="edit-unique-price"
                        value={
                          editProductSizeEntries[0]?.label === YOBO_SINGLE_PRICE_KEY 
                            ? (editProductSizeEntries[0]?.price === 0 ? '' : String(editProductSizeEntries[0]?.price))
                            : ''
                        }
                        onValueChange={(v) => {
                          const n = Number(v.replace(',', '.'))
                          setEditProductSizeEntries([{ label: YOBO_SINGLE_PRICE_KEY, price: Number.isFinite(n) && n >= 0 ? n : 0 }])
                        }}
                        variant="decimal"
                        keyboardMaxLen={10}
                        className="yobo-input w-full pl-4 pr-12 h-12 text-lg font-black text-[var(--accent)]"
                        placeholder=""
                        autoComplete="off"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-black text-xs pointer-events-none">MAD</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Presets de taille</span>
                      <div className="flex flex-wrap gap-2">
                        {['S', 'M', 'L', 'XL'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setEditProductSizeLabel(s)}
                            className={`px-4 py-1.5 rounded-xl border text-[11px] font-black transition-all ${
                              editProductSizeLabel === s 
                              ? 'bg-[var(--accent)] border-[var(--accent)] text-[#4d2600] shadow-lg shadow-[var(--accent)]/20' 
                              : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-h)] hover:border-[var(--accent-border)]'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Saisie Rapide</span>
                      <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                        <YoboAlphaInput
                          value={editProductSizeLabel}
                          onValueChange={setEditProductSizeLabel}
                          className="yobo-input h-11 text-center font-bold"
                          placeholder="Taille"
                          autoComplete="off"
                        />
                        <div className="relative">
                          <YoboNumericInput
                            value={editProductSizePrice}
                            onValueChange={setEditProductSizePrice}
                            variant="decimal"
                            className="yobo-input h-11 pl-3 pr-10 font-black text-[var(--accent)]"
                            placeholder=""
                            autoComplete="off"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] font-black text-[9px]">MAD</span>
                        </div>
                        <button
                          type="button"
                          onClick={addEditProductSizeEntry}
                          className="flex size-11 items-center justify-center rounded-xl bg-[var(--accent)] text-[#4d2600] shadow-lg shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined font-black">add</span>
                        </button>
                      </div>
                    </div>

                    {editProductSizeEntries.length > 0 && (
                      <div className="pt-4 border-t border-[var(--border)]/50">
                        <span className="mb-2.5 block text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Tailles configurées</span>
                        <div className="flex flex-wrap gap-2">
                          {editProductSizeEntries.map((entry, idx) => (
                            <div
                              key={`${entry.label}-${idx}`}
                              className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)] group animate-in zoom-in-95 duration-200"
                            >
                              <span className="text-[10px] font-black text-[var(--muted)]">{entry.label}</span>
                              <span className="text-xs font-black text-[var(--accent)]">{entry.price} <span className="text-[8px] opacity-60">MAD</span></span>
                              <button
                                type="button"
                                onClick={() => removeEditProductSizeEntry(entry.label)}
                                className="size-5 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">close</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </YoboModal>

      <YoboModal
        open={!!deactivateProductTarget}
        onClose={() => setDeactivateProductTarget(null)}
        title="Désactiver ce produit ?"
        subtitle={
          deactivateProductTarget
            ? `${deactivateProductTarget.emoji} ${deactivateProductTarget.name} ne sera plus visible à la caisse tant qu’il n’est pas réactivé.`
            : ''
        }
        headerEmoji="⏸️"
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost"
              onClick={() => setDeactivateProductTarget(null)}
            >
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">close</span>
              Annuler
              </span>
            </button>
            <button type="button" className="yobo-modal-btn yobo-modal-btn--primary" onClick={confirmDeactivateProduct}>
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">pause_circle</span>
              Désactiver
              </span>
            </button>
          </>
        }
      >
        <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
          Tu pourras le <strong className="text-[var(--text-h)]">réactiver</strong> à tout moment depuis ce même tableau (
          bouton vert). Ce n’est pas une suppression.
        </p>
      </YoboModal>

      <YoboModal
        open={!!deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        title="Supprimer ce produit ?"
        subtitle={
          deleteProductTarget
            ? `${deleteProductTarget.emoji} ${deleteProductTarget.name} sera retiré du menu et du catalogue POS.`
            : ''
        }
        headerEmoji="🗑️"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="flex-1 px-6 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] font-black text-sm transition-all hover:bg-[var(--card)] active:scale-95"
              onClick={() => setDeleteProductTarget(null)}
            >
              Annuler
            </button>
            <button 
              type="button" 
              className="flex-[2] px-6 py-3.5 rounded-2xl bg-[var(--danger)] text-white font-black text-sm transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-[var(--danger)]/20"
              onClick={confirmDeleteProduct}
            >
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                Supprimer l'article
              </span>
            </button>
          </div>
        }
      >
        <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
          Cette action est <strong className="text-[var(--text-h)]">irréversible</strong>. Les commandes passées ne sont pas
          modifiées, mais le produit ne pourra plus être vendu.
        </p>
      </YoboModal>
      <YoboModal
        open={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        title="Supprimer cette catégorie ?"
        subtitle={
          deleteCategoryTarget
            ? `${deleteCategoryTarget.emoji} ${deleteCategoryTarget.label} — impossible s’il reste des produits dedans.`
            : ''
        }
        headerEmoji="📂"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="flex-1 px-6 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] font-black text-sm transition-all hover:bg-[var(--card)] active:scale-95"
              onClick={() => setDeleteCategoryTarget(null)}
            >
              Annuler
            </button>
            <button 
              type="button" 
              className="flex-[2] px-6 py-3.5 rounded-2xl bg-[var(--danger)] text-white font-black text-sm transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-[var(--danger)]/20"
              onClick={confirmDeleteCategory}
            >
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">folder_delete</span>
                Supprimer
              </span>
            </button>
          </div>
        }
      >
        <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
          Si la catégorie contient encore des produits, la suppression sera refusée. Vide ou déplace les produits avant.
        </p>
      </YoboModal>
      <YoboModal
        open={showGratineModal}
        onClose={() => setShowGratineModal(false)}
        title="Supplément Gratiné"
        subtitle="Définissez le prix global appliqué à l'option gratiné."
        headerEmoji="🧀"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="flex-1 px-6 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] font-black text-sm transition-all hover:bg-[var(--card)] active:scale-95"
              onClick={() => setShowGratineModal(false)}
            >
              Fermer
            </button>
            <button
              type="button"
              className="flex-[2] px-6 py-3.5 rounded-2xl text-[#4d2600] font-black text-sm transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
              }}
              disabled={isSavingGratine || localGratinePrice === gratinePrice.toString()}
              onClick={async () => {
                await handleSaveGratine()
                setShowGratineModal(false)
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">save</span>
                {isSavingGratine ? 'Enregistrement...' : 'Enregistrer'}
              </span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="yobo-modal-label" htmlFor="gratine-price-input">
              Prix du supplément (MAD)
            </label>
            <div className="relative">
              <YoboNumericInput
                id="gratine-price-input"
                value={localGratinePrice === '0' ? '' : localGratinePrice}
                onValueChange={setLocalGratinePrice}
                variant="decimal"
                className="yobo-modal-field text-lg font-bold tabular-nums pr-12"
                placeholder=""
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-black text-xs pointer-events-none">MAD</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
              Ce prix sera ajouté à chaque article sélectionné avec l'option "Gratiné" dans le panier.
            </p>
          </div>
        </div>
      </YoboModal>
    </>
  )
}
