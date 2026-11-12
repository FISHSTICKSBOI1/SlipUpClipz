const { getStripe, getSiteUrl, jsonResponse } = require('../lib/commerce.cjs')
const { readBillingRecovery, claimBillingRecovery } = require('../lib/billing-recovery.cjs')
const { connectCommerceBlobs, getCommerceStore, getLicenseByKey } = require('../lib/storage.cjs')
const invalid = () => jsonResponse(400, { error: 'This management link is invalid or expired. Request a new link.' })

async function redeemBillingRecovery(event, dependencies = {}) {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })
  let body
  try {
    if (typeof event.body !== 'string' || event.body.length > 4096) return invalid()
    body = JSON.parse(event.body)
    if (typeof body?.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return invalid()
  } catch { return invalid() }
  try {
    if (!dependencies.store) connectCommerceBlobs(event)
    const store = dependencies.store || await getCommerceStore()
    const recovery = await readBillingRecovery(store, body.token)
    if (!recovery.ok) return invalid()
    const license = await (dependencies.getLicense || getLicenseByKey)(recovery.record.licenseKey)
    if (!license?.stripeCustomerId || license.stripeCustomerId !== recovery.record.stripeCustomerId ||
        license.email?.toLowerCase() !== recovery.record.email?.toLowerCase()) return invalid()
    if (!dependencies.stripe && !process.env.STRIPE_SECRET_KEY) {
      return jsonResponse(503, { error: 'Subscription management is not configured.' })
    }
    // Consume atomically BEFORE the external side effect. An uncertain portal response requires a new email link.
    const claimed = await claimBillingRecovery(store, body.token)
    if (!claimed.ok) return invalid()
    const stripe = dependencies.stripe || getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: license.stripeCustomerId, return_url: `${getSiteUrl()}/pricing`,
    })
    const url = new URL(session?.url)
    if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com' || url.username || url.password) throw new Error('invalid-portal')
    return jsonResponse(200, { url: url.href })
  } catch {
    console.error('billing-recovery-redeem failed')
    return jsonResponse(503, { error: 'Unable to open subscription management. Request a new management link and try again.' })
  }
}
exports.handler = (event) => redeemBillingRecovery(event)
exports.redeemBillingRecovery = redeemBillingRecovery
