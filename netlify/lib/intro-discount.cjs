/**
 * First-year survey offer: $3.99 on the $4.99 annual price, first invoice only.
 * Renewals stay on the configured annual Stripe price. This module never
 * creates a coupon when the secret key is a live key.
 */

const INTRO_DISCOUNT_CENTS = 100
const ADVERTISED_ANNUAL_CENTS = 499
const TEST_COUPON_ID = 'slipupclipz_survey_first_year_1usd'
const PUBLIC_PROMOTION_CODE = 'SURVEY20'

function isLiveSecretKey(secretKey) {
  const key = String(secretKey || '')
  return key.startsWith('sk_live_') || key.startsWith('rk_live_')
}

function isTestSecretKey(secretKey) {
  const key = String(secretKey || '')
  return key.startsWith('sk_test_') || key.startsWith('rk_test_')
}

function firstYearCents(regularCents) {
  if (!Number.isInteger(regularCents) || regularCents <= INTRO_DISCOUNT_CENTS) return null
  return regularCents - INTRO_DISCOUNT_CENTS
}

function advertisedQuote() {
  return {
    verified: false,
    source: 'advertised',
    regularCents: ADVERTISED_ANNUAL_CENTS,
    firstYearCents: ADVERTISED_ANNUAL_CENTS - INTRO_DISCOUNT_CENTS,
    discountCents: INTRO_DISCOUNT_CENTS,
    currency: 'usd',
    interval: 'year',
    livemode: null,
  }
}

function describeStripePrice(price) {
  const regularCents = price?.unit_amount
  const currency = price?.currency
  const interval = price?.recurring?.interval
  if (!Number.isInteger(regularCents) || currency !== 'usd' || interval !== 'year') {
    return {
      ok: false,
      error: 'The configured Stripe price is not a USD yearly price.',
    }
  }

  const introCents = firstYearCents(regularCents)
  if (introCents == null) {
    return {
      ok: false,
      error: 'The annual price is too small for a $1 introductory discount.',
    }
  }

  return {
    ok: true,
    verified: true,
    source: 'stripe',
    regularCents,
    firstYearCents: introCents,
    discountCents: INTRO_DISCOUNT_CENTS,
    currency: 'usd',
    interval: 'year',
    livemode: price.livemode === true,
  }
}

function assertIntroCoupon(coupon, price) {
  if (!coupon || coupon.valid !== true) {
    return 'The introductory coupon is missing or no longer active.'
  }
  if (coupon.duration !== 'once') {
    return 'The introductory coupon must use duration "once" so yearly renewals stay at full price.'
  }
  if (price && coupon.applies_to && !coupon.applies_to.products?.includes(typeof price.product === 'string' ? price.product : price.product?.id)) {
    return 'The introductory coupon is not eligible for the configured Pro product.'
  }
  if (coupon.percent_off != null) {
    if (coupon.percent_off !== 20 || coupon.amount_off != null || coupon.currency != null || !price || offerPriceProblem(price)) {
      return 'The percentage offer must be exactly 20% off the verified $4.99 USD annual Pro price.'
    }
    return null // Stripe session totals must still confirm the actual cent rounding.
  }
  if (coupon.amount_off !== INTRO_DISCOUNT_CENTS || coupon.currency !== 'usd') {
    return 'The introductory coupon must be exactly $1.00 USD off.'
  }
  return null
}

function couponError(message) {
  const error = new Error(message)
  error.statusCode = 503
  error.code = 'intro-coupon-not-configured'
  return error
}

async function resolveIntroCoupon(stripe, secretKey) {
  const configuredId = String(process.env.STRIPE_INTRO_COUPON_ID || '').trim()
  if (configuredId) {
    const coupon = await stripe.coupons.retrieve(configuredId)
    const problem = assertIntroCoupon(coupon)
    if (problem) throw couponError(problem)
    return coupon
  }

  if (isLiveSecretKey(secretKey)) {
    throw couponError(
      'The $1 introductory discount is not configured for live checkout. You can still buy Pro at the regular annual price.',
    )
  }

  if (!isTestSecretKey(secretKey)) {
    throw couponError(
      'Stripe test mode is required before an introductory coupon can be created. Regular checkout is unchanged.',
    )
  }

  try {
    const existing = await stripe.coupons.retrieve(TEST_COUPON_ID)
    const problem = assertIntroCoupon(existing)
    if (problem) throw couponError(problem)
    return existing
  } catch (error) {
    if (error?.code === 'intro-coupon-not-configured') throw error
    const missing = error?.statusCode === 404 || error?.code === 'resource_missing'
    if (!missing) throw error
  }

  return stripe.coupons.create({
    id: TEST_COUPON_ID,
    amount_off: INTRO_DISCOUNT_CENTS,
    currency: 'usd',
    duration: 'once',
    name: 'SURVEY20 $1 off first year',
    metadata: {
      purpose: 'slipupclipz-survey20',
      appliesTo: 'first-invoice-only',
    },
  })
}

function couponIdFromPromotion(promotionCode) {
  const coupon = promotionCode?.coupon
  if (!coupon) return ''
  return typeof coupon === 'string' ? coupon : coupon.id || ''
}

