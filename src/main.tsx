import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('SlipUpClipz root element #root was not found.')
}

const root = createRoot(rootElement)

function renderBootFailure(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  root.render(
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
        SlipUpClipz failed to load
      </h1>
      <p style={{ marginTop: 10, maxWidth: 520, lineHeight: 1.5, color: '#94a0b8' }}>
        A module failed while starting the renderer. This is usually a missing export or a stale
        Vite/Electron session — reload after the fix lands.
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
        {message}
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
    </div>,
  )
}

void import('./App')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <HashRouter>
            <App />
          </HashRouter>
        </AppErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    console.error('[boot]', error)
    renderBootFailure(error)
  })
