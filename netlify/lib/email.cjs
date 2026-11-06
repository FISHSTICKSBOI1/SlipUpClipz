const SITE_URL = process.env.SITE_URL || 'https://slipupclipz.com'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'slipupclipz@gmail.com'

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

function formatUsd(cents) {
  return `$${(Number(cents) / 100).toFixed(2)}`
}

function formatRenewalDate(iso) {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return iso
  return new Date(parsed).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function buildRenewalNoticeEmail({ licenseKey, renewsAt, amountCents, hadIntroDiscount }) {
  const manageUrl = `${SITE_URL}/pricing#manage`
  const amount = formatUsd(amountCents)
  const when = formatRenewalDate(renewsAt)
  const intro = hadIntroDiscount
    ? 'Your first year included a one-time discount. That discount does not apply to this renewal. '
    : 'A discount on the first invoice, if you had one, does not apply to this renewal. '
  const text = [
    'Your SlipUpClipz Pro subscription will renew unless you cancel.',
    '',
    `Product: SlipUpClipz Pro`,
    `Renewal date: ${when}`,
    'Renewal term: 1 year',
    `Renewal charge: ${amount}, once per year`,
    intro.trim(),
    '',
    'To cancel automatic renewal before this charge, open:',
    manageUrl,
    'Enter your license key and the email you used at checkout. If you lost the key, use the purchase-email option on that page. Stripe will show the cancellation page.',
    'If you cancel, Pro stays on through the period you already paid, and this renewal will not be charged.',
    'Removing the license from a computer does not cancel billing.',
    '',
    `Your license key: ${licenseKey}`,
    `Contact: ${SUPPORT_EMAIL}`,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111;">
  <p><strong>Your SlipUpClipz Pro subscription will renew unless you cancel.</strong></p>
  <p>Product: SlipUpClipz Pro<br>
  Renewal date: ${escapeHtml(when)}<br>
  Renewal term: 1 year<br>
  Renewal charge: ${escapeHtml(amount)}, once per year</p>
  <p>${escapeHtml(intro.trim())}</p>
  <p><strong>Cancel automatic renewal:</strong><br>
  <a href="${escapeHtml(manageUrl)}">${escapeHtml(manageUrl)}</a><br>
  Enter your license key and the email you used at checkout. If you lost the key, use the purchase-email option on that page.</p>
  <p>If you cancel, Pro stays on through the period you already paid, and this renewal will not be charged. Removing the license from a computer does not cancel billing.</p>
  <p>Your license key: ${escapeHtml(licenseKey)}<br>
  Contact: <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a></p>
</body>
</html>`

  return {
    subject: `SlipUpClipz Pro renews on ${when} for ${amount}`,
    html,
    text,
  }
}

function buildBillingRecoveryEmail({ licenseKey, recoveryUrl }) {
  const text = [
    'Use this link to manage or cancel your SlipUpClipz Pro subscription.',
    recoveryUrl,
    'The link works once and expires in 60 minutes.',
    '',
    'Your license key:',
    licenseKey,
    '',
    'Canceling stops the next renewal. Pro stays on through the period you already paid.',
    'Removing the license from a computer does not cancel billing.',
    '',
    SUPPORT_EMAIL,
  ].join('\n')
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111;">
  <p><a href="${escapeHtml(recoveryUrl)}">Manage or cancel SlipUpClipz Pro</a></p>
  <p>This link works once and expires in 60 minutes.</p>
  <p>Your license key:<br><span style="font-family:Consolas,monospace;">${escapeHtml(licenseKey)}</span></p>
  <p>Canceling stops the next renewal. Pro stays on through the period you already paid. Removing the license from a computer does not cancel billing.</p>
  <p><a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a></p>
</body>
</html>`
  return {
    subject: 'Manage your SlipUpClipz Pro subscription',
    html,
    text,
  }
}

async function sendRenewalNoticeEmail(fields) {
  const content = buildRenewalNoticeEmail(fields)
  return sendResendEmail({
    to: [fields.to],
    reply_to: SUPPORT_EMAIL,
    subject: content.subject,
    html: content.html,
    text: content.text,
  })
}

async function sendBillingRecoveryEmail(fields) {
  const content = buildBillingRecoveryEmail(fields)
  return sendResendEmail({
    to: [fields.to],
    reply_to: SUPPORT_EMAIL,
    subject: content.subject,
    html: content.html,
    text: content.text,
  })
}

function buildLicenseEmailHtml({ licenseKey }) {
  const safeKey = escapeHtml(licenseKey)
  const safeSupport = escapeHtml(SUPPORT_EMAIL)
  const safeDownload = escapeHtml(SITE_URL)
  const safeManage = escapeHtml(`${SITE_URL}/pricing#manage`)

  return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111;">
  <p>Thank you for purchasing SlipUpClipz Pro.</p>
  <p><strong>Your License Key:</strong></p>
  <p style="font-family:Consolas,monospace;font-size:18px;letter-spacing:0.04em;">${safeKey}</p>
  <p>Pro renews once a year at the regular price unless you cancel before the renewal. A first-year discount, if one was applied, covers only the first invoice.</p>
  <p><strong>Cancel automatic renewal:</strong><br>
  Open <a href="${safeManage}">${safeManage}</a> and choose Manage subscription. Enter this license key and the email you used at checkout. If you lose the key, request a link on that page with the same email. Stripe then lets you update billing or cancel renewal. Pro stays on through the period you already paid. A full refund of the current year ends Pro and stops future renewal charges. Removing the license from a computer does not cancel billing.</p>
  <p><strong>Need help?</strong><br><a href="mailto:${safeSupport}">${safeSupport}</a></p>
  <p><strong>Download:</strong><br><a href="${safeDownload}">${safeDownload}</a></p>
</body>
</html>`
}

function buildLicenseEmailText({ licenseKey }) {
  const manageUrl = `${SITE_URL}/pricing#manage`
  return [
    'Thank you for purchasing SlipUpClipz Pro.',
    '',
    'Your License Key:',
    licenseKey,
    '',
    'Pro renews once a year at the regular price unless you cancel before the renewal. A first-year discount, if one was applied, covers only the first invoice.',
    '',
    'Cancel automatic renewal:',
    manageUrl,
    'Enter this license key and the email you used at checkout. If you lose the key, request a link on that page with the same email. Stripe lets you update billing or cancel renewal. Pro stays on through the period you already paid.',
    'A full refund of the current year ends Pro and stops future renewal charges.',
    'Removing the license from a computer does not cancel billing.',
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

function buildDeviceTransferEmail({ code }) {
  const safeCode = escapeHtml(code)
  const text = [
    'Use this code to move SlipUpClipz Pro to the computer that requested the transfer.',
    '',
    code,
    '',
    'The code expires in 60 minutes and works once.',
    'It does not change your paid period or refund the subscription.',
    'If you did not request this, ignore the email. The previous computer stays registered.',
  ].join('\n')
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111;">
  <p>Use this code to move SlipUpClipz Pro to the computer that requested the transfer.</p>
  <p style="font-family:Consolas,monospace;font-size:20px;letter-spacing:0.08em;">${safeCode}</p>
  <p>The code expires in 60 minutes and works once. It does not change your paid period.</p>
  <p>If you did not request this, ignore the email. The previous computer stays registered.</p>
</body>
</html>`
  return {
    subject: 'Transfer SlipUpClipz Pro to another computer',
    html,
    text,
  }
}

async function sendDeviceTransferEmail(fields) {
  const content = buildDeviceTransferEmail(fields)
  return sendResendEmail({
    to: [fields.to],
    reply_to: SUPPORT_EMAIL,
    subject: content.subject,
    html: content.html,
    text: content.text,
  })
}

function buildDeviceTransferEmail({ code }) {
  const safeCode = escapeHtml(code)
  const text = [
    'Use this code to move SlipUpClipz Pro to the computer that requested the transfer.',
    '',
    code,
    '',
    'The code expires in 60 minutes and works once.',
    'It does not change your paid period or refund the subscription.',
    'If you did not request this, ignore the email. The previous computer stays registered.',
  ].join('\n')
  const html = `<!DOCTYPE html>
<html>
  sendDeviceTransferEmail,
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#111;">
  <p>Use this code to move SlipUpClipz Pro to the computer that requested the transfer.</p>
  <p style="font-family:Consolas,monospace;font-size:20px;letter-spacing:0.08em;">${safeCode}</p>
  <p>The code expires in 60 minutes and works once. It does not change your paid period.</p>
  <p>If you did not request this, ignore the email. The previous computer stays registered.</p>
</body>
</html>`
  return {
    subject: 'Transfer SlipUpClipz Pro to another computer',
    html,
    text,
  }
}

async function sendDeviceTransferEmail(fields) {
  const content = buildDeviceTransferEmail(fields)
  return sendResendEmail({
    to: [fields.to],
    reply_to: SUPPORT_EMAIL,
    subject: content.subject,
    html: content.html,
    text: content.text,
  })
}

module.exports = {
  escapeHtml,
  normalizeFromAddress,
  getEmailConfig,
  getSupportToEmail,
  buildSupportEmailPayload,
  buildLicenseEmailHtml,
  buildLicenseEmailText,
  buildRenewalNoticeEmail,
  buildBillingRecoveryEmail,
  sendLicenseEmail,
  sendRenewalNoticeEmail,
  sendBillingRecoveryEmail,
  sendSupportEmail,
}
