/**
 * Rolling replay audio as PCM, then a self-contained WAV clip.
 *
 * A 30 second stereo buffer at 48 kHz is about 11 MB of float samples.
 * The saved clip is 16-bit PCM for the requested window only (about 1.4 MB
 * for 15 seconds of mono audio). That matches the editor's existing WAV
 * trims, avoids a second lossy encode, and stays valid after the window rolls.
 */

export const MAX_REPLAY_SECONDS = 30
export const INSTANT_REPLAY_SECONDS = 0.25
export const MIC_TEST_SECONDS = 5
export const SILENCE_PEAK_THRESHOLD = 0.001

export const SILENT_MIC_TEST_MESSAGE =
  'Microphone test finished, but the recording was silent. Check Windows microphone privacy settings and the selected input device.'

export type PcmRing = {
  sampleRate: number
  channelCount: number
  capacity: number
  channels: Float32Array[]
  writeIndex: number
  stored: number
  totalFramesWritten: number
}

export type WavValidation =
  | { ok: true; durationMs: number; frameCount: number; sampleRate: number; channelCount: number }
  | { ok: false; error: string }

export type MicTestClassification =
  | { kind: 'ok' }
  | { kind: 'silent'; message: string }
  | { kind: 'undecodable'; message: string }
  | { kind: 'empty'; message: string }

/** Choosing a microphone stores that device and leaves the replay source unchanged. */
export function microphoneChoicePatch(deviceId: string): { audioInputDeviceId: string | null } {
  return { audioInputDeviceId: deviceId ? deviceId : null }
}

/** Saved choice and the device actually capturing, which can differ. */
export function replayMicrophoneStatus(input: {
  source: 'microphone' | 'system' | 'virtual'
  savedPresent: boolean
  savedLabel: string
  listening: boolean
  activeLabel: string | null
}): { saved: string; active: string } {
  const saved = input.savedPresent
    ? `Saved microphone: ${input.savedLabel}`
    : 'Saved microphone is not available. It was not replaced.'
  if (input.source === 'system') {
    return { saved, active: 'Replay is recording system audio. This microphone is not the active source.' }
  }
  if (input.source === 'virtual') {
    return { saved, active: 'Replay is recording the virtual device. This microphone is not the active source.' }
  }
  if (input.listening && input.activeLabel) {
    return { saved, active: `Active microphone: ${input.activeLabel}` }
  }
  return { saved, active: 'This microphone is selected for replay and Test Microphone. It is not capturing yet.' }
}

export function replayWindowSeconds(bufferLengthSec: number): number {
  if (!Number.isFinite(bufferLengthSec) || bufferLengthSec <= 0) return INSTANT_REPLAY_SECONDS
  return Math.min(MAX_REPLAY_SECONDS, bufferLengthSec)
}

export function createPcmRing(
  sampleRate: number,
  channelCount: number,
  durationSeconds = MAX_REPLAY_SECONDS,
): PcmRing {
  const safeRate = Math.max(1, Math.round(sampleRate))
  const safeChannels = Math.max(1, Math.round(channelCount))
  const capacity = Math.max(1, Math.round(safeRate * durationSeconds))
  return {
    sampleRate: safeRate,
    channelCount: safeChannels,
    capacity,
    channels: Array.from({ length: safeChannels }, () => new Float32Array(capacity)),
    writeIndex: 0,
    stored: 0,
    totalFramesWritten: 0,
  }
}

export function appendPcmBlock(ring: PcmRing, block: ArrayLike<number>[]): void {
  const frames = block[0]?.length ?? 0
  if (frames <= 0) return

  if (frames >= ring.capacity) {
    const start = frames - ring.capacity
    for (let channel = 0; channel < ring.channelCount; channel += 1) {
      const source = block[Math.min(channel, block.length - 1)]
      for (let frame = 0; frame < ring.capacity; frame += 1) {
        ring.channels[channel][frame] = source[start + frame] ?? 0
      }
    }
    ring.writeIndex = 0
    ring.stored = ring.capacity
    ring.totalFramesWritten += frames
    return
  }

  let remaining = frames
  let offset = 0
  while (remaining > 0) {
    const space = ring.capacity - ring.writeIndex
    const take = Math.min(space, remaining)
    for (let channel = 0; channel < ring.channelCount; channel += 1) {
      const source = block[Math.min(channel, block.length - 1)]
      const target = ring.channels[channel]
      for (let frame = 0; frame < take; frame += 1) {
        target[ring.writeIndex + frame] = source[offset + frame] ?? 0
      }
    }
    ring.writeIndex = (ring.writeIndex + take) % ring.capacity
    offset += take
    remaining -= take
  }
  ring.stored = Math.min(ring.capacity, ring.stored + frames)
  ring.totalFramesWritten += frames
}

/** Copy without removing samples, so a mic test cannot erase the replay window. */
export function copyRecentFrames(ring: PcmRing, durationSeconds: number): Float32Array[] {
  const requested = Math.max(1, Math.round(ring.sampleRate * durationSeconds))
  const count = Math.min(ring.stored, requested)
  const channels = Array.from({ length: ring.channelCount }, () => new Float32Array(count))
  if (count === 0) return channels

  const start = (ring.writeIndex - count + ring.capacity) % ring.capacity
  for (let frame = 0; frame < count; frame += 1) {
    const index = (start + frame) % ring.capacity
    for (let channel = 0; channel < ring.channelCount; channel += 1) {
      channels[channel][frame] = ring.channels[channel][index]
    }
  }
  return channels
}

