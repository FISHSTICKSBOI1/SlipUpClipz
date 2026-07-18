import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from './Button'
import { SITE } from '../config/site'
import { startProCheckout } from '../lib/checkout'
import { normalizeCreatorCode } from '../lib/creatorCode'

type ProCheckoutButtonProps = {
  className?: string
}

export function ProCheckoutButton({ className = '' }: ProCheckoutButtonProps) {
  const [searchParams] = useSearchParams()
  const [affiliateCode, setAffiliateCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ref = searchParams.get('ref')?.trim()
    if (ref) {
      setAffiliateCode(normalizeCreatorCode(ref))
    }
  }, [searchParams])

  async function handleCheckout() {
    if (isLoading) return

    setError(null)
    setIsLoading(true)

    try {
      const result = await startProCheckout(normalizeCreatorCode(affiliateCode) || undefined)
      window.location.assign(result.url!)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout',
      )
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <label
          htmlFor="affiliate-code"
          className="mb-2 block text-sm font-medium text-slate-200"
        >
          Creator code (optional)
        </label>
        <input
          id="affiliate-code"
          name="affiliate-code"
          value={affiliateCode}
          onChange={(event) => setAffiliateCode(normalizeCreatorCode(event.target.value))}
          placeholder="Enter creator code"
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          className="block min-h-[44px] w-full rounded-xl border border-ink-border/90 bg-[rgba(12,15,24,0.92)] px-4 py-3 text-sm font-medium uppercase tracking-wide text-slate-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 transition hover:border-glow-purple/45 focus:border-glow-magenta/70 focus:outline-none focus:ring-2 focus:ring-glow-purple/35 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        />
      </div>

      <Button
        type="button"
        className={`btn-lift min-h-[44px] w-full shadow-glow hover:brightness-110 active:translate-y-px disabled:transform-none disabled:shadow-none ${className}`.trim()}
        disabled={isLoading}
        onClick={() => void handleCheckout()}
      >
        {isLoading
          ? 'Opening secure checkout…'
          : `Buy Pro — ${SITE.pricing.proPriceLabel}${SITE.pricing.proPriceInterval}`}
      </Button>

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
