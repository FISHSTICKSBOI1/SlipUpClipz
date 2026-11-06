const { jsonResponse } = require('../lib/commerce.cjs')
const { normalizeLicenseKey, isLicenseKeyFormat } = require('../lib/license.cjs')
const { normalizeDeviceId, replaceDeviceSeat } = require('../lib/device-seat.cjs')
const { evaluateLicenseRecord } = require('../lib/license-validation.cjs')
const { markDeviceTransferUsed, readDeviceTransfer, transferMatches } = require('../lib/device-transfer.cjs')
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
    return jsonResponse(400, { error: 'This transfer code is invalid or expired.' })
  }

  const licenseKey = normalizeLicenseKey(typeof body.licenseKey === 'string' ? body.licenseKey : '')
  const deviceId = normalizeDeviceId(body.deviceId)
  const code = String(body.code || '')
  if (!isLicenseKeyFormat(licenseKey) || !deviceId) {
    return jsonResponse(400, { error: 'This transfer code is invalid or expired.' })
  }

  const store = await getCommerceStore()
  const transfer = await readDeviceTransfer(store, code)
  if (!transfer.ok || !transferMatches(transfer.record, licenseKey, deviceId)) {
    return jsonResponse(400, { error: 'This transfer code is invalid or expired.' })
  }

  const license = await getLicenseByKey(licenseKey)
  const before = license?.expiresAt || null
  const evaluation = await evaluateLicenseRecord(license)
  if (!evaluation.valid) {
    return jsonResponse(200, {
      ok: false,
      error: 'Subscription inactive. A transfer cannot extend a refunded or expired license.',
    })
  }

  const replaced = await replaceDeviceSeat(store, licenseKey, deviceId)
  if (!replaced.ok) {
    return jsonResponse(503, { error: 'Could not transfer this license. Try again.' })
  }

  const after = await getLicenseByKey(licenseKey)
  if ((after?.expiresAt || null) !== before) {
    console.error('[device-transfer-confirm] Expiration changed during transfer')
  }

  await markDeviceTransferUsed(store, code)
  return jsonResponse(200, { ok: true, expiresAt: evaluation.expiresAt || null })
}
