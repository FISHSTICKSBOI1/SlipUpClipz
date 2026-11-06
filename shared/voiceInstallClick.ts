export const PREPARING_DOWNLOAD_STAGE = 'Preparing download...'

export type VoiceInstallFeedback = {
  status: 'missing' | 'installing' | 'installed' | 'failed'
  stage: string | null
  error: string | null
  progressPercent: number | null
}

/** Visible state for the instant a Pro user clicks Install Voice Cloning. */
export function preparingDownloadFeedback<T extends VoiceInstallFeedback>(state: T): T {
  return {
    ...state,
    status: 'installing',
    stage: PREPARING_DOWNLOAD_STAGE,
    error: null,
    progressPercent: 0,
  }
}

/** Every failed click must leave a message on screen. An empty failure still does. */
export function failedDownloadFeedback<T extends VoiceInstallFeedback>(state: T, error: string): T {
  const message = error.trim() || 'Installation failed. Try again.'
  return {
    ...state,
    status: 'failed',
    stage: null,
    error: message,
    progressPercent: null,
  }
}

export type VoiceInstallButton = 'install' | 'retry' | 'update' | 'repair' | 'none'

/** The install control follows the files on disk, not only whether a Pro download is allowed. */
export function voiceInstallButton(input: {
  status: 'missing' | 'installing' | 'installed' | 'failed'
  runtime: 'missing' | 'ready' | 'update' | 'repair'
  canDownload: boolean
}): VoiceInstallButton {
  if (input.status === 'installing') return 'none'
  if (input.runtime === 'ready') return 'none'
  if (!input.canDownload) return 'none'
  if (input.runtime === 'update') return 'update'
  if (input.runtime === 'repair') return 'repair'
  if (input.status === 'failed') return 'retry'
  return 'install'
}

export function voiceInstallButtonLabel(button: VoiceInstallButton): string {
  if (button === 'retry') return 'Try Again'
  if (button === 'update') return 'Update Voice Cloning'
  if (button === 'repair') return 'Repair'
  return 'Install Voice Cloning'
}

/** A healthy runtime must not start another archive download. A second click during install is ignored. */
export function voiceDownloadDecision(input: {
  alreadyInstalling: boolean
  runtime: 'missing' | 'ready' | 'update' | 'repair'
}): 'busy' | 'already-installed' | 'download' {
  if (input.alreadyInstalling) return 'busy'
  if (input.runtime === 'ready') return 'already-installed'
  return 'download'
}
