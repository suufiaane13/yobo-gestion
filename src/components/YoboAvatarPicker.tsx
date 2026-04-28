import { useState } from 'react'
import { useYoboStore } from '../store'
import { SpinnerIcon } from './icons/SpinnerIcon'

const AVATARS = [
  { id: 'av-crown', icon: 'crown', color: 'from-amber-400 to-orange-600', glow: 'shadow-amber-500/30', label: 'Gérant' },
  { id: 'av-shield', icon: 'shield_person', color: 'from-blue-500 to-indigo-700', glow: 'shadow-blue-500/30', label: 'Admin' },
  { id: 'av-chef', icon: 'restaurant_menu', color: 'from-orange-500 to-red-600', glow: 'shadow-orange-500/30', label: 'Chef' },
  { id: 'av-cash', icon: 'payments', color: 'from-emerald-500 to-teal-700', glow: 'shadow-emerald-500/30', label: 'Caisse' },
  { id: 'av-star', icon: 'grade', color: 'from-purple-500 to-pink-600', glow: 'shadow-purple-500/30', label: 'VIP' },
  { id: 'av-bolt', icon: 'bolt', color: 'from-cyan-400 to-blue-600', glow: 'shadow-cyan-500/30', label: 'Flash' },
]

export function YoboAvatarPicker() {
  const currentAvatar = useYoboStore((s) => s.avatar)
  const updateAvatar = useYoboStore((s) => s.updateAvatar)
  
  const [selectedId, setSelectedId] = useState<string | null>(currentAvatar)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!selectedId || selectedId === currentAvatar) return
    setIsSaving(true)
    try {
      await updateAvatar(selectedId)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanged = selectedId !== currentAvatar

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {AVATARS.map((av) => (
          <button
            key={av.id}
            onClick={() => setSelectedId(av.id)}
            className={`group relative flex flex-col items-center gap-2 transition-all duration-300 ${
              selectedId === av.id ? 'scale-110' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'
            }`}
          >
            <div
              className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ring-offset-2 transition-all duration-500 ${av.color} ${
                selectedId === av.id ? `${av.glow} ring-2 ring-[var(--accent)] rotate-3` : 'ring-0 hover:rotate-3'
              }`}
            >
              <span className="material-symbols-outlined text-[28px] text-white drop-shadow-md group-hover:scale-110 transition-transform">
                {av.icon}
              </span>
              
              {selectedId === av.id && (
                <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-[var(--card)] animate-in zoom-in-50 duration-300">
                  <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
              {av.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          disabled={!hasChanged || isSaving}
          onClick={handleSave}
          className="yobo-modal-btn yobo-modal-btn--primary min-w-[120px] justify-center h-10 shadow-lg shadow-[var(--accent)]/10"
        >
          {isSaving ? (
            <>
              <SpinnerIcon size={14} />
              <span>Enregistrement...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Enregistrer</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export function YoboAvatarDisplay({ id, size = 'md' }: { id?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const avatar = AVATARS.find((a) => a.id === id) || AVATARS[0]
  
  const sizeClasses = {
    sm: 'size-8 rounded-lg',
    md: 'size-10 rounded-xl',
    lg: 'size-14 rounded-2xl'
  }

  const iconSizes = {
    sm: 'text-[18px]',
    md: 'text-[22px]',
    lg: 'text-[28px]'
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br shadow-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer ${sizeClasses[size]} ${avatar.color} ${avatar.glow}`}
    >
      <span className={`material-symbols-outlined text-white drop-shadow-sm ${iconSizes[size]}`}>
        {avatar.icon}
      </span>
    </div>
  )
}
