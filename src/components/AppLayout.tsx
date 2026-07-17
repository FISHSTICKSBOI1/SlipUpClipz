import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAppSettings } from '../context/AppSettingsContext'
import { isElectronApp } from '../lib/electronBridge'
import { Sidebar } from './Sidebar'
import { RightPanel } from './RightPanel'

const TITLE_BY_PATH: Record<string, string> = {
  '/': 'Home',
  '/clips': 'Clips',
  '/soundboard': 'Soundboard',
  '/settings': 'Settings',
}

export function AppLayout() {
  const { settings } = useAppSettings()
  const location = useLocation()
  const pageName = TITLE_BY_PATH[location.pathname] ?? 'Workspace'
  const [isFullScreen, setIsFullScreen] = useState(false)

  useEffect(() => {
    if (!isElectronApp() || !window.electronAPI?.window) return

    void window.electronAPI.window.getState().then((state) => {
      setIsFullScreen(state.isFullScreen)
    })

    return window.electronAPI.window.onStateChange((state) => {
      setIsFullScreen(state.isFullScreen)
    })
  }, [])

  return (
    <div className={`app-shell ${isFullScreen ? 'app-shell--fullscreen' : ''}`}>
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {!isFullScreen && (
          <header className="app-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden h-8 w-1 rounded-full bg-gradient-to-b from-accent to-accent-blue sm:block" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint">
                  SlipUpClipz
                </p>
                <p className="truncate text-sm font-semibold text-white">{pageName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge-idle hidden sm:inline-flex">Windows desktop</span>
              <span className="badge-accent">Ready</span>
            </div>
          </header>
        )}

        <div className="flex min-h-0 flex-1">
          <main className="app-main">
            <Outlet />
          </main>

          {settings.showRightPanel ? <RightPanel /> : null}
        </div>
      </div>
    </div>
  )
}
