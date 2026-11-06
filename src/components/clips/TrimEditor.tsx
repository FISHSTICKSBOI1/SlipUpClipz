import { useCallback, useEffect, useRef, useState } from 'react'
import { useLicense } from '../../context/LicenseContext'
import { requestRemoveSelectionAuthorization } from '../../lib/removeSelectionAccess'
import { formatDuration, formatTimePrecise } from '../../lib/format'
import {
  cutMarkerBounds,
  cutModeControls,
  cutModeKeyDecision,
  cutSpanFromMarkers,
  positionCutCursor,
  emptyCutMarkers,
  placeCutMarker,
  type CutMarkers,
} from '../../lib/audioTrim'
import { isTextEntryTarget, spaceTrimDecision } from '../../lib/trimPlayback'
import { estimateSilenceFloor } from '../../lib/waveform'
import { useAudioTrimEditor } from '../../hooks/useAudioTrimEditor'
import type { RecordingResult } from '../../types/clip'
import { PlayIcon, StopIcon } from '../icons'

type TrimEditorProps = {
  clipName: string
  blob: Blob
  onSave: (
    recording: RecordingResult,
    name: string,
    options?: { asNewClip?: boolean; startSec?: number; endSec?: number },
  ) => void
  onCancel: () => void
  isSaving?: boolean
  saveError?: string | null
}

type DragMode = 'start' | 'end' | 'move' | 'seek' | 'cursor' | null

