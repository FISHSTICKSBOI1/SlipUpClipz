import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  describeStripePrice,
  isLiveSecretKey,
  resolvePublicPromotionCode,
  buildCheckoutSessionParams,
} = require('../netlify/lib/intro-discount.cjs')

const secretKey = process.env.STRIPE_SECRET_KEY || ''
const priceId = process.env.STRIPE_PRICE_ID || ''

if (!secretKey || !priceId) {
  console.log(
    'Stripe price was not read. STRIPE_SECRET_KEY or STRIPE_PRICE_ID is missing from this shell, so the advertised $4.99 price was not confirmed against Stripe.',
  )
  process.exit(2)
}

const stripe = require('stripe')(secretKey)
const price = await stripe.prices.retrieve(priceId)
const described = describeStripePrice(price)

console.log(
  JSON.stringify(
    {
      verified: described.ok === true,
      unitAmountCents: price.unit_amount ?? null,
      currency: price.currency ?? null,
      interval: price.recurring?.interval ?? null,
      livemode: price.livemode === true,
      firstYearCents: described.ok ? described.firstYearCents : null,
      warning: described.ok ? null : described.error,
    },
    null,
    2,
  ),
)

if (!described.ok) process.exit(1)

if (isLiveSecretKey(secretKey)) {
  console.log('Live Stripe key detected. No coupon or SURVEY20 promotion code was created or changed.')
  process.exit(0)
}

const promotionCode = await resolvePublicPromotionCode(stripe, secretKey)
const couponId =
  typeof promotionCode.coupon === 'string' ? promotionCode.coupon : promotionCode.coupon?.id
const coupon = await stripe.coupons.retrieve(couponId)
if (coupon.duration !== 'once' || coupon.amount_off !== 100 || promotionCode.code !== 'SURVEY20') {
  console.error('Test promotion code does not match SURVEY20 with a $1 once-duration coupon.')
  process.exit(1)
}

const preview = await stripe.invoices.createPreview({
  discounts: [{ promotion_code: promotionCode.id }],
  subscription_details: {
    items: [{ price: priceId }],
  },
})

const renewalPreview = await stripe.invoices.createPreview({
  subscription_details: {
    items: [{ price: priceId }],
  },
})

const session = await stripe.checkout.sessions.create(
  buildCheckoutSessionParams({
    siteUrl: 'https://slipupclipz.com',
    priceId,
    promotionCodeId: promotionCode.id,
  }),
)
await stripe.checkout.sessions.expire(session.id)

console.log(
  JSON.stringify(
    {
      promotionCode: promotionCode.code,
      promotionCodeId: promotionCode.id,
      couponId: coupon.id,
      couponDuration: coupon.duration,
      couponAmountOff: coupon.amount_off,
      firstInvoiceCents: preview.amount_due,
      renewalPreviewCents: renewalPreview.amount_due,
      expiredTestSession: session.id,
    },
    null,
    2,
  ),
)

if (preview.amount_due !== described.firstYearCents || renewalPreview.amount_due !== described.regularCents) {
  console.error('Invoice preview did not match the first-year discount and full renewal price.')
  process.exit(1)
}
