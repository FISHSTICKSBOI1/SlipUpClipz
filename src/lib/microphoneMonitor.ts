import { logClipPipeline, logClipPipelineError } from './clipPipelineLog'

export type MicSampleAnalysis = {
  silent: boolean
  peak: number
  rms: number
  allZeros: boolean
  sampleCount: number
  reason: 'ok' | 'allZeros' | 'noSamples' | 'noAudioTrack' | 'decodeFailed'
}

export type MicTrackDiagnostics = {
  hasAudioTrack: boolean
  trackCount: number
  label: string
  muted: boolean
  enabled: boolean
  readyState: MediaStreamTrackState
  settings: MediaTrackSettings
}

const SILENCE_PEAK_THRESHOLD = 0.001

export function readMicPeakLevel(analyser: AnalyserNode): number {
  const samples = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(samples)

  let peak = 0
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]))
  }

  return peak
}

export function micPeakToPercent(peak: number): number {
  const normalized = Math.min(1, peak * 8)
  return Math.round(normalized * 100)
}

export function analyzeFloatSamples(samples: Float32Array): MicSampleAnalysis {
  if (samples.length === 0) {
    return {
      silent: true,
      peak: 0,
      rms: 0,
      allZeros: true,
      sampleCount: 0,
      reason: 'noSamples',
    }
  }

  let peak = 0
  let sumSquares = 0

  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i]
    const abs = Math.abs(value)
    peak = Math.max(peak, abs)
    sumSquares += value * value
  }

  const rms = Math.sqrt(sumSquares / samples.length)
  const allZeros = peak === 0

  return {
    silent: peak < SILENCE_PEAK_THRESHOLD,
    peak,
    rms,
    allZeros,
    sampleCount: samples.length,
    reason: allZeros ? 'allZeros' : peak < SILENCE_PEAK_THRESHOLD ? 'allZeros' : 'ok',
  }
}

export function getMicTrackDiagnostics(stream: MediaStream | null): MicTrackDiagnostics {
  const track = stream?.getAudioTracks()[0]

  if (!track) {
    return {
      hasAudioTrack: false,
      trackCount: stream?.getAudioTracks().length ?? 0,
      label: '',
      muted: false,
      enabled: false,
      readyState: 'ended',
      settings: {},
    }
  }

  return {
    hasAudioTrack: true,
    trackCount: stream.getAudioTracks().length,
    label: track.label,
    muted: track.muted,
    enabled: track.enabled,
    readyState: track.readyState,
    settings: track.getSettings(),
  }
}

export function logMicTrackDiagnostics(stage: string, stream: MediaStream | null): MicTrackDiagnostics {
  const diagnostics = getMicTrackDiagnostics(stream)
  logClipPipeline(stage, { mic: diagnostics })
  return diagnostics
}

export async function sampleAnalyserPeak(
  analyser: AnalyserNode,
  durationMs: number,
  intervalMs = 50,
): Promise<number> {
  const deadline = performance.now() + durationMs
  let peak = 0

  while (performance.now() < deadline) {
    peak = Math.max(peak, readMicPeakLevel(analyser))
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }

  return peak
}

export async function analyzeBlobSamples(blob: Blob): Promise<MicSampleAnalysis> {
  const arrayBuffer = await blob.arrayBuffer()
  if (arrayBuffer.byteLength === 0) {
    return {
      silent: true,
      peak: 0,
      rms: 0,
      allZeros: true,
      sampleCount: 0,
      reason: 'noSamples',
    }
  }

  const audioContext = new AudioContext()

  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const channel = buffer.getChannelData(0)
    return analyzeFloatSamples(channel)
  } catch (error) {
    logClipPipelineError('mic:decodeForAnalysisFailed', error, {
      blobSize: blob.size,
      mimeType: blob.type,
    })
    return {
      silent: true,
      peak: 0,
      rms: 0,
      allZeros: true,
      sampleCount: 0,
      reason: 'decodeFailed',
    }
  } finally {
    void audioContext.close()
  }
}

export function logMicSilenceAnalysis(
  stage: string,
  streamAnalysis: MicSampleAnalysis | null,
  blobAnalysis: MicSampleAnalysis | null,
  livePeak: number,
  diagnostics: MicTrackDiagnostics,
): void {
  logClipPipeline(stage, {
    livePeakDuringRecording: livePeak,
    streamHasAudioTrack: diagnostics.hasAudioTrack,
    trackMuted: diagnostics.muted,
    trackEnabled: diagnostics.enabled,
    trackReadyState: diagnostics.readyState,
    deviceLabel: diagnostics.label,
    deviceSettings: diagnostics.settings,
    streamAnalysis,
    blobAnalysis,
    silent:
      !diagnostics.hasAudioTrack ||
      diagnostics.muted ||
      (streamAnalysis?.silent ?? false) ||
      (blobAnalysis?.silent ?? false),
    silentReason: !diagnostics.hasAudioTrack
      ? 'noAudioTrack'
      : diagnostics.muted
        ? 'trackMuted'
        : blobAnalysis?.allZeros
          ? 'allZeros'
          : streamAnalysis?.allZeros
            ? 'allZeros'
            : blobAnalysis?.silent
              ? 'lowLevel'
              : streamAnalysis?.silent
                ? 'lowLevel'
                : 'none',
  })
}

export async function playBlobAudio(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)

  try {
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url)
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('Playback failed'))
      void audio.play().catch(reject)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export type MicMonitorHandle = {
  analyser: AnalyserNode
  audioContext: AudioContext
  stop: () => void
}

export async function startMicMonitor(stream: MediaStream): Promise<MicMonitorHandle> {
  const audioContext = new AudioContext()
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.4
  source.connect(analyser)

  return {
    analyser,
    audioContext,
    stop: () => {
      source.disconnect()
      void audioContext.close()
    },
  }
}
