const { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')
const { randomBytes, randomUUID, createHash } = require('node:crypto')
const { connectCommerceBlobs, writeConditionalBlob } = require('./storage.cjs')
const { CLAIM_TTL_MS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, hasSurveyBlobsContext, requiresPrivateSurveySalt } = require('./survey.cjs')

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
    async getWithMetadata(key) {
      const file = devPath(key)
      if (!existsSync(file)) return null
      const raw = readFileSync(file, 'utf8')
      return { data: JSON.parse(raw), etag: createHash('sha256').update(raw).digest('hex') }
    },
    async setJSON(key, value, options = {}) {
      ensureDevDir()
      const file = devPath(key)
      // Synchronous local read/write has no await gap. Production uses provider CAS.
      if (options.onlyIfMatch) {
        if (!existsSync(file)) return { modified: false }
        const etag = createHash('sha256').update(readFileSync(file)).digest('hex')
        if (etag !== options.onlyIfMatch) return { modified: false }
      }
      try {
        writeFileSync(file, JSON.stringify(value), { encoding: 'utf8', flag: options.onlyIfNew ? 'wx' : 'w' })
        return { modified: true }
      } catch (error) {
        if (options.onlyIfNew && error.code === 'EEXIST') return { modified: false }
        throw error
      }
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

async function readBlobJSON(store, method, key) {
  try {
    return await store[method](key, { type: 'json', consistency: 'strong' })
  } catch (error) {
    // The installed Lambda adapter supplies a cached endpoint only. ETag
    // conditions still protect quota writes and response keys are immutable.
    if (error?.name !== 'BlobsConsistencyError') throw error
    return store[method](key, { type: 'json' })
  }
}

function wrapBlobStore(createStore) {
  const store = createStore()
  return {
    environment: 'production',
    async getJSON(key) {
      return readBlobJSON(store, 'get', key)
    },
    async getWithMetadata(key) {
      return readBlobJSON(store, 'getWithMetadata', key)
    },
    async setJSON(key, value, options = {}) {
      // Verify the actual HTTP outcome; the SDK alone can report failed CAS writes as modified.
      if (options.onlyIfNew || options.onlyIfMatch) {
        return writeConditionalBlob(createStore, key, JSON.stringify(value), options)
      }
      return store.set(key, JSON.stringify(value), options)
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
  if (hasSurveyBlobsContext(event)) {
    if (event) connectCommerceBlobs(event)
    const blobs = loadBlobsModule()
    if (!blobs || typeof blobs.getStore !== 'function') {
      throw new Error('Netlify Blobs is required for survey storage in production')
    }
    return wrapBlobStore((fetch) => blobs.getStore(STORE_NAME, { fetch }))
  }

  if (requiresPrivateSurveySalt(event)) {
    throw new Error('Deployed survey storage requires a configured Netlify site')
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

async function consumeRateLimit(ipHash, event, now = Date.now(), submissionKey = null) {
  const store = await getFeedbackStore(event)
  const key = `rate:${ipHash}`
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await store.getWithMetadata(key)
    if (current && !current.etag) throw new Error('Survey quota version is unavailable')
    const hits = (Array.isArray(current?.data?.hits) ? current.data.hits : [])
      .filter((hit) => now - Number(typeof hit === 'number' ? hit : hit.time) < RATE_LIMIT_WINDOW_MS)
    if (submissionKey && hits.some((hit) => hit.id === submissionKey)) return { allowed: true }
    if (hits.length >= RATE_LIMIT_MAX) return { allowed: false }
    const result = await store.setJSON(key, { hits: [...hits, { time: now, id: submissionKey }] },
      current ? { onlyIfMatch: current.etag } : { onlyIfNew: true })
    if (result?.modified === true) return { allowed: true }
  }
  return { allowed: false }
}

function feedbackId(submissionId, ipHash) {
  // New clients get deterministic IDs without storing their request ID or full network hash in answers.
  return submissionId ? createHash('sha256').update(`${ipHash}:${submissionId}`).digest('hex') : newId()
}

async function saveFeedbackResponse({ answers, ipHash, submissionId, event, now = new Date() }) {
  const store = await getFeedbackStore(event)
  const response = { id: feedbackId(submissionId, ipHash), createdAt: now.toISOString(),
    ...answers, ipHashPrefix: String(ipHash || '').slice(0, 8) }
  const saved = await store.setJSON(`response:${response.id}`, response, { onlyIfNew: true })
  if (saved?.modified !== true) {
    const existing = await store.getJSON(`response:${response.id}`)
    if (!existing || Object.keys(answers).some(key => existing[key] !== answers[key])) {
      const error = new Error('This submission was already saved with different answers. Reopen the survey to send new feedback.')
      error.statusCode = 409
      throw error
    }
    return existing
  }
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
  feedbackId,
  wrapBlobStore,
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
