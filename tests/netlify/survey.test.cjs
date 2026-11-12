const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const feedbackDir = mkdtempSync(join(tmpdir(), 'slipup-feedback-'))
process.env.SLIPUPCLIPZ_FEEDBACK_DIR = feedbackDir
delete process.env.SITE_ID

const { after, describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { validateSurveySubmission } = require('../../netlify/lib/survey.cjs')
const { listSurveyResponses } = require('../../netlify/lib/feedback-store.cjs')
const { handler: submitSurvey } = require('../../netlify/functions/submit-survey.cjs')
const { createCheckoutSession } = require('../../netlify/functions/create-checkout.cjs')
const { handler: exportSurvey } = require('../../netlify/functions/survey-export.cjs')

const originalPrice = process.env.STRIPE_PRICE_ID
const originalSecret = process.env.STRIPE_SECRET_KEY
const originalCoupon = process.env.STRIPE_INTRO_COUPON_ID
const originalPromo = process.env.STRIPE_SURVEY_PROMOTION_CODE_ID
const originalAdmin = process.env.SURVEY_ADMIN_TOKEN

after(() => {
  process.env.STRIPE_PRICE_ID = originalPrice
  process.env.STRIPE_SECRET_KEY = originalSecret
  if (originalCoupon == null) delete process.env.STRIPE_INTRO_COUPON_ID
  else process.env.STRIPE_INTRO_COUPON_ID = originalCoupon
  if (originalPromo == null) delete process.env.STRIPE_SURVEY_PROMOTION_CODE_ID
  else process.env.STRIPE_SURVEY_PROMOTION_CODE_ID = originalPromo
  if (originalAdmin == null) delete process.env.SURVEY_ADMIN_TOKEN
  else process.env.SURVEY_ADMIN_TOKEN = originalAdmin
  rmSync(feedbackDir, { recursive: true, force: true })
})

function validBody(overrides = {}) {
  return {
    startedAt: Date.now() - 5000,
    heardFrom: 'youtube',
    downloadSource: 'website',
    feedback: 'I want easier pad categories for ranked nights.',
    company: '',
    ...overrides,
  }
}

function post(body, headers = {}) {
  return {
    httpMethod: 'POST',
    headers,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  }
}

function fakeStripe() {
  const calls = []
  return {
    calls,
    prices: { async retrieve(id) { return { id, active: true, unit_amount: 499, currency: 'usd', recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' }, billing_scheme: 'per_unit', product: 'prod_pro', livemode: process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') } } },
    coupons: {
      async retrieve(id) {
        calls.push({ type: 'retrieve-coupon', id })
        return { id, amount_off: 100, currency: 'usd', duration: 'once', valid: true }
      },
      async create() {
        throw new Error('test coupon create should not run when a coupon already exists')
      },
    },
    promotionCodes: {
      async list() {
        calls.push({ type: 'list-promo' })
        return {
          data: [
            {
              id: 'promo_survey20',
              code: 'SURVEY20',
              active: true,
              coupon: 'slipupclipz_survey_first_year_1usd',
            },
          ],
        }
      },
      async create() {
        throw new Error('SURVEY20 already exists in this mock')
      },
    },
    checkout: {
      sessions: {
        async create(params) {
          calls.push({ type: 'create-session', params })
          return { id: `cs_${calls.length}`, url: 'https://checkout.stripe.test/session', status: 'open', mode: 'subscription', currency: 'usd', amount_subtotal: 499, amount_total: 399, total_details: { amount_discount: 100, amount_tax: 0, amount_shipping: 0 }, discounts: params.discounts, line_items: { has_more: false, data: [{ quantity: 1, price: { id: params.line_items[0].price }, currency: 'usd', amount_subtotal: 499, amount_discount: 100, amount_tax: 0, amount_total: 399 }] } }
        },
        async retrieve(id) {
          calls.push({ type: 'retrieve-session', id })
          return { id, status: 'open', url: 'https://checkout.stripe.test/existing' }
        },
      },
    },
  }
}

