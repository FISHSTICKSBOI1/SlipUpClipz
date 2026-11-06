import { applyAudioRoute, type AudioRouteHost, type MicTarget } from '@shared/audioRouteController'
import {
  graphsToCreate,
  playbackTargets,
  type AudioRoutePlan,
} from '@shared/gamingAudioRouting'
import { LOCAL_PAD_GAIN_MAX, VOICE_MIC_GAIN_MAX, VOICE_PAD_GAIN_MAX } from '@shared/voiceMixDiagnostics'
import {
  captureDeviceMatches,
  microphoneTrackConstraints,
  microphoneUnavailableMessage,
  normalizeAudioInputDeviceId,
  openedWrongMicrophoneMessage,
} from '@shared/replayCapture'
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
const bufferOrigin = new WeakMap<AudioBuffer, AudioContext>()
const buffersByContext = new WeakMap<AudioContext, Map<string, { buffer: AudioBuffer; version: number }>>()
const clipAudioVersion = new Map<string, number>()
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
  const targets = playbackTargets(activePlan)
  if (targets.voicePads && targets.localPads) return 'both'
  if (targets.localPads) return 'monitor'
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
  microphoneMeter: AnalyserNode
  soundboardMeter: AnalyserNode
  compressor: DynamicsCompressorNode | null
  voiceChain: VoiceChain | null
  micEntry: AudioNode
  protectWithoutDucking: boolean
}

type MicCapture = {
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  tap: MediaStreamAudioDestinationNode | null
  tapSource: MediaStreamAudioSourceNode | null
}

const idlePlan: AudioRoutePlan = {
  mode: 'legacy',
  voiceSinkId: null,
  voiceSinkExplicit: false,
  voiceMicrophone: false,
  voicePads: true,
  protectWithoutDucking: false,
  localEnabled: false,
  localSinkId: null,
  localSinkExplicit: false,
  localMicrophone: false,
  localPads: false,
  microphoneDeviceId: null,
  keepVoiceGraphHot: false,
}

let activePlan: AudioRoutePlan = idlePlan
let lastGoodPlan: AudioRoutePlan | null = null
let streamContext: AudioContext | null = null
let monitorContext: AudioContext | null = null
let streamGraph: MixGraph | null = null
let monitorGraph: MixGraph | null = null
let streamMicCapture: MicCapture | null = null

let streamDeviceId: string | null = null
let configuredMicrophoneId: string | null = null
let followedMicrophoneId: string | null = null

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


async function applyExplicitSink(
  context: AudioContext,
  sinkId: string | null,
  explicit: boolean,
): Promise<void> {
  const sink = context as SinkCapableAudioContext
  if (!sinkId) {
    if (explicit) {
      throw new Error('Choose a playback device. SlipUpClipz did not switch to the Windows default.')
    }
    return
  }
  if (!sink.setSinkId) {
    throw new Error('Playback device selection is unavailable. SlipUpClipz did not switch devices.')
  }
  try {
    await sink.setSinkId(sinkId)
  } catch {
    throw new Error(
      'The selected playback device could not be opened. SlipUpClipz did not switch to the Windows default.',
    )
  }
  const actual = (sink as AudioContext & { sinkId?: string }).sinkId
  if (typeof actual === 'string' && actual !== '' && actual !== sinkId) {
    throw new Error(
      'The voice-chat output did not switch to the selected device. SlipUpClipz did not leave it on the Windows default.',
    )
  }
}

async function closeAudioContext(context: AudioContext | null): Promise<void> {
  if (!context) return
  await context.close()
}

function stopMicCapture(capture: MicCapture | null): MicCapture | null {
  if (!capture) return null
  try {
    capture.tapSource?.disconnect()
  } catch {
    // Already disconnected.
  }
  try {
    capture.tap?.disconnect()
  } catch {
    // Already disconnected.
  }
  try {
    capture.source.disconnect()
  } catch {
    // Already disconnected.
  }
  capture.stream.getTracks().forEach((track) => track.stop())
  return null
}

