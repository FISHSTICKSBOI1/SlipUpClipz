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
  for (let attempt = 0; attempt < 12; attempt += 1) {
    // Lambda compatibility supplies a cached endpoint. The conditional write
    // rejects stale versions, so a cached read cannot grant excess quota.
    const snapshot = await store.getWithMetadata(key)
    if (snapshot && !snapshot.etag) return { allowed: false }

    const hits = (snapshot?.data?.hits || []).filter((hit) => now - hit < WINDOW_MS)
    if (hits.length >= limit) return { allowed: false }

    const condition = snapshot ? { onlyIfMatch: snapshot.etag } : { onlyIfNew: true }
    const result = await store.setJSON(key, { hits: [...hits, now] }, condition)
    if (result?.modified === true) return { allowed: true }
    if (result?.modified !== false) throw new Error('Recovery rate write could not be confirmed')
  }
  return { allowed: false }
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

async function claimBillingRecovery(store, token, now = new Date()) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return { ok: false }
  const key = recoveryKey(token)
  const snapshot = await store.getWithMetadata(key)
  const record = snapshot?.data
  if (!snapshot?.etag || !record?.licenseKey || record.usedAt ||
      !Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= now.getTime()) return { ok: false }
  const result = await store.setJSON(key, { ...record, usedAt: now.toISOString() }, { onlyIfMatch: snapshot.etag })
  return result?.modified === true ? { ok: true, record } : { ok: false }
}

module.exports = {
  TOKEN_TTL_MS,
  claimBillingRecovery,
  EMAIL_LIMIT,
  IP_LIMIT,
  hashToken,
  recoveryKey,
  consumeRecoveryRateLimit,
  issueBillingRecovery,
  readBillingRecovery,
  markBillingRecoveryUsed,
}
