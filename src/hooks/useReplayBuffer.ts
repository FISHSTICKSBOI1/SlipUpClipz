import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordingResult } from '../types/clip'
import { inspectAudioContainer } from '../lib/clipDebug'
import {
  analyzeBlobSamples,
  getMicTrackDiagnostics,
  logMicSilenceAnalysis,
  logMicTrackDiagnostics,
  micPeakToPercent,
  playBlobAudio,
  readMicPeakLevel,
  sampleAnalyserPeak,
  startMicMonitor,
  type MicMonitorHandle,
  type MicSampleAnalysis,
} from '../lib/microphoneMonitor'
import {
  acquireMicrophoneStream,
  acquireReplayCaptureStream,
  getMicrophoneErrorMessage,
  queryMicrophonePermission,
  releaseSystemAudioCapture,
  type ReplayCaptureConfig,
} from '../lib/replayAudioCapture'
import {
  logClipPipeline,
  logClipPipelineError,
  summarizeBlob,
} from '../lib/clipPipelineLog'

export type { ReplayCaptureConfig }

/** Temporary: bypass replay buffer and record 5s directly to isolate decode failures. */
export const BYPASS_REPLAY_BUFFER_FOR_DEBUG = false
export const DIRECT_RECORD_TEST_SECONDS = 5
export const MIC_TEST_SECONDS = 5

const CHUNK_TIMESLICE_MS = 250

export const MIN_BUFFER_SECONDS = 0
export const MAX_BUFFER_SECONDS = 30
export const DEFAULT_BUFFER_SECONDS = 15

type MediaChunk = {
  blob: Blob
  startMs: number
}

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  const selected =
    candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'audio/webm'

  logClipPipeline('buffer:mimeTypeSelected', {
    mimeType: selected,
    supported: candidates.filter((type) => MediaRecorder.isTypeSupported(type)),
  })

  return selected
}

function blobBaseMimeType(mimeType: string): string {
  return mimeType.split(';')[0]?.trim() || mimeType
}

function validateLiveAudioTrack(stream: MediaStream): MediaStreamTrack | null {
  const track = stream.getAudioTracks()[0]
  if (!track) return null
  if (track.readyState !== 'live' || !track.enabled) return null
  return track
}

