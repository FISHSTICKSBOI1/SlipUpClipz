import { Link } from 'react-router-dom'
import { AppMockup } from '../components/AppMockup'
import { BottomCta } from '../components/BottomCta'
import { Button } from '../components/Button'
import { ComparisonTable } from '../components/ComparisonTable'
import { DemoSection } from '../components/DemoSection'
import { PricingCards } from '../components/PricingCards'
import { ScreenshotFrame } from '../components/ScreenshotFrame'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { WorkflowDemo } from '../components/WorkflowDemo'
import { AiSupportPlaceholder } from '../components/AiSupportPlaceholder'
import { SITE } from '../config/site'
import { FEATURE_SECTIONS } from '../data/features'

export function HomePage() {
  return (
    <>
      <Seo
        title="SlipUpClipz — Capture what they just said. Replay it instantly."
        description="SlipUpClipz captures the last few seconds of game, Discord, or microphone audio, lets you trim the best part, and replay it instantly through your soundboard."
        path={SITE.paths.home}
      />

      <section className="relative overflow-hidden bg-hero-grid">
        <div className="site-container grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
          <div className="motion-safe:animate-fade-up">
            <p className="font-display text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
              SlipUpClipz
            </p>
            <h1 className="mt-6 max-w-xl font-display text-3xl font-bold leading-tight text-slate-50 sm:text-4xl">
              Capture what they just said. Replay it instantly.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              SlipUpClipz captures the last few seconds of game, Discord, or microphone audio, lets
              you trim the best part, and replay it instantly through your soundboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={SITE.downloadUrl} className="btn-lift">
                Download for Windows
              </Button>
              <Button to={`${SITE.paths.home}#demo`} variant="secondary" className="btn-lift">
                Watch Demo
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <li>Windows 10/11</li>
              <li>Free version available</li>
              <li>$4.99 lifetime Pro</li>
              <li>No subscription</li>
            </ul>
          </div>

          <AppMockup className="motion-safe:animate-fade-up lg:justify-self-end" />
        </div>
      </section>

      <div id="demo">
        <DemoSection />
      </div>

      <section className="section-space">
        <div className="site-container">
          <SectionHeading
            eyebrow="How it works"
            title="Capture → Trim → Add → Replay"
            description="The whole loop in four short beats."
          />
          <div className="mt-10">
            <WorkflowDemo />
          </div>
        </div>
      </section>

      <section className="section-space border-y border-ink-border/70 bg-ink-raised/30">
        <div className="site-container space-y-16 lg:space-y-24">
          <SectionHeading
            eyebrow="Features"
            title="Built for Discord chaos and ranked banter"
            description="Clip the moment, shape it, and fire it back through your mic path."
          />
          {FEATURE_SECTIONS.slice(0, 3).map((feature, index) => (
            <article
              key={feature.id}
              className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
            >
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  {feature.title}
                </h3>
                <ul className="mt-5 space-y-3 text-sm text-slate-300 sm:text-base">
                  {feature.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow-purple" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={SITE.paths.features}
                  className="mt-6 inline-flex text-sm font-semibold text-glow-magenta hover:underline"
                >
                  See all features →
                </Link>
              </div>
              <ScreenshotFrame
                shot={feature.imageKey}
                alt={feature.imageAlt}
                float
                className={index % 2 === 1 ? 'lg:order-1' : ''}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="section-space">
        <div className="site-container">
          <SectionHeading
            align="center"
            eyebrow="Compare"
            title="Why SlipUpClipz is different"
            description="Traditional soundboards play files. SlipUpClipz also captures the moment that just happened."
          />
          <div className="mx-auto mt-10 max-w-4xl">
            <ComparisonTable />
          </div>
        </div>
      </section>

      <section className="section-space border-y border-ink-border/70 bg-ink-raised/30">
        <div className="site-container">
          <SectionHeading
            align="center"
            eyebrow="Pricing"
            title="Start free. Unlock Pro once."
            description="No subscription. Windows only."
          />
          <div className="mx-auto mt-10 max-w-4xl">
            <PricingCards />
          </div>
        </div>
      </section>

      <section className="site-container section-space pt-0 sm:pt-0 lg:pt-0">
        <AiSupportPlaceholder />
      </section>

      <BottomCta />
    </>
  )
}
