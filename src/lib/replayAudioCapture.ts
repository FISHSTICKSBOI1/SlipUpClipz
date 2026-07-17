import { isElectronApp } from './electronBridge'
import { logClipPipeline, logClipPipelineError } from './clipPipelineLog'

export type ReplayCaptureConfig = {
  source: 'microphone' | 'system' | 'virtual'
  virtualAudioInputDeviceId: string | null
}

export const VB_CABLE_SETUP_MESSAGE =
  'System audio loopback is unavailable on this device. Install VB-Audio Virtual Cable ' +
  '(or VoiceMeeter), set your Windows playback device to CABLE Input, route game/Discord audio ' +
  'through it, then choose Virtual Audio Device as the replay audio source in Settings.'

const AUDIO_CAPTURE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true,
}

export async function queryMicrophonePermission():
  Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (!navigator.permissions?.query) return 'unknown'

  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    })
    return status.state
  } catch {
    return 'unknown'
  }
}

export async function resolveAudioInputLabel(track: MediaStreamTrack): Promise<string> {
  if (track.label.trim()) return track.label

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const deviceId = track.getSettings().deviceId
    const match = devices.find(
      (device) => device.kind === 'audioinput' && device.deviceId === deviceId,
    )
    if (match?.label) return match.label
  } catch {
    // Fall through to generic label.
  }

  return 'Audio input'
}

function validateLiveAudioTrack(stream: MediaStream): MediaStreamTrack | null {
  const track = stream.getAudioTracks()[0]
  if (!track) return null
  if (track.readyState !== 'live' || !track.enabled) return null
  return track
}

function stripVideoTracks(stream: MediaStream): void {
  for (const track of stream.getVideoTracks()) {
    track.stop()
    stream.removeTrack(track)
  }
}

export async function acquireMicrophoneStream(): Promise<{
  stream: MediaStream
  label: string
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: AUDIO_CAPTURE_CONSTRAINTS,
  })

  const track = validateLiveAudioTrack(stream)
  if (!track) {
    stream.getTracks().forEach((entry) => entry.stop())
    throw new DOMException('Microphone track is not live.', 'NotReadableError')
  }

  const label = await resolveAudioInputLabel(track)
  logClipPipeline('capture:microphone', { label, deviceId: track.getSettings().deviceId })
  return { stream, label }
}

export async function acquireSystemAudioStream(): Promise<{
  stream: MediaStream
  label: string
}> {
  if (!isElectronApp() || !window.electronAPI?.systemAudio) {
    throw new Error(VB_CABLE_SETUP_MESSAGE)
  }

  const capabilities = await window.electronAPI.systemAudio.getCapabilities()
  if (!capabilities.loopbackSupported) {
    throw new Error(VB_CABLE_SETUP_MESSAGE)
  }

  await window.electronAPI.systemAudio.enableLoopback()

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })

    stripVideoTracks(stream)

    const track = validateLiveAudioTrack(stream)
    if (!track) {
      stream.getTracks().forEach((entry) => entry.stop())
      throw new Error(VB_CABLE_SETUP_MESSAGE)
    }

    const label = track.label.trim() || 'System Audio (WASAPI loopback)'
    logClipPipeline('capture:systemLoopback', {
      label,
      trackState: track.readyState,
      platform: capabilities.platform,
    })

    return { stream, label }
  } catch (error) {
    logClipPipelineError('capture:systemLoopbackFailed', error, {})
    await window.electronAPI.systemAudio.disableLoopback()
    throw new Error(VB_CABLE_SETUP_MESSAGE)
  }
}

export async function acquireVirtualAudioStream(deviceId: string): Promise<{
  stream: MediaStream
  label: string
}> {
  if (!deviceId) {
    throw new Error(
      'Select a virtual audio input device in Settings (for example VB-Audio CABLE Output or VoiceMeeter).',
    )
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })

  const track = validateLiveAudioTrack(stream)
  if (!track) {
    stream.getTracks().forEach((entry) => entry.stop())
    throw new DOMException('Virtual audio track is not live.', 'NotReadableError')
  }

  const label = await resolveAudioInputLabel(track)
  logClipPipeline('capture:virtualDevice', { label, deviceId })
  return { stream, label }
}

export async function releaseSystemAudioCapture(): Promise<void> {
  if (isElectronApp() && window.electronAPI?.systemAudio) {
    await window.electronAPI.systemAudio.disableLoopback()
  }
}

export function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone permission was denied. Allow access in system settings and reload the app.'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No microphone was found. Connect a microphone and try again.'
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'Microphone is in use by another app or unavailable.'
    }
    if (error.name === 'SecurityError') {
      return 'Microphone access is blocked in this environment.'
    }
    if (error.message) return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Microphone access is unavailable.'
}

export async function acquireReplayCaptureStream(
  config: ReplayCaptureConfig,
): Promise<{ stream: MediaStream; label: string }> {
  if (config.source === 'system') {
    return acquireSystemAudioStream()
  }

  if (config.source === 'virtual') {
    return acquireVirtualAudioStream(config.virtualAudioInputDeviceId ?? '')
  }

  return acquireMicrophoneStream()
}
