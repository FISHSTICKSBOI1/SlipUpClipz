import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_REFERENCE_TEXT_CHARS, referenceDurationMsAllowed } from '@shared/aiReference'
import { customerAiMessage } from '@shared/customerAiMessage'
import { inspectReferencePcm, transcriptAccuracyWarning, type ReferenceWarning } from '@shared/referenceCheck'
import { GenerationProgress } from './GenerationProgress'
import { type GenerationPhase } from '@shared/generationProgress'
import { audioClipToWav, decodeClipPcm } from '../../lib/aiVoice'
import { captureGenerationRequest, generationAgainRequest, type GenerationRequestSnapshot } from '../../lib/generationRequest'
import { getAudioBlob } from '../../lib/audioStorage'
import { uniqueClipName } from '../../lib/clipNames'
import { useModalScrim } from '../../hooks/useModalScrim'
import type { Clip } from '../../types/clip'
import { PlayIcon } from '../icons'

type AIVoiceDialogProps = {
  clip: Clip
  existingNames: string[]
  onClose: () => void
  onSave: (wav: Blob, name: string) => Promise<void>
}

type TranscriptStatus = 'idle' | 'transcribing' | 'ready' | 'review' | 'truncated' | 'no-speech' | 'failed'

type GeneratedTake = {
  id: string
  blob: Blob
  saved: boolean
}

function transcriptStatusMessage(status: TranscriptStatus): string | null {
  switch (status) {
    case 'transcribing':
      return 'Transcribing...'
    case 'ready':
      return 'Transcript ready'
    case 'review':
      return 'Please review the transcript.'
    case 'truncated':
      return 'Automatic transcript was cut off. Check that every word is here.'
    case 'no-speech':
      return 'No speech detected'
    case 'failed':
      return 'Transcription failed — enter the words manually'
    default:
      return null
  }
}

