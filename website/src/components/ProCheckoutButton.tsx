import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from './Button'
import { SITE } from '../config/site'
import { startProCheckout } from '../lib/checkout'

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
      setAffiliateCode(ref.toUpperCase())
    }
  }, [searchParams])

  async function handleCheckout() {
    setError(null)
    setIsLoading(true)

    try {
      const result = await startProCheckout(affiliateCode)
      window.location.assign(result.url!)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout',
      )
      setIsLoading(false)
    }
  }

  return (
    <div>
      <label htmlFor="affiliate-code" className="text-xs text-slate-400">
        Creator code (optional)
      </label>
      <input
        id="affiliate-code"
        name="affiliate-code"
        value={affiliateCode}
        onChange={(event) => setAffiliateCode(event.target.value.toUpperCase())}
        placeholder="CREATOR"
        autoComplete="off"
        spellCheck={false}
        maxLength={32}
        className="field mt-1"
        disabled={isLoading}
      />
      <Button
        type="button"
        className={`btn-lift mt-4 w-full ${className}`.trim()}
        disabled={isLoading}
        onClick={handleCheckout}
      >
        {isLoading ? 'Redirecting to checkout…' : `Buy Pro for ${SITE.pricing.proPriceLabel}/year`}
      </Button>
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
    </div>
  )
}
