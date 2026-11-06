const { createHash, randomBytes } = require('node:crypto')

const TOKEN_TTL_MS = 60 * 60 * 1000
const EMAIL_LIMIT = 5
const IP_LIMIT = 8
const WINDOW_MS = 24 * 60 * 60 * 1000

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

function newRecoveryToken() {
  return randomBytes(32).toString('hex')
}

function recoveryKey(token) {
  return `billing-recovery:${hashToken(token)}`
}

async function consumeRecoveryRateLimit(store, key, now = Date.now(), limit = EMAIL_LIMIT) {
  const record = (await store.getJSON(key)) || { hits: [] }
  const hits = (record.hits || []).filter((hit) => now - hit < WINDOW_MS)
  if (hits.length >= limit) return { allowed: false }
  hits.push(now)
  await store.setJSON(key, { hits })
  return { allowed: true }
}

async function issueBillingRecovery({ store, license, now = new Date() }) {
  const token = newRecoveryToken()
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString()
  await store.setJSON(recoveryKey(token), {
    licenseKey: license.licenseKey,
    email: license.email,
    stripeCustomerId: license.stripeCustomerId,
    expiresAt,
    usedAt: null,
    createdAt: now.toISOString(),
  })
  return { token, expiresAt }
}

async function readBillingRecovery(store, token, now = new Date()) {
  if (!token || String(token).length < 32) return { ok: false, reason: 'invalid' }
  const record = await store.getJSON(recoveryKey(token))
  if (!record?.licenseKey) return { ok: false, reason: 'invalid' }
  if (record.usedAt) return { ok: false, reason: 'used' }
  if (!record.expiresAt || Date.parse(record.expiresAt) <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, record }
}

async function markBillingRecoveryUsed(store, token, now = new Date()) {
  const key = recoveryKey(token)
  const record = await store.getJSON(key)
  if (!record) return null
  const next = { ...record, usedAt: now.toISOString() }
  await store.setJSON(key, next)
  return next
}

module.exports = {
  TOKEN_TTL_MS,
  EMAIL_LIMIT,
  IP_LIMIT,
  hashToken,
  recoveryKey,
  consumeRecoveryRateLimit,
  issueBillingRecovery,
  readBillingRecovery,
  markBillingRecoveryUsed,
}