export function bufferedMilliseconds(ring: PcmRing | null, windowSeconds: number): number {
  if (!ring || ring.stored <= 0 || ring.sampleRate <= 0) return 0
  const available = (ring.stored / ring.sampleRate) * 1000
  return Math.min(available, windowSeconds * 1000)
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

export function encodePcmWav(channels: ArrayLike<number>[], sampleRate: number): Uint8Array {
  const channelCount = Math.max(1, channels.length)
  const frameCount = channels[0]?.length ?? 0
  const bitsPerSample = 16
  const blockAlign = channelCount * (bitsPerSample / 8)
  const dataLength = frameCount * blockAlign
  const bytes = new Uint8Array(44 + dataLength)
  const view = new DataView(bytes.buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel]?.[frame] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return bytes
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let value = ''
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index] ?? 0)
  }
  return value
}

export function validateWavRecording(bytes: Uint8Array): WavValidation {
  if (bytes.byteLength < 44) {
    return { ok: false, error: 'Recording is not a WAV file (header is incomplete).' }
  }
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE') {
    return { ok: false, error: 'Recording is not a WAV file (missing RIFF header).' }
  }
  if (readAscii(bytes, 12, 4) !== 'fmt ' || readAscii(bytes, 36, 4) !== 'data') {
    return { ok: false, error: 'Recording WAV is missing its format or data section.' }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const audioFormat = view.getUint16(20, true)
  const channelCount = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)
  const dataLength = view.getUint32(40, true)

  if (audioFormat !== 1 || bitsPerSample !== 16 || channelCount < 1 || sampleRate < 1) {
    return { ok: false, error: 'Recording WAV is not 16-bit PCM.' }
  }
  if (dataLength < 2 || 44 + dataLength !== bytes.byteLength) {
    return { ok: false, error: 'Recording WAV data does not match the header.' }
  }

  const frameCount = dataLength / (channelCount * 2)
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    return { ok: false, error: 'Recording WAV contains no complete audio frames.' }
  }

  return {
    ok: true,
    durationMs: Math.round((frameCount / sampleRate) * 1000),
    frameCount,
    sampleRate,
    channelCount,
  }
}

export function decodeWavPcm16(bytes: Uint8Array): Float32Array[] {
  const validation = validateWavRecording(bytes)
  if (!validation.ok) {
    throw new Error(validation.error)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const channels = Array.from({ length: validation.channelCount }, () => new Float32Array(validation.frameCount))
  let offset = 44
  for (let frame = 0; frame < validation.frameCount; frame += 1) {
    for (let channel = 0; channel < validation.channelCount; channel += 1) {
      const sample = view.getInt16(offset, true)
      channels[channel][frame] = sample < 0 ? sample / 0x8000 : sample / 0x7fff
      offset += 2
    }
  }
  return channels
}

export function normalizeAudioInputDeviceId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'default') return null
  return trimmed
}

export type MicrophoneConstraints = {
  echoCancellation: false
  noiseSuppression: false
  autoGainControl: boolean
  deviceId?: { exact: string }
}

export function microphoneTrackConstraints(
  deviceId: string | null,
  processing: 'replay' | 'monitor',
): MicrophoneConstraints {
  const processingConstraints: MicrophoneConstraints = processing === 'replay'
    ? { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
    : { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  const selected = normalizeAudioInputDeviceId(deviceId)
  if (!selected) return processingConstraints
  return { ...processingConstraints, deviceId: { exact: selected } }
}

export function captureDeviceMatches(requestedId: string | null, actualId: string | undefined): boolean {
  const requested = normalizeAudioInputDeviceId(requestedId)
  if (!requested) return true
  if (!actualId || actualId === 'default') return false
  return actualId === requested
}

export function microphoneUnavailableMessage(label?: string | null): string {
  const name = label?.trim() || 'The selected microphone'
  return `${name} is unavailable. SlipUpClipz did not switch to another microphone.`
}

export function openedWrongMicrophoneMessage(actualLabel: string): string {
  const actual = actualLabel.trim() || 'a different microphone'
  return `SlipUpClipz opened ${actual} instead of the selected microphone. Capture was stopped.`
}

export function inputDeviceStillPresent(
  deviceId: string | null,
  devices: readonly { deviceId: string }[],
): boolean {
  const selected = normalizeAudioInputDeviceId(deviceId)
  if (!selected) return true
  return devices.some((device) => device.deviceId === selected)
}

export function canCaptureClip(state: {
  isListening: boolean
  isSaving: boolean
  isTestingMic: boolean
}): boolean {
  return state.isListening && !state.isSaving && !state.isTestingMic
}

export function shouldRestartCapture(state: {
  isTestingMic: boolean
  trackLive: boolean
  capturing: boolean
}): boolean {
  if (state.isTestingMic) return false
  return !state.trackLive || !state.capturing
}

export function classifyMicTest(input: {
  frameCount: number
  peak: number
  decodeError?: string | null
}): MicTestClassification {
  if (input.decodeError) {
    return {
      kind: 'undecodable',
      message: `Microphone test captured audio, but it could not be decoded. ${input.decodeError}`,
    }
  }
  if (input.frameCount <= 0) {
    return { kind: 'empty', message: 'Microphone test did not capture any audio samples.' }
  }
  if (input.peak < SILENCE_PEAK_THRESHOLD) {
    return { kind: 'silent', message: SILENT_MIC_TEST_MESSAGE }
  }
  return { kind: 'ok' }
}

export function micTestPlaybackBudget(durationMs: number): number {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0
  return Math.min(12_000, Math.max(1_000, safeDuration + 1_500))
}

export function peakOfSamples(samples: ArrayLike<number>): number {
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    peak = Math.max(peak, Math.abs(samples[index] ?? 0))
  }
  return peak
}
