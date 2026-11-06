import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { upgradeNavigationState } from '@shared/upgradeNavigation'
import {
  failedDownloadFeedback,
  preparingDownloadFeedback,
  voiceInstallButton,
  voiceInstallButtonLabel,
} from '@shared/voiceInstallClick'
import { isElectronApp } from '../../lib/electronBridge'
import { TOUR_TARGET } from '../../lib/onboardingTour'
import { SettingsSectionHeader } from './SettingsSectionHeader'
import {
  VOICE_CLONING_ARCHIVE_BYTES,
  VOICE_CLONING_MIN_FREE_BYTES,
  voiceCloningStorageNote,
  voiceCloningStorageNoteVisible,
} from '@shared/voiceInstallStorage'

type AiComponentStatus = 'missing' | 'installing' | 'installed' | 'failed'

type AiComponentView = {
  status: AiComponentStatus
  distribution: 'website' | 'microsoft-store'
  progressPercent: number | null
  stage: string | null
  error: string | null
  canDownload: boolean
  canChooseFile: boolean
  requiresPro: boolean
  setupUnavailable: boolean
  updateAvailable: boolean
  runtime: 'missing' | 'ready' | 'update' | 'repair'
  downloadBytes: number
  requiredFreeBytes: number
}

const INITIAL: AiComponentView = {
  status: 'missing',
  distribution: 'website',
  progressPercent: null,
  stage: null,
  error: null,
  canDownload: false,
  canChooseFile: false,
  requiresPro: false,
  setupUnavailable: false,
  updateAvailable: false,
  runtime: 'missing',
  downloadBytes: 0,
  requiredFreeBytes: 0,
}

function formatDownloadGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

function statusLabel(state: AiComponentView): string {
  if (state.status === 'installing') return state.stage || 'Installing...'
  if (state.runtime === 'ready') return 'Ready to use'
  if (state.requiresPro) return 'Requires Pro'
  if (state.runtime === 'repair') return 'Voice Cloning needs repair'
  if (state.runtime === 'update' || state.updateAvailable) return 'Update available'
  if (state.status === 'failed') return 'Installation failed — Try Again'
  return 'Not installed'
}

export function AiRuntimeSection() {
  const navigate = useNavigate()
  const [state, setState] = useState<AiComponentView>(INITIAL)
  const component = window.electronAPI?.aiComponent
  const electron = isElectronApp() && Boolean(component)
  const stateRequest = useRef(0)

  useEffect(() => {
    if (!electron || !component) return
    let closed = false
    const apply = (next: AiComponentView) => {
      if (!closed) setState(next)
    }
    const load = () => {
      const id = ++stateRequest.current
      void component.getState().then((next) => {
        if (!closed && id === stateRequest.current) apply(next)
      })
    }
    load()
    const stopState = component.onStateChange((next) => {
      stateRequest.current += 1
      apply(next)
    })
    const stopLicense = window.electronAPI?.onLicenseChanged?.(() => load())
    return () => {
      closed = true
      stopState()
      stopLicense?.()
    }
  }, [component, electron])

  async function installVoiceCloning() {
    stateRequest.current += 1
    setState((current) => preparingDownloadFeedback(current))
    if (!component) {
      setState((current) => failedDownloadFeedback(current, 'Voice Cloning setup is temporarily unavailable.'))
      return
    }
    try {
      const result = await component.download()
      stateRequest.current += 1
      if (!result?.ok) {
        setState((current) => failedDownloadFeedback(current, result?.error ?? ''))
      } else {
        const id = ++stateRequest.current
        const next = await component.getState()
        if (id === stateRequest.current) setState(next)
      }
    } catch {
      stateRequest.current += 1
      setState((current) => failedDownloadFeedback(current, ''))
    }
  }

  const installing = state.status === 'installing'
  const requiredBytes = state.requiredFreeBytes > 0 ? state.requiredFreeBytes : VOICE_CLONING_MIN_FREE_BYTES
  const archiveBytes = state.downloadBytes > 0 ? state.downloadBytes : VOICE_CLONING_ARCHIVE_BYTES
  const downloadSize = formatDownloadGb(archiveBytes)
  const showInstallRequirements = voiceCloningStorageNoteVisible(state.distribution)
  const installButton = voiceInstallButton({
    status: state.status,
    runtime: state.runtime,
    canDownload: state.canDownload,
  })
  const ready = state.runtime === 'ready' && !installing

  return (
    <section className="panel overflow-hidden" data-tour={TOUR_TARGET.aiVoice}>
      <SettingsSectionHeader
        title="AI Voice Clip Cloning"
        description="Create new voice clips with AI and save them to your soundboard."
      />
      <div className="space-y-3 px-5 py-4 sm:px-6">
        <p className={`text-sm font-medium ${ready ? 'text-emerald-300' : 'text-white'}`}>
          {electron ? statusLabel(state) : 'Not installed'}
        </p>
        {ready ? (
          <p className="text-sm text-emerald-200/80">Voice Cloning is installed and ready.</p>
        ) : null}
        {showInstallRequirements ? (
          <>
            <p className="text-sm text-gray-300">{voiceCloningStorageNote(requiredBytes, state.runtime)}</p>
            {downloadSize && !ready ? (
              <p className="text-sm text-gray-300">
                Download size: about {downloadSize}.
                {installButton === 'install' ? ' Nothing downloads until you choose Install Voice Cloning.' : ''}
              </p>
            ) : null}
          </>
        ) : null}
        {showInstallRequirements && !ready ? (
          <p className="text-sm text-gray-300">Needs a compatible NVIDIA graphics card.</p>
        ) : null}
        {state.requiresPro ? null : state.setupUnavailable ? (
          <p className="text-sm text-gray-300">Voice Cloning setup is temporarily unavailable.</p>
        ) : state.distribution === 'microsoft-store' && state.status !== 'installed' ? (
          <p className="text-sm text-gray-300">Voice Cloning is not included in this installation.</p>
        ) : null}
        {state.stage && statusLabel(state) !== state.stage ? (
          <p className="text-xs text-gray-400">{state.stage}</p>
        ) : null}
        {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
        {installing && state.progressPercent != null ? (
          <div className="h-2 overflow-hidden rounded-full bg-surface-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${state.progressPercent}%` }} />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {state.requiresPro && electron ? (
            <button
              type="button"
              onClick={() => navigate('/settings', { state: upgradeNavigationState() })}
              className="rounded-lg border border-accent bg-accent/20 px-3 py-2 text-xs font-medium text-white"
            >
              Upgrade to Pro
            </button>
          ) : null}
          {installButton !== 'none' ? (
            <button
              type="button"
              disabled={installing}
              onClick={() => void installVoiceCloning()}
              className="rounded-lg border border-accent bg-accent/20 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {voiceInstallButtonLabel(installButton)}
            </button>
          ) : null}
          {installing ? (
            <button
              type="button"
              onClick={() => void component?.cancel()}
              className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-xs font-medium text-gray-200"
            >
              Cancel
            </button>
          ) : null}
        </div>
        {state.canChooseFile ? (
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer">Troubleshooting</summary>
            <button
              type="button"
              disabled={installing}
              onClick={() => void component?.chooseFile()}
              className="mt-2 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-xs font-medium text-gray-200 disabled:opacity-40"
            >
              Choose a local package
            </button>
          </details>
        ) : null}
      </div>
    </section>
  )
}
