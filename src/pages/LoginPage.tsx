import { getVersion } from '@tauri-apps/api/app'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { YoboAlphaInput, YoboNumericInput } from '../components/YoboKeyboardInputs'
import { SpinnerIcon } from '../components/icons/SpinnerIcon'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import { isNonEmpty } from '../lib/yoboStrings'
import { useYoboStore } from '../store'

const SPLASH_MIN_MS = 2000
const SPLASH_MIN_MS_REDUCED = 450
const LOGIN_SPLASH_FADE_MS = 480

const YOBO_BRAND_SRC = '/logo.png'

export function LoginPage() {
  const [splashMounted, setSplashMounted] = useState(true)
  const [splashExiting, setSplashExiting] = useState(false)
  const [splashLogoReady, setSplashLogoReady] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    // On essaie de récupérer la version
    if (isTauriRuntime()) {
      void getVersion().then((v) => setAppVersion(v))
    } else {
      // On évite l'appel synchrone direct pour ESLint
      void Promise.resolve().then(() => setAppVersion('2.6.0-dev'))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let fadeTimer: number

    const finish = () => {
      if (cancelled) return
      setSplashExiting(true)
      fadeTimer = window.setTimeout(() => {
        if (!cancelled) setSplashMounted(false)
      }, LOGIN_SPLASH_FADE_MS)
    }

    const run = async () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const minMs = reduced ? SPLASH_MIN_MS_REDUCED : SPLASH_MIN_MS
      const t0 = performance.now()
      try {
        await document.fonts.ready
      } catch {
        /* ignore */
      }
      const elapsed = performance.now() - t0
      const wait = Math.max(0, minMs - elapsed)
      await new Promise<void>((r) => {
        window.setTimeout(r, wait)
      })
      if (!cancelled) finish()
    }

    void run()
    return () => {
      cancelled = true
      window.clearTimeout(fadeTimer)
    }
  }, [])

  const {
    identifier,
    setIdentifier,
    pin,
    setPin,
    role,
    setRole,
    login,
    loginLoading,
  } = useYoboStore(
    useShallow((s) => ({
      identifier: s.identifier,
      setIdentifier: s.setIdentifier,
      pin: s.pin,
      setPin: s.setPin,
      role: s.role,
      setRole: s.setRole,
      theme: s.theme,
      themePreference: s.themePreference,
      toggleTheme: s.toggleTheme,
      login: s.login,
      loginLoading: s.loginLoading,
    })),
  )

  const canLogin = isNonEmpty(identifier) && isNonEmpty(pin)

  const fieldClass =
    'w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-3.5 pl-12 pr-4 text-[var(--text-h)] placeholder:text-[var(--muted)]/50 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25 text-base'

  return (
    <>
      {splashMounted ? (
        <div
          className={`login-page-splash ${splashExiting ? 'login-page-splash--out' : ''}`}
          style={{ transitionDuration: `${LOGIN_SPLASH_FADE_MS}ms` }}
          role="status"
          aria-live="polite"
          aria-busy={!splashExiting}
        >
          <div className="login-page-splash-logo-slot">
            <img
              className="login-page-brand-img login-page-brand-img--splash"
              src={YOBO_BRAND_SRC}
              alt="YOBO"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setSplashLogoReady(true)}
              onError={() => setSplashLogoReady(true)}
            />
          </div>
          {splashLogoReady ? (
            <>
              <div className="login-page-splash-sub">Gestion snack</div>
              <div className="login-page-splash-dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <main className="login-gate flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden lg:flex-row lg:overflow-hidden">
        {/* Colonne marque — bord à bord gauche, pleine largeur mobile */}
        <section
          className="login-gate__brand relative flex min-h-[38vh] shrink-0 flex-col justify-center overflow-hidden border-b border-[var(--border)] bg-[var(--surface)] px-7 py-12 sm:px-10 sm:py-14 lg:min-h-0 lg:w-[min(44%,30rem)] lg:flex-none lg:border-b-0 lg:border-r lg:px-12 lg:py-10 xl:w-[min(40%,34rem)] xl:px-14"
          aria-hidden={false}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-100"
            style={{
              background:
                'radial-gradient(ellipse 130% 90% at -15% 10%, color-mix(in oklab, var(--accent) 26%, transparent) 0%, transparent 58%), radial-gradient(ellipse 100% 80% at 110% 85%, color-mix(in oklab, var(--accent-container) 20%, transparent) 0%, transparent 52%), linear-gradient(168deg, var(--surface) 0%, color-mix(in oklab, var(--card) 82%, var(--bg)) 55%, var(--bg) 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.2]"
            style={{
              backgroundImage:
                'radial-gradient(circle at center, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-[12%] left-0 hidden w-[3px] rounded-r-full lg:block"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, var(--accent) 35%, var(--accent-container) 70%, transparent 100%)',
              boxShadow: '0 0 18px color-mix(in oklab, var(--accent) 45%, transparent)',
            }}
          />
          <div className="pointer-events-none absolute -right-24 top-1/2 h-[min(70%,28rem)] w-[min(55vw,22rem)] -translate-y-1/2 rounded-full border border-[color-mix(in_oklab,var(--accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] opacity-50 blur-sm" aria-hidden />
          <div className="pointer-events-none absolute -left-8 top-[18%] size-24 rounded-full bg-[var(--accent)] opacity-[0.07] blur-2xl" aria-hidden />

          <div className="relative z-[1] mx-auto flex w-full max-w-[20rem] flex-col items-center text-center sm:max-w-[22rem] xl:max-w-[24rem]">
            <img
              alt="YOBO"
              className="login-gate__logo-img mb-8 h-auto w-[min(12rem,72vw)] max-w-[230px] object-contain drop-shadow-[0_14px_40px_rgba(0,0,0,0.38)] sm:mb-9 sm:w-[min(13rem,68vw)] sm:max-w-[250px]"
              src={YOBO_BRAND_SRC}
              decoding="async"
            />
            <h1 className="mt-3 font-[var(--heading)] text-[1.85rem] font-black leading-[1.1] tracking-tight text-[var(--text-h)] sm:text-4xl sm:leading-[1.08]">
              Connexion
            </h1>
            <div
              className="mx-auto mt-5 h-0.5 w-14 rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--accent) 0%, color-mix(in oklab, var(--accent-container) 70%, transparent) 100%)',
              }}
              aria-hidden
            />
            <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
              {[
                { icon: 'point_of_sale', label: 'Caisse' },
                { icon: 'restaurant_menu', label: 'Menu' },
                { icon: 'history', label: 'Historique' },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--border)_85%,var(--accent)_15%)] bg-[color-mix(in_oklab,var(--card)_70%,transparent)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-h)] shadow-sm backdrop-blur-[2px]"
                >
                  <span className="material-symbols-outlined text-[16px] text-[var(--accent)]">{icon}</span>
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-8 flex w-full flex-col items-center gap-3 border-t border-[color-mix(in_oklab,var(--border)_65%,transparent)] pt-6">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent)] ring-1 ring-[color-mix(in_oklab,var(--accent)_22%,var(--border))]"
                aria-hidden
              >
                <span className="material-symbols-outlined text-[26px]">bolt</span>
              </span>
              {appVersion ? (
                <p className="text-center font-[var(--label)] text-[10px] tabular-nums tracking-wide text-[var(--muted)]">
                  Version {appVersion}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Colonne formulaire — pleine largeur, sans gouttière externe */}
        <section className="login-gate__form flex min-h-0 flex-1 flex-col justify-center bg-[var(--bg)] px-8 py-10 sm:px-12 sm:py-12 lg:px-16 lg:py-8 xl:px-24 xl:py-10">
          <div className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl">
            <div className="mb-8" />

            <form
              className="space-y-7"
              onSubmit={(e) => {
                e.preventDefault()
                if (!canLogin) return
                void login()
              }}
            >
              <div>
                <span className="mb-2 block font-[var(--label)] text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Profil
                </span>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_55%,var(--card))] p-1.5">
                  <label className="cursor-pointer">
                    <input
                      className="sr-only"
                      name="role"
                      type="radio"
                      value="caissier"
                      checked={role === 'caissier'}
                      onChange={() => setRole('caissier')}
                    />
                    <div
                      className={`flex flex-col items-center gap-1 rounded-xl py-3 text-center transition ${
                        role === 'caissier'
                          ? 'bg-[var(--accent)] text-[#4d2600] shadow-md shadow-[var(--accent-container)]/20'
                          : 'text-[var(--muted)] hover:bg-[var(--card)]'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[22px] ${role === 'caissier' ? 'text-[#4d2600]' : ''}`}
                      >
                        storefront
                      </span>
                      <span className="text-xs font-black uppercase tracking-tight">Caissier</span>
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      className="sr-only"
                      name="role"
                      type="radio"
                      value="gerant"
                      checked={role === 'gerant'}
                      onChange={() => setRole('gerant')}
                    />
                    <div
                      className={`flex flex-col items-center gap-1 rounded-xl py-3 text-center transition ${
                        role === 'gerant'
                          ? 'bg-[var(--accent)] text-[#4d2600] shadow-md shadow-[var(--accent-container)]/20'
                          : 'text-[var(--muted)] hover:bg-[var(--card)]'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[22px] ${role === 'gerant' ? 'text-[#4d2600]' : ''}`}
                      >
                        admin_panel_settings
                      </span>
                      <span className="text-xs font-black uppercase tracking-tight">Gérant</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label
                    className="mb-1.5 block font-[var(--label)] text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]"
                    htmlFor="login-identifier"
                  >
                    Identifiant
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[var(--muted)]">
                      person
                    </span>
                    <YoboAlphaInput
                      id="login-identifier"
                      className={fieldClass}
                      placeholder="Nom d'utilisateur"
                      value={identifier}
                      onValueChange={setIdentifier}
                      autoComplete="off"
                      name="yobo-no-save-identifier"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      keyboardMaxLength={48}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="mb-1.5 block font-[var(--label)] text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]"
                    htmlFor="login-pin"
                  >
                    Code PIN
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[var(--muted)]">
                      lock
                    </span>
                    <YoboNumericInput
                      id="login-pin"
                      className={`${fieldClass} pr-12`}
                      placeholder="••••"
                      variant="pin"
                      keyboardMaxLen={12}
                      maskPin={!showPin}
                      value={pin}
                      onValueChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 12))}
                      autoComplete="new-password"
                      name="yobo-no-save-pin"
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text-h)]"
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      aria-label={showPin ? 'Masquer le PIN' : 'Afficher le PIN'}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {showPin ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="w-full rounded-full py-4 text-sm font-black uppercase tracking-widest text-[#4d2600] shadow-lg shadow-[var(--accent-container)]/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)',
                }}
                type="submit"
                disabled={!canLogin || loginLoading}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loginLoading ? <SpinnerIcon size={18} /> : <span className="material-symbols-outlined text-[20px]">login</span>}
                  {loginLoading ? 'Connexion…' : 'Se connecter'}
                </span>
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  )
}