function stopAllMicrophoneCaptures(): void {
  streamMicCapture = stopMicCapture(streamMicCapture)
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

function cappedGain(percent: number, max: number): number {
  return (Math.max(0, Math.min(100, percent)) / 100) * max
}

function createMeter(context: AudioContext): AnalyserNode {
  const meter = context.createAnalyser()
  meter.fftSize = 1024
  meter.smoothingTimeConstant = 0
  return meter
}

function connectMeter(source: AudioNode, meter: AnalyserNode, destination: AudioNode): void {
  source.connect(meter)
  meter.connect(destination)
}

async function createMixGraph(context: AudioContext, protectWithoutDucking: boolean): Promise<MixGraph> {
  const micGain = context.createGain()
  const soundboardGain = context.createGain()
  const microphoneMeter = createMeter(context)
  const soundboardMeter = createMeter(context)

  if (protectWithoutDucking) {
    const safety = context.createDynamicsCompressor()
    safety.threshold.value = -1.5
    safety.knee.value = 0
    safety.ratio.value = 20
    safety.attack.value = 0.002
    safety.release.value = 0.05
    const sum = context.createGain()
    connectMeter(micGain, microphoneMeter, sum)
    connectMeter(soundboardGain, soundboardMeter, sum)
    sum.connect(safety)
    safety.connect(context.destination)
    return {
      micGain,
      soundboardGain,
      microphoneMeter,
      soundboardMeter,
      compressor: safety,
      voiceChain: null,
      micEntry: micGain,
      protectWithoutDucking: true,
    }
  }

  const compressor = context.createDynamicsCompressor()
  const voiceChain = createVoiceChain(context)
  compressor.threshold.value = -14
  compressor.knee.value = 8
  compressor.ratio.value = 3
  compressor.attack.value = 0.003
  compressor.release.value = 0.2
  voiceChain.output.connect(micGain)
  connectMeter(micGain, microphoneMeter, compressor)
  connectMeter(soundboardGain, soundboardMeter, compressor)
  compressor.connect(context.destination)
  await attachPitchNode(context, voiceChain)
  applyVoiceChainSettings(voiceChain)
  return {
    micGain,
    soundboardGain,
    microphoneMeter,
    soundboardMeter,
    compressor,
    voiceChain,
    micEntry: voiceChain.input,
    protectWithoutDucking: false,
  }
}

function applyMixerGains(graph: MixGraph | null, role: 'voice' | 'local'): void {
  if (!graph) return
  const micIncluded = role === 'voice' ? activePlan.voiceMicrophone : activePlan.localMicrophone
  if (graph.protectWithoutDucking) {
    graph.micGain.gain.value = micIncluded ? cappedGain(mixerMicrophoneVolume, VOICE_MIC_GAIN_MAX) : 0
    graph.soundboardGain.gain.value = cappedGain(
      mixerSoundboardVolume,
      role === 'voice' ? VOICE_PAD_GAIN_MAX : LOCAL_PAD_GAIN_MAX,
    )
    return
  }
  graph.micGain.gain.value = micIncluded ? volumeToGain(mixerMicrophoneVolume) : 0
  graph.soundboardGain.gain.value = volumeToGain(mixerSoundboardVolume)
}

async function closeVoiceGraph(): Promise<void> {
  disposeVoiceChain(streamGraph?.voiceChain ?? null)
  await closeAudioContext(streamContext)
  streamContext = null
  streamGraph = null
}

async function closeLocalGraph(): Promise<void> {
  disposeVoiceChain(monitorGraph?.voiceChain ?? null)
  await closeAudioContext(monitorContext)
  monitorContext = null
  monitorGraph = null
}

async function resumeContext(context: AudioContext | null): Promise<void> {
  const state = context?.state as string | undefined
  if (!context || (state !== 'suspended' && state !== 'interrupted')) return
  try {
    await context.resume()
  } catch {
    // A later click resumes playback. The device selection is left unchanged.
  }
}

function createRoutedContext(sinkId: string | null, explicit: boolean): AudioContext {
  if (!(explicit && sinkId)) return new AudioContext()
  try {
    return new AudioContext({ sinkId } as AudioContextOptions)
  } catch (error) {
    if (error instanceof TypeError) return new AudioContext()
    throw error
  }
}

function microphoneDeviceFor(plan: AudioRoutePlan): string | null {
  return plan.microphoneDeviceId ?? (plan.mode === 'legacy' ? followedMicrophoneId : null)
}

async function openPlannedMicrophone(plan: AudioRoutePlan): Promise<void> {
  const graphs = graphsToCreate(plan)
  const context = graphs.voice ? streamContext : monitorContext
  if (!context) throw new Error('The microphone graph is not ready.')
  const deviceId = microphoneDeviceFor(plan)
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: microphoneTrackConstraints(deviceId, 'monitor'),
    })
  } catch (error) {
    if (deviceId) throw new Error(microphoneUnavailableMessage())
    throw error
  }

  const track = stream.getAudioTracks()[0]
  const actualId = track?.getSettings().deviceId
  if (!captureDeviceMatches(deviceId, actualId)) {
    stream.getTracks().forEach((entry) => entry.stop())
    throw new Error(openedWrongMicrophoneMessage(track?.label || 'a different microphone'))
  }

  streamMicCapture = {
    stream,
    source: context.createMediaStreamSource(stream),
    tap: null,
    tapSource: null,
  }
}

