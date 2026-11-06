export type AudioOutputDevice = {
  deviceId: string
  label: string
  isVBCable: boolean
  isVoiceMeeter: boolean
  isRecommendedVirtual: boolean
}

export type VirtualAudioInputDevice = {
  deviceId: string
  label: string
  isVBCable: boolean
  isVoiceMeeter: boolean
}

export type AudioInputDevice = {
  deviceId: string
  label: string
}

export const VB_AUDIO_CABLE_URL = 'https://vb-audio.com/Cable/'

const VB_CABLE_OUTPUT_HINTS = ['cable input', 'vb-audio', 'vb audio', 'virtual cable', 'vb cable']
const VIRTUAL_OUTPUT_HINTS = [
  ...VB_CABLE_OUTPUT_HINTS,
  'voicemeeter',
  'voice meeter',
  'virtual audio',
]
const VIRTUAL_INPUT_HINTS = [
  'cable output',
  'vb-audio',
  'vb audio',
  'virtual cable',
  'voicemeeter',
  'voice meeter',
  'vb cable',
]

export function isVBCableLabel(label: string): boolean {
  const lower = label.toLowerCase()
  return VB_CABLE_OUTPUT_HINTS.some((hint) => lower.includes(hint))
}

export function isVoiceMeeterLabel(label: string): boolean {
  const lower = label.toLowerCase()
  return lower.includes('voicemeeter') || lower.includes('voice meeter')
}

export function isVirtualAudioOutputLabel(label: string): boolean {
  const lower = label.toLowerCase()
  return VIRTUAL_OUTPUT_HINTS.some((hint) => lower.includes(hint))
}

export function isVirtualAudioInputLabel(label: string): boolean {
  const lower = label.toLowerCase()
  return VIRTUAL_INPUT_HINTS.some((hint) => lower.includes(hint))
}

async function microphonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

let permissionRequest: Promise<void> | null = null

async function ensureDevicePermission(): Promise<void> {
  if (!navigator.mediaDevices?.enumerateDevices || !navigator.mediaDevices.getUserMedia) return

  try {
    const existing = await navigator.mediaDevices.enumerateDevices()
    if (existing.some((device) => device.label)) return
  } catch {
    // Fall through and ask once if labels are still hidden.
  }

  if ((await microphonePermission()) === 'denied') return
  if (permissionRequest) {
    await permissionRequest
    return
  }

  permissionRequest = navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((track) => track.stop())
    })
    .catch(() => {
      // Labels may remain blank without permission.
    })
    .finally(() => {
      permissionRequest = null
    })
  await permissionRequest
}

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  await ensureDevicePermission()
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
    }))
}

export async function listAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return []
  }

  await ensureDevicePermission()

  const devices = await navigator.mediaDevices.enumerateDevices()

  return devices
    .filter((device) => device.kind === 'audiooutput')
    .map((device) => {
      const label = device.label || `Output ${device.deviceId.slice(0, 8)}`
      const isVBCable = isVBCableLabel(label)
      const isVoiceMeeter = isVoiceMeeterLabel(label)
      return {
        deviceId: device.deviceId,
        label,
        isVBCable,
        isVoiceMeeter,
        isRecommendedVirtual: isVBCable || isVoiceMeeter || isVirtualAudioOutputLabel(label),
      }
    })
}

export async function listVirtualAudioInputDevices(): Promise<VirtualAudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return []
  }

  await ensureDevicePermission()

  const devices = await navigator.mediaDevices.enumerateDevices()

  return devices
    .filter((device) => device.kind === 'audioinput')
    .filter((device) => isVirtualAudioInputLabel(device.label))
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label || `Input ${device.deviceId.slice(0, 8)}`,
      isVBCable:
        isVBCableLabel(device.label) || device.label.toLowerCase().includes('cable output'),
      isVoiceMeeter: isVoiceMeeterLabel(device.label),
    }))
}

export function findPreferredVBCableDevice(
  devices: AudioOutputDevice[],
): AudioOutputDevice | undefined {
  const exact = devices.find((device) => {
    const lower = device.label.toLowerCase()
    return lower.includes('cable input') && !/16\s*ch/i.test(lower)
  })
  if (exact) return exact
  return (
    devices.find((device) => device.isVBCable && !/16\s*ch/i.test(device.label)) ??
    devices.find((device) => device.isVBCable)
  )
}

export function findRecommendedVirtualOutputDevices(
  devices: AudioOutputDevice[],
): AudioOutputDevice[] {
  return devices.filter((device) => device.isRecommendedVirtual)
}

export function hasRecommendedVirtualOutput(devices: AudioOutputDevice[]): boolean {
  return findRecommendedVirtualOutputDevices(devices).length > 0
}

export function getOutputDeviceLabel(
  devices: AudioOutputDevice[],
  deviceId: string | null,
): string {
  if (!deviceId) return 'System default'
  const match = devices.find((device) => device.deviceId === deviceId)
  return match?.label ?? 'Unknown device'
}

export function formatOutputDeviceOptionLabel(device: AudioOutputDevice): string {
  if (device.isRecommendedVirtual) {
    if (device.isVBCable) return `${device.label} (Recommended · VB-Cable)`
    if (device.isVoiceMeeter) return `${device.label} (Recommended · VoiceMeeter)`
    return `${device.label} (Recommended)`
  }
  return device.label
}

export type OutputDeviceValidation = {
  streamDeviceId: string | null
  storedDeviceValid: boolean
  vbCableAvailable: boolean
  routeToVBCableEffective: boolean
  missingStoredDeviceId: string | null
  missingStoredDeviceLabel: string | null
  missingVBCable: boolean
}

export function validateOutputRouting(
  devices: AudioOutputDevice[],
  settings: {
    routeToVBCable: boolean
    audioOutputDeviceId: string | null
  },
): OutputDeviceValidation {
  const vbCable = findPreferredVBCableDevice(devices)
  const vbCableAvailable = !!vbCable

  let storedDeviceValid = true
  let missingStoredDeviceId: string | null = null
  let missingStoredDeviceLabel: string | null = null

  if (settings.audioOutputDeviceId) {
    const match = devices.find((device) => device.deviceId === settings.audioOutputDeviceId)
    if (!match) {
      storedDeviceValid = false
      missingStoredDeviceId = settings.audioOutputDeviceId
      missingStoredDeviceLabel = `Device ${settings.audioOutputDeviceId.slice(0, 8)}`
    }
  }

  const routeToVBCableEffective = settings.routeToVBCable && vbCableAvailable
  const missingVBCable = settings.routeToVBCable && !vbCableAvailable

  let streamDeviceId: string | null = null
  if (routeToVBCableEffective) {
    streamDeviceId = vbCable?.deviceId ?? null
  } else if (settings.audioOutputDeviceId && storedDeviceValid) {
    streamDeviceId = settings.audioOutputDeviceId
  }

  return {
    streamDeviceId,
    storedDeviceValid,
    vbCableAvailable,
    routeToVBCableEffective,
    missingStoredDeviceId,
    missingStoredDeviceLabel,
    missingVBCable,
  }
}

export function resolveOutputDeviceId(
  devices: AudioOutputDevice[],
  settings: {
    routeToVBCable: boolean
    audioOutputDeviceId: string | null
  },
): string | null {
  return validateOutputRouting(devices, settings).streamDeviceId
}

export function subscribeToAudioDeviceChanges(listener: () => void): () => void {
  if (!navigator.mediaDevices?.addEventListener) {
    return () => {}
  }

  navigator.mediaDevices.addEventListener('devicechange', listener)
  return () => navigator.mediaDevices.removeEventListener('devicechange', listener)
}
