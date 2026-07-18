const SITE_URL = process.env.SITE_URL || 'https://slipupclipz.com'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'slipupclipz@gmail.com'
const BILLING_PORTAL_PATH = '/.netlify/functions/billing-portal'

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeFromAddress(from) {
  const trimmed = String(from || '').trim()
  if (!trimmed) return ''

  if (trimmed.includes('<') && trimmed.includes('>')) {
    return trimmed
  }

  if (/^[^\s<>]+@[^\s<>]+$/.test(trimmed)) {
    return `SlipUpClipz Support <${trimmed}>`
  }

  return trimmed
}

function extractEmailDomain(from) {
  const match = String(from).match(/@([^>\s]+)>?$/)
  return match?.[1]?.toLowerCase() || ''
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const fromRaw = process.env.RESEND_FROM_EMAIL
  const from = normalizeFromAddress(fromRaw)

  if (!apiKey || !from) {
    const missing = [
      !apiKey ? 'RESEND_API_KEY' : null,
      !fromRaw ? 'RESEND_FROM_EMAIL' : null,
    ].filter(Boolean)
    console.error(`[email] Missing required environment variables: ${missing.join(', ')}`)
    return null
  }

  const fromDomain = extractEmailDomain(from)
  if (fromDomain !== 'slipupclipz.com' && !fromDomain.endsWith('.slipupclipz.com')) {
    console.error('[email] RESEND_FROM_EMAIL must use a verified slipupclipz.com domain')
    return null
  }

  return { apiKey, from }
}

function getSupportToEmail() {
  const configured = process.env.SUPPORT_TO_EMAIL?.trim()
  if (configured) return configured
  console.error('[email] Missing required environment variable: SUPPORT_TO_EMAIL')
  return null
}

async function sendResendEmail(payload) {
  const config = getEmailConfig()
  if (!config) {
    return { sent: false, reason: 'missing_resend_config' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      ...payload,
    }),
  })

  if (!response.ok) {
    let details = ''
    try {
      details = (await response.text()).slice(0, 500)
    } catch {
      details = ''
    }
    console.error(`[email] Resend request failed with status ${response.status}`, details)
    throw new Error(`Resend API request failed (${response.status})`)
  }

  return { sent: true }
}

function buildLicenseEmailHtml({ licenseKey }) {
  const safeKey = escapeHtml(licenseKey)
  const safeSupport = escapeHtml(SUPPORT_EMAIL)
  const safeDownload = escapeHtml(SITE_URL)
  const safeBillingHelp = escapeHtml(`${SITE_URL}/help`)

  return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111;">
  <p>Thank you for purchasing SlipUpClipz Pro.</p>
  <p><strong>Your License Key:</strong></p>
  <p style="font-family:Consolas,monospace;font-size:18px;letter-spacing:0.04em;">${safeKey}</p>
  <p><strong>Manage your subscription:</strong><br>
  Open SlipUpClipz and use your license key with the billing portal request flow, or visit
  <a href="${safeBillingHelp}">${safeBillingHelp}</a> for help.</p>
  <p><strong>Need help?</strong><br><a href="mailto:${safeSupport}">${safeSupport}</a></p>
  <p><strong>Download:</strong><br><a href="${safeDownload}">${safeDownload}</a></p>
</body>
</html>`
}

function buildLicenseEmailText({ licenseKey }) {
  return [
    'Thank you for purchasing SlipUpClipz Pro.',
    '',
    'Your License Key:',
    licenseKey,
    '',
    'Manage your subscription:',
    `Use your license key with ${SITE_URL}${BILLING_PORTAL_PATH} from the app when billing self-service is connected.`,
    '',
    'Need help?',
    SUPPORT_EMAIL,
    '',
    'Download:',
    SITE_URL,
  ].join('\n')
}

async function sendLicenseEmail({ to, licenseKey }) {
  return sendResendEmail({
    to: [to],
    reply_to: SUPPORT_EMAIL,
    subject: 'Your SlipUpClipz Pro License',
    html: buildLicenseEmailHtml({ licenseKey }),
    text: buildLicenseEmailText({ licenseKey }),
  })
}

function buildSupportEmailPayload({
  name,
  email,
  subject,
  category,
  message,
  appVersion,
  windowsVersion,
  diagnosticConsent,
}) {
  const to = getSupportToEmail()
  if (!to) {
    return null
  }

  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    subject: escapeHtml(subject),
    category: escapeHtml(category || 'Other'),
    message: escapeHtml(message).replace(/\n/g, '<br>'),
    appVersion: escapeHtml(appVersion || 'Not provided'),
    windowsVersion: escapeHtml(windowsVersion || 'Not provided'),
    diagnosticConsent: diagnosticConsent ? 'Yes' : 'No',
  }

  return {
    to: [to],
    reply_to: email,
    subject: `[SlipUpClipz Support] ${subject}`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111;">
  <h1 style="font-size:20px;">SlipUpClipz support request</h1>
  <p><strong>Name:</strong> ${safe.name}</p>
  <p><strong>Email:</strong> ${safe.email}</p>
  <p><strong>Subject:</strong> ${safe.subject}</p>
  <p><strong>Category:</strong> ${safe.category}</p>
  <p><strong>App version:</strong> ${safe.appVersion}</p>
  <p><strong>Windows version:</strong> ${safe.windowsVersion}</p>
  <p><strong>Diagnostic follow-up allowed:</strong> ${safe.diagnosticConsent}</p>
  <hr>
  <p>${safe.message}</p>
</body>
</html>`,
    text: [
      'SlipUpClipz support request',
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      `Category: ${category || 'Other'}`,
      `App version: ${appVersion || 'Not provided'}`,
      `Windows version: ${windowsVersion || 'Not provided'}`,
      `Diagnostic follow-up allowed: ${diagnosticConsent ? 'Yes' : 'No'}`,
      '',
      message,
    ].join('\n'),
  }
}

async function sendSupportEmail(fields) {
  const payload = buildSupportEmailPayload(fields)
  if (!payload) {
    return { sent: false, reason: 'missing_support_to_email' }
  }

  return sendResendEmail(payload)
}

module.exports = {
  escapeHtml,
  normalizeFromAddress,
  getEmailConfig,
  getSupportToEmail,
  buildSupportEmailPayload,
  sendLicenseEmail,
  sendSupportEmail,
}
