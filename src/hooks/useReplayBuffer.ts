import { useCallback, useEffect, useRef, useState } from 'react'
import { bindHearMyselfToDevice } from '../lib/soundboardAudio'
import {
  appendPcmBlock,
  bufferedMilliseconds,
  canCaptureClip,
  classifyMicTest,
  copyRecentFrames,
  createPcmRing,
  encodePcmWav,
  MIC_TEST_SECONDS,
  micTestPlaybackBudget,
  peakOfSamples,
  replayWindowSeconds,
  shouldRestartCapture,
  validateWavRecording,
  type PcmRing,
} from '@shared/replayCapture'
import { playBlobAudio } from '../lib/microphoneMonitor'
import {
  acquireMicrophoneStream,
  acquireReplayCaptureStream,
  getMicrophoneErrorMessage,
  queryMicrophonePermission,
  releaseSystemAudioCapture,
  type ReplayCaptureConfig,
} from '../lib/replayAudioCapture'
import { logClipPipeline, logClipPipelineError } from '../lib/clipPipelineLog'
import type { RecordingResult } from '../types/clip'

export type { ReplayCaptureConfig }
export { MIC_TEST_SECONDS }

export const MIN_BUFFER_SECONDS = 0
export const MAX_BUFFER_SECONDS = 30
export const DEFAULT_BUFFER_SECONDS = 15

function wavBlob(wav: Uint8Array): Blob {
  const copy = new ArrayBuffer(wav.byteLength)
  new Uint8Array(copy).set(wav)
  return new Blob([copy], { type: 'audio/wav' })
}

type CaptureGraph = {
  context: AudioContext
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
  mute: GainNode
}

