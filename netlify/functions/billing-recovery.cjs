const { jsonResponse, getSiteUrl } = require('../lib/commerce.cjs')
const { sendBillingRecoveryEmail } = require('../lib/email.cjs')
const {
  EMAIL_LIMIT,
  IP_LIMIT,
  consumeRecoveryRateLimit,
  issueBillingRecovery,
} = require('../lib/billing-recovery.cjs')
const { createHash } = require('node:crypto')
const { connectCommerceBlobs, getCommerceStore, getLicenseByEmail } = require('../lib/storage.cjs')

function clientAddress(event) {
  const headers = event?.headers || {}
  const forwarded = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || ''
  return String(forwarded).split(',')[0].trim() || 'local'
}

function emailHash(email) {
  return createHash('sha256').update(email).digest('hex').slice(0, 16)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  let body = {}
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch {
    return jsonResponse(400, { error: 'Invalid request.' })
  }

  const email = String(body?.email || '').trim().toLowerCase()
  const generic = {
    ok: true,
    message: 'If that email has a website Pro subscription, we sent a link that expires in 60 minutes.',
  }
  if (!email || !email.includes('@')) {
    return jsonResponse(200, generic)
  }

  let store
  const limited = () => jsonResponse(429, { error: 'Too many requests. Try again tomorrow.' })
  try {
    connectCommerceBlobs(event)
    store = await getCommerceStore()
    const ipAllowed = await consumeRecoveryRateLimit(
      store, `billing-recovery-rate:ip:${emailHash(clientAddress(event))}`, Date.now(), IP_LIMIT,
    )
    if (!ipAllowed.allowed) return limited()

    const emailAllowed = await consumeRecoveryRateLimit(
      store, `billing-recovery-rate:email:${emailHash(email)}`, Date.now(), EMAIL_LIMIT,
    )
    if (!emailAllowed.allowed) return limited()
  } catch {
    console.error('[billing-recovery] Rate limit storage unavailable')
    return jsonResponse(503, { error: 'Management email is temporarily unavailable.' })
  }

  const license = await getLicenseByEmail(email)
  if (!license || license.email?.toLowerCase() !== email || !license.stripeCustomerId) {
    return jsonResponse(200, generic)
  }

  const issued = await issueBillingRecovery({ store, license })
  const recoveryUrl = `${getSiteUrl()}/pricing?billing=${issued.token}`
  const delivery = await sendBillingRecoveryEmail({
    to: email,
    licenseKey: license.licenseKey,
    recoveryUrl,
  })
  if (!delivery?.sent) {
    console.error('[billing-recovery] Email was not sent')
  }

  return jsonResponse(200, generic)
}
