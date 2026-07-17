import { Button } from './Button'
import { SITE } from '../config/site'

export function BottomCta() {
  return (
    <section className="section-space">
      <div className="site-container">
        <div className="overflow-hidden rounded-3xl border border-ink-border bg-gradient-to-br from-glow-purple/20 via-ink-panel to-ink px-6 py-12 text-center sm:px-10">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Ready to clip the next lobby moment?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
            Download SlipUpClipz for Windows. Start free, upgrade to Pro for $4.99/year.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href={SITE.downloadUrl} className="btn-lift">
              Download for Windows
            </Button>
            <Button to={SITE.paths.pricing} variant="secondary" className="btn-lift">
              See pricing
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
