const { getSiteUrl, getStripe, jsonResponse } = require('../lib/commerce.cjs')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    return jsonResponse(503, { error: 'Checkout is not configured yet' })
  }

  const siteUrl = getSiteUrl()
  const stripe = getStripe()

  /** @type {import('stripe').Stripe.Checkout.SessionCreateParams} */
  const sessionParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/pricing?purchase=success`,
    cancel_url: `${siteUrl}/pricing?purchase=canceled`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: {
      product: 'SlipUpClipz Pro',
    },
    subscription_data: {
      metadata: {
        product: 'SlipUpClipz Pro',
      },
    },
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    return jsonResponse(200, { url: session.url })
  } catch (error) {
    console.error('create-checkout failed', error)
    return jsonResponse(500, { error: 'Unable to start checkout' })
  }
}
