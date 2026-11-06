const { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')
const { randomBytes, randomUUID } = require('node:crypto')
const { connectCommerceBlobs } = require('./storage.cjs')
const { CLAIM_TTL_MS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require('./survey.cjs')

const STORE_NAME = 'slipupclipz-feedback'
const DEV_STORE_DIR =
  process.env.SLIPUPCLIPZ_FEEDBACK_DIR || join(__dirname, '../../.netlify/feedback-dev')

function loadBlobsModule() {
  try {
    return require('@netlify/blobs')
  } catch {
    return null
  }
}

function usesProductionBlobs() {
  return Boolean(process.env.SITE_ID)
}

function safeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, '_')
}

function devPath(key) {
  return join(DEV_STORE_DIR, `${safeKey(key)}.json`)
}

function ensureDevDir() {
  if (!existsSync(DEV_STORE_DIR)) mkdirSync(DEV_STORE_DIR, { recursive: true })
}

function createFileStore() {
  ensureDevDir()
  return {
    environment: 'dev-local',
    async getJSON(key) {
      const filePath = devPath(key)
      if (!existsSync(filePath)) return null
      const raw = readFileSync(filePath, 'utf8')
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    },
    async setJSON(key, value) {
      ensureDevDir()
      writeFileSync(devPath(key), JSON.stringify(value), 'utf8')
    },
    async delete(key) {
      const filePath = devPath(key)
      if (existsSync(filePath)) unlinkSync(filePath)
    },
    async list(options) {
      ensureDevDir()
      const prefix = safeKey(options?.prefix || '')
      const keys = readdirSync(DEV_STORE_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.slice(0, -5))
        .filter((key) => key.startsWith(prefix))
      return { blobs: keys.map((key) => ({ key })) }
    },
  }
}

function wrapBlobStore(store) {
  return {
    environment: 'production',
    async getJSON(key) {
      return store.get(key, { type: 'json' })
    },
    async setJSON(key, value) {
      await store.setJSON(key, value)
    },
    async delete(key) {
      await store.delete(key)
    },
    async list(options) {
      return store.list(options)
    },
  }
}

async function getFeedbackStore(event) {
  if (event) connectCommerceBlobs(event)

  if (usesProductionBlobs()) {
    const blobs = loadBlobsModule()
    if (!blobs || typeof blobs.getStore !== 'function') {
      throw new Error('Netlify Blobs is required for survey storage in production')
    }
    return wrapBlobStore(blobs.getStore(STORE_NAME))
  }

  return createFileStore()
}

function newId() {
  return randomUUID()
}

function newToken() {
  return randomBytes(24).toString('base64url')
}

async function writeClaim(store, claim) {
  await store.setJSON(`claim-token:${claim.token}`, claim)
  await store.setJSON(`claim-id:${claim.id}`, claim)
}

async function getClaimByToken(token, event) {
  if (!token || typeof token !== 'string' || token.length < 16 || token.length > 128) return null
  const store = await getFeedbackStore(event)
  return store.getJSON(`claim-token:${token}`)
}

async function getClaimById(claimId, event) {
  if (!claimId || typeof claimId !== 'string') return null
  const store = await getFeedbackStore(event)
  return store.getJSON(`claim-id:${claimId}`)
}

function claimIsOpen(claim, now = Date.now()) {
  if (!claim || claim.status === 'redeemed') return false
  const expires = Date.parse(claim.expiresAt)
  return Number.isFinite(expires) && expires > now
}

async function consumeRateLimit(ipHash, event, now = Date.now()) {
  const store = await getFeedbackStore(event)
  const key = `rate:${ipHash}`
  const current = (await store.getJSON(key)) || { hits: [] }
  const hits = (Array.isArray(current.hits) ? current.hits : []).filter(
    (hit) => now - Number(hit) < RATE_LIMIT_WINDOW_MS,
  )
  if (hits.length >= RATE_LIMIT_MAX) {
    return { allowed: false }
  }
  hits.push(now)
  await store.setJSON(key, { hits })
  return { allowed: true }
}

async function saveFeedbackResponse({ answers, ipHash, event, now = new Date() }) {
  const store = await getFeedbackStore(event)
  const response = {
    id: newId(),
    createdAt: now.toISOString(),
    ...answers,
    ipHashPrefix: String(ipHash || '').slice(0, 8),
  }
  await store.setJSON(`response:${response.id}`, response)
  return response
}

async function saveSurveyResponse({ answers, ipHash, event, now = new Date() }) {
  const store = await getFeedbackStore(event)
  const createdAt = now.toISOString()
  const responseId = newId()
  const claim = {
    id: newId(),
    token: newToken(),
    responseId,
    status: 'issued',
    createdAt,
    expiresAt: new Date(now.getTime() + CLAIM_TTL_MS).toISOString(),
    checkoutSessionId: null,
    redeemedAt: null,
  }
  const response = {
    id: responseId,
    createdAt,
    heardFrom: answers.heardFrom,
    heardFromOther: answers.heardFromOther,
    downloadSource: answers.downloadSource,
    downloadSourceOther: answers.downloadSourceOther,
    feedback: answers.feedback,
    claimId: claim.id,
    claimStatus: 'issued',
    ipHashPrefix: String(ipHash || '').slice(0, 8),
  }

  await store.setJSON(`response:${responseId}`, response)
  await writeClaim(store, claim)
  return { response, claim }
}

async function attachCheckoutSession(claim, checkoutSessionId, event) {
  const store = await getFeedbackStore(event)
  const next = {
    ...claim,
    checkoutSessionId,
    checkoutStartedAt: new Date().toISOString(),
  }
  await writeClaim(store, next)
  return next
}

async function redeemSurveyClaim(claimId, info = {}, event) {
  const store = await getFeedbackStore(event)
  const claim = await store.getJSON(`claim-id:${claimId}`)
  if (!claim) return { ok: false, reason: 'missing' }
  if (claim.status === 'redeemed') return { ok: true, already: true }

  const redeemed = {
    ...claim,
    status: 'redeemed',
    redeemedAt: new Date().toISOString(),
    checkoutSessionId: info.checkoutSessionId || claim.checkoutSessionId || null,
  }
  await writeClaim(store, redeemed)

  const response = await store.getJSON(`response:${claim.responseId}`)
  if (response) {
    await store.setJSON(`response:${claim.responseId}`, {
      ...response,
      claimStatus: 'redeemed',
    })
  }
  return { ok: true }
}

async function listSurveyResponses(event) {
  const store = await getFeedbackStore(event)
  const listed = await store.list({ prefix: 'response:' })
  const blobs = Array.isArray(listed?.blobs) ? listed.blobs : []
  const responses = []
  for (const blob of blobs.slice(0, 1000)) {
    const record = await store.getJSON(blob.key)
    if (!record?.id) continue
    responses.push(record)
  }
  responses.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  return {
    responses,
    truncated: blobs.length > 1000,
    environment: store.environment,
  }
}

module.exports = {
  STORE_NAME,
  getFeedbackStore,
  getClaimByToken,
  getClaimById,
  claimIsOpen,
  consumeRateLimit,
  saveFeedbackResponse,
  saveSurveyResponse,
  attachCheckoutSession,
  redeemSurveyClaim,
  listSurveyResponses,
}