export function useReplayBuffer(captureConfig: ReplayCaptureConfig) {
  const [bufferLengthSec, setBufferLengthSec] = useState(DEFAULT_BUFFER_SECONDS)
  const [bufferedMs, setBufferedMs] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [isRequestingMic, setIsRequestingMic] = useState(true)
  const [microphoneLabel, setMicrophoneLabel] = useState<string | null>(null)
  const [microphoneNotice, setMicrophoneNotice] = useState<string | null>(null)
  const [micLevelPercent, setMicLevelPercent] = useState(0)
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [micTestSecondsLeft, setMicTestSecondsLeft] = useState(MIC_TEST_SECONDS)
  const [micTestMessage, setMicTestMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bufferLengthSecRef = useRef(bufferLengthSec)
  const streamRef = useRef<MediaStream | null>(null)
  const graphRef = useRef<CaptureGraph | null>(null)
  const ringRef = useRef<PcmRing | null>(null)
  const isTestingRef = useRef(false)
  const capturingRef = useRef(false)
  const mountedRef = useRef(true)
  const isStartingRef = useRef(false)
  const startTokenRef = useRef(0)
  const restartTimerRef = useRef<number | null>(null)
  const levelTimerRef = useRef<number | null>(null)
  const actualDeviceIdRef = useRef<string | null>(null)
  const captureConfigRef = useRef(captureConfig)
  const usingSystemLoopbackRef = useRef(false)
  const scheduleAutoRestartRef = useRef<(reason: string) => void>(() => {})
  const startListeningRef = useRef<() => Promise<boolean>>(async () => false)
  const teardownRef = useRef<() => void>(() => {})

  captureConfigRef.current = captureConfig
  bufferLengthSecRef.current = bufferLengthSec

  const stopGraph = useCallback(() => {
    const graph = graphRef.current
    graphRef.current = null
    capturingRef.current = false
    if (!graph) return
    graph.processor.onaudioprocess = null
    try { graph.source.disconnect() } catch { /* already disconnected */ }
    try { graph.processor.disconnect() } catch { /* already disconnected */ }
    try { graph.mute.disconnect() } catch { /* already disconnected */ }
    void graph.context.close()
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopLevelTimer = useCallback(() => {
    if (levelTimerRef.current !== null) {
      window.clearInterval(levelTimerRef.current)
      levelTimerRef.current = null
    }
  }, [])

  const teardownRecording = useCallback(() => {
    stopLevelTimer()
    stopGraph()
    releaseStream()
    ringRef.current = null
    if (usingSystemLoopbackRef.current) {
      usingSystemLoopbackRef.current = false
      void releaseSystemAudioCapture()
    }
    setIsListening(false)
    setMicrophoneLabel(null)
    setMicLevelPercent(0)
    setBufferedMs(0)
  }, [releaseStream, stopGraph, stopLevelTimer])

  teardownRef.current = teardownRecording

  const publishLevels = useCallback(() => {
    const ring = ringRef.current
    setBufferedMs(bufferedMilliseconds(ring, replayWindowSeconds(bufferLengthSecRef.current)))
  }, [])

  const scheduleAutoRestart = useCallback((reason: string) => {
    if (restartTimerRef.current !== null || isStartingRef.current) return
    if (!shouldRestartCapture({
      isTestingMic: isTestingRef.current,
      trackLive: false,
      capturing: capturingRef.current,
    })) {
      logClipPipeline('buffer:autoRestartSkipped', { reason, testing: true })
      return
    }

    logClipPipeline('buffer:autoRestartScheduled', { reason })
    teardownRecording()
    setError(`Recording stopped (${reason}). Restarting audio capture...`)

    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null
      void startListeningRef.current().then((started) => {
        if (started) {
          setError('Audio capture restarted.')
          window.setTimeout(() => setError(null), 4000)
        }
      })
    }, 1500)
  }, [teardownRecording])

  scheduleAutoRestartRef.current = scheduleAutoRestart

  const attachPcmCapture = useCallback((stream: MediaStream) => {
    const context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    const trackChannels = stream.getAudioTracks()[0]?.getSettings().channelCount ?? 1
    const channelCount = Math.max(1, Math.min(2, trackChannels || 1))
    const processor = context.createScriptProcessor(4096, channelCount, channelCount)
    const mute = context.createGain()
    mute.gain.value = 0
    source.connect(processor)
    processor.connect(mute)
    mute.connect(context.destination)

    processor.onaudioprocess = (event) => {
      if (!capturingRef.current) return
      const input = event.inputBuffer
      const channelCount = Math.max(1, input.numberOfChannels)
      let ring = ringRef.current
      if (!ring || ring.channelCount !== channelCount || ring.sampleRate !== context.sampleRate) {
        ring = createPcmRing(context.sampleRate, channelCount)
        ringRef.current = ring
      }
      const block: Float32Array[] = []
      for (let channel = 0; channel < channelCount; channel += 1) {
        block.push(input.getChannelData(channel))
      }
      appendPcmBlock(ring, block)
      const peak = peakOfSamples(block[0] ?? [])
      setMicLevelPercent(Math.round(Math.min(1, peak * 8) * 100))
    }

    graphRef.current = { context, source, processor, mute }
    capturingRef.current = true
    void context.resume()
  }, [])

  const startListening = useCallback(async (): Promise<boolean> => {
    if (isTestingRef.current) return false

    const token = ++startTokenRef.current
    const config = captureConfigRef.current
    const isMicrophoneSource = config.source === 'microphone'
    isStartingRef.current = true
    setError(null)
    setIsListening(false)
    setMicrophoneLabel(null)
    setIsRequestingMic(true)
    teardownRef.current()
    const stillCurrent = () => token === startTokenRef.current && mountedRef.current

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Audio capture is not supported in this environment.')
        return false
      }

      if (isMicrophoneSource) {
        const permission = await queryMicrophonePermission()
        if (!stillCurrent()) return false
        if (permission === 'denied') {
          setError('Microphone permission was denied. Allow access in system settings and reload the app.')
          return false
        }
      }

      if (!stillCurrent()) return false

      let stream: MediaStream
      let label: string
      if (config.source === 'system') {
        usingSystemLoopbackRef.current = true
        const captured = await acquireReplayCaptureStream(config)
        stream = captured.stream
        label = captured.label
      } else if (isMicrophoneSource) {
        const captured = await acquireMicrophoneStream(config.audioInputDeviceId)
        stream = captured.stream
        label = captured.label
      } else {
        const captured = await acquireReplayCaptureStream(config)
        stream = captured.stream
        label = captured.label
      }

      const track = stream.getAudioTracks()[0]
      if (!stillCurrent()) {
        stream.getTracks().forEach((entry) => entry.stop())
        return false
      }
      if (!track || track.readyState !== 'live') {
        stream.getTracks().forEach((entry) => entry.stop())
        throw new DOMException('Audio track is not live.', 'NotReadableError')
      }

      const actualId = track.getSettings().deviceId ?? null
      if (isMicrophoneSource && !config.audioInputDeviceId && actualDeviceIdRef.current && actualId && actualDeviceIdRef.current !== actualId) {
        setMicrophoneNotice(`The microphone in use changed to ${label}.`)
      } else if (isMicrophoneSource) {
        setMicrophoneNotice(null)
      }
      if (isMicrophoneSource) actualDeviceIdRef.current = actualId

      track.addEventListener('ended', () => {
        logClipPipeline('buffer:trackEnded', {})
        scheduleAutoRestartRef.current('track-ended')
      })

      streamRef.current = stream
      ringRef.current = null
      attachPcmCapture(stream)
      if (isMicrophoneSource && !config.audioInputDeviceId && actualId) {
        void bindHearMyselfToDevice(actualId)
      }
      setMicrophoneLabel(label)
      setIsListening(true)
      stopLevelTimer()
      levelTimerRef.current = window.setInterval(publishLevels, 250)
      logClipPipeline('buffer:listening', {
        inputLabel: label,
        deviceId: actualId,
        requestedDeviceId: config.audioInputDeviceId,
        replayAudioSource: config.source,
      })
      return true
    } catch (caught) {
      if (!stillCurrent()) return false
      if (usingSystemLoopbackRef.current) {
        usingSystemLoopbackRef.current = false
        await releaseSystemAudioCapture()
      }
      logClipPipelineError('buffer:captureFailed', caught, { replayAudioSource: config.source })
      setError(getMicrophoneErrorMessage(caught))
      teardownRef.current()
      return false
    } finally {
      if (token === startTokenRef.current) {
        setIsRequestingMic(false)
        isStartingRef.current = false
      }
    }
  }, [attachPcmCapture, publishLevels, stopLevelTimer])

  startListeningRef.current = startListening

  const testMicrophone = useCallback(async (): Promise<boolean> => {
    if (isTestingRef.current) return false
    if (!streamRef.current || !capturingRef.current) {
      setMicTestMessage('Microphone is not active. Grant permission and try again.')
      return false
    }

    const startedAt = ringRef.current?.totalFramesWritten ?? 0
    isTestingRef.current = true
    setIsTestingMic(true)
    setMicTestSecondsLeft(MIC_TEST_SECONDS)
    setMicTestMessage(null)
    setError(null)
    const deadline = performance.now() + MIC_TEST_SECONDS * 1000
    const countdown = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
      if (mountedRef.current) setMicTestSecondsLeft(remaining)
    }, 200)

    try {
      await new Promise((resolve) => window.setTimeout(resolve, MIC_TEST_SECONDS * 1000))
      if (!mountedRef.current) return false

      const ring = ringRef.current
      const framesWritten = (ring?.totalFramesWritten ?? startedAt) - startedAt
      const capturedSeconds = ring && framesWritten > 0
        ? Math.min(MIC_TEST_SECONDS, framesWritten / ring.sampleRate)
        : 0
      const channels = ring && capturedSeconds > 0 ? copyRecentFrames(ring, capturedSeconds) : []
      const samples = channels[0] ?? new Float32Array()
      const wav = samples.length > 0 && ring ? encodePcmWav(channels, ring.sampleRate) : new Uint8Array()
      const validation = samples.length > 0 ? validateWavRecording(wav) : null
      const classification = classifyMicTest({
        frameCount: samples.length,
        peak: peakOfSamples(samples),
        decodeError: validation && !validation.ok ? validation.error : null,
      })

      logClipPipeline('mic:testAnalysis', {
        framesWritten,
        classification: classification.kind,
        message: classification.kind === 'ok' ? '' : classification.message,
      })

      if (classification.kind !== 'ok') {
        setMicTestMessage(classification.message)
        return false
      }

      setMicTestSecondsLeft(0)
      setMicTestMessage('Playing back test recording...')
      const blob = wavBlob(wav)
      await playBlobAudio(blob, micTestPlaybackBudget(validation?.ok ? validation.durationMs : MIC_TEST_SECONDS * 1000))
      if (mountedRef.current) {
        setMicTestMessage('Microphone test passed. You should have heard your recording.')
      }
      return true
    } catch (caught) {
      logClipPipelineError('mic:testFailed', caught, {})
      if (mountedRef.current) setMicTestMessage('Microphone test failed before it could finish.')
      return false
    } finally {
      window.clearInterval(countdown)
      isTestingRef.current = false
      if (mountedRef.current) {
        setIsTestingMic(false)
        setMicTestSecondsLeft(MIC_TEST_SECONDS)
      }
    }
  }, [])

  const clipBuffer = useCallback(async (): Promise<RecordingResult | null> => {
    if (!canCaptureClip({
      isListening: Boolean(streamRef.current) && capturingRef.current,
      isSaving: false,
      isTestingMic: isTestingRef.current,
    })) {
      setError(isTestingRef.current
        ? 'Wait for the microphone test to finish before clipping.'
        : 'Audio capture is not ready yet.')
      return null
    }

    const ring = ringRef.current
    if (!ring) {
      setError('Nothing in the replay buffer yet. Keep the audio playing for a moment.')
      return null
    }

    const channels = copyRecentFrames(ring, replayWindowSeconds(bufferLengthSecRef.current))
    if (!channels[0]?.length) {
      setError('Nothing in the replay buffer yet. Keep the audio playing for a moment.')
      return null
    }
    const wav = encodePcmWav(channels, ring.sampleRate)
    const validation = validateWavRecording(wav)
    if (!validation.ok) {
      setError(validation.error)
      logClipPipeline('clip:rejected', { error: validation.error, bytes: wav.byteLength })
      return null
    }

    logClipPipeline('clip:captured', {
      mimeType: 'audio/wav',
      bytes: wav.byteLength,
      durationMs: validation.durationMs,
      frameCount: validation.frameCount,
      sampleRate: validation.sampleRate,
    })

    return {
      blob: wavBlob(wav),
      mimeType: 'audio/wav',
      durationMs: validation.durationMs,
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void startListeningRef.current()
    return () => {
      mountedRef.current = false
      isTestingRef.current = false
      startTokenRef.current += 1
      isStartingRef.current = false
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      teardownRef.current()
    }
  }, [captureConfig.source, captureConfig.virtualAudioInputDeviceId, captureConfig.audioInputDeviceId])

  useEffect(() => {
    if (!isListening) return
    const interval = window.setInterval(() => {
      const track = streamRef.current?.getAudioTracks()[0]
      const trackLive = track?.readyState === 'live'
      if (!shouldRestartCapture({
        isTestingMic: isTestingRef.current,
        trackLive: Boolean(trackLive),
        capturing: capturingRef.current && graphRef.current?.context.state !== 'closed',
      })) {
        return
      }
      scheduleAutoRestartRef.current(trackLive ? 'watchdog-capture' : 'watchdog-stream')
    }, 3000)
    return () => window.clearInterval(interval)
  }, [isListening])

  useEffect(() => {
    void window.electronAPI?.recorder?.setStatus({ isListening })
  }, [isListening])

  const resetError = useCallback(() => setError(null), [])

  return {
    bufferLengthSec,
    setBufferLengthSec,
    bufferedMs,
    isListening,
    isRequestingMic,
    microphoneLabel,
    microphoneNotice,
    micLevelPercent,
    isTestingMic,
    micTestSecondsLeft,
    micTestMessage,
    testMicrophone,
    error,
    clipBuffer,
    resetError,
    startListening,
    stopListening: teardownRecording,
    replayAudioSource: captureConfig.source,
  }
}
