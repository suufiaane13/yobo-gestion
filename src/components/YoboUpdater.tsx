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
    <div className="rounded-2xl bg-[var(--surface)] p-6 ring-1 ring-[var(--border)]">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-black text-[var(--text-h)]">Mise à jour du logiciel</h4>
          <p className="text-[10px] font-bold text-[var(--muted)]">
            Vérifiez si une nouvelle version de YOBO est disponible.
          </p>
        </div>

        {!updateInfo ? (
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--card)] border border-[var(--border)] px-6 text-xs font-black text-[var(--text-h)] shadow-sm transition hover:border-[var(--accent)]/50"
            onClick={handleCheck}
            disabled={checking}
          >
            {checking ? <SpinnerIcon size={14} /> : <span className="material-symbols-outlined text-[18px]">update</span>}
            Vérifier maintenant
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="text-right">
              <div className="text-xs font-black text-[var(--accent)]">Version {updateInfo.version} disponible !</div>
              <div className="text-[9px] font-bold text-[var(--muted)]">Nouveautés détectées.</div>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-container)] px-6 text-xs font-black text-[#4d2600] shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-110 disabled:opacity-50"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? <SpinnerIcon size={14} /> : <span className="material-symbols-outlined text-[18px]">download</span>}
              Installer {progress !== null ? `(${progress}%)` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
