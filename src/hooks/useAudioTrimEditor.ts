import { useCallback, useEffect, useRef, useState } from 'react'
import {
  audioBufferFromPcm,
  beginEditSession,
  commitRemoval,
  pcmFromAudioBuffer,
  resetEdit,
  trimAudioBuffer,
  undoEdit,
  viewAfterRemoval,
  type EditSession,
} from '../lib/audioTrim'
import { playbackStartSec } from '../lib/trimPlayback'
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
  const [notice, setNotice] = useState<string | null>(null)
  const [removalCount, setRemovalCount] = useState(0)
  const sessionRef = useRef<EditSession | null>(null)
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
  const playheadSecRef = useRef(0)
  const playbackTokenRef = useRef(0)
  const isPreviewingRef = useRef(false)

  startSecRef.current = startSec
  endSecRef.current = endSec

  const rememberPlayhead = useCallback((sec: number) => {
    playheadSecRef.current = sec
    setPlayheadSec(sec)
  }, [])

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
    playbackTokenRef.current += 1
    stopSourceOnly()
    isPreviewingRef.current = false
    setIsPreviewing(false)
    setIsPaused(false)
    playheadSecRef.current = startSecRef.current
    setPlayheadSec(startSecRef.current)
  }, [stopSourceOnly])

  const tickPlayhead = useCallback(() => {
    const context = audioContextRef.current
    if (!context) return

    const { contextStart, bufferOffset, selectionEnd } = previewAnchorRef.current
    const elapsed = context.currentTime - contextStart
    const next = Math.min(selectionEnd, bufferOffset + elapsed)
    playheadSecRef.current = next
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

      const token = ++playbackTokenRef.current
      isPreviewingRef.current = true
      const clamped = playbackStartSec(fromSec, selectionStart, Math.max(selectionStart, selectionEnd - 0.01))
      const remaining = selectionEnd - clamped
      if (remaining <= 0.01) {
        stopPreview()
        return
      }

      stopSourceOnly()
      if (token !== playbackTokenRef.current) return

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
        isPreviewingRef.current = false
        setIsPreviewing(false)
        setIsPaused(false)
        playheadSecRef.current = startSecRef.current
        setPlayheadSec(startSecRef.current)
      }

      if (token !== playbackTokenRef.current) {
        source.disconnect()
        return
      }
      previewSourceRef.current = source
      previewAnchorRef.current = {
        contextStart: context.currentTime,
        bufferOffset: clamped,
        selectionEnd,
      }

      rememberPlayhead(clamped)
      isPreviewingRef.current = true
      setIsPreviewing(true)
      setIsPaused(false)
      source.start(0, clamped, remaining)

      previewEndTimerRef.current = window.setTimeout(() => {
        stopPreview()
      }, remaining * 1000 + 80)

      rafRef.current = window.requestAnimationFrame(tickPlayhead)
    },
    [audioBuffer, clearPreviewTimers, rememberPlayhead, stopPreview, stopSourceOnly, tickPlayhead],
  )

  const pausePreview = useCallback(() => {
    playbackTokenRef.current += 1
    const context = audioContextRef.current
    if (previewSourceRef.current && context) {
      const { contextStart, bufferOffset, selectionEnd } = previewAnchorRef.current
      const frozen = Math.min(
        selectionEnd,
        bufferOffset + (context.currentTime - contextStart),
      )
      rememberPlayhead(frozen)
    }
    stopSourceOnly()
    isPreviewingRef.current = false
    setIsPreviewing(false)
    setIsPaused(true)
  }, [rememberPlayhead, stopSourceOnly])

  const resumePreview = useCallback(() => {
    void startPlaybackFrom(playheadSecRef.current)
  }, [startPlaybackFrom])

  const previewSelection = useCallback(async () => {
    await startPlaybackFrom(playheadSecRef.current)
  }, [startPlaybackFrom])

  const togglePreview = useCallback(() => {
    if (isPreviewingRef.current) {
      pausePreview()
      return
    }
    void startPlaybackFrom(playheadSecRef.current)
  }, [pausePreview, startPlaybackFrom])

  const seekPreview = useCallback(
    (sec: number) => {
      const selectionStart = startSecRef.current
      const selectionEnd = endSecRef.current
      const clamped = Math.max(selectionStart, Math.min(sec, selectionEnd))
      rememberPlayhead(clamped)

      if (isPreviewingRef.current) {
        void startPlaybackFrom(clamped)
        return
      }

      if (isPaused) {
        setIsPaused(true)
      }
    },
    [isPaused, rememberPlayhead, startPlaybackFrom],
  )

  useEffect(() => {
    if (!blob) {
      setAudioBuffer(null)
      setPeaks([])
      setDurationSec(0)
      setStartSec(0)
      setEndSec(0)
      playheadSecRef.current = 0
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
        sessionRef.current = beginEditSession(pcmFromAudioBuffer(buffer))
        setRemovalCount(0)
        setNotice(null)
        setAudioBuffer(buffer)
        setPeaks(computeWaveformPeaks(buffer, WAVEFORM_BARS))
        setDurationSec(duration)
        setStartSec(0)
        setEndSec(duration)
        rememberPlayhead(0)

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

  // When the trim region changes, stop an active preview and keep the playhead in range.
  // Do NOT depend on isPreviewing/isPaused — that previously stopped playback the instant it started.
  useEffect(() => {
    if (isPreviewingRef.current) {
      stopPreview()
      return
    }

    setPlayheadSec((current) => {
      const next = current < startSec || current > endSec ? startSec : current
      playheadSecRef.current = next
      return next
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

  const showBuffer = useCallback(
    (buffer: AudioBuffer) => {
      stopPreview()
      const view = viewAfterRemoval(buffer.duration)
      setAudioBuffer(buffer)
      setPeaks(computeWaveformPeaks(buffer, WAVEFORM_BARS))
      setDurationSec(view.endSec)
      setStartSec(view.startSec)
      rememberPlayhead(view.playheadSec)
      setEndSec(view.endSec)
    },
    [rememberPlayhead, stopPreview],
  )

  const removeSelection = useCallback(
    (isPro: boolean, range: { startSec: number; endSec: number } | null) => {
      const session = sessionRef.current
      if (!session) return false
      if (!isPro) {
        setNotice('Cut is a Pro feature.')
        return false
      }
      if (!range) {
        setNotice('Press C at the cut cursor to mark both sides. That selection cannot be empty or the whole clip.')
        return false
      }
      const removed = commitRemoval(session, range.startSec, range.endSec, true)
      if (removed.error || removed.session === session) {
        setNotice(removed.error ?? 'Choose a region inside the clip to remove.')
        return false
      }
      sessionRef.current = removed.session
      setRemovalCount(removed.session.undo.length)
      setNotice('The cut is ready to preview. Saving keeps the original clip and adds a new one.')
      showBuffer(audioBufferFromPcm(removed.session.current))
      return true
    },
    [showBuffer],
  )

  const undoRemoval = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.undo.length === 0) return false
    const next = undoEdit(session)
    sessionRef.current = next
    setRemovalCount(next.undo.length)
    setNotice(null)
    showBuffer(audioBufferFromPcm(next.current))
    return true
  }, [showBuffer])

  const resetEdits = useCallback(() => {
    const session = sessionRef.current
    if (!session) return false
    const next = resetEdit(session)
    sessionRef.current = next
    setRemovalCount(0)
    setNotice(null)
    showBuffer(audioBufferFromPcm(next.current))
    return true
  }, [showBuffer])

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
    togglePreview,
    stopPreview,
    seekPreview,
    buildTrimmedRecording,
    removeSelection,
    undoRemoval,
    resetEdits,
    hasRemovals: removalCount > 0,
    notice,
    selectionDurationMs,
    totalDurationMs,
  }
}
