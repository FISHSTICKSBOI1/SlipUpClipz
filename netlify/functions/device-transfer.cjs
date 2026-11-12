const { createHash } = require('node:crypto')
const { jsonResponse } = require('../lib/commerce.cjs')
const { normalizeLicenseKey, isLicenseKeyFormat } = require('../lib/license.cjs')
const { normalizeDeviceId } = require('../lib/device-seat.cjs')
const { evaluateLicenseRecord } = require('../lib/license-validation.cjs')
const { sendDeviceTransferEmail } = require('../lib/email.cjs')
const { issueDeviceTransfer } = require('../lib/device-transfer.cjs')
const { EMAIL_LIMIT, IP_LIMIT, consumeRecoveryRateLimit } = require('../lib/billing-recovery.cjs')
const { connectCommerceBlobs, getCommerceStore, getLicenseByKey } = require('../lib/storage.cjs')

const GENERIC = {
  ok: true,
  message: 'If that email matches this license, we sent a transfer code that expires in 60 minutes.',
}

function clientAddress(event) {
  const headers = event?.headers || {}
  const forwarded = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || ''
  return String(forwarded).split(',')[0].trim() || 'local'
}

function digest(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16)
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

  const licenseKey = normalizeLicenseKey(typeof body.licenseKey === 'string' ? body.licenseKey : '')
  const email = String(body.email || '').trim().toLowerCase()
  const deviceId = normalizeDeviceId(body.deviceId)
  if (!isLicenseKeyFormat(licenseKey) || !email.includes('@') || !deviceId) {
    return jsonResponse(200, GENERIC)
  }

  let store
  const limited = () => jsonResponse(429, { error: 'Too many requests. Try again tomorrow.' })
  try {
    connectCommerceBlobs(event)
    store = await getCommerceStore()
    const ipAllowed = await consumeRecoveryRateLimit(
      store, `device-transfer-rate:ip:${digest(clientAddress(event))}`, Date.now(), IP_LIMIT,
    )
    if (!ipAllowed.allowed) return limited()

    const emailAllowed = await consumeRecoveryRateLimit(
      store, `device-transfer-rate:email:${digest(email)}`, Date.now(), EMAIL_LIMIT,
    )
    if (!emailAllowed.allowed) return limited()
  } catch {
    console.error('[device-transfer] Rate limit storage unavailable')
    return jsonResponse(503, { error: 'Device transfer is temporarily unavailable.' })
  }

  const license = await getLicenseByKey(licenseKey)
  if (!license || license.email?.toLowerCase() !== email) {
    return jsonResponse(200, GENERIC)
  }

  const evaluation = await evaluateLicenseRecord(license)
  if (!evaluation.valid) {
    return jsonResponse(200, {
      ok: false,
      error: 'Subscription inactive. A transfer cannot extend a refunded or expired license.',
    })
  }

  const issued = await issueDeviceTransfer({ store, licenseKey, deviceId })
  const delivery = await sendDeviceTransferEmail({ to: email, code: issued.code })
  if (!delivery?.sent) {
    console.error('[device-transfer] Email was not sent')
  }

  return jsonResponse(200, GENERIC)
}
