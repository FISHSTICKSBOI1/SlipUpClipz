const { getStripe, getSiteUrl, jsonResponse } = require('../lib/commerce.cjs')
const { readBillingRecovery, markBillingRecoveryUsed } = require('../lib/billing-recovery.cjs')
const { connectCommerceBlobs, getCommerceStore, getLicenseByKey } = require('../lib/storage.cjs')

exports.handler = async (event) => {
  connectCommerceBlobs(event)
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  let body = {}
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch {
    return jsonResponse(400, { error: 'This cancellation link is invalid or expired.' })
  }

  const token = String(body.token || '')
  const store = await getCommerceStore()
  const recovery = await readBillingRecovery(store, token)
  if (!recovery.ok) {
    return jsonResponse(400, { error: 'This cancellation link is invalid or expired.' })
  }

  const license = await getLicenseByKey(recovery.record.licenseKey)
  if (!license?.stripeCustomerId || license.stripeCustomerId !== recovery.record.stripeCustomerId) {
    return jsonResponse(400, { error: 'This cancellation link is invalid or expired.' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[billing-recovery-redeem] Missing STRIPE_SECRET_KEY')
    return jsonResponse(503, { error: 'Subscription management is not configured.' })
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: license.stripeCustomerId,
    return_url: `${getSiteUrl()}/pricing`,
  })

  if (!session?.url || !session.url.startsWith('https://billing.stripe.com/')) {
    return jsonResponse(502, { error: 'Billing portal returned an unexpected address.' })
  }

  await markBillingRecoveryUsed(store, token)
  return jsonResponse(200, { url: session.url })
}
