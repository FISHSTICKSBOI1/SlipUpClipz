const { createHash, randomBytes, timingSafeEqual } = require('node:crypto')

const TRANSFER_TTL_MS = 60 * 60 * 1000
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function hashTransferCode(code) {
  return createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex')
}

function newTransferCode() {
  const bytes = randomBytes(8)
  let code = ''
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  }
  return code
}

function transferKey(code) {
  return `device-transfer:${hashTransferCode(code)}`
}

function codesMatch(provided, expectedHash) {
  const actual = Buffer.from(hashTransferCode(provided))
  const expected = Buffer.from(String(expectedHash || ''))
  if (actual.length === 0 || expected.length === 0 || actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

async function issueDeviceTransfer({ store, licenseKey, deviceId, now = new Date() }) {
  const code = newTransferCode()
  const expiresAt = new Date(now.getTime() + TRANSFER_TTL_MS).toISOString()
  await store.setJSON(transferKey(code), {
    licenseKey,
    deviceId,
    codeHash: hashTransferCode(code),
    expiresAt,
    usedAt: null,
  })
  return { code, expiresAt }
}

function transferMatches(record, licenseKey, deviceId) {
  return Boolean(record) && record.licenseKey === licenseKey && record.deviceId === deviceId
}

async function readDeviceTransfer(store, code, now = new Date()) {
  if (!code || String(code).trim().length < 8) return { ok: false, reason: 'invalid' }
  const record = await store.getJSON(transferKey(code))
  if (!record || !codesMatch(code, record.codeHash)) return { ok: false, reason: 'invalid' }
  if (record.usedAt) return { ok: false, reason: 'used' }
  if (!record.expiresAt || Date.parse(record.expiresAt) <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, record }
}

async function markDeviceTransferUsed(store, code, now = new Date()) {
  const key = transferKey(code)
  const record = await store.getJSON(key)
  if (!record) return null
  const next = { ...record, usedAt: now.toISOString() }
  await store.setJSON(key, next)
  return next
}

module.exports = {
  TRANSFER_TTL_MS,
  newTransferCode,
  issueDeviceTransfer,
  readDeviceTransfer,
  markDeviceTransferUsed,
  transferMatches,
}
