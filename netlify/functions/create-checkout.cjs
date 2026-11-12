const { getSiteUrl, getStripe, jsonResponse } = require('../lib/commerce.cjs')
const { parseJsonBody } = require('../lib/survey.cjs')
const {
  offerPriceProblem,
  assertOfferSession,
  requestedPromotionCode,
  resolvePublicPromotionCode,
  buildCheckoutSessionParams,
} = require('../lib/intro-discount.cjs')

async function createCheckoutSession(event, deps = {}) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const priceId = process.env.STRIPE_PRICE_ID
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!priceId || !secretKey) {
    const missing = [!priceId ? 'STRIPE_PRICE_ID' : null, !secretKey ? 'STRIPE_SECRET_KEY' : null]
      .filter(Boolean)
      .join(', ')
    console.error(`[create-checkout] Missing required environment variables: ${missing}`)
    return jsonResponse(503, { error: 'Checkout is not configured yet' })
  }

  try {
    const body = parseJsonBody(event)
    const promotionCode = requestedPromotionCode(body)
    const stripe = deps.stripe || getStripe()
    let promotionCodeId = null

    if (promotionCode) {
      const price = await stripe.prices.retrieve(priceId)
      const problem = offerPriceProblem(price)
      const live = /^(sk|rk)_live_/.test(secretKey)
      if (problem || price.id !== priceId || price.livemode !== live) {
        return jsonResponse(503, { error: problem || 'The survey price does not match this checkout environment.' })
      }
      const promo = await resolvePublicPromotionCode(stripe, secretKey, price)
      promotionCodeId = promo.id
    }

    const session = await stripe.checkout.sessions.create(
      { ...buildCheckoutSessionParams({
        siteUrl: getSiteUrl(),
        priceId,
        promotionCodeId,
      }), ...(promotionCodeId ? { expand: ['line_items'] } : {}) },
    )

    if (promotionCodeId) {
      try {
        assertOfferSession(session, priceId, promotionCodeId)
      } catch (error) {
        // Never return an unverified URL, even if best-effort expiration fails.
        try { await stripe.checkout.sessions.expire(session.id) }
        catch { console.error('create-checkout: unverified session expiration failed') }
        throw error
      }
    }
    return jsonResponse(200, { url: session.url })
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500
    const revealMessage = statusCode < 500 || error?.code === 'intro-coupon-not-configured'
    if (statusCode >= 500 && error?.code !== 'intro-coupon-not-configured') {
      console.error('create-checkout failed', { category: 'stripe-or-validation' })
    }
    return jsonResponse(statusCode, {
      error: revealMessage ? error.message || 'Unable to start checkout' : 'Unable to start checkout',
    })
  }
}

exports.handler = (event) => createCheckoutSession(event)
exports.createCheckoutSession = createCheckoutSession