export function AIVoiceDialog({ clip, existingNames, onClose, onSave }: AIVoiceDialogProps) {
  const [referenceText, setReferenceText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [permission, setPermission] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [healthMessage, setHealthMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [takes, setTakes] = useState<GeneratedTake[]>([])
  const previewPlayers = useRef<Set<HTMLAudioElement>>(new Set())
  const generationSnapshot = useRef<GenerationRequestSnapshot | null>(null)
  const activeClipId = useRef(clip.id)
  activeClipId.current = clip.id
  const [canRepeat, setCanRepeat] = useState(false)
  const [referenceWarnings, setReferenceWarnings] = useState<ReferenceWarning[]>([])
  const [job, setJob] = useState<{
    requestId: string
    phase: GenerationPhase
    coldStart: boolean
    startedAt: number
    textLength: number
    completed: number
    total: number
    label: string
  } | null>(null)
  const [progressNow, setProgressNow] = useState(0)
  const generationAlive = useRef(true)
  const generationLock = useRef(false)
  const generationSeq = useRef(0)
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>('idle')
  const [seenClipId, setSeenClipId] = useState(clip.id)
  const userEditedTranscript = useRef(false)
  const transcribeRequestId = useRef(0)
  const saveInFlight = useRef(false)
  const savedNames = useRef(new Set<string>())
  const generationSessionId = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `00000000-0000-4000-8000-${String(Date.now()).padStart(12, '0').slice(-12)}`,
  )
  const durationValid = referenceDurationMsAllowed(clip.durationMs)

  function reportAiError(caught: unknown, fallback: string) {
    const raw = caught instanceof Error ? caught.message : fallback
    console.error('[ai]', raw)
    setError(customerAiMessage(raw))
  }
  useModalScrim(0.7)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || busy || saving || job) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, job, onClose, saving])

  if (seenClipId !== clip.id) {
    setSeenClipId(clip.id)
    userEditedTranscript.current = false
    transcribeRequestId.current += 1
    setReferenceText('')
    setTargetText('')
    setPermission(false)
    setTakes([])
    generationSnapshot.current = null
    savedNames.current = new Set()
    setCanRepeat(false)
    setJob(null)
    setReferenceWarnings([])
    setError('')
    setTranscriptStatus('idle')
  }

  useEffect(() => {
    let cancelled = false
    if (!window.electronAPI?.ai) {
      setAvailable(false)
      return
    }
    void window.electronAPI.ai.health().then((result) => {
      if (cancelled) return
      setAvailable(result.ready)
      setHealthMessage(result.message ?? '')
    }).catch(() => {
      if (!cancelled) setAvailable(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!permission || available !== true || !durationValid || !window.electronAPI?.ai) {
      return
    }
    if (userEditedTranscript.current) {
      return
    }

    const requestId = ++transcribeRequestId.current
    let cancelled = false
    setTranscriptStatus('transcribing')

    void (async () => {
      try {
        const source = await getAudioBlob(clip.id)
        if (!source) throw new Error('The selected clip has no saved audio.')
        const wav = await audioClipToWav(source)
        const result = await window.electronAPI!.ai.transcribe({ audioWav: wav, consent: true })
        if (cancelled || requestId !== transcribeRequestId.current || userEditedTranscript.current) {
          return
        }
        const text = result.text.trim()
        if (result.noSpeech || !text) {
          setTranscriptStatus('no-speech')
          return
        }
        if (result.truncated || text.length > MAX_REFERENCE_TEXT_CHARS) {
          setReferenceText(text.slice(0, MAX_REFERENCE_TEXT_CHARS))
          setTranscriptStatus('truncated')
          return
        }
        setReferenceText(text)
        setTranscriptStatus(result.unclear ? 'review' : 'ready')
      } catch (caught) {
        if (cancelled || requestId !== transcribeRequestId.current || userEditedTranscript.current) {
          return
        }
        setTranscriptStatus('failed')
        reportAiError(caught, 'Transcription failed. Enter the words manually.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [permission, available, clip.id, durationValid])

  useEffect(() => {
    let cancelled = false
    setReferenceWarnings([])
    void (async () => {
      try {
        const source = await getAudioBlob(clip.id)
        if (!source || cancelled) return
        const pcm = await decodeClipPcm(source)
        if (cancelled) return
        setReferenceWarnings(pcm ? inspectReferencePcm(pcm.samples, pcm.sampleRate) : inspectReferencePcm([], 0))
      } catch {
        if (!cancelled) setReferenceWarnings(inspectReferencePcm([], 0))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clip.id])

  useEffect(() => {
    generationAlive.current = true
    return () => {
      generationAlive.current = false
    }
  }, [])

  useEffect(() => {
    if (!job) return
    const timer = window.setInterval(() => setProgressNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [job])

  useEffect(() => {
    return window.electronAPI?.ai.onGenerateProgress?.((event) => {
      setJob((current) => {
        if (!current || current.requestId !== event.requestId) return current
        if (event.stage === 'loading') return { ...current, phase: 'loading', coldStart: true }
        if (event.stage === 'generating') return { ...current, phase: 'generating' }
        return { ...current, phase: 'finishing' }
      })
    })
  }, [])

  function beginGeneration(label: string, completed: number, total: number, textLength: number) {
    generationSeq.current += 1
    const requestId = `gen-${generationSeq.current}-${Date.now()}`
    const startedAt = Date.now()
    generationLock.current = true
    setJob({
      requestId,
      phase: 'preparing',
      coldStart: false,
      startedAt,
      textLength,
      completed,
      total,
      label,
    })
    setProgressNow(startedAt)
    return requestId
  }

  const canGenerate = available && durationValid && permission && referenceText.trim() && targetText.trim() && !busy

  function rememberTake(bytes: Uint8Array) {
    const copy = new Uint8Array(bytes.length)
    copy.set(bytes)
    const take: GeneratedTake = {
      id: `take-${generationSeq.current}`,
      blob: new Blob([copy.buffer as ArrayBuffer], { type: 'audio/wav' }),
      saved: false,
    }
    setTakes((current) => [...current, take])
  }

  async function handleGenerate() {
    if (!canGenerate || !window.electronAPI?.ai || job || generationLock.current) return
    const clipId = clip.id
    const refText = referenceText.trim()
    const text = targetText.trim()
    const startSec = 0
    const endSec = clip.durationMs / 1000
    generationLock.current = true
    const requestId = beginGeneration('Generating voice...', 0, 1, text.length)
    setBusy(true)
    setError('')
    try {
      const source = await getAudioBlob(clipId)
      if (!source) throw new Error('The selected clip has no saved audio.')
      const referenceSource = new Uint8Array(await source.arrayBuffer())
      const wav = await audioClipToWav(new Blob([referenceSource], { type: source.type || 'audio/wav' }))
      const result = await window.electronAPI.ai.generate({
        audioWav: wav,
        refText,
        text,
        temporary: true,
        sessionId: generationSessionId.current,
        consent: true,
        requestId,
      })
      if (!generationAlive.current || activeClipId.current !== clipId) return
      const outputBytes = new Uint8Array(result.length)
      outputBytes.set(result)
      generationSnapshot.current = captureGenerationRequest({
        clipId,
        referenceWav: wav,
        referenceSource,
        referenceTranscript: refText,
        targetText: text,
        startSec,
        endSec,
      })
      setCanRepeat(true)
      rememberTake(outputBytes)
    } catch (caught) {
      if (!generationAlive.current || activeClipId.current !== clipId) return
      reportAiError(caught, 'Voice generation failed.')
    } finally {
      generationLock.current = false
      if (generationAlive.current) {
        setJob(null)
        setBusy(false)
      }
    }
  }

  async function handleGenerateAgain() {
    const snapshot = generationSnapshot.current
    if (!snapshot || !permission || available !== true || !window.electronAPI?.ai || job || generationLock.current) return
    generationLock.current = true
    const requestId = beginGeneration('Generating voice...', 0, 1, snapshot.targetText.length)
    setBusy(true)
    setError('')
    try {
      const source = await getAudioBlob(snapshot.clipId)
      const currentSource = source ? new Uint8Array(await source.arrayBuffer()) : null
      const again = generationAgainRequest(snapshot, currentSource)
      if (!again.ok) throw new Error(again.error)
      const result = await window.electronAPI.ai.generate({
        audioWav: again.audioWav,
        refText: again.refText,
        text: again.text,
        temporary: true,
        sessionId: generationSessionId.current,
        consent: true,
        requestId,
      })
      if (!generationAlive.current || activeClipId.current !== snapshot.clipId) return
      const outputBytes = new Uint8Array(result.length)
      outputBytes.set(result)
      rememberTake(outputBytes)
    } catch (caught) {
      if (!generationAlive.current || activeClipId.current !== snapshot.clipId) return
      reportAiError(caught, 'Voice generation failed.')
    } finally {
      generationLock.current = false
      if (generationAlive.current) {
        setJob(null)
        setBusy(false)
      }
    }
  }

  function claimName(base: string, taken: Set<string>): string {
    const name = uniqueClipName(base, taken)
    taken.add(name.toLowerCase())
    return name
  }

  async function handleSave(take: GeneratedTake) {
    if (take.saved || saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    setError('')
    try {
      const taken = new Set(
        [...existingNames, ...savedNames.current].map((name) => name.toLowerCase()),
      )
      const name = claimName(`AI - ${clip.name}`, taken)
      await onSave(take.blob, name)
      savedNames.current.add(name)
      setTakes((current) => current.map((item) => (item.id === take.id ? { ...item, saved: true } : item)))
    } catch (caught) {
      reportAiError(caught, 'Could not save the generated clip.')
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  const registerPreview = useCallback((audio: HTMLAudioElement) => {
    previewPlayers.current.add(audio)
    return () => {
      previewPlayers.current.delete(audio)
    }
  }, [])

  const playPreviewExclusively = useCallback((audio: HTMLAudioElement) => {
    for (const other of previewPlayers.current) {
      if (other !== audio) other.pause()
    }
  }, [])

  const generationBusy = busy || saving || job !== null
  const canGenerateAgain = canRepeat && permission && available === true && !generationBusy

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <section className="panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="ai-voice-title">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="ai-voice-title" className="text-lg font-semibold text-white">AI Voice Clone</h2>
            <p className="mt-1 break-words text-sm text-gray-400">Reference: {clip.name} ({(clip.durationMs / 1000).toFixed(1)} sec)</p>
          </div>
          <button type="button" onClick={onClose} disabled={generationBusy} className="shrink-0 text-sm text-gray-400 hover:text-white disabled:opacity-40">Close</button>
        </div>

        <div className="mt-5 space-y-4">
          {available === null && <p className="helper-text">Checking your local AI engine…</p>}
          {available === false && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              {customerAiMessage(healthMessage || 'The local AI engine is unavailable.')}
            </p>
          )}
          {!durationValid && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              AI Clone uses clips from 0.8 to 7 seconds. Close this window and use Trim to select a speech segment in that range.
            </p>
          )}
          {referenceWarnings.length > 0 && (
            <details className="rounded-lg border border-white/10 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-white">
                Reference tips ({referenceWarnings.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink-muted">
                {referenceWarnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </details>
          )}
          <div>
            <label htmlFor="voice-ref-text" className="control-label">Exact words in the clip</label>
            <textarea
              id="voice-ref-text"
              className="field-input mt-2 w-full"
              rows={3}
              maxLength={MAX_REFERENCE_TEXT_CHARS}
              value={referenceText}
              onChange={(event) => {
                userEditedTranscript.current = true
                setTranscriptStatus('idle')
                setReferenceText(event.target.value)
              }}
              placeholder="Transcribe the reference audio exactly…"
            />
            <p className="helper-text mt-1">
              {transcriptStatusMessage(transcriptStatus) ??
                'Type the words in the clip, or check permission and let AI Clone fill them in.'}
            </p>
            {transcriptAccuracyWarning({ durationSec: clip.durationMs / 1000, status: transcriptStatus }) && (
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {transcriptAccuracyWarning({ durationSec: clip.durationMs / 1000, status: transcriptStatus })}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="voice-target-text" className="control-label">What should the AI say?</label>
            <textarea id="voice-target-text" className="field-input mt-2 w-full" rows={3} maxLength={500} value={targetText} onChange={(event) => setTargetText(event.target.value)} placeholder="Enter a short sentence…" />
          </div>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-300">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-accent" checked={permission} onChange={(event) => setPermission(event.target.checked)} />
            <span>I have permission from the speaker to create synthetic speech using this recording. I'll label it as AI and won't use it to impersonate or mislead anyone.</span>
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          {job && (
            <GenerationProgress
              phase={job.phase}
              elapsedMs={Math.max(0, progressNow - job.startedAt)}
              coldStart={job.coldStart}
              textLength={job.textLength}
              completed={job.completed}
              total={job.total}
              activeLabel={job.label}
            />
          )}
          <button type="button" disabled={!canGenerate || generationBusy} onClick={() => void handleGenerate()} className="btn-primary w-full">
            Generate AI voice
          </button>
          {takes.length > 0 && (
            <div className="panel-inset space-y-4 p-4">
              <p className="text-sm font-semibold text-white">AI-generated preview</p>
              {takes.map((take, index) => (
                <GeneratedTakePreview
                  key={take.id}
                  take={take}
                  label={takes.length === 1 ? 'Generated voice' : `Generated voice ${index + 1}`}
                  saving={saving}
                  onSave={() => void handleSave(take)}
                  onRegister={registerPreview}
                  onPlay={playPreviewExclusively}
                />
              ))}
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={!canGenerateAgain}
                onClick={() => void handleGenerateAgain()}
              >
                Generate Again
              </button>
              <p className="helper-text">Generate Again repeats the last voice. Earlier results stay here.</p>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}


function GeneratedTakePreview({
  take,
  label,
  saving,
  onSave,
  onRegister,
  onPlay,
}: {
  take: GeneratedTake
  label: string
  saving: boolean
  onSave: () => void
  onRegister: (audio: HTMLAudioElement) => () => void
  onPlay: (audio: HTMLAudioElement) => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const next = URL.createObjectURL(take.blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [take.blob])

  return (
    <div className="space-y-2">
      {url && (
        <GeneratedAudioPreview
          url={url}
          label={label}
          onRegister={onRegister}
          onPlay={onPlay}
        />
      )}
      <button className="btn-primary w-full" type="button" disabled={saving || take.saved} onClick={onSave}>
        {take.saved ? 'Saved to library' : saving ? 'Saving…' : 'Save AI clip to library'}
      </button>
    </div>
  )
}

function GeneratedAudioPreview({
  url,
  label = 'Generated voice',
  onRegister,
  onPlay,
}: {
  url: string
  label?: string
  onRegister?: (audio: HTMLAudioElement) => () => void
  onPlay?: (audio: HTMLAudioElement) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackError, setPlaybackError] = useState('')

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !onRegister) return
    return onRegister(audio)
  }, [onRegister, url])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return

    if (!audio.paused) {
      audio.pause()
      return
    }

    if (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration) {
      audio.currentTime = 0
      setCurrentTime(0)
    }

    try {
      setPlaybackError('')
      await audio.play()
    } catch {
      setPlaying(false)
      setPlaybackError('Could not play this preview. You can still save the generated clip.')
    }
  }

  function seekTo(value: number) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0) return
    const nextTime = Math.max(0, Math.min(value, duration))
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1018] p-3 sm:p-4">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const seconds = event.currentTarget.duration
          setDuration(Number.isFinite(seconds) ? seconds : 0)
        }}
        onDurationChange={(event) => {
          const seconds = event.currentTarget.duration
          if (Number.isFinite(seconds)) setDuration(seconds)
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={(event) => {
          onPlay?.(event.currentTarget)
          setPlaying(true)
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false)
          setPlaybackError('Could not load the audio preview. You can still save the generated clip.')
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          title={playing ? 'Pause' : 'Play'}
          onClick={() => void togglePlayback()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-glow transition hover:bg-accent-hover focus-visible:outline-accent"
        >
          {playing ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="4.5" width="4" height="15" rx="1" />
              <rect x="14" y="4.5" width="4" height="15" rx="1" />
            </svg>
          ) : (
            <PlayIcon className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-gray-200">{label}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
              {formatPreviewTime(currentTime)} / {formatPreviewTime(duration)}
            </span>
          </div>
          <input
            type="range"
            aria-label="Seek through AI voice preview"
            min={0}
            max={duration || 1}
            step={0.05}
            value={Math.min(currentTime, duration || 1)}
            disabled={duration <= 0}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="block w-full accent-accent disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: `linear-gradient(to right, #7c5cff 0%, #7c5cff ${progress}%, #303344 ${progress}%, #303344 100%)` }}
          />
        </div>
      </div>
      {playbackError && <p role="alert" className="mt-2 text-xs text-red-300">{playbackError}</p>}
    </div>
  )
}

function formatPreviewTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const totalSeconds = Math.floor(seconds)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

