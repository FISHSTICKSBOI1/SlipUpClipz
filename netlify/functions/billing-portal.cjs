const { getSiteUrl, getStripe, jsonResponse } = require('../lib/commerce.cjs')
const { normalizeLicenseKey, isLicenseKeyFormat } = require('../lib/license.cjs')
const { connectCommerceBlobs, getLicenseByKey } = require('../lib/storage.cjs')

function parseBody(event) {
  if (!event.body) return {}

  try {
    return JSON.parse(event.body)
  } catch {
    return null
  }
}

exports.handler = async (event) => {
  connectCommerceBlobs(event)

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const body = parseBody(event)
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const licenseKey = normalizeLicenseKey(typeof body.licenseKey === 'string' ? body.licenseKey : '')
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!isLicenseKeyFormat(licenseKey)) {
    return jsonResponse(404, { error: 'License not found' })
  }

  if (!email) {
    return jsonResponse(400, { error: 'Email is required' })
  }

  try {
    const record = await getLicenseByKey(licenseKey)
    if (!record || record.email?.toLowerCase() !== email) {
      return jsonResponse(404, { error: 'License not found' })
    }

    if (!record.stripeCustomerId) {
      return jsonResponse(503, { error: 'Billing portal is not available for this license yet' })
    }

    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: record.stripeCustomerId,
      return_url: `${getSiteUrl()}/pricing`,
    })

    return jsonResponse(200, { url: session.url })
  } catch (error) {
    console.error('billing-portal failed', error)
    return jsonResponse(500, { error: 'Unable to create billing portal session' })
  }
}
