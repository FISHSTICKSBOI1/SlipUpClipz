import { useEffect, useState } from 'react'
import { isElectronApp } from '../../lib/electronBridge'
import { SettingsSectionHeader } from './SettingsSectionHeader'

type UpdateStatus =
  | 'idle'
  | 'up-to-date'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'failed'

type UpdateState = {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  progressPercent: number | null
  error: string | null
  canInstall: boolean
}

const STATUS_LABEL: Record<UpdateStatus, string> = {
  idle: 'Waiting',
  'up-to-date': 'Up to date',
  checking: 'Checking for updates',
  available: 'Update available',
  downloading: 'Downloading update',
  ready: 'Update ready',
  failed: 'Update failed',
}

const INITIAL_STATE: UpdateState = {
  status: 'idle',
  currentVersion: '—',
  availableVersion: null,
  progressPercent: null,
  error: null,
  canInstall: false,
}

export function UpdatesSection() {
  const [state, setState] = useState<UpdateState>(INITIAL_STATE)
  const [busy, setBusy] = useState(false)
  const updater = window.electronAPI?.updater

  useEffect(() => {
    if (!isElectronApp() || !updater) return

    void updater.getState().then(setState)
    return updater.onStateChange(setState)
  }, [updater])

  async function checkForUpdates() {
    if (!updater || busy) return
    setBusy(true)
    try {
      const next = await updater.check()
      setState(next)
    } finally {
      setBusy(false)
    }
  }

  function installUpdate() {
    if (!updater || !state.canInstall) return
    void updater.install()
  }

  const isDevPreview = !isElectronApp() || !updater
  const checking = state.status === 'checking' || busy
  const downloading = state.status === 'downloading'
  const showProgress =
    state.progressPercent != null &&
    (state.status === 'downloading' || state.status === 'available' || state.status === 'ready')

  return (
    <section className="panel overflow-hidden">
      <SettingsSectionHeader
        title="Updates"
        description="Check for SlipUpClipz updates from GitHub Releases."
      />

      <div className="divide-y divide-surface-border px-5 sm:px-6">
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium text-gray-200">Current version</p>
            <p className="mt-0.5 text-xs text-gray-500">Installed SlipUpClipz build</p>
          </div>
          <span className="text-sm text-gray-400">{state.currentVersion}</span>
        </div>

        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium text-gray-200">Update status</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {state.availableVersion
                ? `Newer version: ${state.availableVersion}`
                : isDevPreview
                  ? 'Updates run only in installed (packaged) builds.'
                  : 'Automatic checks run when the app starts.'}
            </p>
            {state.error ? (
              <p className="mt-2 text-xs text-red-400">{state.error}</p>
            ) : null}
          </div>
          <span className="shrink-0 text-sm text-gray-400">{STATUS_LABEL[state.status]}</span>
        </div>

        {showProgress ? (
          <div className="py-4">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>Download progress</span>
              <span>{state.progressPercent ?? 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-border">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${state.progressPercent ?? 0}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 py-4">
          <button
            type="button"
            disabled={isDevPreview || checking || downloading}
            onClick={() => void checkForUpdates()}
            className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {checking ? 'Checking…' : 'Check for Updates'}
          </button>

          {state.canInstall || state.status === 'ready' ? (
            <button
              type="button"
              disabled={isDevPreview}
              onClick={installUpdate}
              className="rounded-lg border border-accent bg-accent/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Restart and Install
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
