const { jsonResponse } = require('../lib/commerce.cjs')
const { normalizeLicenseKey, isLicenseKeyFormat } = require('../lib/license.cjs')
const { evaluateLicenseRecord } = require('../lib/license-validation.cjs')
const { connectCommerceBlobs, getLicenseByKey } = require('../lib/storage.cjs')

const STORE_NAME = process.env.COMMERCE_STORE_NAME || 'slipupclipz-commerce'

function parseBody(event) {
  if (!event.body) return {}

  try {
    return JSON.parse(event.body)
  } catch {
    return null
  }
}

function maskedLicenseSuffix(licenseKey) {
  const match = String(licenseKey || '').match(/-([A-Z0-9]{4})$/i)
  return match ? match[1].toUpperCase() : '****'
}

function logValidationDiagnostics({ licenseKey, recordFound, storedStatus, rejectionReason }) {
  console.info('[validate-license]', {
    maskedSuffix: maskedLicenseSuffix(licenseKey),
    storeName: STORE_NAME,
    recordFound: Boolean(recordFound),
    storedStatus: storedStatus || null,
    rejectionReason: rejectionReason || null,
  })
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
    logValidationDiagnostics({
      licenseKey,
      recordFound: false,
      storedStatus: null,
      rejectionReason: 'invalid_format',
    })
    return jsonResponse(200, { valid: false, tier: 'free' })
  }

  try {
    const record = await getLicenseByKey(licenseKey)
    const result = await evaluateLicenseRecord(record)

    logValidationDiagnostics({
      licenseKey,
      recordFound: Boolean(record),
      storedStatus: record?.status || null,
      rejectionReason: result.valid ? null : result.rejectionReason || result.status || 'invalid',
    })

    return jsonResponse(200, {
      valid: result.valid,
      tier: result.tier,
      expiresAt: result.expiresAt || null,
      status: result.status || null,
    })
  } catch (error) {
    logValidationDiagnostics({
      licenseKey,
      recordFound: false,
      storedStatus: null,
      rejectionReason: 'server_error',
    })
    console.error('validate-license failed', error instanceof Error ? error.message : String(error))
    return jsonResponse(500, { error: 'Unable to validate license' })
  }
}
