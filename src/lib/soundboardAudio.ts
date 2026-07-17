import { getAudioBlob } from './audioStorage'
import { padVolumeToGain } from './soundboardStorage'
import {
  clampVoiceBass,
  clampVoiceFormant,
  clampVoiceMix,
  clampVoiceOutputGain,
  clampVoicePitch,
  dbToGain,
  semitonesToPitchRatio,
  toneForPreset,
  type VoiceEffectsSettings,
  type VoiceEffectsTone,
} from './voiceEffects'

const bufferCache = new Map<string, AudioBuffer>()
const activeSources = new Set<AudioBufferSourceNode>()

type PlaybackInstance = {
  id: string
  clipId: string
  sources: AudioBufferSourceNode[]
  gainNodes: GainNode[]
  startedAt: number
  durationMs: number
}

const activePlaybacks = new Map<string, PlaybackInstance>()
const playbackListeners = new Set<() => void>()

export type PlaybackRoute = 'monitor' | 'virtual' | 'both'

export type ActivePlaybackInfo = {
  id: string
  clipId: string
  progress: number
  startedAt: number
  durationMs: number
  route: PlaybackRoute
}

function notifyPlaybackListeners(): void {
  for (const listener of playbackListeners) {
    listener()
  }
}

export function subscribePlaybackState(listener: () => void): () => void {
  playbackListeners.add(listener)
  return () => {
    playbackListeners.delete(listener)
  }
}

function currentPlaybackRoute(): PlaybackRoute {
  if (shouldUseSeparateMonitor()) return 'both'
  if (streamDeviceId && monitorDeviceId && streamDeviceId !== monitorDeviceId) {
    return hearMyselfEnabled ? 'both' : 'virtual'
  }
  if (hearMyselfEnabled) return 'monitor'
  return streamDeviceId ? 'virtual' : 'monitor'
}

export function getActivePlaybacks(): ActivePlaybackInfo[] {
  const now = performance.now()
  const route = currentPlaybackRoute()
  const results: ActivePlaybackInfo[] = []

  for (const playback of activePlaybacks.values()) {
    const elapsed = now - playback.startedAt
    const progress =
      playback.durationMs > 0
        ? Math.min(1, Math.max(0, elapsed / playback.durationMs))
        : 0
    results.push({
      id: playback.id,
      clipId: playback.clipId,
      progress,
      startedAt: playback.startedAt,
      durationMs: playback.durationMs,
      route,
    })
  }

  return results
}

export function isClipPlaying(clipId: string): boolean {
  for (const playback of activePlaybacks.values()) {
    if (playback.clipId === clipId) return true
  }
  return false
}

type SinkCapableAudioContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>
}

type VoiceChain = {
  input: GainNode
  output: GainNode
  pitchNode: AudioWorkletNode | null
  /** Wet path entry when worklet is unavailable (direct to processing). */
  wetBypass: GainNode
  bassFilter: BiquadFilterNode
  formantLow: BiquadFilterNode
  formantHigh: BiquadFilterNode
  presenceFilter: BiquadFilterNode
  toneFilter: BiquadFilterNode
  radioDrive: WaveShaperNode
  modGain: GainNode
  robotOscillator: OscillatorNode | null
  robotDepth: GainNode
  sum: GainNode
  outputGain: GainNode
  limiter: DynamicsCompressorNode
  dryGain: GainNode
  wetGain: GainNode
}

type MixGraph = {
  micGain: GainNode
  soundboardGain: GainNode
  compressor: DynamicsCompressorNode
  voiceChain: VoiceChain
}

type MicCapture = {
  stream: MediaStream
  source: MediaStreamAudioSourceNode
}

let streamContext: AudioContext | null = null
let monitorContext: AudioContext | null = null
let streamGraph: MixGraph | null = null
let monitorGraph: MixGraph | null = null
let streamMicCapture: MicCapture | null = null
let monitorMicCapture: MicCapture | null = null

let streamDeviceId: string | null = null
let monitorDeviceId: string | null = null
let hearMyselfEnabled = true

let mixerMicrophoneEnabled = false
let mixerMicrophoneVolume = 75
let mixerSoundboardVolume = 100