function attachPlannedMicrophone(target: MicTarget): void {
  const capture = streamMicCapture
  const graph = target === 'voice' ? streamGraph : monitorGraph
  const context = target === 'voice' ? streamContext : monitorContext
  if (!capture || !graph || !context) {
    throw new Error('The microphone graph is not ready.')
  }
  if (capture.source.context === context) {
    capture.source.connect(graph.micEntry)
    return
  }
  const owner = capture.source.context as AudioContext
  const tap = capture.tap ?? owner.createMediaStreamDestination()
  if (!capture.tap) {
    capture.tap = tap
    capture.source.connect(tap)
  }
  capture.tapSource = context.createMediaStreamSource(tap.stream)
  capture.tapSource.connect(graph.micEntry)
}

async function createVoiceGraph(plan: AudioRoutePlan): Promise<void> {
  await closeVoiceGraph()
  streamContext = createRoutedContext(plan.voiceSinkId, plan.voiceSinkExplicit)
  streamGraph = await createMixGraph(streamContext, plan.protectWithoutDucking)
  applyMixerGains(streamGraph, 'voice')
  logVoice('graph:stream-created', { sampleRate: streamContext.sampleRate })
}

async function createLocalGraph(plan: AudioRoutePlan): Promise<void> {
  await closeLocalGraph()
  monitorContext = createRoutedContext(plan.localSinkId, plan.localSinkExplicit)
  monitorGraph = await createMixGraph(monitorContext, plan.protectWithoutDucking)
  applyMixerGains(monitorGraph, 'local')
  logVoice('graph:monitor-created', { sampleRate: monitorContext.sampleRate })
}

const routeHost: AudioRouteHost = {
  async closeMicrophone() {
    stopAllMicrophoneCaptures()
  },
  async closeVoice() {
    await closeVoiceGraph()
  },
  async closeLocal() {
    routeHost.detachMicrophone('local')
    await closeLocalGraph()
  },
  async createVoice(plan) {
    await createVoiceGraph(plan)
  },
  async createLocal(plan) {
    await createLocalGraph(plan)
  },
  async setVoiceSink(plan) {
    if (!streamContext) throw new Error('Voice-chat output is not ready.')
    await applyExplicitSink(streamContext, plan.voiceSinkId, plan.voiceSinkExplicit)
    streamDeviceId = plan.voiceSinkId
  },
  async setLocalSink(plan) {
    if (!monitorContext) throw new Error('Headphone output is not ready.')
    await applyExplicitSink(monitorContext, plan.localSinkId, plan.localSinkExplicit)
  },
  async resumeVoice() {
    await resumeContext(streamContext)
  },
  async resumeLocal() {
    await resumeContext(monitorContext)
  },
  async openMicrophone(plan) {
    await openPlannedMicrophone(plan)
  },
  attachMicrophone(target) {
    attachPlannedMicrophone(target)
  },
  detachMicrophone(target) {
    if (target !== 'local' || !streamMicCapture) return
    streamMicCapture.tapSource?.disconnect()
    streamMicCapture.tapSource = null
  },
}

function rememberPlanDevices(plan: AudioRoutePlan): void {
  streamDeviceId = plan.voiceSinkId
  activePlan = plan
}

let lastRouteRestored = false

export function soundboardRouteRestored(): boolean {
  return lastRouteRestored
}

