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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options?.promotionCode ? { promotionCode: options.promotionCode } : {}),
  })

  const payload = (await response.json()) as CheckoutResponse

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to start checkout')
  }

  if (!payload.url) {
    throw new Error('Checkout URL missing from server response')
  }

  return payload
}
