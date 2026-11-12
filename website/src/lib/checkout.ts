export type CheckoutResponse = {
  url?: string
  error?: string
}

export async function startProCheckout(options?: {
  promotionCode?: string
}): Promise<CheckoutResponse> {
  const response = await fetch('/.netlify/functions/create-checkout', {
    method: 'POST',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options?.promotionCode ? { promotionCode: options.promotionCode } : {}),
  })

  const payload = (await response.json().catch(() => null)) as CheckoutResponse | null

  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to start checkout. Please try again later.')
  }

  if (!payload?.url) {
    throw new Error('Checkout URL missing from server response')
  }

  const url = new URL(payload.url)
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) {
    throw new Error('Checkout returned an unexpected address.')
  }
  return { ...payload, url: url.href }
}
