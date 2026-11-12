const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  firstYearCents,
  advertisedQuote,
  describeStripePrice,
  assertIntroCoupon,
  buildCheckoutSessionParams,
  isLiveSecretKey,
  isTestSecretKey,
} = require('../../netlify/lib/intro-discount.cjs')
const { buildKnowledgeContext } = require('../../netlify/lib/slipupclipz-knowledge.cjs')

describe('introductory discount math', () => {
  it('takes one dollar off a $4.99 or $5.00 annual price', () => {
    assert.equal(firstYearCents(499), 399)
    assert.equal(firstYearCents(500), 400)
    assert.equal(firstYearCents(100), null)
  })

  it('advertises $4.99 until Stripe confirms the live price', () => {
    const quote = advertisedQuote()
    assert.equal(quote.verified, false)
    assert.equal(quote.regularCents, 499)
    assert.equal(quote.firstYearCents, 399)
    assert.equal(quote.discountCents, 100)
  })

  it('reads a USD yearly Stripe price without changing it', () => {
    const described = describeStripePrice({
      unit_amount: 500,
      currency: 'usd',
      recurring: { interval: 'year' },
      livemode: false,
    })
    assert.equal(described.ok, true)
    assert.equal(described.regularCents, 500)
    assert.equal(described.firstYearCents, 400)
    assert.equal(described.livemode, false)
  })

  it('rejects coupons that would discount renewals or change the amount', () => {
    assert.equal(assertIntroCoupon({ amount_off: 100, currency: 'usd', duration: 'once', valid: true }), null)
    assert.match(assertIntroCoupon({ amount_off: 100, currency: 'usd', duration: 'forever', valid: true }), /once/)
    assert.match(
      assertIntroCoupon({ amount_off: 100, currency: 'usd', duration: 'once', percent_off: 10, valid: true }),
      /exactly 20%/,
    )
    assert.match(assertIntroCoupon({ amount_off: 250, currency: 'usd', duration: 'once', valid: true }), /\$1\.00/)
  })

  it('lets regular checkout accept SURVEY20 and applies that code only once', () => {
    const regular = buildCheckoutSessionParams({
      siteUrl: 'http://localhost:5174',
      priceId: 'price_test',
      promotionCodeId: null,
    })
    assert.equal(regular.allow_promotion_codes, true)
    assert.equal(regular.discounts, undefined)
    assert.equal(regular.metadata.promotionCode, undefined)

    const discounted = buildCheckoutSessionParams({
      siteUrl: 'http://localhost:5174',
      priceId: 'price_test',
      promotionCodeId: 'promo_survey20',
    })
    assert.equal(discounted.allow_promotion_codes, undefined)
    assert.deepEqual(discounted.discounts, [{ promotion_code: 'promo_survey20' }])
    assert.equal(discounted.discounts.length, 1)
    assert.equal(discounted.metadata.promotionCode, 'SURVEY20')
    assert.equal(discounted.subscription_data.metadata.promotionCode, 'SURVEY20')
    assert.equal(discounted.mode, 'subscription')
  })

  it('recognizes live keys so a coupon is never created against them', () => {
    assert.equal(isLiveSecretKey('sk_live_example'), true)
    assert.equal(isTestSecretKey('sk_live_example'), false)
    assert.equal(isTestSecretKey('sk_test_example'), true)
  })
})

describe('support knowledge plans', () => {
  it('describes the current Free and Pro plans', () => {
    const text = buildKnowledgeContext()
    assert.match(text, /7 soundboard pads/)
    assert.match(text, /50 soundboard pads/)
    assert.match(text, /voice engine/)
    assert.match(text, /\$4\.99 per year/)
    assert.match(text, /Do not tell the visitor the promotion code/)
    assert.doesNotMatch(text, /SURVEY20/)
    assert.match(text, /v0\.1\.6/)
    assert.doesNotMatch(text, /Qwen/)
    assert.doesNotMatch(text, /three variations/i)
    assert.doesNotMatch(text, /3 soundboard pads/)
    assert.doesNotMatch(text, /Priority updates/i)
    assert.doesNotMatch(text, /Future Pro features/i)
    assert.doesNotMatch(text, /Global hotkeys require Pro/)
  })
})

