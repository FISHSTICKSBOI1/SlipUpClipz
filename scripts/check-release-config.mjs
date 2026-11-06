/**
 * Reports which release environment variables are present.
 * Prints names and categories only. Never prints secret values.
 * Does not create Stripe objects and does not change Netlify settings.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { describeStripePrice, isLiveSecretKey, isTestSecretKey } = require('../netlify/lib/intro-discount.cjs')

const REQUIRED = [
  ['STRIPE_SECRET_KEY', 'Stripe checkout and webhooks'],
  ['STRIPE_PRICE_ID', 'Annual subscription price'],
  ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook signature'],
  ['RESEND_API_KEY', 'License email delivery'],
  ['RESEND_FROM_EMAIL', 'License email sender'],
  ['SUPPORT_TO_EMAIL', 'Support form destination'],
  ['SURVEY_ADMIN_TOKEN', 'Private survey export'],
  ['SURVEY_IP_SALT', 'Production survey IP hash salt'],
]

const LIVE_ONLY = [
  ['STRIPE_INTRO_COUPON_ID', 'Live SURVEY20 coupon. Test mode can create one; live mode must not.'],
  ['STRIPE_SURVEY_PROMOTION_CODE_ID', 'Live SURVEY20 promotion code.'],
]

function presence(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) return 'missing'
  if (name === 'STRIPE_SECRET_KEY') {
    if (isLiveSecretKey(value)) return 'set-live'
    if (isTestSecretKey(value)) return 'set-test'
    return 'set-unrecognized'
  }
  if (name === 'STRIPE_PRICE_ID') return value.startsWith('price_') ? 'set-price-id' : 'set'
  if (name === 'STRIPE_WEBHOOK_SECRET') return value.startsWith('whsec_') ? 'set-webhook' : 'set'
  return 'set'
}

const report = REQUIRED.map(([name, purpose]) => ({ name, purpose, status: presence(name) }))
const liveOnly = LIVE_ONLY.map(([name, purpose]) => ({ name, purpose, status: presence(name) }))

console.log(
  JSON.stringify(
    {
      siteUrl: process.env.SITE_URL || 'https://slipupclipz.com (default)',
      context: process.env.CONTEXT || 'not-set',
      required: report,
      liveStripeOnly: liveOnly,
    },
    null,
    2,
  ),
)

const secret = String(process.env.STRIPE_SECRET_KEY || '').trim()
const priceId = String(process.env.STRIPE_PRICE_ID || '').trim()
if (!secret || !priceId) {
  console.log('Stripe price was not read. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID in this shell to check the amount.')
  process.exit(2)
}

const stripe = require('stripe')(secret)
const price = await stripe.prices.retrieve(priceId)
const described = describeStripePrice(price)
console.log(
  JSON.stringify(
    {
      priceRead: true,
      livemode: price.livemode === true,
      unitAmountCents: price.unit_amount ?? null,
      matchesAdvertised499: price.unit_amount === 499,
      currency: price.currency ?? null,
      interval: price.recurring?.interval ?? null,
      warning: described.ok ? null : described.error,
    },
    null,
    2,
  ),
)

if (isLiveSecretKey(secret)) {
  console.log('Live key detected. No coupon, promotion code, checkout session, or subscription was created or changed.')
}
if (!described.ok || price.unit_amount !== 499) process.exit(1)
