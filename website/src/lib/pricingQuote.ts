import { useEffect, useState } from 'react'
import { SITE } from '../config/site'

export type PricingQuote = {
  verified: boolean
  source: 'advertised' | 'stripe'
  regularCents: number
  firstYearCents: number
  discountCents: number
  currency: 'usd'
  interval: 'year'
  livemode: boolean | null
}

export const ADVERTISED_QUOTE: PricingQuote = {
  verified: false,
  source: 'advertised',
  regularCents: 499,
  firstYearCents: 399,
  discountCents: 100,
  currency: 'usd',
  interval: 'year',
  livemode: null,
}

export function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function isPricingQuote(value: unknown): value is PricingQuote {
  if (!value || typeof value !== 'object') return false
  const quote = value as Partial<PricingQuote>
  return (
    typeof quote.regularCents === 'number' &&
    typeof quote.firstYearCents === 'number' &&
    typeof quote.discountCents === 'number' &&
    quote.currency === 'usd' &&
    quote.interval === 'year'
  )
}

export function usePricingQuote() {
  const [quote, setQuote] = useState<PricingQuote>(ADVERTISED_QUOTE)

  useEffect(() => {
    let cancelled = false
    fetch(SITE.pricingQuoteEndpoint)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && isPricingQuote(payload)) {
          setQuote({
            ...ADVERTISED_QUOTE,
            ...payload,
            verified: payload.verified === true,
            source: payload.source === 'stripe' ? 'stripe' : 'advertised',
            livemode: typeof payload.livemode === 'boolean' ? payload.livemode : null,
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return quote
}
