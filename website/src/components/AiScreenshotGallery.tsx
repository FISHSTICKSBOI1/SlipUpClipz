import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AI_VOICE_SHOTS, type ShowcaseShot } from '../config/aiVoiceShowcase'
import { cropFrameStyle } from '../lib/cropFrame'
import { MotionToggle } from './MotionToggle'

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
  const [paused, setPaused] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const galleryRef = useRef<HTMLDivElement>(null)
  const galleryId = useId()
  const [open, setOpen] = useState(false)
  const [holding, setHolding] = useState(false)
  const [interaction, setInteraction] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (galleryRef.current) observer.observe(galleryRef.current)
    return () => observer.disconnect()
  }, [])
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
    if (open || holding || reduceMotion || paused || focused || !visible) return
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % count)
    }, ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [index, open, holding, interaction, reduceMotion, count, paused, focused, visible])

  return (
    <div ref={galleryRef}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false) }}
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
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-white sm:text-xl">See the Workflow</h3>
        {!reduceMotion && <MotionToggle name="slideshow" paused={paused} onToggle={() => setPaused(value => !value)} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="AI Voice Clip Cloning steps">
        {AI_VOICE_SHOTS.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${galleryId}-tab-${itemIndex}`}
            aria-controls={`${galleryId}-panel`}
            tabIndex={itemIndex === index ? 0 : -1}
            onKeyDown={(event) => {
              const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
              if (next === null) return
              event.preventDefault(); go(next)
              document.getElementById(`${galleryId}-tab-${next}`)?.focus()
            }}
            aria-selected={itemIndex === index}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              itemIndex === index
                ? 'bg-[#6840bd] text-white'
                : 'border border-white/15 text-slate-300 hover:text-white'
            }`}
            onClick={() => go(itemIndex)}
          >
            {item.step}. {item.title}
          </button>
        ))}
      </div>
      <figure className="mt-4" role="tabpanel" id={`${galleryId}-panel`} aria-labelledby={`${galleryId}-tab-${index}`}>
        <button
          type="button"
          className="shot-frame block w-full text-left"
          onClick={() => {
            setOpen(true)
            noteInteraction()
          }}
        >
          <span className="sr-only">Enlarge {shot.title}. </span>
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
  const dialogRef = useRef<HTMLDialogElement>(null)
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
    if (!dialogRef.current?.open) dialogRef.current?.showModal()
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
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
    <dialog ref={dialogRef}
      className="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-4 backdrop:bg-black/80"
      aria-modal="true"
      aria-label={`${shot.title} screenshot`}
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
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
    </dialog>,
    document.body,
  )
}
