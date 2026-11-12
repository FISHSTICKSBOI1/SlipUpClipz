import { useState } from 'react'
import { SectionHeading } from './SectionHeading'
import { SITE } from '../config/site'
import { shortEmbedUrl, visibleShorts, type ShortVideo } from '../lib/shorts'

export function ShortsSection({ videos = SITE.shorts }: { videos?: readonly ShortVideo[] }) {
  const shorts = visibleShorts(videos)
  const [activeId, setActiveId] = useState<string | null>(null)
  if (shorts.length === 0) return null

  return (
    <section className="section-space">
      <div className="site-container">
        <SectionHeading
          align="center"
          eyebrow="Shorts"
          title="See SlipUpClipz in Action"
          description="Short clips of the real app. One plays at a time."
        />
        <div className="mx-auto mt-10 grid max-w-5xl justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shorts.map((video) => {
            const playing = activeId === video.youtubeId
            return (
              <article key={video.youtubeId} className="w-full max-w-[280px]">
                <div className="aspect-[9/16] overflow-hidden rounded-2xl border border-ink-border bg-ink">
                  {playing ? (
                    <iframe
                      title={video.title || 'SlipUpClipz Short'}
                      referrerPolicy="strict-origin"
                      src={shortEmbedUrl(video.youtubeId)}
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-sm font-semibold text-white"
                      onClick={() => setActiveId(video.youtubeId)}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-glow-purple text-lg">
                        ▶
                      </span>
                      Play
                    </button>
                  )}
                </div>
                {video.title ? (
                  <p className="mt-3 text-center text-sm text-slate-300">{video.title}</p>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