// Offline Stripe doubles only: these regressions never use account credentials.
describe('live SURVEY20 resolution', () => {
  const { beforeEach, afterEach } = require('node:test')
  const { resolvePublicPromotionCode } = require('../../netlify/lib/intro-discount.cjs')
  const names = ['STRIPE_INTRO_COUPON_ID', 'STRIPE_SURVEY_PROMOTION_CODE_ID', 'STRIPE_AFFILIATE_COUPON_ID']
  let previous
  beforeEach(() => {
    previous = names.map((name) => process.env[name])
    names.forEach((name) => delete process.env[name])
  })
  afterEach(() => names.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name]
    else process.env[name] = previous[index]
  }))
  function mock(overrides = {}) {
    const coupon = { id: 'coupon_existing', valid: true, amount_off: 100, currency: 'usd', duration: 'once', ...overrides }
    const promotion = { id: 'promo_existing', code: 'SURVEY20', active: true, coupon }
    const calls = []
    const stripe = {
      coupons: { retrieve: async (id) => { calls.push(['coupon', id]); return coupon },
        create: async () => assert.fail('must never create live coupons') },
      promotionCodes: {
        list: async (params) => { calls.push(['list', params]); return { data: [promotion] } },
        retrieve: async (id) => { calls.push(['retrieve', id]); return promotion },
        create: async () => assert.fail('must never create live promotions'),
      },
    }
    return { stripe, coupon, promotion, calls }
  }
  it('discovers only active existing promotions without a coupon environment variable', async () => {
    const { stripe, promotion, calls } = mock()
    assert.equal(await resolvePublicPromotionCode(stripe, 'sk_live_offline_fixture'), promotion)
    assert.deepEqual(calls, [['list', { code: 'SURVEY20', active: true, limit: 2 }]])
  })
  it('uses an explicit promo ID and validates its coupon, ignoring unrelated legacy/affiliate coupons', async () => {
    process.env.STRIPE_SURVEY_PROMOTION_CODE_ID = 'promo_existing'
    process.env.STRIPE_INTRO_COUPON_ID = 'coupon_legacy'
    process.env.STRIPE_AFFILIATE_COUPON_ID = 'coupon_affiliate'
    const { stripe, promotion, calls } = mock()
    promotion.coupon = 'coupon_existing'
    await resolvePublicPromotionCode(stripe, 'rk_live_offline_fixture')
    assert.deepEqual(calls, [['retrieve', 'promo_existing'], ['coupon', 'coupon_existing']])
  })
  it('keeps the annual price unchanged and applies a fixed first-invoice-only discount once', async () => {
    const { stripe, coupon } = mock()
    const promo = await resolvePublicPromotionCode(stripe, 'sk_live_offline_fixture')
    const params = buildCheckoutSessionParams({ siteUrl: 'https://example.test', priceId: 'price_existing_499', promotionCodeId: promo.id })
    assert.deepEqual(params.line_items, [{ price: 'price_existing_499', quantity: 1 }])
    assert.deepEqual(params.discounts, [{ promotion_code: promo.id }])
    assert.equal(params.allow_promotion_codes, undefined)
    assert.equal(499 - coupon.amount_off, 399)
    assert.equal(coupon.duration, 'once') // Stripe applies no discount on subsequent invoices.
  })
  for (const [label, change] of Object.entries({ expired: { valid: false }, uncertain: { valid: undefined }, repeating: { duration: 'repeating' }, forever: { duration: 'forever' }, percentage: { percent_off: 20 }, amount: { amount_off: 200 }, currency: { currency: 'eur' } })) {
    it(`rejects ${label} coupons`, async () => {
      await assert.rejects(resolvePublicPromotionCode(mock(change).stripe, 'sk_live_offline_fixture'), { code: 'intro-coupon-not-configured' })
    })
  }
  it('fails closed when missing, inactive, ambiguous, wrong-code or malformed promotions are returned', async () => {
    for (const kind of ['missing', 'inactive', 'ambiguous', 'wrong-code', 'malformed']) {
      const { stripe, promotion } = mock()
      if (kind === 'missing') stripe.promotionCodes.list = async () => ({ data: [] })
      if (kind === 'inactive') promotion.active = false
      if (kind === 'ambiguous') stripe.promotionCodes.list = async () => ({ data: [promotion, { ...promotion, id: 'promo_other' }] })
      if (kind === 'wrong-code') promotion.code = 'OTHER'
      if (kind === 'malformed') delete promotion.coupon
      await assert.rejects(resolvePublicPromotionCode(stripe, 'sk_live_offline_fixture'), { code: 'intro-coupon-not-configured' })
    }
  })
  it('propagates lookup failure without falling back to coupon or promotion creation', async () => {
    const { stripe } = mock()
    stripe.promotionCodes.list = async () => { throw new Error('lookup unavailable') }
    await assert.rejects(resolvePublicPromotionCode(stripe, 'sk_live_offline_fixture'), /lookup unavailable/)
  })
  it('retains test-mode-only creation when no promotion exists', async () => {
    const { stripe } = mock()
    stripe.promotionCodes.list = async () => ({ data: [] })
    stripe.coupons.retrieve = async () => { throw Object.assign(new Error('missing'), { code: 'resource_missing' }) }
    stripe.coupons.create = async (params) => {
      assert.equal(params.amount_off, 100)
      assert.equal(params.duration, 'once')
      return { ...params, valid: true }
    }
    stripe.promotionCodes.create = async (params) => {
      assert.equal(params.code, 'SURVEY20')
      assert.equal(params.coupon, 'slipupclipz_survey_first_year_1usd')
      return { ...params, id: 'promo_test' }
    }
    assert.equal((await resolvePublicPromotionCode(stripe, 'sk_test_offline_fixture')).id, 'promo_test')
  })
})


