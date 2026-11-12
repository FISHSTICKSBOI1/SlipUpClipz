import { formatUsd, type PricingQuote } from '../lib/pricingQuote'

export function PriceDisclosure({ quote }: { quote: PricingQuote }) {
  const regular = formatUsd(quote.regularCents)
  const firstYear = formatUsd(quote.firstYearCents)
  const priceSource = quote.verified
    ? `Pro is ${regular} per year.`
    : `The advertised Pro price is ${regular} per year. Stripe Checkout shows the exact charge before you pay.`

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-400">
      <p>
        {priceSource} Pro renews each year at the regular price unless you cancel. The advertised
        survey offer is $1 off the first year, subject to availability at checkout. If applied, that first year is{' '}
        {firstYear} and later years return to {regular}. The discount applies once, to the first
        invoice of a new subscription bought through Stripe on this website. It does not apply to
        Microsoft Store purchases.
      </p>
      <p>
        Buy Pro at the regular price without the survey. If you already have a promotion code, you
        can enter it on the Stripe checkout page. A code cannot be applied twice on the same
        checkout. Checkout without a code charges the regular annual price.
      </p>
      {quote.verified && quote.livemode === false ? (
        <p className="text-amber-200/90">Stripe is in test mode for this preview.</p>
      ) : null}
    </div>
  )
}
