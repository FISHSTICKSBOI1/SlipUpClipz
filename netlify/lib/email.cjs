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
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    console.warn('RESEND_API_KEY or RESEND_FROM_EMAIL missing; skipping license email')
    return { sent: false, reason: 'missing_resend_config' }
  }

  if (/@gmail\.com/i.test(from)) {
    throw new Error('RESEND_FROM_EMAIL must use a verified slipupclipz.com domain, not gmail.com')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: SUPPORT_EMAIL,
      subject: 'Your SlipUpClipz Pro License',
      html: buildLicenseEmailHtml({ licenseKey }),
      text: buildLicenseEmailText({ licenseKey }),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Resend API error (${response.status}): ${errorText}`)
  }

  return { sent: true }
}

module.exports = {
  sendLicenseEmail,
}
