import { Component, type ErrorInfo, type ReactNode } from 'react'
import { client } from '../lib/yoboClientMessages'

type Props = { children: ReactNode }

type State = {
  hasError: boolean
  message: string
}

export class YoboErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: import.meta.env.DEV ? error.message?.trim() || 'Erreur.' : client.error.boundaryTitle,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[yobo] YoboErrorBoundary', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-[100svh] flex-col items-center justify-center gap-6 bg-[var(--bg)] p-8 text-center text-[var(--text-h)]"
          role="alert"
        >
          <div>
            <h1 className="text-xl font-bold tracking-tight">{client.error.boundaryTitle}</h1>
            <p className="mt-3 max-w-md text-sm text-[var(--muted)]">{client.error.boundaryHint}</p>
          </div>
          {import.meta.env.DEV ? (
            <pre className="max-h-40 max-w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-xs text-[var(--danger)]">
              {this.state.message}
            </pre>
          ) : null}
          <button
            type="button"
            className="yobo-btn-accent px-6 py-2.5"
            onClick={() => window.location.reload()}
          >
            {client.error.boundaryReload}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
