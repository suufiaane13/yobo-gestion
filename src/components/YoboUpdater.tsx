import { useState, useEffect, useCallback } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { invoke } from '@tauri-apps/api/core'
import { SpinnerIcon } from './icons/SpinnerIcon'
import { useYoboStore } from '../store'
import { isTauriRuntime } from '../lib/isTauriRuntime'

export function YoboUpdater() {
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body?: string } | null>(null)
  
  const pushToast = useYoboStore((s) => s.pushToast)
  const updateFirstSeenAt = useYoboStore((s) => s.updateFirstSeenAt)
  const updateVersionSeen = useYoboStore((s) => s.updateVersionSeen)
  const setUpdateSeen = useYoboStore((s) => s.setUpdateSeen)

  const UPDATE_URL = 'https://raw.githubusercontent.com/suufiaane13/yobo-gestion/main/updater/windows-x86_64.json'

  const handleUpdate = useCallback(async (isAuto = false) => {
    setUpdating(true)
    try {
      const update = await check()
      if (update?.available) {
        if (isAuto) {
          pushToast('success', 'Mise à jour obligatoire en cours...')
        }
        
        let downloaded = 0
        let contentLength = 0
        
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0
              break
            case 'Progress':
              downloaded += event.data.chunkLength
              if (contentLength > 0) {
                setProgress(Math.round((downloaded / contentLength) * 100))
              }
              break
          }
        })
        
        // Reset tracking after success (app will relaunch anyway)
        setUpdateSeen(null, null)
        await invoke('relaunch')
      }
    } catch (e) {
      console.error(e)
      pushToast('error', 'Échec de la mise à jour.')
      setUpdating(false)
      setProgress(null)
    }
  }, [pushToast, setUpdateSeen])

  const handleCheck = useCallback(async (silent = false) => {
    setChecking(true)
    try {
      const update = await check()
      if (update?.available) {
        setUpdateInfo({ version: update.version, body: update.body })
        
        // Gestion de la date de première détection
        const now = new Date().toISOString()
        let firstSeen = updateFirstSeenAt
        
        if (updateVersionSeen !== update.version) {
          // Nouvelle version détectée ou première détection
          setUpdateSeen(update.version, now)
          firstSeen = now
        }

        // Vérification des 7 jours (7 * 24 * 60 * 60 * 1000 ms)
        if (firstSeen) {
          const firstSeenDate = new Date(firstSeen)
          const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000
          const isExpired = (new Date().getTime() - firstSeenDate.getTime()) > sevenDaysInMs
          
          if (isExpired) {
            console.log("Mise à jour obligatoire détectée (> 7 jours).")
            void handleUpdate(true)
          }
        }
      } else {
        // Si l'application est à jour, on nettoie les flags de suivi
        if (updateVersionSeen) {
          setUpdateSeen(null, null)
        }
        if (!silent) {
          pushToast('success', 'Votre application est à jour.')
        }
      }
    } catch (e) {
      console.error(e)
      if (!silent) {
        pushToast('error', 'Impossible de vérifier les mises à jour.')
      }
    } finally {
      setChecking(false)
    }
  }, [updateFirstSeenAt, updateVersionSeen, setUpdateSeen, handleUpdate, pushToast])

  // Vérification automatique au montage
  useEffect(() => {
    if (isTauriRuntime()) {
      void handleCheck(true)
    }
  }, [handleCheck])

  const isForced = updateFirstSeenAt && (new Date().getTime() - new Date(updateFirstSeenAt).getTime()) > (7 * 24 * 60 * 60 * 1000)

  return (
    <div className="rounded-xl bg-transparent p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h4 className="text-[13px] font-black text-[var(--text-h)]">Mises à jour</h4>
          <p className="text-[9px] font-bold text-[var(--muted)]">
            {updateInfo 
              ? isForced 
                ? 'Mise à jour obligatoire (délai dépassé)' 
                : `Version ${updateInfo.version} disponible`
              : checking 
                ? 'Recherche en cours...' 
                : 'Votre système est à jour.'}
          </p>
        </div>

        {updateInfo ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[11px] font-black shadow-lg transition hover:brightness-110 disabled:opacity-50 ${
                isForced 
                ? 'bg-red-500 text-white shadow-red-500/20' 
                : 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-container)] text-[#4d2600] shadow-[var(--accent)]/20'
              }`}
              onClick={() => void handleUpdate(false)}
              disabled={updating}
            >
              {updating ? <SpinnerIcon size={12} /> : <span className="material-symbols-outlined text-[16px]">{isForced ? 'warning' : 'download'}</span>}
              {isForced ? 'Mise à jour forcée' : 'Installer'} {progress !== null ? `(${progress}%)` : ''}
            </button>
          </div>
        ) : checking ? (
          <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-[var(--muted)]">
            <SpinnerIcon size={12} />
            Vérification...
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-[var(--accent)]">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            À jour
          </div>
        )}
      </div>
    </div>
  )
}
