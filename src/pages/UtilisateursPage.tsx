import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { YoboAlphaInput, YoboNumericInput } from '../components/YoboKeyboardInputs'
import { SpinnerIcon } from '../components/icons/SpinnerIcon'
import { YoboModal } from '../components/YoboModal'
import { YoboPagination } from '../components/YoboPagination'
import { formatDateHeureFr } from '../lib/formatDateHeureFr'
import { paginateSlice } from '../lib/pagination'
import { capitalizeFirstLetter } from '../lib/yoboStrings'
import { useYoboStore } from '../store'

export function UtilisateursPage() {
  const role = useYoboStore((s) => s.role)
  const {
    caissiers,
    caissiersLoading,
    caissiersPage,
    caissiersPageSize,
    setCaissiersPage,
    setCaissiersPageSize,
    busyToggleUserId,
    setDeactivateUserError,
    setDeactivateUserTarget,
    toggleCaissierActive,
    setResetPinError,
    setResetPinValue,
    setResetPinTarget,
    busyResetPinUserId,
    newCaissierName,
    setNewCaissierName,
    newCaissierPin,
    setNewCaissierPin,
    addingCaissier,
    addCaissier,
    theme,
  } = useYoboStore(
    useShallow((s) => ({
      caissiers: s.caissiers,
      caissiersLoading: s.caissiersLoading,
      caissiersPage: s.caissiersPage,
      caissiersPageSize: s.caissiersPageSize,
      setCaissiersPage: s.setCaissiersPage,
      setCaissiersPageSize: s.setCaissiersPageSize,
      busyToggleUserId: s.busyToggleUserId,
      setDeactivateUserError: s.setDeactivateUserError,
      setDeactivateUserTarget: s.setDeactivateUserTarget,
      toggleCaissierActive: s.toggleCaissierActive,
      setResetPinError: s.setResetPinError,
      setResetPinValue: s.setResetPinValue,
      setResetPinTarget: s.setResetPinTarget,
      busyResetPinUserId: s.busyResetPinUserId,
      newCaissierName: s.newCaissierName,
      setNewCaissierName: s.setNewCaissierName,
      newCaissierPin: s.newCaissierPin,
      setNewCaissierPin: s.setNewCaissierPin,
      addingCaissier: s.addingCaissier,
      addCaissier: s.addCaissier,
      theme: s.theme,
    })),
  )

  const [showAddModal, setShowAddModal] = useState(false)

  const caissiersPaginated = paginateSlice(caissiers, caissiersPage, caissiersPageSize)
  const activeCount = caissiers.filter((c) => c.active).length
  const inactiveCount = caissiers.length - activeCount

  return (
    <div className="space-y-6">
      {/* ── HEADER ROW ── */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-[var(--text-h)] tracking-tighter uppercase">
            Utilisateurs
          </h2>
        </div>

        <button
          type="button"
          className="group inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[12px] font-black uppercase tracking-widest text-[#4d2600] shadow-xl shadow-[var(--accent-container)]/15 transition-all hover:brightness-110 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
          }}
          disabled={role !== 'gerant'}
          onClick={() => setShowAddModal(true)}
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Nouveau Caissier
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total',
            value: caissiers.length,
            icon: 'groups',
            color: 'var(--accent)',
          },
          {
            label: 'Actifs',
            value: activeCount,
            icon: 'person',
            color: '#10b981',
          },
          {
            label: 'Inactifs',
            value: inactiveCount,
            icon: 'person_off',
            color: '#ef4444',
          },
        ].map((s) => (
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
                <div className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--muted)]">
                  {s.label}
                </div>
                <div className="font-[var(--heading)] text-3xl font-black tabular-nums tracking-tighter text-[var(--text-h)]">
                  {s.value}
                </div>
              </div>
            </div>
            {/* Background decorative icon */}
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

      {/* ── USER CARDS GRID ── */}
      {caissiersLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl bg-[var(--card)] p-5 ring-1 ring-[color-mix(in_oklab,var(--border)_70%,transparent)]"
            >
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-[var(--surface)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-[var(--surface)]" />
                  <div className="h-3 w-16 rounded bg-[var(--surface)]" />
                </div>
              </div>
              <div className="mt-4 h-3 w-32 rounded bg-[var(--surface)]" />
              <div className="mt-4 flex gap-2">
                <div className="h-9 flex-1 rounded-xl bg-[var(--surface)]" />
                <div className="h-9 flex-1 rounded-xl bg-[var(--surface)]" />
              </div>
            </div>
          ))}
        </div>
      ) : caissiers.length === 0 ? (
        <div className="flex w-full flex-col items-center py-20">
          <div className="mb-6 flex size-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--accent-bg)] to-[color-mix(in_oklab,var(--accent-bg)_80%,var(--accent))] text-[var(--accent)] shadow-lg shadow-[var(--accent)]/10">
            <span className="material-symbols-outlined text-5xl">person_off</span>
          </div>
          <p className="mx-auto w-full max-w-md text-center font-[var(--heading)] text-xl font-black uppercase tracking-tight text-[var(--text-h)]">
            Aucun caissier
          </p>
          <p className="mx-auto mt-3 w-full max-w-md text-center text-xs leading-relaxed text-[var(--muted)] opacity-60 text-pretty">
            Ajoutez un premier compte caissier — le nom s'affiche sur les tickets et dans l'historique.
          </p>
          <button
            type="button"
            className="mt-8 inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-black text-[#4d2600] shadow-lg shadow-[var(--accent-container)]/15 transition hover:brightness-110 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
            }}
            onClick={() => setShowAddModal(true)}
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            Ajouter un caissier
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {caissiersPaginated.map((c) => (
              <div
                key={c.id}
                className={`group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklab,var(--surface)_98%,var(--card))] p-5 transition-all hover:brightness-105 hover:ring-1 hover:ring-[var(--accent)]/30 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] ${
                  c.active ? '' : 'opacity-55 grayscale-[40%]'
                }`}
              >
                {/* User Identity */}
                <div className="flex items-start gap-4">
                  <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-inner transition-colors ${
                    c.active
                      ? 'bg-[var(--accent-bg)] text-[var(--accent)] ring-[var(--accent)]/20'
                      : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--border)]'
                  }`}>
                    <span className="material-symbols-outlined text-[28px]">person</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[15px] font-black tracking-tight text-[var(--text-h)] group-hover:text-[var(--accent)] transition-colors">
                      {capitalizeFirstLetter(c.name)}
                    </h4>
                    <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ring-inset ${
                      c.active
                        ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20'
                        : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--border)]'
                    }`}>
                      <span className={`size-1.5 rounded-full ${c.active ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--muted)] opacity-40'}`} />
                      {c.active ? 'Actif' : 'Inactif'}
                    </div>
                  </div>
                </div>

                {/* Created Date */}
                <div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] border-dashed pt-4">
                  <span className="material-symbols-outlined text-[14px] text-[var(--muted)] opacity-40">calendar_today</span>
                  <span className="text-[10px] font-bold text-[var(--muted)]">
                    Créé le {formatDateHeureFr(c.createdAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                      c.active
                        ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20 hover:bg-emerald-500/15'
                        : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)] hover:text-[var(--text-h)] hover:ring-[var(--accent-border)]'
                    }`}
                    disabled={busyToggleUserId === c.id || caissiersLoading}
                    onClick={() => {
                      if (c.active) {
                        setDeactivateUserError(null)
                        setDeactivateUserTarget(c)
                      } else {
                        void toggleCaissierActive(c.id, true)
                      }
                    }}
                    aria-label={c.active ? `Désactiver ${c.name}` : `Activer ${c.name}`}
                    title={c.active ? 'Désactiver' : 'Activer'}
                  >
                    {busyToggleUserId === c.id ? (
                      <SpinnerIcon size={14} />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">
                        {c.active ? 'visibility' : 'visibility_off'}
                      </span>
                    )}
                    {c.active ? 'Actif' : 'Inactif'}
                  </button>

                  {role === 'gerant' ? (
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-bg)] py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--accent)] ring-1 ring-[var(--accent)]/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                      disabled={busyResetPinUserId === c.id || caissiersLoading}
                      onClick={() => {
                        setResetPinError(null)
                        setResetPinValue('')
                        setResetPinTarget(c)
                      }}
                      title="Réinitialiser le PIN"
                      aria-label={`Réinitialiser le PIN de ${c.name}`}
                    >
                      {busyResetPinUserId === c.id ? (
                        <SpinnerIcon size={14} />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">key</span>
                      )}
                      PIN
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <YoboPagination
            page={caissiersPage}
            totalItems={caissiers.length}
            pageSize={caissiersPageSize}
            onPageChange={setCaissiersPage}
            onPageSizeChange={setCaissiersPageSize}
          />
        </>
      )}

      {/* ── MODAL : Nouveau Compte ── */}
      <YoboModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Nouveau compte"
        subtitle="Nom court (prénom ou poste) et PIN confidentiel."
        headerEmoji="👤"
        maxWidthClass="max-w-lg"
        footer={
          <button
            type="button"
            className="yobo-modal-btn yobo-modal-btn--primary"
            disabled={addingCaissier || caissiersLoading || !newCaissierName.trim() || !newCaissierPin.trim()}
            onClick={async () => {
              await addCaissier()
              setShowAddModal(false)
            }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {addingCaissier ? (
                <SpinnerIcon size={16} />
              ) : (
                <span className="material-symbols-outlined text-[18px]">person_add</span>
              )}
              {addingCaissier ? 'Création...' : 'Créer le compte'}
            </span>
          </button>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--text-h)]" htmlFor="add-user-name">
              Nom / Identifiant
            </label>
            <YoboAlphaInput
              id="add-user-name"
              value={newCaissierName}
              onValueChange={setNewCaissierName}
              className="yobo-input w-full"
              placeholder="Prénom ou identifiant du caissier"
              keyboardMaxLength={48}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--text-h)]" htmlFor="add-user-pin">
              Code PIN
            </label>
            <YoboNumericInput
              variant="pin"
              keyboardMaxLen={12}
              value={newCaissierPin}
              onValueChange={(v) => setNewCaissierPin(v.replace(/\D/g, '').slice(0, 12))}
              className="yobo-input w-full"
              placeholder="1234"
            />
          </div>
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-[var(--accent)] opacity-60 mt-0.5">info</span>
              <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                Le code PIN est confidentiel et permet au caissier de se connecter.
                Choisissez un code facile à retenir mais difficile à deviner.
              </p>
            </div>
          </div>
        </div>
      </YoboModal>
    </div>
  )
}
