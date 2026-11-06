const { getSiteUrl, getStripe, jsonResponse } = require('../lib/commerce.cjs')
const { parseJsonBody } = require('../lib/survey.cjs')
const {
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
      const promo = await resolvePublicPromotionCode(stripe, process.env.STRIPE_SECRET_KEY)
      promotionCodeId = promo.id
    }

    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        siteUrl: getSiteUrl(),
        priceId,
        promotionCodeId,
      }),
    )

    return jsonResponse(200, { url: session.url })
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500
    const revealMessage = statusCode < 500 || error?.code === 'intro-coupon-not-configured'
    if (statusCode >= 500 && error?.code !== 'intro-coupon-not-configured') {
      console.error('create-checkout failed', error)
    }
    return jsonResponse(statusCode, {
      error: revealMessage ? error.message || 'Unable to start checkout' : 'Unable to start checkout',
    })
  }
}

exports.handler = (event) => createCheckoutSession(event)
exports.createCheckoutSession = createCheckoutSession