export function useReplayBuffer(captureConfig: ReplayCaptureConfig) {
  const [bufferLengthSec, setBufferLengthSec] = useState(DEFAULT_BUFFER_SECONDS)
  const [bufferedMs, setBufferedMs] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [isRequestingMic, setIsRequestingMic] = useState(true)
  const [microphoneLabel, setMicrophoneLabel] = useState<string | null>(null)
  const [micLevelPercent, setMicLevelPercent] = useState(0)
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [micTestMessage, setMicTestMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initChunkRef = useRef<Blob | null>(null)
  const mediaChunksRef = useRef<MediaChunk[]>([])
  const bufferLengthSecRef = useRef(bufferLengthSec)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mimeTypeRef = useRef('audio/webm')
  const pruneTimerRef = useRef<number | null>(null)
  const isFirstChunkRef = useRef(true)
  const totalChunkCountRef = useRef(0)
  const totalBytesRecordedRef = useRef(0)
  const micPermissionRef = useRef<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const micMonitorRef = useRef<MicMonitorHandle | null>(null)
  const micLevelRafRef = useRef<number | null>(null)
  const restartTimerRef = useRef<number | null>(null)
  const isStartingRef = useRef(false)
  const scheduleAutoRestartRef = useRef<(reason: string) => void>(() => {})
  const startListeningRef = useRef<() => Promise<boolean>>(async () => false)
  const captureConfigRef = useRef(captureConfig)
  const usingSystemLoopbackRef = useRef(false)

  captureConfigRef.current = captureConfig

  bufferLengthSecRef.current = bufferLengthSec

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const clearPruneTimer = useCallback(() => {
    if (pruneTimerRef.current !== null) {
      window.clearInterval(pruneTimerRef.current)
      pruneTimerRef.current = null
    }
  }, [])

  const stopMicMonitor = useCallback(() => {
    if (micLevelRafRef.current !== null) {
      cancelAnimationFrame(micLevelRafRef.current)
      micLevelRafRef.current = null
    }

    micMonitorRef.current?.stop()
    micMonitorRef.current = null
    setMicLevelPercent(0)
  }, [])

  const beginMicMonitor = useCallback((stream: MediaStream) => {
    stopMicMonitor()

    void startMicMonitor(stream).then((monitor) => {
      if (streamRef.current !== stream) {
        monitor.stop()
        return
      }

      micMonitorRef.current = monitor

      const tick = () => {
        if (!micMonitorRef.current) return
        const peak = readMicPeakLevel(monitor.analyser)
        setMicLevelPercent(micPeakToPercent(peak))
        micLevelRafRef.current = requestAnimationFrame(tick)
      }

      micLevelRafRef.current = requestAnimationFrame(tick)
    })
  }, [stopMicMonitor])

  const updateBufferedMs = useCallback(() => {
    const mediaChunks = mediaChunksRef.current
    const windowMs = bufferLengthSecRef.current * 1000

    if (mediaChunks.length === 0 && !initChunkRef.current) {
      setBufferedMs(0)
      return
    }

    if (windowMs <= 0) {
      setBufferedMs(initChunkRef.current ? CHUNK_TIMESLICE_MS : 0)
      return
    }

    if (mediaChunks.length === 0) {
      setBufferedMs(Math.min(CHUNK_TIMESLICE_MS, windowMs))
      return
    }

    const oldest = mediaChunks[0].startMs
    const span = Date.now() - oldest + CHUNK_TIMESLICE_MS
    setBufferedMs(Math.min(span, windowMs))
  }, [])

  const pruneOldMediaChunks = useCallback(() => {
    const windowMs = bufferLengthSecRef.current * 1000

    if (windowMs <= 0) {
      if (mediaChunksRef.current.length > 1) {
        mediaChunksRef.current = mediaChunksRef.current.slice(-1)
      }
    } else {
      const cutoff = Date.now() - windowMs
      mediaChunksRef.current = mediaChunksRef.current.filter(
        (chunk) => chunk.startMs >= cutoff,
      )
    }

    updateBufferedMs()
  }, [updateBufferedMs])

  const buildClipBlobFromParts = useCallback(
    (parts: Blob[], mimeType: string): Blob | null => {
      const nonEmpty = parts.filter((part) => part.size > 0)
      if (nonEmpty.length === 0) return null
      return new Blob(nonEmpty, { type: blobBaseMimeType(mimeType) })
    },
    [],
  )

  const logCaptureStats = useCallback((stage: string, extra: Record<string, unknown> = {}) => {
    logClipPipeline(stage, {
      micPermissionGranted:
        micPermissionRef.current === 'granted' || micPermissionRef.current === 'prompt',
      micPermission: micPermissionRef.current,
      mediaRecorderStarted: mediaRecorderRef.current?.state === 'recording',
      mediaRecorderState: mediaRecorderRef.current?.state ?? 'none',
      totalChunksRecorded: totalChunkCountRef.current,
      totalBytesRecorded: totalBytesRecordedRef.current,
      initChunkBytes: initChunkRef.current?.size ?? 0,
      mediaChunkCount: mediaChunksRef.current.length,
      mimeType: mimeTypeRef.current,
      ...extra,
    })
  }, [])

  const attachRecorder = useCallback(
    (stream: MediaStream) => {
      const mimeType = pickMimeType()
      mimeTypeRef.current = mimeType
      initChunkRef.current = null
      mediaChunksRef.current = []
      isFirstChunkRef.current = true
      totalChunkCountRef.current = 0
      totalBytesRecordedRef.current = 0

      const recorder = new MediaRecorder(stream, { mimeType })

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return

        totalChunkCountRef.current += 1
        totalBytesRecordedRef.current += event.data.size

        if (isFirstChunkRef.current) {
          initChunkRef.current = event.data
          isFirstChunkRef.current = false
          logClipPipeline('buffer:initChunk', {
            mimeType,
            initChunk: summarizeBlob(event.data),
            chunkIndex: totalChunkCountRef.current,
            totalBytesRecorded: totalBytesRecordedRef.current,
          })
          updateBufferedMs()
          return
        }

        mediaChunksRef.current.push({ blob: event.data, startMs: Date.now() })
        pruneOldMediaChunks()

        logClipPipeline('buffer:mediaChunk', {
          mediaChunkCount: mediaChunksRef.current.length,
          latestChunkBytes: event.data.size,
          chunkIndex: totalChunkCountRef.current,
          totalBytesRecorded: totalBytesRecordedRef.current,
          bufferedMs: bufferLengthSecRef.current * 1000,
        })
      }

      mediaRecorderRef.current = recorder
      recorder.start(CHUNK_TIMESLICE_MS)

      if (recorder.state !== 'recording') {
        throw new Error('Microphone recorder failed to start.')
      }

      logClipPipeline('buffer:recorderStarted', {
        mimeType,
        timesliceMs: CHUNK_TIMESLICE_MS,
        recorderState: recorder.state,
        mediaRecorderStarted: recorder.state === 'recording',
      })
    },
    [pruneOldMediaChunks, updateBufferedMs],
  )

  const notifyRecordingIssue = useCallback((body: string) => {
    setError(body)
    void window.electronAPI?.recorder?.notify({
      title: 'SlipUpClipz',
      body,
    })
  }, [])

  const teardownRecording = useCallback(() => {
    clearPruneTimer()
    stopMicMonitor()

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    mediaRecorderRef.current = null
    releaseStream()
    initChunkRef.current = null
    mediaChunksRef.current = []

    if (usingSystemLoopbackRef.current) {
      usingSystemLoopbackRef.current = false
      void releaseSystemAudioCapture()
    }

    setIsListening(false)
    setMicrophoneLabel(null)
  }, [clearPruneTimer, releaseStream, stopMicMonitor])

  const scheduleAutoRestart = useCallback(
    (reason: string) => {
      if (restartTimerRef.current !== null || isStartingRef.current) {
        return
      }

      logClipPipeline('buffer:autoRestartScheduled', { reason })
      teardownRecording()
      notifyRecordingIssue(`Recording stopped (${reason}). Restarting audio capture...`)

      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        void startListeningRef.current().then((started) => {
          if (started) {
            notifyRecordingIssue('Microphone recording restarted.')
            window.setTimeout(() => setError(null), 4000)
          }
        })
      }, 1500)
    },
    [notifyRecordingIssue, teardownRecording],
  )

  scheduleAutoRestartRef.current = scheduleAutoRestart

  const handleTrackEnded = useCallback(() => {
    logClipPipeline('buffer:trackEnded', {})
    scheduleAutoRestartRef.current('track-ended')
  }, [])

  const stopRecorderAndCollectFinalChunks = useCallback(
    async (recorder: MediaRecorder): Promise<Blob[]> => {
      const finalChunks: Blob[] = []

      await new Promise<void>((resolve) => {
        const onData = (event: BlobEvent) => {
          if (event.data.size === 0) return

          finalChunks.push(event.data)
          totalChunkCountRef.current += 1
          totalBytesRecordedRef.current += event.data.size

          logClipPipeline('buffer:stopChunk', {
            bytes: event.data.size,
            chunkIndex: totalChunkCountRef.current,
            totalBytesRecorded: totalBytesRecordedRef.current,
          })
        }

        recorder.addEventListener('dataavailable', onData)
        recorder.addEventListener(
          'stop',
          () => {
            recorder.removeEventListener('dataavailable', onData)
            resolve()
          },
          { once: true },
        )
        recorder.stop()
      })

      return finalChunks
    },
    [],
  )

  const recordDirectTestCapture = useCallback(async (): Promise<RecordingResult | null> => {
    const stream = streamRef.current
    if (!stream) {
      setError('Microphone is not ready yet.')
      logClipPipeline('clip:directTestAborted', { reason: 'no-stream' })
      return null
    }

    logCaptureStats('clip:directTestStart', {
      bypassReplayBuffer: true,
      durationSec: DIRECT_RECORD_TEST_SECONDS,
    })

    clearPruneTimer()

    const existing = mediaRecorderRef.current
    if (existing && existing.state === 'recording') {
      await stopRecorderAndCollectFinalChunks(existing)
    }
    mediaRecorderRef.current = null
    initChunkRef.current = null
    mediaChunksRef.current = []

    const mimeType = pickMimeType()
    mimeTypeRef.current = mimeType
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType })

    const blobPromise = new Promise<Blob | null>((resolve) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return
        chunks.push(event.data)
        logClipPipeline('clip:directTestChunk', {
          chunkIndex: chunks.length,
          bytes: event.data.size,
          totalBytesRecorded: chunks.reduce((sum, part) => sum + part.size, 0),
        })
      }
      recorder.onstop = async () => {
        if (chunks.length === 0) {
          resolve(null)
          return
        }

        const blob = new Blob(chunks, { type: blobBaseMimeType(mimeType) })
        const container = await inspectAudioContainer(blob)
        logClipPipeline('clip:directTestCaptured', {
          mimeType,
          blob: summarizeBlob(blob),
          chunkCount: chunks.length,
          totalBytes: blob.size,
          mediaRecorderStarted: true,
          container,
        })
        resolve(blob)
      }
    })

    recorder.start()
    logClipPipeline('clip:directTestRecording', {
      mimeType,
      recorderState: recorder.state,
      mediaRecorderStarted: recorder.state === 'recording',
      durationSec: DIRECT_RECORD_TEST_SECONDS,
    })

    await new Promise((resolve) => {
      window.setTimeout(resolve, DIRECT_RECORD_TEST_SECONDS * 1000)
    })

    if (recorder.state === 'recording') {
      recorder.stop()
    }

    const blob = await blobPromise

    attachRecorder(stream)
    pruneTimerRef.current = window.setInterval(pruneOldMediaChunks, 500)

    if (!blob || blob.size === 0) {
      setError('Direct test recording produced no audio.')
      logClipPipeline('clip:directTestAborted', { reason: 'empty-blob' })
      return null
    }

    return {
      blob,
      mimeType: blob.type || blobBaseMimeType(mimeType),
      durationMs: DIRECT_RECORD_TEST_SECONDS * 1000,
    }
  }, [attachRecorder, clearPruneTimer, logCaptureStats, pruneOldMediaChunks, stopRecorderAndCollectFinalChunks])

  const testMicrophone = useCallback(async (): Promise<boolean> => {
    const stream = streamRef.current
    const analyser = micMonitorRef.current?.analyser

    if (!stream || !isListening) {
      setMicTestMessage('Microphone is not active. Grant permission and try again.')
      return false
    }

    const diagnostics = getMicTrackDiagnostics(stream)
    if (!diagnostics.hasAudioTrack) {
      logClipPipeline('mic:testAborted', {
        reason: 'noAudioTrack',
        mic: diagnostics,
      })
      setMicTestMessage('No audio track is being received from the microphone.')
      return false
    }

    setIsTestingMic(true)
    setMicTestMessage(`Recording ${MIC_TEST_SECONDS} seconds...`)
    setError(null)

    clearPruneTimer()

    const existing = mediaRecorderRef.current
    if (existing && existing.state === 'recording') {
      await stopRecorderAndCollectFinalChunks(existing)
    }
    mediaRecorderRef.current = null

    try {
      const mimeType = pickMimeType()
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream, { mimeType })

      const blobPromise = new Promise<Blob | null>((resolve) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }
        recorder.onstop = () => {
          if (chunks.length === 0) {
            resolve(null)
            return
          }
          resolve(new Blob(chunks, { type: blobBaseMimeType(mimeType) }))
        }
      })

      recorder.start()

      const livePeakPromise = analyser
        ? sampleAnalyserPeak(analyser, MIC_TEST_SECONDS * 1000)
        : Promise.resolve(0)

      await new Promise((resolve) => {
        window.setTimeout(resolve, MIC_TEST_SECONDS * 1000)
      })

      if (recorder.state === 'recording') {
        recorder.stop()
      }

      const [blob, livePeak] = await Promise.all([blobPromise, livePeakPromise])

      if (!blob || blob.size === 0) {
        logClipPipeline('mic:testAborted', {
          reason: 'emptyBlob',
          livePeakDuringRecording: livePeak,
          mic: diagnostics,
        })
        setMicTestMessage('No audio data was captured during the test recording.')
        return false
      }

      const blobAnalysis = await analyzeBlobSamples(blob)

      const streamSampleAnalysis: MicSampleAnalysis = {
        silent: livePeak < 0.001,
        peak: livePeak,
        rms: livePeak / Math.sqrt(2),
        allZeros: livePeak === 0,
        sampleCount: 0,
        reason: livePeak === 0 ? 'allZeros' : livePeak < 0.001 ? 'allZeros' : 'ok',
      }

      logMicSilenceAnalysis(
        'mic:testAnalysis',
        streamSampleAnalysis,
        blobAnalysis,
        livePeak,
        diagnostics,
      )

      const silent =
        !diagnostics.hasAudioTrack ||
        diagnostics.muted ||
        livePeak < 0.001 ||
        blobAnalysis.silent ||
        blobAnalysis.allZeros

      if (silent) {
        const reason = !diagnostics.hasAudioTrack
          ? 'no audio track is being received'
          : diagnostics.muted
            ? 'the microphone track is muted'
            : blobAnalysis.allZeros
              ? 'decoded audio samples are all zeros'
              : livePeak < 0.001
                ? 'live input level stayed at zero'
                : 'audio level is too low'
        logClipPipeline('mic:testSilent', {
          reason,
          livePeakDuringRecording: livePeak,
          blobAnalysis,
          mic: diagnostics,
        })
        setMicTestMessage(`Test recording is silent: ${reason}.`)
      } else {
        setMicTestMessage('Playing back test recording...')
      }

      await playBlobAudio(blob)

      if (silent) {
        setMicTestMessage(
          'Microphone test finished, but the recording was silent. Check Windows microphone privacy settings and the selected input device.',
        )
        return false
      }

      setMicTestMessage('Microphone test passed. You should have heard your recording.')
      return true
    } catch (caught) {
      logClipPipelineError('mic:testFailed', caught, {
        mic: getMicTrackDiagnostics(stream),
      })
      setMicTestMessage('Microphone test failed. See the console for details.')
      return false
    } finally {
      attachRecorder(stream)
      pruneTimerRef.current = window.setInterval(pruneOldMediaChunks, 500)
      setIsTestingMic(false)
    }
  }, [
    attachRecorder,
    clearPruneTimer,
    isListening,
    pruneOldMediaChunks,
    stopRecorderAndCollectFinalChunks,
  ])

  const startListening = useCallback(async (): Promise<boolean> => {
    if (isStartingRef.current) {
      return false
    }

    const config = captureConfigRef.current
    const isMicrophoneSource = config.source === 'microphone'

    isStartingRef.current = true
    setError(null)
    setIsListening(false)
    setMicrophoneLabel(null)
    setIsRequestingMic(true)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio capture is not supported in this environment.')
      setIsRequestingMic(false)
      isStartingRef.current = false
      return false
    }

    if (isMicrophoneSource) {
      const permission = await queryMicrophonePermission()
      micPermissionRef.current = permission
      logClipPipeline('buffer:permission', {
        permission,
        micPermissionGranted: permission === 'granted' || permission === 'prompt',
        replayAudioSource: config.source,
      })

      if (permission === 'denied') {
        setError('Microphone permission was denied. Allow access in system settings and reload the app.')
        setIsRequestingMic(false)
        isStartingRef.current = false
        return false
      }
    } else {
      micPermissionRef.current = 'granted'
      logClipPipeline('buffer:permission', {
        permission: 'not-required',
        replayAudioSource: config.source,
      })
    }

    try {
      let stream: MediaStream
      let label: string

      if (isMicrophoneSource) {
        const captured = await acquireMicrophoneStream()
        stream = captured.stream
        label = captured.label
      } else {
        if (config.source === 'system') {
          usingSystemLoopbackRef.current = true
        }
        const captured = await acquireReplayCaptureStream(config)
        stream = captured.stream
        label = captured.label
      }

      const track = validateLiveAudioTrack(stream)

      if (!track) {
        stream.getTracks().forEach((entry) => entry.stop())
        if (usingSystemLoopbackRef.current) {
          usingSystemLoopbackRef.current = false
          await releaseSystemAudioCapture()
        }
        throw new DOMException('Audio track is not live.', 'NotReadableError')
      }

      track.addEventListener('ended', handleTrackEnded)
      track.addEventListener('mute', () => {
        logClipPipeline('mic:trackMuted', { mic: getMicTrackDiagnostics(stream) })
      })
      track.addEventListener('unmute', () => {
        logClipPipeline('mic:trackUnmuted', { mic: getMicTrackDiagnostics(stream) })
      })

      streamRef.current = stream
      beginMicMonitor(stream)
      attachRecorder(stream)

      const diagnostics = logMicTrackDiagnostics('mic:streamReady', stream)
      if (diagnostics.muted) {
        logClipPipeline('mic:mutedInput', { mic: diagnostics })
      }

      micPermissionRef.current = 'granted'
      pruneTimerRef.current = window.setInterval(pruneOldMediaChunks, 500)
      setMicrophoneLabel(label)
      setIsListening(true)

      logClipPipeline('buffer:listening', {
        trackCount: stream.getAudioTracks().length,
        trackState: track.readyState,
        trackEnabled: track.enabled,
        inputLabel: label,
        replayAudioSource: config.source,
      })

      return true
    } catch (caught) {
      if (usingSystemLoopbackRef.current) {
        usingSystemLoopbackRef.current = false
        await releaseSystemAudioCapture()
      }

      logClipPipelineError('buffer:captureFailed', caught, {
        replayAudioSource: config.source,
      })
      setError(getMicrophoneErrorMessage(caught))
      stopMicMonitor()
      releaseStream()
      setIsListening(false)
      setMicrophoneLabel(null)
      return false
    } finally {
      setIsRequestingMic(false)
      isStartingRef.current = false
    }
  }, [attachRecorder, beginMicMonitor, handleTrackEnded, pruneOldMediaChunks, releaseStream, stopMicMonitor])

  startListeningRef.current = startListening

  useEffect(() => {
    void startListening()

    return () => {
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }

      teardownRecording()
    }
  }, [startListening, teardownRecording, captureConfig.source, captureConfig.virtualAudioInputDeviceId])

  useEffect(() => {
    if (!isListening) return

    const interval = window.setInterval(() => {
      const stream = streamRef.current
      const recorder = mediaRecorderRef.current
      const track = stream?.getAudioTracks()[0]

      if (!stream || !recorder || !track || track.readyState !== 'live') {
        scheduleAutoRestartRef.current('watchdog-stream')
        return
      }

      if (recorder.state !== 'recording') {
        scheduleAutoRestartRef.current('watchdog-recorder')
      }
    }, 3000)

    return () => window.clearInterval(interval)
  }, [isListening])

  useEffect(() => {
    void window.electronAPI?.recorder?.setStatus({ isListening })
  }, [isListening])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible' || !isListening) return

      const recorder = mediaRecorderRef.current
      const track = streamRef.current?.getAudioTracks()[0]
      if (!track || track.readyState !== 'live' || recorder?.state !== 'recording') {
        scheduleAutoRestartRef.current('visibility-recover')
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [isListening])

  useEffect(() => {
    pruneOldMediaChunks()
  }, [bufferLengthSec, pruneOldMediaChunks])

  const clipBuffer = useCallback(async (): Promise<RecordingResult | null> => {
    if (BYPASS_REPLAY_BUFFER_FOR_DEBUG) {
      return recordDirectTestCapture()
    }

    pruneOldMediaChunks()
    logCaptureStats('clip:start')

    const recorder = mediaRecorderRef.current
    const stream = streamRef.current
    if (!recorder || recorder.state !== 'recording' || !stream) {
      setError('Microphone is not ready yet.')
      logClipPipeline('clip:aborted', { reason: 'recorder-not-ready' })
      return null
    }

    const mimeType = mimeTypeRef.current
    const parts: Blob[] = []

    if (initChunkRef.current && initChunkRef.current.size > 0) {
      parts.push(initChunkRef.current)
    }

    for (const chunk of mediaChunksRef.current) {
      if (chunk.blob.size > 0) {
        parts.push(chunk.blob)
      }
    }

    const hasInit = parts.length > 0
    const mediaChunkCount = mediaChunksRef.current.length

    if (!hasInit && mediaChunkCount === 0) {
      setError('Nothing in the replay buffer yet. Keep talking for a moment.')
      logClipPipeline('clip:aborted', { reason: 'empty-buffer' })
      return null
    }

    clearPruneTimer()
    const finalChunks = await stopRecorderAndCollectFinalChunks(recorder)
    mediaRecorderRef.current = null

    for (const chunk of finalChunks) {
      parts.push(chunk)
    }

    const blob = buildClipBlobFromParts(parts, mimeType)
    if (!blob || blob.size === 0) {
      setError('Could not capture audio from the replay buffer.')
      logClipPipeline('clip:aborted', {
        reason: 'empty-blob',
        hasInit,
        mediaChunkCount,
        finalChunkCount: finalChunks.length,
        partCount: parts.length,
      })
      return null
    }

    const container = await inspectAudioContainer(blob)
    const windowMs = bufferLengthSecRef.current * 1000
    const oldestMedia = mediaChunksRef.current[0]?.startMs
    const durationMs =
      windowMs <= 0
        ? CHUNK_TIMESLICE_MS
        : oldestMedia
          ? Math.min(Date.now() - oldestMedia + CHUNK_TIMESLICE_MS, windowMs)
          : CHUNK_TIMESLICE_MS

    logClipPipeline('clip:captured', {
      mimeType,
      blob: summarizeBlob(blob),
      blobSizeBeforeDecode: blob.size,
      hasInitChunk: hasInit,
      initChunkBytes: initChunkRef.current?.size ?? 0,
      mediaChunkCount,
      finalChunkCount: finalChunks.length,
      partCount: parts.length,
      totalChunksRecorded: totalChunkCountRef.current,
      totalBytesRecorded: totalBytesRecordedRef.current,
      container,
      durationMs,
    })

    attachRecorder(stream)
    pruneTimerRef.current = window.setInterval(pruneOldMediaChunks, 500)
    logClipPipeline('buffer:recorderRestarted', {})

    return {
      blob,
      mimeType: blob.type || blobBaseMimeType(mimeType),
      durationMs,
    }
  }, [
    attachRecorder,
    buildClipBlobFromParts,
    clearPruneTimer,
    logCaptureStats,
    pruneOldMediaChunks,
    recordDirectTestCapture,
    stopRecorderAndCollectFinalChunks,
  ])

  const resetError = useCallback(() => setError(null), [])

  return {
    bufferLengthSec,
    setBufferLengthSec,
    bufferedMs,
    isListening,
    isRequestingMic,
    microphoneLabel,
    micLevelPercent,
    isTestingMic,
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
