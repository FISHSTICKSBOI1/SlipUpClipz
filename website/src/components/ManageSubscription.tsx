import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SITE } from '../config/site'

async function openStripePortal(url: string) {
  const portal = new URL(url)
  if (portal.protocol !== 'https:' || portal.hostname !== 'billing.stripe.com' || portal.username || portal.password) {
    throw new Error('Billing portal returned an unexpected address.')
  }
  window.location.assign(portal.href)
}

export function ManageSubscription() {
  const [params] = useSearchParams()
  const recoveryToken = params.get('billing')
  const redemption = useRef<{ token: string; request: Promise<{ url?: string; error?: string }> } | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [email, setEmail] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(Boolean(recoveryToken))

  useEffect(() => {
    if (!recoveryToken) return
    let cancelled = false

    async function redeem() {
      setIsRedeeming(true)
      setError(null)
      try {
        // StrictMode replays effects; share one request rather than consuming a one-time link twice.
        if (!redemption.current || redemption.current.token !== recoveryToken) {
          redemption.current = { token: recoveryToken!, request: fetch(SITE.billingRecoveryRedeemEndpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: recoveryToken }), signal: AbortSignal.timeout(15000),
          }).then(async (response) => {
            const payload = await response.json()
            if (!response.ok || !payload.url) throw new Error(payload.error || 'This management link is invalid or expired.')
            return payload
          }) }
          const clean = new URL(window.location.href)
          clean.searchParams.delete('billing')
          window.history.replaceState(window.history.state, '', clean.pathname + clean.search + clean.hash)
        }
        const payload = await redemption.current.request
        if (!cancelled) await openStripePortal(payload.url!)
      } catch (redeemError) {
        if (!cancelled) {
          setError(
            redeemError instanceof Error
              ? redeemError.message
              : 'This management link is invalid or expired.',
          )
          setIsRedeeming(false)
        }
      }
    }

    void redeem()
    return () => {
      cancelled = true
    }
  }, [recoveryToken])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isOpening) return
    setError(null)
    setIsOpening(true)

    try {
      const response = await fetch(SITE.billingPortalEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          email: email.trim(),
        }),
      })
      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Could not open subscription management.')
      }
      await openStripePortal(payload.url!)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Could not open subscription management.')
      setIsOpening(false)
    }
  }

  async function handleRecovery(event: FormEvent) {
    event.preventDefault()
    if (isSending) return
    setError(null)
    setRecoveryMessage(null)
    setIsSending(true)
    try {
      const response = await fetch(SITE.billingRecoveryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      })
      const payload = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not send the management link.')
      }
      setRecoveryMessage(
        payload.message ||
          'If that email has a website Pro subscription, we sent a link that expires in 60 minutes.',
      )
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error ? recoveryError.message : 'Could not send the management link.',
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section id="manage" className="scroll-mt-28 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <div className="mx-auto w-full max-w-xl">
        <h2 className="font-display text-2xl font-semibold text-white">Manage your subscription</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Website Pro renews once a year at the regular price unless you cancel before the renewal.
          You can cancel here without the desktop app. Enter the license key from your purchase email
          and the email you used at checkout. Stripe opens a page where you can update billing or
          cancel automatic renewal. Canceling stops the next charge. Pro stays on through the period
          you already paid, and Stripe shows that date.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Pro works on one computer at a time. Removing the license on that computer frees it
          for another. If the old computer is lost, enter the key on the new one and transfer it
          with the purchase email. A full refund of the current year ends Pro and cancels future
          renewal charges. A partial refund does not. Removing the license does not delete clips.
          Store purchases are managed by Microsoft, not here.
        </p>
        {isRedeeming ? (
          <p className="mt-6 text-sm text-slate-200" role="status">
            Opening subscription management…
          </p>
        ) : null}
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 grid gap-4">
          <label className="block text-sm text-slate-200">
            License key
            <input
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              required
              placeholder="SLIP-XXXX-XXXX-XXXX"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink px-3 py-2.5 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-sm text-slate-200">
            Purchase email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink px-3 py-2.5 text-sm text-white"
            />
          </label>
          <button
            type="submit"
            disabled={isOpening}
            className="btn-lift inline-flex min-h-[44px] items-center justify-center rounded-xl button-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isOpening ? 'Opening Stripe…' : 'Manage subscription'}
          </button>
        </form>

        <details className="recovery-disclosure">
          <summary>Lost your license key?</summary>
          <form onSubmit={(event) => void handleRecovery(event)} className="mt-4 grid gap-4">
            <p className="text-sm leading-relaxed text-slate-400">
              Enter the purchase email. If it matches a website subscription, we email a one-time link
              and the license key. The link expires in 60 minutes. It only opens that subscription.
            </p>
            <label className="block text-sm text-slate-200">
              Purchase email
              <input
                type="email"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                autoComplete="email"
                required
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink px-3 py-2.5 text-sm text-white"
              />
            </label>
            {recoveryMessage ? (
              <p role="status" className="text-sm text-slate-200">
                {recoveryMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSending ? 'Sending…' : 'Email me a management link'}
            </button>
          </form>
        </details>
        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
