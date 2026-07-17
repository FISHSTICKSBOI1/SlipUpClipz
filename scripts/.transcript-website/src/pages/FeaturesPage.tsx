import { ScreenshotFrame } from '../components/ScreenshotFrame'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { BottomCta } from '../components/BottomCta'
import { SITE } from '../config/site'
import { FEATURE_SECTIONS } from '../data/features'

export function FeaturesPage() {
  return (
    <>
      <Seo
        title="Features — SlipUpClipz"
        description="Instant replay clipping, waveform trimming, soundboard hotkeys, virtual mic routing, voice effects, and tray support."
        path={SITE.paths.features}
      />

      <section className="section-space">
        <div className="site-container">
          <SectionHeading
            eyebrow="Features"
            title="Everything you need to clip and replay the moment"
            description="Alternating walkthrough of the core SlipUpClipz workflow — no fluff, just what ships today."
          />

          <div className="mt-14 space-y-20 lg:space-y-28">
            {FEATURE_SECTIONS.map((feature, index) => {
              const imageLeft = index % 2 === 1
              return (
                <article
                  key={feature.id}
                  id={feature.id}
                  className="grid scroll-mt-28 items-center gap-8 lg:grid-cols-2 lg:gap-14"
                >
                  <div className={imageLeft ? 'lg:order-2' : ''}>
                    <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
                      {feature.title}
                    </h2>
                    <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                      {feature.points.map((point) => (
                        <li key={point} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow-purple" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ScreenshotFrame
                    shot={feature.imageKey}
                    alt={feature.imageAlt}
                    float
                    className={imageLeft ? 'lg:order-1' : ''}
                  />
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <BottomCta />
    </>
  )
}