export async function applySoundboardRoute(plan: AudioRoutePlan): Promise<string | null> {
  const previous = lastGoodPlan
  lastRouteRestored = false
  const result = await applyAudioRoute(routeHost, plan, previous)
  lastRouteRestored = !result.ok && result.restored
  if (result.ok) {
    rememberPlanDevices(plan)
    lastGoodPlan = plan
    applyMixerGains(streamGraph, 'voice')
    applyMixerGains(monitorGraph, 'local')
    return null
  }
  if (result.restored && previous) {
    rememberPlanDevices(previous)
    lastGoodPlan = previous
  } else {
    activePlan = idlePlan
    lastGoodPlan = null
    streamDeviceId = null
  }
  return result.message
}

export async function setMicrophoneInputDevice(deviceId: string | null): Promise<string | null> {
  const next = normalizeAudioInputDeviceId(deviceId)
  if (configuredMicrophoneId === next) return null
  configuredMicrophoneId = next
  followedMicrophoneId = null
  return null
}

export async function bindHearMyselfToDevice(deviceId: string): Promise<void> {
  if (configuredMicrophoneId || !deviceId || !lastGoodPlan || lastGoodPlan.mode === 'gaming-discord') return
  if (followedMicrophoneId === deviceId) return
  const targets = playbackTargets(lastGoodPlan)
  followedMicrophoneId = deviceId
  if (!targets.voiceMicrophone && !targets.localMicrophone) return
  await applySoundboardRoute({ ...lastGoodPlan, microphoneDeviceId: deviceId })
}

async function ensureStreamGraph(): Promise<{ context: AudioContext; soundboardGain: GainNode }> {
  if (!streamContext || !streamGraph) {
    await createVoiceGraph(activePlan)
    try {
      if (!streamContext || !streamGraph) throw new Error('Voice-chat output is not ready.')
      await applyExplicitSink(streamContext, activePlan.voiceSinkId, activePlan.voiceSinkExplicit)
      streamDeviceId = activePlan.voiceSinkId
    } catch (error) {
      await closeVoiceGraph()
      throw error
    }
  }
  await resumeContext(streamContext)
  if (!streamContext || !streamGraph) throw new Error('Voice-chat output is not ready.')
  return { context: streamContext, soundboardGain: streamGraph.soundboardGain }
}

async function ensureMonitorGraph(): Promise<{ context: AudioContext; soundboardGain: GainNode }> {
  if (!monitorContext || !monitorGraph) {
    await createLocalGraph(activePlan)
    try {
      if (!monitorContext || !monitorGraph) throw new Error('Headphone output is not ready.')
      await applyExplicitSink(monitorContext, activePlan.localSinkId, activePlan.localSinkExplicit)
    } catch (error) {
      await closeLocalGraph()
      throw error
    }
  }
  await resumeContext(monitorContext)
  if (!monitorContext || !monitorGraph) throw new Error('Headphone output is not ready.')
  return { context: monitorContext, soundboardGain: monitorGraph.soundboardGain }
}

export type SoundboardMixerSettings = {
  microphoneEnabled: boolean
  microphoneVolume: number
  soundboardVolume: number
}

export async function setSoundboardMixerSettings(options: SoundboardMixerSettings): Promise<void> {
  mixerMicrophoneVolume = options.microphoneVolume
  mixerSoundboardVolume = options.soundboardVolume
  applyMixerGains(streamGraph, 'voice')
  applyMixerGains(monitorGraph, 'local')
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

  if (streamContext && streamGraph?.voiceChain) {
    await attachPitchNode(streamContext, streamGraph.voiceChain)
  }
  if (monitorContext && monitorGraph?.voiceChain) {
    await attachPitchNode(monitorContext, monitorGraph.voiceChain)
  }

  applyVoiceChainSettings(streamGraph?.voiceChain ?? null)
  applyVoiceChainSettings(monitorGraph?.voiceChain ?? null)
}

export function getSoundboardOutputDevice(): string | null {
  return streamDeviceId
}

export function isMixerMicrophoneActive(): boolean {
  return activePlan.voiceMicrophone && streamMicCapture !== null
}

export function isVoiceGraphSuspended(): boolean {
  return streamContext?.state === 'suspended'
}

export function isSinkIdSupported(): boolean {
  if (typeof AudioContext === 'undefined') return false
  const probe = new AudioContext() as SinkCapableAudioContext
  const supported = typeof probe.setSinkId === 'function'
  void probe.close()
  return supported
}

function meterPeak(meter: AnalyserNode | null | undefined): number {
  if (!meter) return 0
  const samples = new Float32Array(meter.fftSize)
  meter.getFloatTimeDomainData(samples)
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    peak = Math.max(peak, Math.abs(samples[index] ?? 0))
  }
  return peak
}

