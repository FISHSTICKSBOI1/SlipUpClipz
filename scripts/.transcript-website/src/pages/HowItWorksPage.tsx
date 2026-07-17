import { Link } from 'react-router-dom'
import { BottomCta } from '../components/BottomCta'
import { Button } from '../components/Button'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { WorkflowDemo } from '../components/WorkflowDemo'
import { SITE } from '../config/site'
import { WORKFLOW_STEPS } from '../data/features'

const ICONS = ['◎', '✂', '+', '▶'] as const

export function HowItWorksPage() {
  return (
    <>
      <Seo
        title="How It Works — SlipUpClipz"
        description="Capture recent audio, trim the best part, add it to a soundboard pad, and replay it instantly."
        path={SITE.paths.howItWorks}
      />

      <section className="section-space">
        <div className="site-container">
          <SectionHeading
            eyebrow="How it works"
            title="Capture → Trim → Add → Replay"
            description="Four beats. Under ten seconds to understand. Built for Discord chaos and ranked banter."
          />

          <div className="mt-10">
            <WorkflowDemo />
          </div>

          <ol className="mx-auto mt-14 max-w-2xl space-y-8">
            {WORKFLOW_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-glow-purple/15 text-lg text-glow-magenta"
                  aria-hidden
                >
                  {ICONS[index]}
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-white">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Button href={SITE.downloadUrl} className="btn-lift">
              Download for Windows
            </Button>
            <Button to={SITE.paths.features} variant="secondary" className="btn-lift">
              Explore features
            </Button>
            <Link
              to={SITE.paths.help}
              className="inline-flex items-center text-sm font-semibold text-slate-400 hover:text-white"
            >
              Need setup help?
            </Link>
          </div>
        </div>
      </section>

      <BottomCta />
    </>
  )
}
