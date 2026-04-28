import { useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { invoke } from '@tauri-apps/api/core'
import { SpinnerIcon } from './icons/SpinnerIcon'
import { useYoboStore } from '../store'

export function YoboUpdater() {
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body?: string } | null>(null)
  const pushToast = useYoboStore((s) => s.pushToast)

  async function handleCheck() {
    setChecking(true)
    try {
      const update = await check()
      if (update?.available) {
        setUpdateInfo({ version: update.version, body: update.body })
      } else {
        pushToast('success', 'Votre application est à jour.')
      }
    } catch (e) {
      console.error(e)
      pushToast('error', 'Impossible de vérifier les mises à jour.')
    } finally {
      setChecking(false)
    }
  }

  async function handleUpdate() {
    setUpdating(true)
    try {
      const update = await check()
      if (update?.available) {
        let downloaded = 0
        let contentLength = 0
        
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0
              console.log(`Started downloading ${contentLength} bytes`)
              break
            case 'Progress':
              downloaded += event.data.chunkLength
              if (contentLength > 0) {
                setProgress(Math.round((downloaded / contentLength) * 100))
              }
              break
            case 'Finished':
              console.log('Download finished')
              break
          }
        })
        
        await invoke('relaunch')
      }
    } catch (e) {
      console.error(e)
      pushToast('error', 'Échec de la mise à jour.')
      setUpdating(false)
      setProgress(null)
    }
  }

  return (
    <div className="rounded-xl bg-transparent p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h4 className="text-[13px] font-black text-[var(--text-h)]">Mise à jour</h4>
          <p className="text-[9px] font-bold text-[var(--muted)]">
            Vérifiez si une version est disponible.
          </p>
        </div>

        {!updateInfo ? (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--card)] border border-[var(--border)] px-4 text-[11px] font-black text-[var(--text-h)] shadow-sm transition hover:border-[var(--accent)]/50"
            onClick={handleCheck}
            disabled={checking}
          >
            {checking ? <SpinnerIcon size={12} /> : <span className="material-symbols-outlined text-[16px]">update</span>}
            Vérifier
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="text-right">
              <div className="text-xs font-black text-[var(--accent)]">Version {updateInfo.version} disponible !</div>
              <div className="text-[9px] font-bold text-[var(--muted)]">Nouveautés détectées.</div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--accent)] to-[var(--accent-container)] px-4 text-[11px] font-black text-[#4d2600] shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-110 disabled:opacity-50"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? <SpinnerIcon size={12} /> : <span className="material-symbols-outlined text-[16px]">download</span>}
              Installer {progress !== null ? `(${progress}%)` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