let recentSoundboardPeak = 0
let recentSoundboardAt = 0

function rememberSoundboardPeak(peak: number): void {
  if (peak <= 0) return
  if (peak < recentSoundboardPeak && Date.now() - recentSoundboardAt < 5000) return
  recentSoundboardPeak = peak
  recentSoundboardAt = Date.now()
}

function watchSoundboardMeter(): void {
  for (const delay of [40, 120, 220]) {
    window.setTimeout(() => {
      rememberSoundboardPeak(meterPeak(streamGraph?.soundboardMeter))
    }, delay)
  }
}

function contextSinkId(context: AudioContext | null): string | null {
  if (!context) return null
  const sinkId = (context as AudioContext & { sinkId?: string }).sinkId
  return typeof sinkId === 'string' ? sinkId : null
}

export function getVoiceMixSnapshot(): {
  microphonePeak: number
  soundboardPeak: number
  soundboardTested: boolean
  sinkId: string | null
  sinkMatchesRequest: boolean | null
  contextState: string | null
} {
  const liveBoard = meterPeak(streamGraph?.soundboardMeter)
  if (liveBoard > 0) rememberSoundboardPeak(liveBoard)
  const fresh = Date.now() - recentSoundboardAt < 5000
  const sinkId = contextSinkId(streamContext)
  const requested = activePlan.voiceSinkExplicit ? activePlan.voiceSinkId : null
  return {
    microphonePeak: meterPeak(streamGraph?.microphoneMeter),
    soundboardPeak: fresh ? Math.max(liveBoard, recentSoundboardPeak) : liveBoard,
    soundboardTested: fresh,
    sinkId,
    sinkMatchesRequest: requested ? (sinkId === null ? null : sinkId === requested) : null,
    contextState: streamContext?.state ?? null,
  }
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
    watchSoundboardMeter()

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
  bufferOrigin.set(audioBuffer, context)
  bufferCache.set(clipId, audioBuffer)
}

function bufferForContext(context: AudioContext, clipId: string, shared: AudioBuffer): AudioBuffer {
  const version = clipAudioVersion.get(clipId) ?? 0
  if (bufferOrigin.get(shared) === context) return shared
  let copies = buffersByContext.get(context)
  if (!copies) {
    copies = new Map()
    buffersByContext.set(context, copies)
  }
  const cached = copies.get(clipId)
  if (cached && cached.version === version && bufferOrigin.get(cached.buffer) === context) return cached.buffer
  const copy = context.createBuffer(shared.numberOfChannels, shared.length, shared.sampleRate)
  for (let channel = 0; channel < shared.numberOfChannels; channel += 1) {
    copy.copyToChannel(shared.getChannelData(channel).slice(), channel)
  }
  bufferOrigin.set(copy, context)
  copies.set(clipId, { buffer: copy, version })
  return copy
}

export async function preloadClipAudioMany(clipIds: string[]): Promise<void> {
  await Promise.all(clipIds.map((clipId) => preloadClipAudio(clipId)))
}

export function invalidateClipAudio(clipId: string): void {
  bufferCache.delete(clipId)
  clipAudioVersion.set(clipId, (clipAudioVersion.get(clipId) ?? 0) + 1)
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

    const targets = playbackTargets(activePlan)
    if (targets.voicePads) {
      const { context, soundboardGain } = await ensureStreamGraph()
      const streamPlay = startSource(
        context,
        bufferForContext(context, clipId, buffer),
        soundboardGain,
        finishIfDone,
      )
      streamPlay.gain.gain.value = volumeGain
      sources.push(streamPlay.source)
      gainNodes.push(streamPlay.gain)
      watchSoundboardMeter()
    }

    if (targets.localPads) {
      const monitor = await ensureMonitorGraph()
      const monitorPlay = startSource(
        monitor.context,
        bufferForContext(monitor.context, clipId, buffer),
        monitor.soundboardGain,
        finishIfDone,
      )
      monitorPlay.gain.gain.value = volumeGain
      sources.push(monitorPlay.source)
      gainNodes.push(monitorPlay.gain)
    }

    if (sources.length === 0) return false

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
  const graphs = graphsToCreate(activePlan)
  if (graphs.voice) void ensureStreamGraph()
  if (graphs.local) void ensureMonitorGraph()
}
