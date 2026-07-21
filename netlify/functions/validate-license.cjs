const { jsonResponse } = require('../lib/commerce.cjs')
const { normalizeLicenseKey, isLicenseKeyFormat } = require('../lib/license.cjs')
const { evaluateLicenseRecord } = require('../lib/license-validation.cjs')
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
  if (!isLicenseKeyFormat(licenseKey)) {
    return jsonResponse(200, { valid: false, tier: 'free' })
  }

  try {
    const record = await getLicenseByKey(licenseKey)
    const result = await evaluateLicenseRecord(record)

    return jsonResponse(200, {
      valid: result.valid,
      tier: result.tier,
      expiresAt: result.expiresAt || null,
      status: result.status || null,
    })
  } catch (error) {
    console.error('validate-license failed', error)
    return jsonResponse(500, { error: 'Unable to validate license' })
  }
}