let voiceEffectsEnabled = false
let voicePitch = 0
let voiceBass = 0
let voiceFormant = 0
let voiceMix = 100
let voiceOutputGain = 0
let voiceTone: VoiceEffectsTone = 'none'
let voiceWorkletFailed = false

const workletReadyContexts = new WeakSet<AudioContext>()
const workletFailedContexts = new WeakSet<AudioContext>()

function logVoice(event: string, details?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  if (details) {
    console.info(`[voice] ${event}`, details)
  } else {
    console.info(`[voice] ${event}`)
  }
}
const MIC_CAPTURE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

function volumeToGain(percent: number): number {
  const clamped = Math.max(0, Math.min(100, percent))
  return (clamped / 100) * 0.9
}

function resolveWorkletUrl(): string {
  if (typeof window === 'undefined') {
    return 'worklets/voice-pitch-processor.js'
  }
  return new URL('worklets/voice-pitch-processor.js', window.location.href).href
}

async function ensurePitchWorklet(context: AudioContext): Promise<boolean> {
  if (workletReadyContexts.has(context)) return true
  if (workletFailedContexts.has(context)) return false

  try {
    await context.audioWorklet.addModule(resolveWorkletUrl())
    workletReadyContexts.add(context)
    logVoice('worklet:load-success', { url: resolveWorkletUrl() })
    return true
  } catch (error) {
    workletFailedContexts.add(context)
    voiceWorkletFailed = true
    logVoice('worklet:load-failure', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

function createRadioCurve(): Float32Array<ArrayBuffer> {
  const samples = 256
  const curve = new Float32Array(new ArrayBuffer(samples * 4))
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / (samples - 1) - 1
    // Mild soft saturation for communication-style grit without harsh clipping.
    curve[i] = Math.tanh(x * 1.6) * 0.92
  }
  return curve
}

function createIdentityCurve(): Float32Array<ArrayBuffer> {
  const samples = 256
  const curve = new Float32Array(new ArrayBuffer(samples * 4))
  for (let i = 0; i < samples; i += 1) {
    curve[i] = (i * 2) / (samples - 1) - 1
  }
  return curve
}

const RADIO_CURVE = createRadioCurve()
const IDENTITY_CURVE = createIdentityCurve()


async function applySinkId(
  context: SinkCapableAudioContext,
  deviceId: string | null,
): Promise<void> {
  if (!deviceId || !context.setSinkId) return
  try {
    await context.setSinkId(deviceId)
  } catch {
    // Device may have been disconnected; caller falls back to default output.
  }
}

async function closeAudioContext(context: AudioContext | null): Promise<void> {
  if (!context) return
  await context.close()
}

function stopMicCapture(capture: MicCapture | null): MicCapture | null {
  if (!capture) return null
  capture.source.disconnect()
  capture.stream.getTracks().forEach((track) => track.stop())
  return null
}

function stopAllMicrophoneCaptures(): void {
  streamMicCapture = stopMicCapture(streamMicCapture)
  monitorMicCapture = stopMicCapture(monitorMicCapture)
}

function disposeVoiceChain(chain: VoiceChain | null): void {
  if (!chain) return
  try {
    chain.robotOscillator?.stop()
  } catch {
    // Already stopped.
  }
  chain.robotOscillator = null
}

function createVoiceChain(context: AudioContext): VoiceChain {
  const input = context.createGain()
  const output = context.createGain()
  const dryGain = context.createGain()
  const wetGain = context.createGain()
  const wetBypass = context.createGain()
  const bassFilter = context.createBiquadFilter()
  const formantLow = context.createBiquadFilter()
  const formantHigh = context.createBiquadFilter()
  const presenceFilter = context.createBiquadFilter()
  const toneFilter = context.createBiquadFilter()
  const radioDrive = context.createWaveShaper()
  const modGain = context.createGain()
  const robotDepth = context.createGain()
  const sum = context.createGain()
  const outputGain = context.createGain()
  const limiter = context.createDynamicsCompressor()

  bassFilter.type = 'lowshelf'
  bassFilter.frequency.value = 150
  bassFilter.gain.value = 0

  formantLow.type = 'lowshelf'
  formantLow.frequency.value = 280
  formantLow.gain.value = 0

  formantHigh.type = 'highshelf'
  formantHigh.frequency.value = 3200
  formantHigh.gain.value = 0

  presenceFilter.type = 'peaking'
  presenceFilter.frequency.value = 4200
  presenceFilter.Q.value = 0.85
  presenceFilter.gain.value = 0

  toneFilter.type = 'allpass'
  toneFilter.frequency.value = 1000
  toneFilter.Q.value = 0.7

  radioDrive.curve = IDENTITY_CURVE
  radioDrive.oversample = '2x'

  modGain.gain.value = 1
  robotDepth.gain.value = 0

  limiter.threshold.value = -10
  limiter.knee.value = 10
  limiter.ratio.value = 8
  limiter.attack.value = 0.002
  limiter.release.value = 0.12

  // Dry mic path (unprocessed) for Effect Mix.
  input.connect(dryGain)
  dryGain.connect(sum)

  // Wet path starts at pitch (or wetBypass until worklet attaches).
  wetBypass.connect(bassFilter)
  bassFilter.connect(formantLow)
  formantLow.connect(formantHigh)
  formantHigh.connect(presenceFilter)
  presenceFilter.connect(toneFilter)
  toneFilter.connect(radioDrive)
  radioDrive.connect(modGain)
  modGain.connect(wetGain)
  wetGain.connect(sum)

  sum.connect(outputGain)
  outputGain.connect(limiter)
  limiter.connect(output)

  dryGain.gain.value = 0
  wetGain.gain.value = 1
  wetBypass.gain.value = 1
  input.gain.value = 1
  output.gain.value = 1
  outputGain.gain.value = 1
  sum.gain.value = 1

  // Default wet entry until pitch worklet connects.
  input.connect(wetBypass)

  logVoice('graph:voice-chain-created')

  return {
    input,
    output,
    pitchNode: null,
    wetBypass,
    bassFilter,
    formantLow,
    formantHigh,
    presenceFilter,
    toneFilter,
    radioDrive,
    modGain,
    robotOscillator: null,
    robotDepth,
    sum,
    outputGain,
    limiter,
    dryGain,
    wetGain,
  }
}

async function attachPitchNode(context: AudioContext, chain: VoiceChain): Promise<void> {
  if (chain.pitchNode) return

  const ready = await ensurePitchWorklet(context)
  if (!ready) {
    voiceWorkletFailed = true
    return
  }

  try {
    const pitchNode = new AudioWorkletNode(context, 'voice-pitch-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })

    // Prefer worklet wet path; disconnect direct bypass to avoid double signal.
    try {
      chain.input.disconnect(chain.wetBypass)
    } catch {
      // Already disconnected.
    }

    chain.input.connect(pitchNode)
    pitchNode.connect(chain.bassFilter)
    chain.pitchNode = pitchNode
    voiceWorkletFailed = false
    logVoice('graph:pitch-node-attached')
  } catch (error) {
    voiceWorkletFailed = true
    logVoice('graph:pitch-node-failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function stopRobotModulator(chain: VoiceChain): void {
  if (chain.robotOscillator) {
    try {
      chain.robotOscillator.stop()
    } catch {
      // Already stopped.
    }
    try {
      chain.robotOscillator.disconnect()
    } catch {
      // Already disconnected.
    }
    chain.robotOscillator = null
  }

  try {
    chain.robotDepth.disconnect()
  } catch {
    // Already disconnected.
  }

  chain.robotDepth.gain.value = 0
  const now = chain.modGain.context.currentTime
  chain.modGain.gain.cancelScheduledValues(now)
  chain.modGain.gain.setTargetAtTime(1, now, 0.02)
}

function applyFormantFilters(
  chain: VoiceChain,
  enabled: boolean,
  formant: number,
  now: number,
): void {
  if (!enabled || formant === 0) {
    chain.formantLow.gain.setTargetAtTime(0, now, 0.04)
    chain.formantHigh.gain.setTargetAtTime(0, now, 0.04)
    chain.presenceFilter.gain.setTargetAtTime(0, now, 0.04)
    return
  }

  // Positive formant = smaller/brighter; negative = larger/darker.
  const lowGain = -formant * 0.85
  const highGain = formant * 1.05
  const presenceGain = formant * 0.55

  chain.formantLow.frequency.setTargetAtTime(formant > 0 ? 340 : 200, now, 0.04)
  chain.formantHigh.frequency.setTargetAtTime(formant > 0 ? 2600 : 3800, now, 0.04)
  chain.presenceFilter.frequency.setTargetAtTime(formant > 0 ? 5200 : 3000, now, 0.04)

  chain.formantLow.gain.setTargetAtTime(lowGain, now, 0.04)
  chain.formantHigh.gain.setTargetAtTime(highGain, now, 0.04)
  chain.presenceFilter.gain.setTargetAtTime(presenceGain, now, 0.04)
}

function applyVoiceChainSettings(chain: VoiceChain | null): void {
  if (!chain) return

  const pitch = clampVoicePitch(voicePitch)
  const bass = clampVoiceBass(voiceBass)
  const formant = clampVoiceFormant(voiceFormant)
  const mix = clampVoiceMix(voiceMix) / 100
  const outGain = dbToGain(voiceOutputGain)
  const enabled = voiceEffectsEnabled
  const tone = voiceTone
  const ratio = semitonesToPitchRatio(pitch)
  const pitchActive = enabled && Math.abs(pitch) > 0.01 && chain.pitchNode !== null
  const now = chain.input.context.currentTime
  const ramp = 0.045

  // When disabled: full dry passthrough, zero wet processing coloration.
  if (!enabled) {
    chain.dryGain.gain.setTargetAtTime(1, now, ramp)
    chain.wetGain.gain.setTargetAtTime(0, now, ramp)
    chain.bassFilter.gain.setTargetAtTime(0, now, ramp)
    applyFormantFilters(chain, false, 0, now)
    chain.toneFilter.type = 'allpass'
    chain.toneFilter.frequency.setTargetAtTime(1000, now, ramp)
    chain.toneFilter.Q.setTargetAtTime(0.7, now, ramp)
    chain.radioDrive.curve = IDENTITY_CURVE
    chain.modGain.gain.setTargetAtTime(1, now, ramp)
    chain.outputGain.gain.setTargetAtTime(1, now, ramp)
    stopRobotModulator(chain)
    if (chain.pitchNode) {
      chain.pitchNode.parameters.get('enabled')?.setValueAtTime(0, now)
      chain.pitchNode.parameters.get('pitchRatio')?.setTargetAtTime(1, now, 0.03)
    }
    return
  }

  chain.bassFilter.gain.setTargetAtTime(bass, now, ramp)
  applyFormantFilters(chain, true, formant, now)

  // Effect mix: dry vs fully processed wet (same settings on stream + monitor).
  chain.dryGain.gain.setTargetAtTime(1 - mix, now, ramp)
  chain.wetGain.gain.setTargetAtTime(mix, now, ramp)
  chain.outputGain.gain.setTargetAtTime(outGain, now, ramp)

  if (chain.pitchNode) {
    const pitchParam = chain.pitchNode.parameters.get('pitchRatio')
    const enabledParam = chain.pitchNode.parameters.get('enabled')
    pitchParam?.setTargetAtTime(ratio, now, 0.03)
    enabledParam?.setValueAtTime(pitchActive ? 1 : 0, now)
  }

  if (tone === 'none') {
    chain.toneFilter.type = 'allpass'
    chain.toneFilter.frequency.setTargetAtTime(1000, now, ramp)
    chain.toneFilter.Q.setTargetAtTime(0.7, now, ramp)
    chain.radioDrive.curve = IDENTITY_CURVE
    chain.modGain.gain.setTargetAtTime(1, now, ramp)
    stopRobotModulator(chain)
    return
  }

  if (tone === 'radio') {
    stopRobotModulator(chain)
    chain.toneFilter.type = 'bandpass'
    chain.toneFilter.frequency.setTargetAtTime(1550, now, ramp)
    chain.toneFilter.Q.setTargetAtTime(1.35, now, ramp)
    chain.radioDrive.curve = RADIO_CURVE
    chain.modGain.gain.setTargetAtTime(0.9, now, ramp)
    return
  }

  // Robot: restrained AM + mild bandpass; keep speech readable.
  chain.toneFilter.type = 'bandpass'
  chain.toneFilter.frequency.setTargetAtTime(1100, now, ramp)
  chain.toneFilter.Q.setTargetAtTime(0.9, now, ramp)
  chain.radioDrive.curve = IDENTITY_CURVE
  chain.modGain.gain.setTargetAtTime(0.82, now, ramp)
  chain.robotDepth.gain.setTargetAtTime(0.18, now, ramp)

  if (!chain.robotOscillator) {
    const osc = chain.input.context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 18
    osc.connect(chain.robotDepth)
    chain.robotDepth.connect(chain.modGain.gain)
    osc.start()
    chain.robotOscillator = osc
  }
}

export type VoiceEffectsRuntimeStatus = {
  workletAvailable: boolean
  message: string | null
}

export function getVoiceEffectsRuntimeStatus(): VoiceEffectsRuntimeStatus {
  if (voiceWorkletFailed) {
    return {
      workletAvailable: false,
      message: 'Pitch processor unavailable — using clean microphone passthrough.',
    }
  }
  return { workletAvailable: true, message: null }
}

async function createMixGraph(context: AudioContext): Promise<MixGraph> {
  const micGain = context.createGain()
  const soundboardGain = context.createGain()
  const compressor = context.createDynamicsCompressor()
  const voiceChain = createVoiceChain(context)

  compressor.threshold.value = -14
  compressor.knee.value = 8
  compressor.ratio.value = 3
  compressor.attack.value = 0.003
  compressor.release.value = 0.2

  voiceChain.output.connect(micGain)
  micGain.connect(compressor)
  soundboardGain.connect(compressor)
  compressor.connect(context.destination)

  await attachPitchNode(context, voiceChain)
  applyVoiceChainSettings(voiceChain)

  return { micGain, soundboardGain, compressor, voiceChain }
}

function applyMixerGains(graph: MixGraph | null): void {
  if (!graph) return
  graph.micGain.gain.value = mixerMicrophoneEnabled ? volumeToGain(mixerMicrophoneVolume) : 0
  graph.soundboardGain.gain.value = volumeToGain(mixerSoundboardVolume)
}

async function resetAudioContexts(): Promise<void> {
  stopAllMicrophoneCaptures()
  disposeVoiceChain(streamGraph?.voiceChain ?? null)
  disposeVoiceChain(monitorGraph?.voiceChain ?? null)
  await closeAudioContext(streamContext)
  await closeAudioContext(monitorContext)
  streamContext = null
  monitorContext = null
  streamGraph = null
  monitorGraph = null
  logVoice('graph:contexts-destroyed')
}

function shouldUseSeparateMonitor(): boolean {
  if (!hearMyselfEnabled) return false
  if (!streamDeviceId) return false
  return streamDeviceId !== monitorDeviceId
}

async function acquireMicrophoneCapture(context: AudioContext): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: MIC_CAPTURE_CONSTRAINTS,
  })
  const source = context.createMediaStreamSource(stream)
  return { stream, source }
}

async function syncMicrophoneCaptures(): Promise<void> {
  if (!mixerMicrophoneEnabled) {
    stopAllMicrophoneCaptures()
    applyMixerGains(streamGraph)
    applyMixerGains(monitorGraph)
    return
  }

  if (streamContext && streamGraph && !streamMicCapture) {
    try {
      const capture = await acquireMicrophoneCapture(streamContext)
      capture.source.connect(streamGraph.voiceChain.input)
      streamMicCapture = capture
    } catch {
      streamMicCapture = null
    }
  }

  if (shouldUseSeparateMonitor() && monitorContext && monitorGraph && !monitorMicCapture) {
    try {
      const capture = await acquireMicrophoneCapture(monitorContext)
      capture.source.connect(monitorGraph.voiceChain.input)
      monitorMicCapture = capture
    } catch {
      monitorMicCapture = null
    }
  } else if (!shouldUseSeparateMonitor()) {
    monitorMicCapture = stopMicCapture(monitorMicCapture)
  }

  applyMixerGains(streamGraph)
  applyMixerGains(monitorGraph)
  applyVoiceChainSettings(streamGraph?.voiceChain ?? null)
  applyVoiceChainSettings(monitorGraph?.voiceChain ?? null)
}

async function ensureStreamGraph(): Promise<{ context: AudioContext; soundboardGain: GainNode }> {
  if (!streamContext || !streamGraph) {
    streamContext = new AudioContext()
    await applySinkId(streamContext as SinkCapableAudioContext, streamDeviceId)
    streamGraph = await createMixGraph(streamContext)
    applyMixerGains(streamGraph)
    await syncMicrophoneCaptures()
    logVoice('graph:stream-created', { sampleRate: streamContext.sampleRate })
  }

  if (streamContext.state === 'suspended') {
    await streamContext.resume()
  }

  return { context: streamContext, soundboardGain: streamGraph.soundboardGain }
}

async function ensureMonitorGraph(): Promise<{ context: AudioContext; soundboardGain: GainNode }> {
  if (!monitorContext || !monitorGraph) {
    monitorContext = new AudioContext()
    await applySinkId(monitorContext as SinkCapableAudioContext, monitorDeviceId)
    monitorGraph = await createMixGraph(monitorContext)
    applyMixerGains(monitorGraph)
    await syncMicrophoneCaptures()
    logVoice('graph:monitor-created', { sampleRate: monitorContext.sampleRate })
  }

  if (monitorContext.state === 'suspended') {
    await monitorContext.resume()
  }

  return { context: monitorContext, soundboardGain: monitorGraph.soundboardGain }
}

export type SoundboardMixerSettings = {
  microphoneEnabled: boolean
  microphoneVolume: number
  soundboardVolume: number
}

export async function setSoundboardRouting(options: {
  streamDeviceId: string | null
  monitorDeviceId: string | null
  hearMyself: boolean
}): Promise<void> {
  streamDeviceId = options.streamDeviceId
  monitorDeviceId = options.monitorDeviceId
  hearMyselfEnabled = options.hearMyself
  await resetAudioContexts()
  await syncMicrophoneCaptures()
}

export async function setSoundboardMixerSettings(options: SoundboardMixerSettings): Promise<void> {
  const micToggled = mixerMicrophoneEnabled !== options.microphoneEnabled
  mixerMicrophoneEnabled = options.microphoneEnabled
  mixerMicrophoneVolume = options.microphoneVolume
  mixerSoundboardVolume = options.soundboardVolume

  if (!mixerMicrophoneEnabled) {
    stopAllMicrophoneCaptures()
  } else if (micToggled || !streamMicCapture) {
    await syncMicrophoneCaptures()
  }

  applyMixerGains(streamGraph)
  applyMixerGains(monitorGraph)
}

export async function setVoiceEffectsSettings(options: VoiceEffectsSettings): Promise<void> {
  voiceEffectsEnabled = options.enabled
  voicePitch = clampVoicePitch(options.pitch)
  voiceBass = clampVoiceBass(options.bass)
  voiceFormant = clampVoiceFormant(options.formant)
  voiceMix = clampVoiceMix(options.mix)
  voiceOutputGain = clampVoiceOutputGain(options.outputGain)
  voiceTone = toneForPreset(options.preset)

  logVoice('settings:apply', {
    enabled: voiceEffectsEnabled,
    preset: options.preset,
    pitch: voicePitch,
    formant: voiceFormant,
    bass: voiceBass,
    mix: voiceMix,
    outputGain: voiceOutputGain,
  })

  if (streamContext && streamGraph) {
    await attachPitchNode(streamContext, streamGraph.voiceChain)
  }
  if (monitorContext && monitorGraph) {
    await attachPitchNode(monitorContext, monitorGraph.voiceChain)
  }

  applyVoiceChainSettings(streamGraph?.voiceChain ?? null)
  applyVoiceChainSettings(monitorGraph?.voiceChain ?? null)
}

export function getSoundboardOutputDevice(): string | null {
  return streamDeviceId
}

export function isMixerMicrophoneActive(): boolean {
  return mixerMicrophoneEnabled && streamMicCapture !== null
}

export function isSinkIdSupported(): boolean {
  if (typeof AudioContext === 'undefined') return false
  const probe = new AudioContext() as SinkCapableAudioContext
  const supported = typeof probe.setSinkId === 'function'
  void probe.close()
  return supported
}

export async function playOutputTestTone(): Promise<boolean> {
  try {
    const { context, soundboardGain } = await ensureStreamGraph()
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.value = 0.12

    oscillator.connect(gain)
    gain.connect(soundboardGain)

    const startAt = context.currentTime
    oscillator.start(startAt)
    oscillator.stop(startAt + 0.35)

    return true
  } catch {
    return false
  }
}

export async function preloadClipAudio(clipId: string): Promise<void> {
  if (bufferCache.has(clipId)) return

  const blob = await getAudioBlob(clipId)
  if (!blob) return

  const { context } = await ensureStreamGraph()
  const arrayBuffer = await blob.arrayBuffer()
  const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0))
  bufferCache.set(clipId, audioBuffer)
}

