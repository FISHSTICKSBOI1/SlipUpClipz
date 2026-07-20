import { useState } from 'react'
import { Button } from './Button'
import { SITE } from '../config/site'
import { startProCheckout } from '../lib/checkout'

type ProCheckoutButtonProps = {
  className?: string
}

export function ProCheckoutButton({ className = '' }: ProCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    if (isLoading) return

    setError(null)
    setIsLoading(true)

    try {
      const result = await startProCheckout()
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
        <p
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