async function assertPromotionCoupon(stripe, promotionCode, price) {
  if (!promotionCode?.id || promotionCode.active !== true) {
    throw couponError('SURVEY20 is not an active promotion code.')
  }
  const couponId = couponIdFromPromotion(promotionCode)
  if (!couponId) throw couponError('SURVEY20 has no valid introductory coupon.')
  const coupon =
    promotionCode?.coupon && typeof promotionCode.coupon !== 'string'
      ? promotionCode.coupon
      : await stripe.coupons.retrieve(couponId)
  const problem = assertIntroCoupon(coupon, price)
  if (problem) throw couponError(problem)
  if (String(promotionCode.code || '').toUpperCase() !== PUBLIC_PROMOTION_CODE) {
    throw couponError('The configured promotion code is not SURVEY20.')
  }
  return promotionCode
}

async function resolvePublicPromotionCode(stripe, secretKey, price) {
  // An existing promotion owns its coupon; no separate coupon setting is needed.
  const configuredId = String(process.env.STRIPE_SURVEY_PROMOTION_CODE_ID || '').trim()
  if (configuredId) {
    return assertPromotionCoupon(stripe, await stripe.promotionCodes.retrieve(configuredId), price)
  }

  const listed = await stripe.promotionCodes.list({
    code: PUBLIC_PROMOTION_CODE,
    active: true,
    limit: 2,
  })
  if (listed?.data?.length > 1 || listed?.has_more) {
    throw couponError('Multiple active SURVEY20 promotions exist. Configure STRIPE_SURVEY_PROMOTION_CODE_ID explicitly.')
  }
  const existing = listed?.data?.[0]
  if (existing) return assertPromotionCoupon(stripe, existing, price)

  if (isLiveSecretKey(secretKey)) {
    throw couponError(
      'SURVEY20 is not configured for live checkout. You can still buy Pro at the regular annual price.',
    )
  }

  if (!isTestSecretKey(secretKey)) {
    throw couponError('Stripe test mode is required before SURVEY20 can be created.')
  }

  const coupon = await resolveIntroCoupon(stripe, secretKey)
  return stripe.promotionCodes.create({
    coupon: coupon.id,
    code: PUBLIC_PROMOTION_CODE,
    active: true,
    metadata: {
      purpose: 'slipupclipz-survey20',
      shareable: 'true',
    },
  })
}

function offerPriceProblem(price) {
  if (!price?.id || price.active !== true || price.currency !== 'usd' || price.unit_amount !== 499 ||
      price.recurring?.interval !== 'year' || price.recurring?.interval_count !== 1 ||
      price.recurring?.usage_type !== 'licensed' || price.billing_scheme !== 'per_unit' ||
      price.transform_quantity != null || price.tax_behavior === 'inclusive' || !price.product) {
    return 'The survey offer requires the active $4.99 USD yearly Pro price without quantity transforms.'
  }
  return null
}

function assertOfferSession(session, priceId, promotionId) {
  const lines = session?.line_items
  const line = lines?.data?.[0]
  const discount = session?.discounts?.[0]
  const appliedId = typeof discount?.promotion_code === 'string' ? discount.promotion_code : discount?.promotion_code?.id
  const tax = session?.total_details?.amount_tax
  if (session?.mode !== 'subscription' || session.status !== 'open' || session.currency !== 'usd' ||
      session.amount_subtotal !== 499 || session.total_details?.amount_discount !== 100 ||
      session.total_details?.amount_shipping !== 0 || !Number.isSafeInteger(tax) || tax < 0 ||
      session.amount_total !== 399 + tax || session.discounts?.length !== 1 || appliedId !== promotionId ||
      lines?.has_more !== false || lines.data.length !== 1 || line?.quantity !== 1 || line.price?.id !== priceId ||
      line.currency !== 'usd' || line.amount_subtotal !== 499 || line.amount_discount !== 100 ||
      line.amount_tax !== tax || line.amount_total !== 399 + tax || !session.url) {
    throw couponError('Stripe could not confirm the $3.99 first-year survey offer. No checkout link was issued.')
  }
}

function requestedPromotionCode(body) {
  const code = String(body?.promotionCode || '').trim().toUpperCase()
  if (!code) return null
  if (code !== PUBLIC_PROMOTION_CODE) {
    const error = new Error('Enter SURVEY20 on the Stripe checkout page.')
    error.statusCode = 400
    throw error
  }
  return code
}

function buildCheckoutSessionParams({ siteUrl, priceId, promotionCodeId }) {
  const params = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/pricing?purchase=success`,
    cancel_url: `${siteUrl}/pricing?purchase=canceled`,
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

  if (!promotionCodeId) {
    params.allow_promotion_codes = true
    return params
  }

  params.discounts = [{ promotion_code: promotionCodeId }]
  params.metadata.promotionCode = PUBLIC_PROMOTION_CODE
  params.subscription_data.metadata.promotionCode = PUBLIC_PROMOTION_CODE
  return params
}

module.exports = {
  offerPriceProblem,
  assertOfferSession,
  INTRO_DISCOUNT_CENTS,
  ADVERTISED_ANNUAL_CENTS,
  TEST_COUPON_ID,
  PUBLIC_PROMOTION_CODE,
  isLiveSecretKey,
  isTestSecretKey,
  firstYearCents,
  advertisedQuote,
  describeStripePrice,
  assertIntroCoupon,
  resolveIntroCoupon,
  resolvePublicPromotionCode,
  requestedPromotionCode,
  buildCheckoutSessionParams,
}