export async function preloadClipAudioMany(clipIds: string[]): Promise<void> {
  await Promise.all(clipIds.map((clipId) => preloadClipAudio(clipId)))
}

export function invalidateClipAudio(clipId: string): void {
  bufferCache.delete(clipId)
}

function startSource(
  context: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
  onEnded?: () => void,
): { source: AudioBufferSourceNode; gain: GainNode } {
  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = buffer
  source.connect(gain)
  gain.connect(destination)
  source.onended = () => {
    activeSources.delete(source)
    onEnded?.()
  }
  activeSources.add(source)
  source.start(0)
  return { source, gain }
}

export async function playClipInstant(
  clipId: string,
  options: { volume?: number } = {},
): Promise<boolean> {
  try {
    await preloadClipAudio(clipId)
    const buffer = bufferCache.get(clipId)
    if (!buffer) return false

    const volumeGain = padVolumeToGain(options.volume ?? 100)
    const playbackId = crypto.randomUUID()
    const sources: AudioBufferSourceNode[] = []
    const gainNodes: GainNode[] = []
    const durationMs = Math.round(buffer.duration * 1000)

    const finishIfDone = () => {
      const playback = activePlaybacks.get(playbackId)
      if (!playback) return
      const stillActive = playback.sources.some((source) => activeSources.has(source))
      if (!stillActive) {
        activePlaybacks.delete(playbackId)
        notifyPlaybackListeners()
      }
    }

    const { context, soundboardGain } = await ensureStreamGraph()
    const streamPlay = startSource(context, buffer, soundboardGain, finishIfDone)
    streamPlay.gain.gain.value = volumeGain
    sources.push(streamPlay.source)
    gainNodes.push(streamPlay.gain)

    if (shouldUseSeparateMonitor()) {
      const monitor = await ensureMonitorGraph()
      const monitorPlay = startSource(
        monitor.context,
        buffer,
        monitor.soundboardGain,
        finishIfDone,
      )
      monitorPlay.gain.gain.value = volumeGain
      sources.push(monitorPlay.source)
      gainNodes.push(monitorPlay.gain)
    }

    activePlaybacks.set(playbackId, {
      id: playbackId,
      clipId,
      sources,
      gainNodes,
      startedAt: performance.now(),
      durationMs,
    })
    notifyPlaybackListeners()

    window.setTimeout(() => {
      if (activePlaybacks.has(playbackId)) {
        activePlaybacks.delete(playbackId)
        notifyPlaybackListeners()
      }
    }, durationMs + 250)

    return true
  } catch {
    invalidateClipAudio(clipId)
    return false
  }
}

