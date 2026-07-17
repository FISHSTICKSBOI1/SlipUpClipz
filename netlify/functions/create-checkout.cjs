const { findAffiliate, resolveAffiliateCouponId } = require('../lib/affiliates.cjs')
const { getSiteUrl, getStripe, jsonResponse } = require('../lib/commerce.cjs')

function parseBody(event) {
  if (!event.body) return {}

  try {
    return JSON.parse(event.body)
  } catch {
    return null
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    return jsonResponse(503, { error: 'Checkout is not configured yet' })
  }

  const body = parseBody(event)
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const affiliateCode = typeof body.affiliateCode === 'string' ? body.affiliateCode : ''
  const affiliate = affiliateCode ? findAffiliate(affiliateCode) : null

  if (affiliateCode.trim() && !affiliate) {
    return jsonResponse(400, { error: 'Invalid or inactive creator code' })
  }

  const siteUrl = getSiteUrl()
  const stripe = getStripe()

  /** @type {import('stripe').Stripe.Checkout.SessionCreateParams} */
  const sessionParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/pricing?purchase=success`,
    cancel_url: `${siteUrl}/pricing?purchase=canceled`,
    allow_promotion_codes: false,
    billing_address_collection: 'auto',
    metadata: {
      affiliateCode: affiliate?.code || '',
      product: 'SlipUpClipz Pro',
    },
    subscription_data: {
      metadata: {
        affiliateCode: affiliate?.code || '',
        product: 'SlipUpClipz Pro',
      },
    },
  }

  const couponId = resolveAffiliateCouponId(affiliate)
  if (couponId) {
    sessionParams.discounts = [{ coupon: couponId }]
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    return jsonResponse(200, { url: session.url })
  } catch (error) {
    console.error('create-checkout failed', error)
    return jsonResponse(500, { error: 'Unable to start checkout' })
  }
}
