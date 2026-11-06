import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AI_VOICE_SHOTS, type ShowcaseShot } from '../config/aiVoiceShowcase'
import { cropFrameStyle } from '../lib/cropFrame'

const ADVANCE_MS = 5000
const FADE_MS = 750

function CroppedShot({
  shot,
  active,
}: {
  shot: ShowcaseShot
  active: boolean
}) {
  const frame = cropFrameStyle(shot.crop, {
    width: shot.imageWidth,
    height: shot.imageHeight,
  })
  return (
    <img
      src={shot.src}
      alt={active ? shot.alt : ''}
      aria-hidden={active ? undefined : true}
      draggable={false}
      className={`absolute max-w-none transition-opacity ease-in-out motion-reduce:transition-none ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ ...frame.image, transitionDuration: `${FADE_MS}ms` }}
    />
  )
}

export function AiScreenshotGallery() {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [holding, setHolding] = useState(false)
  const [interaction, setInteraction] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const count = AI_VOICE_SHOTS.length
  const shot = AI_VOICE_SHOTS[index] ?? AI_VOICE_SHOTS[0]
  const frame = cropFrameStyle(shot.crop, {
    width: shot.imageWidth,
    height: shot.imageHeight,
  })

  function noteInteraction() {
    setInteraction((value) => value + 1)
  }

  function go(next: number) {
    setIndex((next + count) % count)
    noteInteraction()
  }

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (open || holding || reduceMotion) return
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % count)
    }, ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [index, open, holding, interaction, reduceMotion, count])

  return (
    <div
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => {
        setHolding(false)
        noteInteraction()
      }}
      onPointerCancel={() => {
        setHolding(false)
        noteInteraction()
      }}
      onPointerLeave={() => setHolding(false)}
      onKeyDown={noteInteraction}
    >
      <h3 className="font-display text-lg font-bold text-white sm:text-xl">See the Workflow</h3>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="AI Voice Clip Cloning steps">
        {AI_VOICE_SHOTS.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={itemIndex === index}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              itemIndex === index
                ? 'bg-glow-purple text-white'
                : 'border border-white/15 text-slate-300 hover:text-white'
            }`}
            onClick={() => go(itemIndex)}
          >
            {item.step}. {item.title}
          </button>
        ))}
      </div>
      <figure className="mt-4">
        <button
          type="button"
          className="shot-frame block w-full text-left"
          onClick={() => {
            setOpen(true)
            noteInteraction()
          }}
        >
          <span className="sr-only">Enlarge {shot.title}. </span>
          <span className="flex items-center gap-2 border-b border-ink-border/80 bg-ink/70 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" aria-hidden />
            <span className="ml-2 truncate text-[11px] font-medium text-slate-400">
              SlipUpClipz · AI Voice Clip Cloning
            </span>
          </span>
          <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: frame.aspectRatio }}>
            {AI_VOICE_SHOTS.map((item, itemIndex) => (
              <CroppedShot key={item.id} shot={item} active={itemIndex === index} />
            ))}
          </div>
        </button>
        <figcaption className="mt-3 text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-white">
            Step {shot.step} — {shot.title}.
          </span>{' '}
          {shot.caption}
        </figcaption>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-white"
            onClick={() => go(index - 1)}
          >
            Previous
          </button>
          <div className="flex items-center gap-2" aria-hidden>
            {AI_VOICE_SHOTS.map((item, itemIndex) => (
              <span
                key={item.id}
                className={`h-2 w-2 rounded-full ${itemIndex === index ? 'bg-glow-magenta' : 'bg-white/25'}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-white"
            onClick={() => go(index + 1)}
          >
            Next
          </button>
        </div>
      </figure>
      {open ? (
        <ShotLightbox
          index={index}
          onIndex={go}
          onClose={() => {
            setOpen(false)
            noteInteraction()
          }}
        />
      ) : null}
    </div>
  )
}

function ShotLightbox({
  index,
  onIndex,
  onClose,
}: {
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const indexRef = useRef(index)
  const onIndexRef = useRef(onIndex)
  const onCloseRef = useRef(onClose)
  indexRef.current = index
  onIndexRef.current = onIndex
  onCloseRef.current = onClose
  const shot = AI_VOICE_SHOTS[index] ?? AI_VOICE_SHOTS[0]
  const frame = cropFrameStyle(shot.crop, {
    width: shot.imageWidth,
    height: shot.imageHeight,
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key === 'ArrowRight') onIndexRef.current(indexRef.current + 1)
      if (event.key === 'ArrowLeft') onIndexRef.current(indexRef.current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${shot.title} screenshot`}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-white/10 bg-[#120a22] p-4 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            Step {shot.step} of {AI_VOICE_SHOTS.length} — {shot.title}
          </p>
          <button
            ref={closeRef}
            type="button"
            className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: frame.aspectRatio }}>
          <CroppedShot shot={shot} active />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">{shot.caption}</p>
        <div className="mt-4 flex justify-between gap-3">
          <button
            type="button"
            className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-white"
            onClick={() => onIndex(index - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-white"
            onClick={() => onIndex(index + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
