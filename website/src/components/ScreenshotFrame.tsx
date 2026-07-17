import type { ImgHTMLAttributes } from 'react'
import { SITE } from '../config/site'

type ShotKey = keyof typeof SITE.screenshots

const LABELS: Record<ShotKey, string> = {
  clips: 'Clips page',
  replay: 'Replay buffer',
  trim: 'Trim editor',
  soundboard: 'Soundboard',
  voiceEffects: 'Voice effects',
  onboarding: 'Guided onboarding',
  settings: 'Settings',
  demoPoster: 'Demo video poster',
}

type ScreenshotFrameProps = {
  shot: ShotKey
  alt?: string
  float?: boolean
  className?: string
  priority?: boolean
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>

export function ScreenshotFrame({
  shot,
  alt,
  float = false,
  className = '',
  priority = false,
  ...imgProps
}: ScreenshotFrameProps) {
  return (
    <figure className={`shot-frame ${float ? 'shot-float' : ''} ${className}`}>
      <div className="flex items-center gap-2 border-b border-ink-border/80 bg-ink/70 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" aria-hidden />
        <figcaption className="ml-2 truncate text-[11px] font-medium text-slate-400">
          SlipUpClipz · {LABELS[shot]}
        </figcaption>
      </div>
      <img
        src={SITE.screenshots[shot]}
        alt={alt ?? `SlipUpClipz ${LABELS[shot]} screenshot`}
        className="block h-auto w-full bg-ink object-contain"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...imgProps}
      />
    </figure>
  )
}
