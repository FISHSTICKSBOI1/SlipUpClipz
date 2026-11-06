import { useEffect, useId, useRef, useState } from 'react'
import type { VoiceSample } from '../config/aiVoiceShowcase'
import { claimAudioPlayback, subscribeAudioPlayback } from '../lib/audioPlayback'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0'
  const tenths = Math.round(seconds * 10) / 10
  const minutes = Math.floor(tenths / 60)
  const remainder = (tenths - minutes * 60).toFixed(1)
  return `${minutes}:${remainder.padStart(4, '0')}`
}

export function VoiceSamplePlayer({ sample }: { sample: VoiceSample }) {
  const playbackId = `${useId()}:${sample.id}`
  const audioRef = useRef<HTMLAudioElement>(null)
  const seekingRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    return subscribeAudioPlayback((activeId) => {
      if (activeId !== playbackId) audio?.pause()
    })
  }, [playbackId])

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio?.pause()
    }
  }, [])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio || error) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    if (audio.ended) audio.currentTime = 0
    claimAudioPlayback(playbackId)
    try {
      await audio.play()
    } catch {
      setError('This sample could not be played.')
    }
  }

  const action = ended ? 'Replay' : playing ? 'Pause' : 'Play'

  return (
    <article className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <audio
        ref={audioRef}
        src={sample.src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration)
          setReady(true)
          setError(null)
        }}
        onTimeUpdate={(event) => {
          if (!seekingRef.current) setCurrent(event.currentTarget.currentTime)
        }}
        onPlay={() => {
          setPlaying(true)
          setEnded(false)
        }}
        onPause={() => setPlaying(false)}
        onEnded={(event) => {
          setPlaying(false)
          setEnded(true)
          setCurrent(event.currentTarget.duration || 0)
        }}
        onError={() => setError('This sample could not be loaded.')}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-glow-magenta">{sample.label}</p>
      <p className="mt-2 font-display text-lg font-bold text-white">“{sample.quote}”</p>
      <p className="mt-1 text-sm text-slate-400">{sample.detail}</p>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-glow-purple to-glow-magenta text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`${action} ${sample.label}`}
          aria-pressed={playing}
          disabled={Boolean(error)}
          onClick={() => void togglePlayback()}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(current, duration || 0)}
            disabled={!ready || Boolean(error)}
            aria-label={`${sample.label} playback position`}
            aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#7c5cff] disabled:cursor-not-allowed"
            onPointerDown={() => {
              seekingRef.current = true
            }}
            onPointerUp={() => {
              seekingRef.current = false
            }}
            onChange={(event) => {
              const audio = audioRef.current
              const next = Number(event.target.value)
              if (audio && ready) audio.currentTime = next
              setCurrent(next)
              setEnded(false)
            }}
          />
          <div className="mt-2 flex justify-between text-xs tabular-nums text-slate-400">
            <span>{formatTime(current)}</span>
            <span>{ready ? formatTime(duration) : '…'}</span>
          </div>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
    </svg>
  )
}
