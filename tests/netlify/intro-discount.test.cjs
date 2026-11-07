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
      /fixed amount/,
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
