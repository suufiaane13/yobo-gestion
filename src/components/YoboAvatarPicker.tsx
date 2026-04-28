import { useState } from 'react'
import { useYoboStore } from '../store'
import { SpinnerIcon } from './icons/SpinnerIcon'

export const AVATARS = [
  { id: 'av-crown', icon: 'crown', color: 'from-amber-400 to-orange-600', glow: 'shadow-amber-500/30', label: 'Gérant' },
  { id: 'av-shield', icon: 'shield_person', color: 'from-blue-500 to-indigo-700', glow: 'shadow-blue-500/30', label: 'Admin' },
  { id: 'av-chef', icon: 'restaurant_menu', color: 'from-orange-500 to-red-600', glow: 'shadow-orange-500/30', label: 'Chef' },
  { id: 'av-waiter', icon: 'person_raised_hand', color: 'from-emerald-400 to-teal-600', glow: 'shadow-emerald-500/30', label: 'Service' },
  { id: 'av-cash', icon: 'payments', color: 'from-indigo-400 to-violet-600', glow: 'shadow-indigo-500/30', label: 'Caisse' },
  { id: 'av-pizza', icon: 'local_pizza', color: 'from-red-400 to-orange-500', glow: 'shadow-red-500/30', label: 'Pizza' },
  { id: 'av-burger', icon: 'lunch_dining', color: 'from-yellow-500 to-amber-600', glow: 'shadow-amber-500/30', label: 'Burger' },
  { id: 'av-coffee', icon: 'coffee', color: 'from-amber-700 to-orange-900', glow: 'shadow-orange-900/30', label: 'Café' },
  { id: 'av-drink', icon: 'local_bar', color: 'from-cyan-400 to-blue-500', glow: 'shadow-cyan-500/30', label: 'Boissons' },
  { id: 'av-cake', icon: 'cake', color: 'from-pink-400 to-fuchsia-600', glow: 'shadow-pink-500/30', label: 'Dessert' },
  { id: 'av-rocket', icon: 'rocket_launch', color: 'from-purple-500 to-indigo-600', glow: 'shadow-purple-500/30', label: 'Livraison' },
  { id: 'av-star', icon: 'star', color: 'from-yellow-300 to-amber-500', glow: 'shadow-yellow-400/30', label: 'Favori' },
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
    <div className="space-y-4">
      {/* Compact Grid */}
      <div className="grid grid-cols-6 gap-3 sm:grid-cols-12 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12">
        {AVATARS.map((av) => {
          const isSelected = selectedId === av.id
          const isActuallyActive = currentAvatar === av.id
          
          return (
            <button
              key={av.id}
              type="button"
              title={av.label}
              onClick={() => setSelectedId(av.id)}
              className={`group relative flex size-12 items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
                isSelected 
                  ? `scale-110 ring-2 ring-offset-2 ring-offset-[var(--card)] ring-[var(--accent)] ${av.glow} shadow-lg z-10` 
                  : 'hover:scale-105 opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${av.color} ${isSelected ? 'opacity-100' : 'opacity-20 group-hover:opacity-40'}`} />
              
              <span className={`material-symbols-outlined text-xl z-10 transition-all ${
                isSelected ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]' : 'text-[var(--text-h)]'
              }`}>
                {av.icon}
              </span>

              {isActuallyActive && !isSelected && (
                <div className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--card)]" />
              )}
            </button>
          )
        })}
      </div>

      {/* Action Button - Shows only when necessary */}
      {hasChanged && (
        <div className="flex animate-in fade-in slide-in-from-top-1 duration-300">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-container)] px-4 text-[10px] font-black uppercase tracking-widest text-[#4d2600] shadow-md transition-all hover:brightness-110 active:scale-95"
          >
            {isSaving ? <SpinnerIcon size={14} /> : <span className="material-symbols-outlined text-[16px]">done_all</span>}
            Confirmer la sélection
          </button>
        </div>
      )}
    </div>
  )
}

/** Composant pour afficher l'avatar n'importe où (Header, Profil, etc.) */
export function YoboAvatarDisplay({ id, size = 'md', className = '' }: { id: string | null | undefined, size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl', className?: string }) {
  const av = AVATARS.find(a => a.id === id)
  
  const sizeClasses = {
    xs: 'size-5 text-[10px] rounded-full',
    sm: 'size-8 text-xl rounded-full',
    md: 'size-10 text-2xl rounded-full',
    lg: 'size-16 text-4xl rounded-full',
    xl: 'size-20 text-5xl rounded-full'
  }

  if (!av) return null

  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${av.color} shadow-lg transition-all duration-300 hover:scale-110 hover:rotate-3 active:scale-90 cursor-pointer group/avatar ${sizeClasses[size]} ${className}`}>
      <span className="material-symbols-outlined text-[1em] text-white drop-shadow-md transition-transform group-hover/avatar:scale-110">
        {av.icon}
      </span>
    </div>
  )
}
