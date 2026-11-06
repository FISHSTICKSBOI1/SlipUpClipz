const HEARD_OPTIONS = ['tiktok', 'youtube', 'reddit', 'search', 'other']
const DOWNLOAD_OPTIONS = ['microsoft-store', 'website', 'other']

const LIMITS = {
  other: 80,
  feedbackMax: 1000,
  minFillMs: 1200,
  maxAgeMs: 6 * 60 * 60 * 1000,
  bodyChars: 8000,
}

const CLAIM_COOKIE = 'slipup_survey_claim'
const CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000

function collapseSpaces(value, max) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function validateSurveySubmission(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid survey.' }
  }

  if (String(body.company || body.website || '').trim()) {
    return { ok: false, error: 'Unable to submit this survey.', spam: true }
  }

  const startedAt = Number(body.startedAt)
  if (!Number.isFinite(startedAt) || now - startedAt < LIMITS.minFillMs) {
    return {
      ok: false,
      error: 'Please take a moment to answer the questions before submitting.',
    }
  }
  if (startedAt > now + 60_000 || now - startedAt > LIMITS.maxAgeMs) {
    return { ok: false, error: 'This form expired. Refresh the page and try again.' }
  }

  if (!HEARD_OPTIONS.includes(body.heardFrom)) {
    return { ok: false, error: 'Choose how you heard about SlipUpClipz.' }
  }
  if (!DOWNLOAD_OPTIONS.includes(body.downloadSource)) {
    return { ok: false, error: 'Choose where you downloaded SlipUpClipz from.' }
  }

  const heardFromOther =
    body.heardFrom === 'other' ? collapseSpaces(body.heardFromOther, LIMITS.other) : ''
  const downloadSourceOther =
    body.downloadSource === 'other' ? collapseSpaces(body.downloadSourceOther, LIMITS.other) : ''

  if (body.heardFrom === 'other' && heardFromOther.length < 2) {
    return { ok: false, error: 'Add a short note for how you heard about SlipUpClipz.' }
  }
  if (body.downloadSource === 'other' && downloadSourceOther.length < 2) {
    return { ok: false, error: 'Add a short note for where you downloaded SlipUpClipz from.' }
  }

  const feedback = String(body.feedback || '').trim()
  if (feedback.length > LIMITS.feedbackMax) {
    return { ok: false, error: 'Please keep feedback under 1000 characters.' }
  }

  return {
    ok: true,
    answers: {
      heardFrom: body.heardFrom,
      heardFromOther: heardFromOther || null,
      downloadSource: body.downloadSource,
      downloadSourceOther: downloadSourceOther || null,
      feedback,
    },
  }
}

function readCookie(headers, name) {
  const source = headers || {}
  let raw = ''
  for (const [key, value] of Object.entries(source)) {
    if (String(key).toLowerCase() !== 'cookie') continue
    raw = Array.isArray(value) ? value.join(';') : String(value || '')
  }

  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator)
    if (key !== name) continue
    try {
      return decodeURIComponent(trimmed.slice(separator + 1))
    } catch {
      return ''
    }
  }
  return ''
}

function requestIsHttps(event) {
  const headers = event?.headers || {}
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== 'x-forwarded-proto') continue
    const proto = Array.isArray(value) ? value[0] : value
    return String(proto || '').split(',')[0].trim().toLowerCase() === 'https'
  }
  return false
}

function clearClaimCookieHeader() {
  return `${CLAIM_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

function claimCookieHeader(token, event) {
  const parts = [
    `${CLAIM_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(CLAIM_TTL_MS / 1000)}`,
  ]
  if (requestIsHttps(event)) parts.push('Secure')
  return parts.join('; ')
}

function clientAddress(event) {
  const headers = event?.headers || {}
  const forwarded = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || headers['client-ip']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return String(value || 'local').split(',')[0].trim() || 'local'
}

const DEV_SURVEY_IP_SALT = 'slipupclipz-survey-v1'

function requiresPrivateSurveySalt() {
  const context = String(process.env.CONTEXT || '')
  return context === 'production' || context === 'deploy-preview' || context === 'branch-deploy'
}

function resolveSurveyIpSalt() {
  const configured = String(process.env.SURVEY_IP_SALT || '').trim()
  if (configured) return configured
  if (requiresPrivateSurveySalt()) {
    const error = new Error('Survey storage is not configured.')
    error.statusCode = 503
    error.code = 'survey-salt-missing'
    throw error
  }
  return DEV_SURVEY_IP_SALT
}

function hashClientAddress(address) {
  const { createHash } = require('node:crypto')
  const salt = resolveSurveyIpSalt()
  return createHash('sha256').update(`${salt}:${address}`).digest('hex')
}

function parseJsonBody(event) {
  if (event?.body == null || event.body === '') return {}
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : String(event.body)
  if (raw.length > LIMITS.bodyChars) {
    const error = new Error('Survey is too large.')
    error.statusCode = 413
    throw error
  }
  try {
    return JSON.parse(raw)
  } catch {
    const error = new Error('Invalid survey.')
    error.statusCode = 400
    throw error
  }
}

function summarizeResponses(responses) {
  const heardFrom = {}
  const downloadSource = {}
  for (const response of responses) {
    const heard = response.heardFrom || 'unknown'
    const download = response.downloadSource || 'unknown'
    heardFrom[heard] = (heardFrom[heard] || 0) + 1
    downloadSource[download] = (downloadSource[download] || 0) + 1
  }
  return {
    count: responses.length,
    heardFrom,
    downloadSource,
  }
}

module.exports = {
  HEARD_OPTIONS,
  DOWNLOAD_OPTIONS,
  LIMITS,
  CLAIM_COOKIE,
  CLAIM_TTL_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  validateSurveySubmission,
  readCookie,
  claimCookieHeader,
  clearClaimCookieHeader,
  clientAddress,
  hashClientAddress,
  parseJsonBody,
  summarizeResponses,
}
