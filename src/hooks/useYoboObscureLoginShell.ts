import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauriRuntime } from '../lib/isTauriRuntime'

/**
 * Tant que l’utilisateur n’est pas connecté : masque le splash / login si la fenêtre
 * n’a pas le focus (autre app au premier plan) ou si l’onglet / la fenêtre n’est pas visible.
 */
export function useYoboObscureLoginShell(authed: boolean) {
  const [pageHidden, setPageHidden] = useState(
    () => (typeof document !== 'undefined' ? document.hidden : false),
  )
  const [winFocused, setWinFocused] = useState(true)

  useEffect(() => {
    if (authed) return
    const onVis = () => setPageHidden(document.hidden)
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [authed])

  useEffect(() => {
    if (!isTauriRuntime() || authed) return
    let unlisten: (() => void) | undefined
    void getCurrentWindow()
      .onFocusChanged(({ payload }) => setWinFocused(payload))
      .then((u) => {
        unlisten = u
      })
    return () => {
      unlisten?.()
    }
  }, [authed])

  return !authed && (pageHidden || !winFocused)
}
