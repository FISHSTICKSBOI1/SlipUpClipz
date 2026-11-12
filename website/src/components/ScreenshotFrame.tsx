import type { ImgHTMLAttributes } from 'react'
import { SITE } from '../config/site'

type ShotKey = keyof typeof SITE.screenshots

const LABELS: Record<ShotKey, string> = {
  homepageClips: 'Clips page',
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
  imageViewportClassName?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>

export function ScreenshotFrame({
  shot,
  alt,
  float = false,
  className = '',
  priority = false,
  imageViewportClassName,
  ...imgProps
}: ScreenshotFrameProps) {
  const image = (
    <img
      src={SITE.screenshots[shot]}
      alt={alt ?? `SlipUpClipz ${LABELS[shot]} screenshot`}
      className="block h-auto w-full bg-ink object-contain"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...imgProps}
    />
  )

  return (
    <figure className={`shot-frame ${float ? 'shot-float' : ''} ${className}`}>
      {imageViewportClassName ? <div className={imageViewportClassName}>{image}</div> : image}
      <figcaption className="border-t border-ink-border/80 px-3 py-2 text-[11px] font-medium text-slate-400">
        SlipUpClipz · {LABELS[shot]}
      </figcaption>
    </figure>
  )
}