export function stopClipInstant(clipId: string): void {
  const toStop: PlaybackInstance[] = []
  for (const playback of activePlaybacks.values()) {
    if (playback.clipId === clipId) {
      toStop.push(playback)
    }
  }

  for (const playback of toStop) {
    for (const source of playback.sources) {
      try {
        source.stop()
      } catch {
        // Already stopped.
      }
      source.disconnect()
      activeSources.delete(source)
    }
    for (const gain of playback.gainNodes) {
      try {
        gain.disconnect()
      } catch {
        // Already disconnected.
      }
    }
    activePlaybacks.delete(playback.id)
  }

  if (toStop.length > 0) {
    notifyPlaybackListeners()
  }
}

export function stopAllInstantPlayback(): void {
  for (const source of activeSources) {
    try {
      source.stop()
    } catch {
      // Source may already be stopped.
    }
    source.disconnect()
  }
  activeSources.clear()

  for (const playback of activePlaybacks.values()) {
    for (const gain of playback.gainNodes) {
      try {
        gain.disconnect()
      } catch {
        // Already disconnected.
      }
    }
  }
  activePlaybacks.clear()
  notifyPlaybackListeners()
}

export function warmUpAudioEngine(): void {
  void ensureStreamGraph()
  if (shouldUseSeparateMonitor()) {
    void ensureMonitorGraph()
  }
}