describe('survey validation', () => {
  it('accepts the current questions and an empty suggestion', () => {
    const result = validateSurveySubmission(validBody({ feedback: '' }))
    assert.equal(result.ok, true)
    assert.equal(result.answers.heardFrom, 'youtube')
    assert.equal(result.answers.downloadSource, 'website')
    assert.equal(result.answers.feedback, '')
  })

  it('rejects removed choices, oversized text, rushed forms, and honeypots', () => {
    assert.equal(validateSurveySubmission(validBody({ heardFrom: 'discord' })).ok, false)
    assert.equal(validateSurveySubmission(validBody({ heardFrom: 'friend' })).ok, false)
    assert.equal(validateSurveySubmission(validBody({ downloadSource: 'github' })).ok, false)
    assert.equal(validateSurveySubmission(validBody({ feedback: 'x'.repeat(1001) })).ok, false)
    assert.equal(validateSurveySubmission(validBody({ startedAt: Date.now() })).ok, false)
    assert.equal(validateSurveySubmission(validBody({ heardFrom: 'other', heardFromOther: '' })).ok, false)
    const spam = validateSurveySubmission(validBody({ company: 'spam inc' }))
    assert.equal(spam.ok, false)
    assert.equal(spam.spam, true)
  })
})

describe('survey storage and public SURVEY20 checkout', () => {
  it('stores feedback and does not lock the next visit to a claim cookie', async () => {
    const first = await submitSurvey(post(validBody(), { 'x-forwarded-for': '203.0.113.10' }))
    assert.equal(first.statusCode, 200)
    const saved = JSON.parse(first.body)
    assert.equal(saved.ok, true)
    assert.equal(saved.claimToken, undefined)
    assert.match(first.headers['Set-Cookie'], /Max-Age=0/)

    const before = (await listSurveyResponses()).responses.length
    const second = await submitSurvey(
      post(validBody({ feedback: 'A later visit with a new suggestion.' }), {
        'x-forwarded-for': '203.0.113.11',
        cookie: first.headers['Set-Cookie'],
      }),
    )
    assert.equal(second.statusCode, 200)
    const listed = await listSurveyResponses()
    assert.equal(listed.responses.length, before + 1)
    assert.ok(listed.responses.some((item) => /pad categories/.test(item.feedback)))
    assert.ok(listed.responses.some((item) => /later visit/.test(item.feedback)))
  })

  it('rate limits repeated new submissions', async () => {
    for (let index = 0; index < 5; index += 1) {
      const response = await submitSurvey(
        post(validBody({ feedback: `Suggestion number ${index} is long enough.` }), {
          'x-forwarded-for': '203.0.113.20',
        }),
      )
      assert.equal(response.statusCode, 200)
    }
    const blocked = await submitSurvey(
      post(validBody({ feedback: 'This sixth suggestion should be rate limited.' }), {
        'x-forwarded-for': '203.0.113.20',
      }),
    )
    assert.equal(blocked.statusCode, 429)
  })

  it('starts regular checkout with promotion codes and applies SURVEY20 once without a survey', async () => {
    process.env.STRIPE_PRICE_ID = 'price_test_annual'
    process.env.STRIPE_SECRET_KEY = 'sk_test_local_only'
    delete process.env.STRIPE_INTRO_COUPON_ID
    delete process.env.STRIPE_SURVEY_PROMOTION_CODE_ID
    const stripe = fakeStripe()

    const regular = await createCheckoutSession(post({}), { stripe })
    assert.equal(regular.statusCode, 200)
    const regularCall = stripe.calls.find((call) => call.type === 'create-session')
    assert.equal(regularCall.params.allow_promotion_codes, true)
    assert.equal(regularCall.params.discounts, undefined)

    stripe.calls.length = 0
    const discounted = await createCheckoutSession(post({ promotionCode: 'SURVEY20' }), { stripe })
    assert.equal(discounted.statusCode, 200)
    const discountedCall = stripe.calls.find((call) => call.type === 'create-session')
    assert.equal(discountedCall.params.allow_promotion_codes, undefined)
    assert.deepEqual(discountedCall.params.discounts, [{ promotion_code: 'promo_survey20' }])
    assert.equal(discountedCall.params.metadata.promotionCode, 'SURVEY20')
    assert.equal(discountedCall.params.metadata.surveyClaimId, undefined)
    assert.equal(discountedCall.params.mode, 'subscription')

    const other = await createCheckoutSession(post({ promotionCode: 'OTHER' }), { stripe })
    assert.equal(other.statusCode, 400)
  })

  it('reuses an existing live promotion without a separate coupon setting', async () => {
    process.env.STRIPE_PRICE_ID = 'price_live_untouched'
    process.env.STRIPE_SECRET_KEY = 'sk_live_blocked'
    delete process.env.STRIPE_INTRO_COUPON_ID
    delete process.env.STRIPE_SURVEY_PROMOTION_CODE_ID
    const stripe = fakeStripe()
    const response = await createCheckoutSession(post({ promotionCode: 'SURVEY20' }), { stripe })
    assert.equal(response.statusCode, 200)
    const session = stripe.calls.find((call) => call.type === 'create-session').params
    assert.deepEqual(session.line_items, [{ price: 'price_live_untouched', quantity: 1 }])
    assert.deepEqual(session.discounts, [{ promotion_code: 'promo_survey20' }])
    assert.equal(session.allow_promotion_codes, undefined)
  })

  it('supports the existing percentage shape only after Stripe confirms the session totals', async () => {
    process.env.STRIPE_PRICE_ID = 'price_test_annual'
    process.env.STRIPE_SECRET_KEY = 'sk_test_local_only'
    delete process.env.STRIPE_SURVEY_PROMOTION_CODE_ID
    const stripe = fakeStripe()
    stripe.coupons.retrieve = async () => ({ id: 'coupon_percent', valid: true, duration: 'once', percent_off: 20, amount_off: null, currency: null, applies_to: { products: ['prod_pro'] } })
    const response = await createCheckoutSession(post({ promotionCode: 'SURVEY20', quantity: 2 }), { stripe })
    assert.equal(response.statusCode, 200)
    const params = stripe.calls.find(c => c.type === 'create-session').params
    assert.equal(params.line_items[0].quantity, 1)
    assert.deepEqual(params.expand, ['line_items'])
    assert.equal(params.discounts.length, 1)
    assert.equal(params.allow_promotion_codes, undefined)
  })

  it('withholds an incorrect checkout URL and expires the session even when expiration fails', async () => {
    for (const expirationFails of [false, true]) {
      const stripe = fakeStripe()
      const create = stripe.checkout.sessions.create
      stripe.checkout.sessions.create = async params => ({ ...await create(params), amount_total: 400 })
      let expired = false
      stripe.checkout.sessions.expire = async id => { assert.match(id, /^cs_/); expired = true; if (expirationFails) throw new Error('unavailable') }
      const response = await createCheckoutSession(post({ promotionCode: 'SURVEY20' }), { stripe })
      assert.equal(response.statusCode, 503)
      assert.equal(JSON.parse(response.body).url, undefined)
      assert.equal(expired, true)
    }
  })

  it('rejects wrong price and ineligible coupon before creating a session', async () => {
    for (const kind of ['price', 'product']) {
      const stripe = fakeStripe()
      if (kind === 'price') stripe.prices.retrieve = async () => ({ unit_amount: 500 })
      else stripe.coupons.retrieve = async () => ({ id: 'coupon', valid: true, duration: 'once', amount_off: 100, currency: 'usd', applies_to: { products: ['prod_other'] } })
      const response = await createCheckoutSession(post({ promotionCode: 'SURVEY20' }), { stripe })
      assert.equal(response.statusCode, 503)
      assert.equal(stripe.calls.some(c => c.type === 'create-session'), false)
    }
  })

  it('refuses survey storage in production when the private IP salt is missing', async () => {
    const previousContext = process.env.CONTEXT
    const previousSalt = process.env.SURVEY_IP_SALT
    process.env.CONTEXT = 'production'
    delete process.env.SURVEY_IP_SALT
    try {
      const response = await submitSurvey(post(validBody()))
      assert.equal(response.statusCode, 503)
      const body = JSON.parse(response.body)
      assert.equal(body.error, 'Survey submissions are unavailable on this deployment. Your answers were not saved.')
      assert.equal(JSON.stringify(body).includes('slipupclipz-survey-v1'), false)
    } finally {
      if (previousContext == null) delete process.env.CONTEXT
      else process.env.CONTEXT = previousContext
      if (previousSalt == null) delete process.env.SURVEY_IP_SALT
      else process.env.SURVEY_IP_SALT = previousSalt
    }
  })

  it('keeps the export private', async () => {
    delete process.env.SURVEY_ADMIN_TOKEN
    const unconfigured = await exportSurvey({ httpMethod: 'GET', headers: {} })
    assert.equal(unconfigured.statusCode, 503)

    process.env.SURVEY_ADMIN_TOKEN = 'local-review-token'
    const denied = await exportSurvey({
      httpMethod: 'GET',
      headers: { 'x-survey-admin-token': 'wrong' },
    })
    assert.equal(denied.statusCode, 401)

    const allowed = await exportSurvey({
      httpMethod: 'GET',
      headers: { 'x-survey-admin-token': 'local-review-token' },
    })
    assert.equal(allowed.statusCode, 200)
    const payload = JSON.parse(allowed.body)
    assert.ok(payload.summary.count >= 1)
    assert.equal(payload.responses.some((item) => item.token), false)
  })
})
