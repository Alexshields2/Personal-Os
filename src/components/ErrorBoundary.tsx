import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * A crash anywhere under React used to unmount the whole tree, which on a
 * black theme is a black page with nothing to tap and no clue why. This keeps
 * the crash inside the screen that caused it, says what broke, and offers a
 * way out. Nothing logged is lost — the store writes on every change, so the
 * data is already saved by the time anything renders.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void; resetLabel?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const { onReset, resetLabel = 'Back to Today' } = this.props

    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }} role="alert">
        <div className="card card-pad">
          <div className="t-cap" style={{ color: 'var(--accent)' }}>
            Something broke
          </div>
          <div className="t-head" style={{ marginTop: 6 }}>
            This screen hit an error
          </div>
          <p className="t-foot muted" style={{ marginTop: 8 }}>
            Everything you have logged is saved. Go back and carry on, or reload.
          </p>
          <pre
            className="t-foot muted"
            style={{ marginTop: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {error.message}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {onReset && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ error: null })
                  onReset()
                }}
              >
                {resetLabel}
              </button>
            )}
            <button className="btn" onClick={() => window.location.reload()}>
              Reload the app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