describe('percentage offer price and Stripe-calculated totals', () => {
  const { offerPriceProblem, assertOfferSession } = require('../../netlify/lib/intro-discount.cjs')
  const price = { id: 'price_pro', active: true, unit_amount: 499, currency: 'usd', recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' }, billing_scheme: 'per_unit', product: 'prod_pro' }
  const percentage = { id: 'coupon_percent', valid: true, duration: 'once', percent_off: 20, amount_off: null, currency: null, applies_to: { products: ['prod_pro'] } }
  function session() {
    return { mode: 'subscription', status: 'open', currency: 'usd', amount_subtotal: 499, amount_total: 399, url: 'https://checkout.stripe.test/session', discounts: [{ promotion_code: 'promo_existing' }], total_details: { amount_discount: 100, amount_tax: 0, amount_shipping: 0 }, line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'price_pro' }, currency: 'usd', amount_subtotal: 499, amount_discount: 100, amount_tax: 0, amount_total: 399 }] } }
  }
  it('accepts only 20% once against the exact eligible annual USD product', () => {
    assert.equal(offerPriceProblem(price), null)
    assert.equal(assertIntroCoupon(percentage, price), null)
    assert.equal(assertIntroCoupon({ ...percentage, percent_off: null, amount_off: 100, currency: 'usd' }, price), null)
    for (const patch of [{ percent_off: 19 }, { percent_off: 25 }, { duration: 'forever' }, { duration: 'repeating' }, { valid: false }, { applies_to: { products: ['prod_other'] } }, { currency: 'eur' }, { amount_off: 100 }]) {
      assert.ok(assertIntroCoupon({ ...percentage, ...patch }, price))
    }
    assert.ok(assertIntroCoupon(percentage))
    for (const patch of [{ unit_amount: 500 }, { currency: 'eur' }, { active: false }, { recurring: { interval: 'month' } }, { recurring: { interval: 'year', interval_count: 2, usage_type: 'licensed' } }, { transform_quantity: { divide_by: 2 } }, { billing_scheme: 'tiered' }]) {
      assert.ok(offerPriceProblem({ ...price, ...patch }))
      assert.ok(assertIntroCoupon(percentage, { ...price, ...patch }))
    }
  })
  it('accepts Stripe-reported 100-cent rounding, not locally computed percentage arithmetic', () => {
    assert.doesNotThrow(() => assertOfferSession(session(), 'price_pro', 'promo_existing'))
    const taxed = session(); taxed.total_details.amount_tax = 32; taxed.amount_total = 431
    taxed.line_items.data[0].amount_tax = 32; taxed.line_items.data[0].amount_total = 431
    assert.doesNotThrow(() => assertOfferSession(taxed, 'price_pro', 'promo_existing'))
  })
  it('rejects wrong rounding, totals, quantity, price, currency, extra discounts and missing evidence', () => {
    const edits = [s => s.total_details.amount_discount = 99, s => s.amount_total = 400, s => s.currency = 'eur', s => s.amount_subtotal = 500, s => s.line_items.data[0].quantity = 2, s => s.line_items.data[0].price.id = 'price_other', s => s.discounts.push({ promotion_code: 'promo_other' }), s => s.discounts[0].promotion_code = 'promo_other', s => delete s.total_details, s => delete s.line_items, s => s.line_items.has_more = true]
    for (const edit of edits) { const s = session(); edit(s); assert.throws(() => assertOfferSession(s, 'price_pro', 'promo_existing'), { code: 'intro-coupon-not-configured' }) }
  })
})