export function TrimEditor({
  clipName,
  blob,
  onSave,
  onCancel,
  isSaving = false,
  saveError = null,
}: TrimEditorProps) {
  const { isPro } = useLicense()
  const {
    peaks,
    durationSec,
    startSec,
    endSec,
    playheadSec,
    setStartHandle,
    setEndHandle,
    setSelectionRange,
    isLoading,
    error,
    isPreviewing,
    isPaused,
    togglePreview,
    stopPreview,
    seekPreview,
    buildTrimmedRecording,
    removeSelection,
    undoRemoval,
    resetEdits,
    hasRemovals,
    notice,
    selectionDurationMs,
  } = useAudioTrimEditor(blob)

  const editorRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playheadElRef = useRef<HTMLDivElement>(null)
  const [activeHandle, setActiveHandle] = useState<DragMode>(null)
  const moveOriginRef = useRef<{ pointerSec: number; startSec: number; endSec: number } | null>(
    null,
  )
  const [clipNameDraft, setClipNameDraft] = useState(clipName)
  const [cutMode, setCutMode] = useState(false)
  const [cutMarkers, setCutMarkers] = useState<CutMarkers>(emptyCutMarkers)
  const [cutCursorSec, setCutCursorSec] = useState(0)
  const dragModeRef = useRef<DragMode>(null)
  const cutHighlight = cutMarkerBounds(cutMarkers)
  const cutRange = cutSpanFromMarkers(cutMarkers, durationSec)
  const cutControls = cutModeControls({
    cutMode,
    pendingMarkers: cutMarkers.first !== null,
    completedCuts: hasRemovals,
  })

  useEffect(() => {
    setClipNameDraft(clipName)
  }, [clipName])

  const startRatio = durationSec > 0 ? startSec / durationSec : 0
  const endRatio = durationSec > 0 ? endSec / durationSec : 1
  const playheadRatio = durationSec > 0 ? playheadSec / durationSec : 0

  // Keep the DOM playhead in sync every paint while React state updates labels.
  useEffect(() => {
    if (playheadElRef.current) {
      playheadElRef.current.style.left = `${playheadRatio * 100}%`
    }
  }, [playheadRatio])

  useEffect(() => {
    const canvas = canvasRef.current
    const track = trackRef.current
    if (!canvas || !track || peaks.length === 0) return

    const draw = () => {
      const width = track.clientWidth
      const height = track.clientHeight
      if (width <= 0 || height <= 0) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      ctx.fillStyle = 'rgba(148, 163, 184, 0.14)'
      ctx.fillRect(0, height / 2 - 0.5, width, 1)

      const maxPeak = Math.max(...peaks, 0.01)
      const silenceFloor = estimateSilenceFloor(peaks)
      const barWidth = width / peaks.length
      const centerY = height / 2

      peaks.forEach((peak, index) => {
        const x = index * barWidth
        const normalized = peak / maxPeak
        const display = Math.pow(Math.min(1, normalized), 0.72)
        const barHeight = Math.max(2, display * (height * 0.88))
        const ratio = index / peaks.length
        const inSelection = ratio >= startRatio && ratio <= endRatio
        const isSilent = peak <= silenceFloor

        if (isSilent) {
          ctx.fillStyle = inSelection ? 'rgba(52, 211, 153, 0.22)' : 'rgba(55, 65, 81, 0.55)'
        } else if (inSelection) {
          const intensity = 0.55 + display * 0.45
          ctx.fillStyle = `rgba(52, 211, 153, ${intensity.toFixed(3)})`
        } else {
          const intensity = 0.35 + display * 0.45
          ctx.fillStyle = `rgba(129, 140, 248, ${intensity.toFixed(3)})`
        }

        ctx.fillRect(x, centerY - barHeight / 2, Math.max(1.5, barWidth - 1), barHeight)
      })

      // Canvas playhead — drawn every redraw so motion is unmistakable.
      const playheadX = playheadRatio * width
      ctx.save()
      ctx.strokeStyle = cutMode ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.95)'
      ctx.shadowColor = 'rgba(255, 255, 255, 0.85)'
      ctx.shadowBlur = cutMode ? 0 : 10
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.fillStyle = cutMode ? 'rgba(255, 255, 255, 0.35)' : '#ffffff'
      ctx.beginPath()
      ctx.moveTo(playheadX - 6, 0)
      ctx.lineTo(playheadX + 6, 0)
      ctx.lineTo(playheadX, 10)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    draw()

    const observer = new ResizeObserver(draw)
    observer.observe(track)
    return () => observer.disconnect()
  }, [cutMode, peaks, startRatio, endRatio, playheadRatio])

  const ratioFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || durationSec <= 0) return 0

      const rect = track.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      return (x / rect.width) * durationSec
    },
    [durationSec],
  )

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end') => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!cutControls.trimming) return
      event.preventDefault()
      event.stopPropagation()
      dragModeRef.current = handle
      setActiveHandle(handle)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [cutControls.trimming],
  )

  const handleSelectionPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!cutControls.trimming || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const pointerSec = ratioFromClientX(event.clientX)
      moveOriginRef.current = {
        pointerSec,
        startSec,
        endSec,
      }
      dragModeRef.current = 'move'
      setActiveHandle('move')
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [cutControls.trimming, endSec, ratioFromClientX, startSec],
  )

  const handleWaveformSeekDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      if ((event.target as HTMLElement).closest('[data-trim-chrome="true"]')) return
      event.preventDefault()
      event.currentTarget.focus()
      const sec = ratioFromClientX(event.clientX)
      if (!cutControls.playhead) {
        setCutCursorSec(positionCutCursor(sec, durationSec))
        dragModeRef.current = 'cursor'
        setActiveHandle('cursor')
      } else {
        seekPreview(sec)
        dragModeRef.current = 'seek'
        setActiveHandle('seek')
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [cutControls.playhead, durationSec, ratioFromClientX, seekPreview],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const mode = dragModeRef.current ?? activeHandle
      if (!mode) return

      const sec = ratioFromClientX(event.clientX)
      if (mode === 'start' || mode === 'end') {
        if (!cutControls.trimming) return
        if (mode === 'start') setStartHandle(sec)
        else setEndHandle(sec)
        return
      }
      if (mode === 'cursor') {
        setCutCursorSec(positionCutCursor(sec, durationSec))
        return
      }
      if (mode === 'seek') {
        if (!cutControls.playhead) return
        seekPreview(sec)
        return
      }
      if (!cutControls.trimming) return

      const origin = moveOriginRef.current
      if (!origin || durationSec <= 0) return

      const length = origin.endSec - origin.startSec
      let nextStart = origin.startSec + (sec - origin.pointerSec)
      let nextEnd = nextStart + length

      if (nextStart < 0) {
        nextStart = 0
        nextEnd = length
      }
      if (nextEnd > durationSec) {
        nextEnd = durationSec
        nextStart = Math.max(0, durationSec - length)
      }

      setSelectionRange(nextStart, nextEnd)
    },
    [
      activeHandle,
      durationSec,
      ratioFromClientX,
      seekPreview,
      setEndHandle,
      setSelectionRange,
      setStartHandle,
      cutControls.playhead,
      cutControls.trimming,
    ],
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragModeRef.current = null
    setActiveHandle(null)
    moveOriginRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleSave = () => {
    stopPreview()
    if (!cutControls.save) return
    const trimmed = buildTrimmedRecording()
    const name = clipNameDraft.trim()
    if (trimmed && name) {
      onSave(trimmed, name, { asNewClip: hasRemovals, startSec, endSec })
    }
  }

  function handlePreviewButton() {
    if (!cutControls.playback) return
    togglePreview()
  }

  useEffect(() => {
    setCutCursorSec((current) => positionCutCursor(current, durationSec))
  }, [durationSec])

  useEffect(() => {
    const previous = document.activeElement
    const restore =
      previous instanceof HTMLElement && editorRef.current && !editorRef.current.contains(previous)
        ? previous
        : null
    trackRef.current?.focus()
    return () => {
      if (restore?.isConnected) restore.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!cutControls.playback) {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
        if ((event.code === 'Space' || event.key === ' ') && !isTextEntryTarget(event.target)) {
          const inside = Boolean(
            editorRef.current && event.target instanceof Node && editorRef.current.contains(event.target),
          )
          if (spaceTrimDecision(event.target, inside) === 'play') {
            event.preventDefault()
            event.stopPropagation()
          }
        }
        return
      }
      if (event.code !== 'Space' && event.key !== ' ') return
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const inside = Boolean(
        editorRef.current && event.target instanceof Node && editorRef.current.contains(event.target),
      )
      if (spaceTrimDecision(event.target, inside) === 'ignore') return
      event.preventDefault()
      event.stopPropagation()
      togglePreview()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [cutControls.playback, togglePreview])

  const cancelCut = useCallback(() => {
    setCutMode(false)
    setCutMarkers(emptyCutMarkers())
  }, [])

  useEffect(() => {
    if (!cutMode) return
    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const editorFocused = Boolean(
        editorRef.current &&
          document.activeElement instanceof Node &&
          editorRef.current.contains(document.activeElement),
      )
      const decision = cutModeKeyDecision({
        cutMode: true,
        editorFocused,
        key: event.key,
        repeat: event.repeat,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        editable: isTextEntryTarget(event.target),
      })
      if (decision === 'pass') return
      event.stopImmediatePropagation()
      if (decision === 'cancel') {
        event.preventDefault()
        cancelCut()
        return
      }
      if (decision !== 'place') return
      event.preventDefault()
      setCutMarkers((current) => placeCutMarker(current, cutCursorSec, durationSec))
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [cancelCut, cutCursorSec, cutMode, durationSec])

  return (
    <section ref={editorRef} className="panel overflow-hidden">
      <div className="border-b border-white/5 bg-gradient-to-r from-clip/10 via-transparent to-accent/5 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="control-label text-clip-hover">Trim editor</p>
            <h2 className="page-subtitle mt-1">Shape your clip</h2>
            <p className="section-desc max-w-xl">
              {cutMode
                ? 'Cut mode uses the violet cut cursor on this waveform. Playback and trim handles stay paused until you cancel.'
                : 'Preview moves a live playhead across the waveform. Drag the top grip to move the selection, handles to resize, or click anywhere to scrub.'}
            </p>
          </div>
          <span className="badge-amber">Draft</span>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <label htmlFor="clip-name" className="field-label">
            Clip name
          </label>
          <input
            id="clip-name"
            value={clipNameDraft}
            onChange={(event) => setClipNameDraft(event.target.value)}
            disabled={isSaving}
            className="field-input mt-1.5"
          />
        </div>

        {isLoading ? (
          <p className="helper-text">Loading waveform...</p>
        ) : error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-clip" />
                Selection
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent-hover/70" />
                Outside
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-3 w-0.5 rounded-full bg-white shadow-[0_0_8px_white] ${cutMode ? 'opacity-40' : ''}`}
                />
                {cutMode ? 'Playhead (frozen)' : 'Playhead (live)'}
              </span>
              {cutMode && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-0.5 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
                  Cut cursor
                </span>
              )}
              <span className="ml-auto status-text">
                {isPreviewing ? '▶ Playing' : isPaused ? '❚❚ Paused' : '■ Stopped'}
              </span>
            </div>

            <div
              ref={trackRef}
              tabIndex={-1}
              className={`relative h-44 cursor-crosshair select-none overflow-visible rounded-2xl border bg-[#0a0c14] outline-none ${
                cutMode ? 'border-violet-400/70 ring-2 ring-violet-500/40' : 'border-white/10'
              }`}
              onPointerDown={handleWaveformSeekDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl"
              />

              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-l-2xl bg-black/55"
                style={{ width: `${startRatio * 100}%` }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 rounded-r-2xl bg-black/55"
                style={{ width: `${(1 - endRatio) * 100}%` }}
              />

              {/* Selection highlight — clicks pass through except the move grip */}
              <div
                className="pointer-events-none absolute inset-y-0 z-[5] border-y-2 border-clip/80 bg-clip/5"
                style={{
                  left: `${startRatio * 100}%`,
                  width: `${Math.max(0.5, (endRatio - startRatio) * 100)}%`,
                }}
              />
              {cutMode && <div className="pointer-events-none absolute inset-0 z-[1] bg-violet-500/10" />}
              {cutHighlight && durationSec > 0 && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-[8] border-x border-rose-200/80 bg-rose-500/35"
                  style={{
                    left: `${(cutHighlight.startSec / durationSec) * 100}%`,
                    width: `${((cutHighlight.endSec - cutHighlight.startSec) / durationSec) * 100}%`,
                  }}
                />
              )}
              {cutMarkers.first !== null && durationSec > 0 && (
                <CutMarker ratio={cutMarkers.first / durationSec} label="A" />
              )}
              {cutMarkers.second !== null && durationSec > 0 && (
                <CutMarker ratio={cutMarkers.second / durationSec} label="B" />
              )}

              {/* Move grip — top strip only so waveform clicks still seek */}
              <div
                data-trim-chrome="true"
                role="slider"
                aria-label="Move trim selection"
                aria-disabled={!cutControls.trimming}
                aria-valuemin={0}
                aria-valuemax={Math.round(durationSec * 1000)}
                aria-valuenow={Math.round(startSec * 1000)}
                className={`absolute top-0 z-[15] h-5 ${
                  cutControls.trimming ? '' : 'pointer-events-none opacity-40'
                } ${
                  activeHandle === 'move' ? 'cursor-grabbing bg-clip/40' : 'cursor-grab bg-clip/25'
                } rounded-b-md border border-clip/50`}
                style={{
                  left: `${startRatio * 100}%`,
                  width: `${Math.max(0.5, (endRatio - startRatio) * 100)}%`,
                }}
                onPointerDown={handleSelectionPointerDown}
              >
                <span className="absolute inset-x-0 top-1 mx-auto h-1 w-10 rounded-full bg-white/70" />
              </div>

              <div
                ref={playheadElRef}
                className={`pointer-events-none absolute inset-y-0 z-30 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)] ${
                  cutMode ? 'opacity-40' : ''
                }`}
                style={{ left: `${playheadRatio * 100}%` }}
                aria-hidden
              >
                <span className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#0a0c14] bg-white" />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
                  {formatTimePrecise(playheadSec)}
                </span>
              </div>

              {cutMode && durationSec > 0 && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-40 w-[3px] -translate-x-1/2 bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.95)]"
                  style={{ left: `${(cutCursorSec / durationSec) * 100}%` }}
                  aria-hidden
                >
                  <span className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-violet-300" />
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-violet-600 px-1 text-[9px] font-bold leading-none text-white">
                    Cut
                  </span>
                </div>
              )}

              <div
                data-trim-chrome="true"
                className={cutControls.trimming ? undefined : 'pointer-events-none'}
              >
                <TrimHandle
                  label="Start"
                  positionRatio={startRatio}
                  isActive={activeHandle === 'start'}
                  disabled={!cutControls.trimming}
                  onPointerDown={handlePointerDown('start')}
                />
              </div>
              <div
                data-trim-chrome="true"
                className={cutControls.trimming ? undefined : 'pointer-events-none'}
              >
                <TrimHandle
                  label="End"
                  positionRatio={endRatio}
                  isActive={activeHandle === 'end'}
                  disabled={!cutControls.trimming}
                  onPointerDown={handlePointerDown('end')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TimeStat label="Playhead" value={formatTimePrecise(playheadSec)} accent />
              <TimeStat label="Start" value={formatTimePrecise(startSec)} />
              <TimeStat label="End" value={formatTimePrecise(endSec)} />
              <TimeStat label="Total" value={formatTimePrecise(durationSec)} />
            </div>

            <p className="helper-text">
              {cutMode
                ? `Click the waveform to move the cut cursor (${formatTimePrecise(cutCursorSec)}). Press C to mark each side. Playback and trim are paused.`
                : `Selection length ${formatDuration(selectionDurationMs)} · click waveform to seek · drag top grip to move selection`}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
          <button
            type="button"
            onClick={handlePreviewButton}
            disabled={isLoading || !!error || isSaving || !cutControls.playback}
            className="btn-secondary"
          >
            {isPreviewing ? (
              <>Pause</>
            ) : (
              <>
                <PlayIcon className="h-4 w-4" />
                Play
              </>
            )}
          </button>

          {(isPreviewing || isPaused) && (
            <button
              type="button"
              onClick={stopPreview}
              className="btn-secondary"
              disabled={isSaving || !cutControls.playback}
            >
              <StopIcon className="h-4 w-4" />
              Stop
            </button>
          )}

          <button
            type="button"
            aria-pressed={cutMode}
            onClick={() => {
              if (cutMode) return
              void requestRemoveSelectionAuthorization().then((allowed) => {
                if (!allowed) {
                  removeSelection(false, null)
                  return
                }
                stopPreview()
                setCutCursorSec(positionCutCursor(playheadSec, durationSec))
                setCutMarkers(emptyCutMarkers())
                setCutMode(true)
                trackRef.current?.focus()
              })
            }}
            disabled={isLoading || !!error || isSaving}
            className={`btn-secondary ${cutMode ? 'border-violet-300 bg-violet-600 text-white ring-2 ring-violet-300' : ''}`}
          >
            Cut
            {!isPro && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-200">Pro</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              void requestRemoveSelectionAuthorization().then((allowed) => {
                const removed = removeSelection(allowed, cutRange)
                if (removed) setCutMarkers(emptyCutMarkers())
              })
            }}
            disabled={isLoading || !!error || isSaving}
            className="btn-secondary"
          >
            Remove Selection
            {!isPro && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-200">Pro</span>}
          </button>
          {cutMode && (
            <>
              <button
                type="button"
                onClick={() => setCutMarkers(emptyCutMarkers())}
                disabled={!cutControls.clearSelection || isSaving}
                className="btn-ghost"
              >
                Clear Selection
              </button>
              <button type="button" onClick={cancelCut} disabled={isSaving} className="btn-ghost">
                Cancel
              </button>
            </>
          )}
          {hasRemovals && (
            <>
              <button
                type="button"
                onClick={undoRemoval}
                disabled={isSaving || !cutControls.undo}
                className="btn-ghost"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={resetEdits}
                disabled={isSaving || !cutControls.undo}
                className="btn-ghost"
              >
                Reset
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !!error || isSaving || !clipNameDraft.trim() || !cutControls.save}
            className="btn-primary"
          >
            {hasRemovals ? 'Save as new clip' : 'Save trimmed clip'}
          </button>

          <button
            type="button"
            onClick={() => {
              stopPreview()
              onCancel()
            }}
            disabled={isSaving}
            className="btn-ghost"
          >
            Discard
          </button>

          {isSaving && <span className="helper-text">Saving trimmed audio...</span>}
          {!isSaving && saveError && <span className="helper-text">{saveError}</span>}
          {!isSaving && cutMode && !cutControls.save && (
            <span className="helper-text">
              {cutMarkers.first !== null
                ? 'Finish or clear the cut markers before saving.'
                : 'Remove a selection before saving as a new clip.'}
            </span>
          )}
          {!isSaving && cutControls.save && !clipNameDraft.trim() && (
            <span className="helper-text">Enter a clip name before saving.</span>
          )}
        </div>
        {notice && <p className="helper-text">{notice}</p>}
        {hasRemovals && (
          <p className="helper-text">
            AI Clone transcribes the audio that remains. Review that transcript before generating.
          </p>
        )}
      </div>
    </section>
  )
}

function CutMarker({ ratio, label }: { ratio: number; label: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-[12] w-0.5 -translate-x-1/2 bg-rose-300"
      style={{ left: `${ratio * 100}%` }}
    >
      <span className="absolute top-1 left-1/2 -translate-x-1/2 rounded bg-rose-400 px-1 text-[9px] font-bold leading-none text-white">
        {label}
      </span>
    </div>
  )
}

function TimeStat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className={`stat-chip ${accent ? 'ring-1 ring-white/20' : ''}`}>
      <p className="control-label">{label}</p>
      <p className={`mt-1 font-mono text-sm ${accent ? 'text-white' : 'text-ink-soft'}`}>{value}</p>
    </div>
  )
}

function TrimHandle({
  label,
  positionRatio,
  isActive,
  disabled = false,
  onPointerDown,
}: {
  label: string
  positionRatio: number
  isActive: boolean
  disabled?: boolean
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      aria-label={`${label} trim handle`}
      data-trim-chrome="true"
      disabled={disabled}
      onPointerDown={onPointerDown}
      className={`absolute top-0 z-20 flex h-full w-5 -translate-x-1/2 touch-none flex-col items-center justify-center ${
        disabled ? 'cursor-default opacity-30' : 'cursor-ew-resize'
      } ${isActive && !disabled ? 'opacity-100' : disabled ? '' : 'opacity-90 hover:opacity-100'}`}
      style={{ left: `${positionRatio * 100}%` }}
    >
      <span className="h-full w-1.5 rounded-full bg-clip shadow-lg shadow-clip/50" />
      <span className="absolute -bottom-5 text-[10px] font-semibold uppercase tracking-wide text-clip-hover">
        {label}
      </span>
    </button>
  )
}
