import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './Button'
import { SITE } from '../config/site'

const DEMO_OPEN_EVENT = 'slipupclipz:open-demo'

export function openDemoVideo() {
  window.dispatchEvent(new Event(DEMO_OPEN_EVENT))
}

export function DemoSection() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    function handleOpen() {
      setOpen(true)
    }
    window.addEventListener(DEMO_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(DEMO_OPEN_EVENT, handleOpen)
  }, [])

  function handlePlay() {
    if (SITE.demoVideoEmbedUrl) {
      setOpen(true)
      return
    }
    if (SITE.demoVideoUrl) {
      window.open(SITE.demoVideoUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <section className="section-space border-y border-ink-border/70 bg-ink-raised/35">
      <div className="site-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-glow-magenta">
            Demo
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
            See SlipUpClipz in action
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Funny moment → Clip hotkey → trim → soundboard pad → instant replay.
          </p>
        </div>

        <div className="relative mx-auto mt-10 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-raised shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <button
              type="button"
              onClick={handlePlay}
              className="group relative block w-full text-left"
              aria-label="Play SlipUpClipz demo video on YouTube"
            >
              <img
                src={SITE.screenshots.demoPoster}
                alt=""
                className="block h-auto w-full bg-ink object-contain"
                loading="lazy"
                decoding="async"
                aria-hidden
              />
              <span className="absolute inset-0 flex items-center justify-center bg-ink/35 transition group-hover:bg-ink/50">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-glow-purple/90 text-white shadow-glow transition group-hover:scale-105 sm:h-20 sm:w-20">
                  <span className="ml-1 text-2xl" aria-hidden>
                    ▶
                  </span>
                </span>
              </span>
            </button>
          </div>
        </div>

        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="w-[min(56rem,calc(100vw-2rem))] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/70"
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === dialogRef.current) setOpen(false)
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-raised shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-ink-border/80 bg-ink/70 px-4 py-3">
              <p id={titleId} className="text-sm font-medium text-white">
                SlipUpClipz demo
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-slate-400 transition hover:text-white"
                aria-label="Close demo video"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full bg-ink">
              {open && SITE.demoVideoEmbedUrl ? (
                <iframe
                  src={SITE.demoVideoEmbedUrl}
                  title="SlipUpClipz product demo on YouTube"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : null}
            </div>
          </div>
        </dialog>

        <div className="mt-8 flex justify-center">
          <Button href={SITE.downloadUrl} className="btn-lift">
            Download for Windows
          </Button>
        </div>
      </div>
    </section>
  )
}
