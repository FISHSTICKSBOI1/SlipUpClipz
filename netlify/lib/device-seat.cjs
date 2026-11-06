/**
 * One active computer per Pro license.
 * The seat is stored apart from the Stripe subscription record, so a transfer
 * cannot change the paid period.
 */

const DEVICE_ID_PATTERN = /^[a-f0-9]{64}$/

function seatKey(licenseKey) {
  return `seat:${licenseKey}`
}

function normalizeDeviceId(value) {
  const deviceId = String(value || '').trim().toLowerCase()
  return DEVICE_ID_PATTERN.test(deviceId) ? deviceId : null
}

function seatDeviceId(seat) {
  const deviceId = normalizeDeviceId(seat?.deviceId)
  return deviceId
}

function legacySeatAllowed() {
  return false
}

async function readSeat(store, licenseKey) {
  if (typeof store.getWithMetadata === 'function') {
    return store.getWithMetadata(seatKey(licenseKey), { type: 'json' })
  }
  const data = await store.getJSON(seatKey(licenseKey))
  return data ? { data, etag: undefined } : null
}

async function claimDeviceSeat(store, licenseKey, deviceId, now = new Date().toISOString()) {
  const normalized = normalizeDeviceId(deviceId)
  if (!normalized) return { ok: false, reason: 'invalid-device' }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await readSeat(store, licenseKey)
    const occupiedBy = seatDeviceId(current?.data)
    if (occupiedBy && occupiedBy === normalized) {
      return { ok: true, sameDevice: true, deviceId: normalized }
    }
    if (occupiedBy) {
      return { ok: false, reason: 'device_in_use' }
    }

    const next = {
      licenseKey,
      deviceId: normalized,
      registeredAt: current?.data?.registeredAt || now,
      lastSeenAt: now,
    }
    const write = await store.setJSON(
      seatKey(licenseKey),
      next,
      current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    )
    if (write?.modified) {
      return { ok: true, sameDevice: false, deviceId: normalized }
    }
  }

  return { ok: false, reason: 'conflict' }
}

async function releaseDeviceSeat(store, licenseKey, deviceId, now = new Date().toISOString()) {
  const normalized = normalizeDeviceId(deviceId)
  if (!normalized) return { ok: false, reason: 'invalid-device' }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await readSeat(store, licenseKey)
    const occupiedBy = seatDeviceId(current?.data)
    if (!occupiedBy) return { ok: true, released: false, reason: 'empty' }
    if (occupiedBy !== normalized) return { ok: false, reason: 'not-held' }

    const write = await store.setJSON(
      seatKey(licenseKey),
      {
        licenseKey,
        deviceId: null,
        releasedAt: now,
        previousDeviceId: occupiedBy,
      },
      current.etag ? { onlyIfMatch: current.etag } : undefined,
    )
    if (write?.modified) return { ok: true, released: true }
  }

  return { ok: false, reason: 'conflict' }
}

async function replaceDeviceSeat(store, licenseKey, deviceId, now = new Date().toISOString()) {
  const normalized = normalizeDeviceId(deviceId)
  if (!normalized) return { ok: false, reason: 'invalid-device' }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await readSeat(store, licenseKey)
    const next = {
      licenseKey,
      deviceId: normalized,
      registeredAt: now,
      lastSeenAt: now,
      transferredAt: now,
    }
    const write = await store.setJSON(
      seatKey(licenseKey),
      next,
      current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    )
    if (write?.modified) return { ok: true, deviceId: normalized }
  }

  return { ok: false, reason: 'conflict' }
}

module.exports = {
  normalizeDeviceId,
  legacySeatAllowed,
  claimDeviceSeat,
  releaseDeviceSeat,
  replaceDeviceSeat,
  seatKey,
}
