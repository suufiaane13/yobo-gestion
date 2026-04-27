import type { SetStateAction } from 'react'
import { GerantMenuPage } from './GerantMenuPage'
import { useYoboStore } from '../store'

export function MenuPage() {
  const userId = useYoboStore((s) => s.userId)
  const catalogCategories = useYoboStore((s) => s.catalogCategories)
  const loadCatalog = useYoboStore((s) => s.loadCatalog)
  const setErrorPlain = useYoboStore((s) => s.setError)

  if (userId === null) return null

  const setError = (value: SetStateAction<string | null>) => {
    if (typeof value === 'function') {
      setErrorPlain(value(useYoboStore.getState().error))
    } else {
      setErrorPlain(value)
    }
  }

  return (
    <GerantMenuPage
      userId={userId}
      catalogCategories={catalogCategories}
      onCatalogChanged={async () => {
        await loadCatalog()
      }}
      setError={setError}
    />
  )
}
