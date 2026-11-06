import { getLicenseValidateUrl } from './licenseConfig.js'

export function billingPortalEndpoint(isPackaged: boolean): string {
  const validateUrl = new URL(getLicenseValidateUrl(isPackaged))
  return `${validateUrl.origin}/.netlify/functions/billing-portal`
}

export function isStripeBillingPortalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'billing.stripe.com'
  } catch {
    return false
  }
}

type PortalResult = { ok: true; url: string } | { ok: false; error: string }

export async function requestBillingPortalSession(options: {
  endpoint: string
  licenseKey: string
  email: string
  fetchImpl?: typeof fetch
}): Promise<PortalResult> {
  const licenseKey = options.licenseKey.trim()
  const email = options.email.trim()
  if (!licenseKey || !email) {
    return { ok: false, error: 'Enter the license key and the purchase email.' }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, email }),
    })
  } catch {
    return { ok: false, error: 'Could not reach the billing service.' }
  }

  let payload: { url?: string; error?: string } = {}
  try {
    payload = (await response.json()) as { url?: string; error?: string }
  } catch {
    payload = {}
  }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Could not open subscription management.' }
  }

  if (!payload.url || !isStripeBillingPortalUrl(payload.url)) {
    return { ok: false, error: 'Billing portal returned an unexpected address.' }
  }

  return { ok: true, url: payload.url }
}
