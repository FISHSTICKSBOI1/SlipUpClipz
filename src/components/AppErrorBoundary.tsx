import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

/**
 * Catches renderer runtime crashes so the window shows a readable message
 * instead of a blank/black screen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) {
      return this.props.children
    }

    return (
      <div
        style={{
          boxSizing: 'border-box',
          minHeight: '100%',
          padding: '32px 28px',
          background: '#090b12',
          color: '#d5dced',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#fff' }}>
          SlipUpClipz hit a runtime error
        </h1>
        <p style={{ marginTop: 10, maxWidth: 520, lineHeight: 1.5, color: '#94a0b8' }}>
          The UI crashed while loading. Open DevTools Console for the full stack, or reload after
          fixing the module error below.
        </p>
        <pre
          style={{
            marginTop: 20,
            padding: 16,
            overflow: 'auto',
            borderRadius: 12,
            border: '1px solid #2a3148',
            background: '#10131c',
            color: '#fca5a5',
            fontSize: 12,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error.name}: {error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 20,
            border: 0,
            borderRadius: 10,
            padding: '10px 16px',
            background: '#7c5cff',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload app
        </button>
      </div>
    )
  }
}
