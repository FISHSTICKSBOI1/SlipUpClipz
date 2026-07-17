import { Button } from './Button'
import { ProCheckoutButton } from './ProCheckoutButton'
import { SITE } from '../config/site'

const FREE_FEATURES = [
  'Replay Buffer',
  'Clip Library',
  'Trim Editor',
  '3 Soundboard Pads',
] as const

const PRO_FEATURES = [
  '50 Soundboard Pads',
  'Voice Effects',
  'Hear Myself',
  'Global Hotkeys',
  'VB-Audio Routing',
  'Auto Start',
  'Future Pro Features',
  'Priority Updates',
] as const

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <article className="panel flex flex-col p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {SITE.pricing.freeName}
        </p>
        <h3 className="mt-3 font-display text-4xl font-bold text-white">$0</h3>
        <p className="mt-2 text-sm text-slate-400">Start clipping with the core workflow.</p>
        <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-300">
          {FREE_FEATURES.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-glow-cyan" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Button href={SITE.downloadUrl} variant="secondary" className="btn-lift mt-8 w-full">
          Download Free
        </Button>
      </article>

      <article className="relative flex flex-col overflow-hidden rounded-2xl border border-glow-purple/45 bg-gradient-to-b from-glow-purple/15 to-ink-panel p-6 sm:p-8">
        <div className="absolute right-4 top-4 rounded-full border border-glow-magenta/40 bg-glow-magenta/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-glow-magenta">
          Annual
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-glow-magenta">
          {SITE.pricing.proName}
        </p>
        <h3 className="mt-3 font-display text-4xl font-bold text-white">
          {SITE.pricing.proPriceLabel}
          <span className="text-lg font-semibold text-slate-300">/year</span>
        </h3>
        <p className="mt-2 text-sm text-slate-300">Full Pro feature set</p>
        <p className="mt-1 text-xs text-slate-400">{SITE.pricing.proPriceNote}</p>
        <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-200">
          {PRO_FEATURES.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-glow-magenta" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <ProCheckoutButton />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          Secure checkout via Stripe. Your license key is emailed automatically after purchase.
        </p>
      </article>
    </div>
  )
}
