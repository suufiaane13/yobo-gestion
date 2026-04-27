/** Catégorie menu (alignée sur l’API Rust / SQLite). */
export type CatalogCategory = { id: number; label: string; emoji: string; position: number }

export type CatalogProduct = {
  id: number
  name: string
  emoji: string
  category_id: number
  sizes: Record<string, number>
  active: boolean
  position: number
}

export type CatalogResponse = { categories: CatalogCategory[]; products: CatalogProduct[] }
