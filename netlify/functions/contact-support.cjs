const { sendSupportEmail } = require('../lib/email.cjs')

const FALLBACK_SUPPORT_EMAIL = 'slipupclipz@gmail.com'
const MAX_BODY_BYTES = 16_000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5
const LIMITS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000,
  category: 100,
  appVersion: 50,
  windowsVersion: 100,
}
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimits = new Map()

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

function getClientKey(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown'
  )
}

function checkRateLimit(key) {
  const now = Date.now()
  const current = rateLimits.get(key)
  if (!current || now >= current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (current.count >= RATE_LIMIT_MAX) return false
  current.count += 1
  return true
}

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength + 1)
}

function validateBody(body) {
  const data = {
    name: cleanString(body.name, LIMITS.name),
    email: cleanString(body.email, LIMITS.email).toLowerCase(),
    subject: cleanString(body.subject, LIMITS.subject).replace(/[\r\n]+/g, ' '),
    message: cleanString(body.message, LIMITS.message),
    category: cleanString(body.category, LIMITS.category),
    appVersion: cleanString(body.appVersion, LIMITS.appVersion),
    windowsVersion: cleanString(body.windowsVersion, LIMITS.windowsVersion),
    diagnosticConsent: body.diagnosticConsent === true,
  }

  const errors = {}
  if (!data.name) errors.name = 'Name is required.'
  else if (data.name.length > LIMITS.name) errors.name = 'Name is too long.'

  if (!data.email) errors.email = 'Email is required.'
  else if (data.email.length > LIMITS.email || !EMAIL_PATTERN.test(data.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!data.subject) errors.subject = 'Subject is required.'
  else if (data.subject.length > LIMITS.subject) errors.subject = 'Subject is too long.'

  if (!data.message) errors.message = 'Message is required.'
  else if (data.message.length > LIMITS.message) errors.message = 'Message is too long.'

  return { data, errors }
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed.' })
  }

  if ((event.body?.length || 0) > MAX_BODY_BYTES) {
    return json(413, { success: false, error: 'Message is too large.' })
  }

  const clientKey = getClientKey(event)
  if (!checkRateLimit(clientKey)) {
    console.warn('[contact-support] Rate limit exceeded')
    return json(429, {
      success: false,
      error: 'Too many messages. Please wait a minute and try again.',
    })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { success: false, error: 'Invalid request.' })
  }

  // Honeypot submissions receive a success response without sending email.
  if (typeof body.botField === 'string' && body.botField.trim()) {
    console.warn('[contact-support] Honeypot submission ignored')
    return json(200, { success: true })
  }

  const { data, errors } = validateBody(body)
  if (Object.keys(errors).length > 0) {
    return json(400, {
      success: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: errors,
    })
  }

  try {
    const result = await sendSupportEmail(data)
    if (!result.sent) {
      console.error('[contact-support] Email service is not configured', result.reason || '')
      return json(503, {
        success: false,
        error: `Support email is temporarily unavailable. Email ${FALLBACK_SUPPORT_EMAIL} directly.`,
      })
    }

    return json(200, { success: true })
  } catch (error) {
    console.error(
      '[contact-support] Failed to send support email:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    return json(502, {
      success: false,
      error: `We could not send your message. Email ${FALLBACK_SUPPORT_EMAIL} directly.`,
    })
  }
}

module.exports = {
  handler,
  validateBody,
  LIMITS,
}
