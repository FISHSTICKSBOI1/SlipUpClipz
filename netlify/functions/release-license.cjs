const { jsonResponse } = require('../lib/commerce.cjs')
const { normalizeLicenseKey, isLicenseKeyFormat } = require('../lib/license.cjs')
const { normalizeDeviceId, releaseDeviceSeat } = require('../lib/device-seat.cjs')
const { connectCommerceBlobs, getCommerceStore } = require('../lib/storage.cjs')

exports.handler = async (event) => {
  connectCommerceBlobs(event)
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
  const deviceId = normalizeDeviceId(body.deviceId)
  if (!isLicenseKeyFormat(licenseKey) || !deviceId) {
    return jsonResponse(400, { error: 'Invalid request.' })
  }

  const store = await getCommerceStore()
  const result = await releaseDeviceSeat(store, licenseKey, deviceId)
  if (!result.ok && result.reason === 'conflict') {
    return jsonResponse(503, { error: 'Could not release this computer. Try again.' })
  }
  if (!result.ok && result.reason === 'not-held') {
    return jsonResponse(200, { released: false, reason: 'not-held' })
  }

  return jsonResponse(200, { released: true, reason: result.reason || 'released' })
}
