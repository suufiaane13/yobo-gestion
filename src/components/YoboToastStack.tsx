import { useYoboStore } from '../store'

export function YoboToastStack() {
  const toasts = useYoboStore((s) => s.toasts)
  const dismissToast = useYoboStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div
      className="yobo-toast-stack"
      role="region"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map((t) => (
        <div key={t.id} className={`yobo-toast yobo-toast--${t.type}`}>
          <div className="yobo-toast__icon" aria-hidden>
            <span className="material-symbols-outlined">
              {t.type === 'success' ? 'check_circle' : t.type === 'warning' ? 'warning' : 'error'}
            </span>
          </div>
          <div className="yobo-toast__message">{t.message}</div>
          <button
            type="button"
            className="yobo-toast__close"
            aria-label="Fermer"
            onClick={() => dismissToast(t.id)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}
