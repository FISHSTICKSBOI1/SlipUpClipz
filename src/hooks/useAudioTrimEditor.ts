import { useCallback, useEffect, useRef, useState } from 'react'
import { trimAudioBuffer } from '../lib/audioTrim'
import { formatDecodeException } from '../lib/clipDebug'
import { logClipPipeline, logClipPipelineError, summarizeBlob } from '../lib/clipPipelineLog'
import { computeWaveformPeaks, decodeAudioBlob, peaksToDurationMs } from '../lib/waveform'
import type { RecordingResult } from '../types/clip'

const MIN_SELECTION_SEC = 0.1
const WAVEFORM_BARS = 200

export function useAudioTrimEditor(blob: Blob | null) {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [durationSec, setDurationSec] = useState(0)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [playheadSec, setPlayheadSec] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const previewEndTimerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const previewAnchorRef = useRef({
    contextStart: 0,
    bufferOffset: 0,
    selectionEnd: 0,
  })
  const startSecRef = useRef(0)
  const endSecRef = useRef(0)

  startSecRef.current = startSec
  endSecRef.current = endSec

  const clearPreviewTimers = useCallback(() => {
    if (previewEndTimerRef.current !== null) {
      window.clearTimeout(previewEndTimerRef.current)
      previewEndTimerRef.current = null
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const stopSourceOnly = useCallback(() => {
    clearPreviewTimers()
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.onended = null
        previewSourceRef.current.stop()
      } catch {
        // Already stopped.
      }
      previewSourceRef.current.disconnect()
      previewSourceRef.current = null
    }
  }, [clearPreviewTimers])

  const stopPreview = useCallback(() => {
    stopSourceOnly()
    setIsPreviewing(false)
    setIsPaused(false)
    setPlayheadSec(startSecRef.current)
  }, [stopSourceOnly])

  const tickPlayhead = useCallback(() => {
    const context = audioContextRef.current
    if (!context) return

    const { contextStart, bufferOffset, selectionEnd } = previewAnchorRef.current
    const elapsed = context.currentTime - contextStart
    const next = Math.min(selectionEnd, bufferOffset + elapsed)
    setPlayheadSec(next)

    if (next >= selectionEnd - 0.001) {
      return
    }

    rafRef.current = window.requestAnimationFrame(tickPlayhead)
  }, [])

  const startPlaybackFrom = useCallback(
    async (fromSec: number) => {
      if (!audioBuffer) return

      const selectionStart = startSecRef.current
      const selectionEnd = endSecRef.current
      if (selectionEnd <= selectionStart) return

      const clamped = Math.max(selectionStart, Math.min(fromSec, selectionEnd - 0.01))
      const remaining = selectionEnd - clamped
      if (remaining <= 0.01) {
        stopPreview()
        return
      }

      stopSourceOnly()

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      const context = audioContextRef.current
      if (context.state === 'suspended') {
        await context.resume()
      }

      const source = context.createBufferSource()
      source.buffer = audioBuffer
      source.connect(context.destination)
      source.onended = () => {
        if (previewSourceRef.current !== source) return
        previewSourceRef.current = null
        clearPreviewTimers()
        setIsPreviewing(false)
        setIsPaused(false)
        setPlayheadSec(startSecRef.current)
      }

      previewSourceRef.current = source
      previewAnchorRef.current = {
        contextStart: context.currentTime,
        bufferOffset: clamped,
        selectionEnd,
      }

      setPlayheadSec(clamped)
      setIsPreviewing(true)
      setIsPaused(false)
      source.start(0, clamped, remaining)

      previewEndTimerRef.current = window.setTimeout(() => {
        stopPreview()
      }, remaining * 1000 + 80)

      rafRef.current = window.requestAnimationFrame(tickPlayhead)
    },
    [audioBuffer, clearPreviewTimers, stopPreview, stopSourceOnly, tickPlayhead],
  )

  const pausePreview = useCallback(() => {
    if (!isPreviewing || isPaused) return
    const context = audioContextRef.current
    if (context) {
      const { contextStart, bufferOffset, selectionEnd } = previewAnchorRef.current
      const frozen = Math.min(
        selectionEnd,
        bufferOffset + (context.currentTime - contextStart),
      )
      setPlayheadSec(frozen)
    }
    stopSourceOnly()
    setIsPreviewing(false)
    setIsPaused(true)
  }, [isPaused, isPreviewing, stopSourceOnly])

  const resumePreview = useCallback(() => {
    void startPlaybackFrom(playheadSec)
  }, [playheadSec, startPlaybackFrom])

  const previewSelection = useCallback(async () => {
    await startPlaybackFrom(startSecRef.current)
  }, [startPlaybackFrom])

  const seekPreview = useCallback(
    (sec: number) => {
      const selectionStart = startSecRef.current
      const selectionEnd = endSecRef.current
      const clamped = Math.max(selectionStart, Math.min(sec, selectionEnd))
      setPlayheadSec(clamped)

      if (isPreviewing && !isPaused) {
        void startPlaybackFrom(clamped)
        return
      }

      if (isPaused) {
        setIsPaused(true)
      }
    },
    [isPaused, isPreviewing, startPlaybackFrom],
  )

  useEffect(() => {
    if (!blob) {
      setAudioBuffer(null)
      setPeaks([])
      setDurationSec(0)
      setStartSec(0)
      setEndSec(0)
      setPlayheadSec(0)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    logClipPipeline('trimEditor:load', { blob: summarizeBlob(blob) })

    void decodeAudioBlob(blob)
      .then((buffer) => {
        if (cancelled) return

        const duration = buffer.duration
        setAudioBuffer(buffer)
        setPeaks(computeWaveformPeaks(buffer, WAVEFORM_BARS))
        setDurationSec(duration)
        setStartSec(0)
        setEndSec(duration)
        setPlayheadSec(0)

        logClipPipeline('trimEditor:ready', {
          durationSec: duration,
          peakCount: WAVEFORM_BARS,
        })
      })
      .catch((caught) => {
        if (!cancelled) {
          logClipPipelineError('trimEditor:decodeFailed', caught, {
            blob: summarizeBlob(blob),
            decodeAudioDataException: formatDecodeException(caught),
          })
          setError('Could not decode this clip for editing.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [blob])

  useEffect(() => {
    return () => {
      stopPreview()
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [stopPreview])

  const isPreviewingRef = useRef(false)
  isPreviewingRef.current = isPreviewing

  // When the trim region changes, stop an active preview and keep the playhead in range.
  // Do NOT depend on isPreviewing/isPaused — that previously stopped playback the instant it started.
  useEffect(() => {
    if (isPreviewingRef.current) {
      stopPreview()
      return
    }

    setPlayheadSec((current) => {
      if (current < startSec || current > endSec) {
        return startSec
      }
      return current
    })
  }, [endSec, startSec, stopPreview])

  const clampSelection = useCallback(
    (nextStart: number, nextEnd: number) => {
      if (durationSec <= 0) {
        return { start: 0, end: 0 }
      }

      let start = Math.max(0, Math.min(nextStart, durationSec))
      let end = Math.max(0, Math.min(nextEnd, durationSec))

      if (end - start < MIN_SELECTION_SEC) {
        if (nextStart !== startSec) {
          end = Math.min(durationSec, start + MIN_SELECTION_SEC)
          start = Math.max(0, end - MIN_SELECTION_SEC)
        } else {
          start = Math.max(0, end - MIN_SELECTION_SEC)
          end = Math.min(durationSec, start + MIN_SELECTION_SEC)
        }
      }

      if (start > end - MIN_SELECTION_SEC) {
        start = Math.max(0, end - MIN_SELECTION_SEC)
      }

      return { start, end }
    },
    [durationSec, startSec],
  )

  const setStartHandle = useCallback(
    (value: number) => {
      const { start, end } = clampSelection(value, endSec)
      setStartSec(start)
      setEndSec(end)
    },
    [clampSelection, endSec],
  )

  const setEndHandle = useCallback(
    (value: number) => {
      const { start, end } = clampSelection(startSec, value)
      setStartSec(start)
      setEndSec(end)
    },
    [clampSelection, startSec],
  )

  const moveSelection = useCallback(
    (deltaSec: number) => {
      if (durationSec <= 0) return
      const length = endSec - startSec
      if (length <= 0) return

      let nextStart = startSec + deltaSec
      let nextEnd = endSec + deltaSec

      if (nextStart < 0) {
        nextStart = 0
        nextEnd = length
      }
      if (nextEnd > durationSec) {
        nextEnd = durationSec
        nextStart = Math.max(0, durationSec - length)
      }

      setStartSec(nextStart)
      setEndSec(nextEnd)
    },
    [durationSec, endSec, startSec],
  )

  const setSelectionRange = useCallback(
    (nextStart: number, nextEnd: number) => {
      const { start, end } = clampSelection(nextStart, nextEnd)
      setStartSec(start)
      setEndSec(end)
    },
    [clampSelection],
  )

  const buildTrimmedRecording = useCallback((): RecordingResult | null => {
    if (!audioBuffer) return null
    return trimAudioBuffer(audioBuffer, startSec, endSec)
  }, [audioBuffer, endSec, startSec])

  const selectionDurationMs = Math.round((endSec - startSec) * 1000)
  const totalDurationMs = audioBuffer ? peaksToDurationMs(audioBuffer) : 0

  return {
    peaks,
    durationSec,
    startSec,
    endSec,
    playheadSec,
    setStartHandle,
    setEndHandle,
    moveSelection,
    setSelectionRange,
    isLoading,
    error,
    isPreviewing,
    isPaused,
    previewSelection,
    pausePreview,
    resumePreview,
    stopPreview,
    seekPreview,
    buildTrimmedRecording,
    selectionDurationMs,
    totalDurationMs,
  }
}
