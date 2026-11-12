import { Link } from 'react-router-dom'
import { Button } from './Button'
import { PriceDisclosure } from './PriceDisclosure'
import { ProCheckoutButton } from './ProCheckoutButton'
import { SITE } from '../config/site'
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from '../data/features'
import { formatUsd, usePricingQuote } from '../lib/pricingQuote'

export function PricingCards() {
  const quote = usePricingQuote()
  const regular = formatUsd(quote.regularCents)

  return (
    <div className="space-y-6">
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <article className="panel flex h-full flex-col p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {SITE.pricing.freeName}
          </p>
          <h3 className="mt-3 font-display text-4xl font-bold text-white">$0</h3>
          <p className="mt-2 text-sm text-slate-400">The full clipping and soundboard workflow.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-slate-300">
            {FREE_PLAN_FEATURES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-glow-cyan" aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button href={SITE.downloadUrl} variant="secondary" className="btn-lift mt-8 min-h-[44px] w-full">
            Download Free
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            The download button installs the latest published release, currently v{SITE.currentVersion}.
          </p>
        </article>

        <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-glow-purple/45 bg-gradient-to-b from-glow-purple/15 to-ink-panel p-6 sm:p-8">
          <div className="absolute right-4 top-4 rounded-full border border-glow-magenta/40 bg-glow-magenta/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-glow-magenta">
            Annual
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-glow-magenta">
            {SITE.pricing.proName}
          </p>
          <h3 className="mt-3 font-display text-4xl font-bold text-white">
            {regular}
            <span className="text-lg font-semibold text-slate-300">/year</span>
          </h3>
          <p className="mt-2 text-sm text-slate-300">Everything in Free, plus the Pro extras</p>
          <p className="mt-1 text-sm text-slate-400">{SITE.pricing.proPriceNote}</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-slate-200">
            {PRO_PLAN_FEATURES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-glow-magenta" aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            On the Windows installer, Pro includes local AI Voice Cloning. English is the tested
            language, the speaker must give permission, and a compatible NVIDIA GPU is required. The
            current Microsoft Store release does not include it.
          </p>
          <div className="mt-8">
            <ProCheckoutButton label={`Buy Pro — ${regular}/year`} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Secure checkout via Stripe. Your license key is emailed automatically after purchase.
            This button charges the regular annual price.
          </p>
          <Link to={`${SITE.paths.pricing}#feedback`} className="mt-3 text-sm font-semibold text-glow-magenta hover:underline">
            Take the Survey — $1 offer details
          </Link>
        </article>
      </div>
      <PriceDisclosure quote={quote} />
    </div>
  )
}
