const { getStripe, jsonResponse } = require('../lib/commerce.cjs')
const { advertisedQuote, describeStripePrice } = require('../lib/intro-discount.cjs')

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const priceId = process.env.STRIPE_PRICE_ID
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!priceId || !secretKey) {
    return jsonResponse(200, advertisedQuote())
  }

  try {
    const stripe = getStripe()
    const price = await stripe.prices.retrieve(priceId)
    const described = describeStripePrice(price)
    if (!described.ok) {
      return jsonResponse(200, {
        ...advertisedQuote(),
        warning: described.error,
      })
    }
    return jsonResponse(200, {
      verified: described.verified,
      source: described.source,
      regularCents: described.regularCents,
      firstYearCents: described.firstYearCents,
      discountCents: described.discountCents,
      currency: described.currency,
      interval: described.interval,
      livemode: described.livemode,
    })
  } catch (error) {
    console.error('pricing-quote failed', error instanceof Error ? error.message : error)
    return jsonResponse(200, advertisedQuote())
  }
}
