const { getStripe, jsonResponse } = require('../lib/commerce.cjs')
const { sendRenewalNoticeEmail } = require('../lib/email.cjs')
const { sendDueRenewalNotices } = require('../lib/renewal-notices.cjs')
const { connectCommerceBlobs, listLicenseRecords, saveLicenseRecord } = require('../lib/storage.cjs')

exports.config = {
  schedule: '0 16 * * *',
}

exports.handler = async (event) => {
  connectCommerceBlobs(event)
  const scheduled = String(event?.headers?.['x-nf-event'] || event?.headers?.['X-NF-Event'] || '').toLowerCase()
  const agent = String(event?.headers?.['user-agent'] || event?.headers?.['User-Agent'] || '')
  if (scheduled !== 'schedule' && !agent.includes('Netlify Clockwork')) {
    return jsonResponse(403, { error: 'Renewal notices run on the daily schedule only.' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[renewal-notices] Missing STRIPE_SECRET_KEY')
    return jsonResponse(503, { error: 'Renewal notices are not configured.' })
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error('[renewal-notices] Missing Resend configuration')
    return jsonResponse(503, { error: 'Renewal notices are not configured.' })
  }

  const stripe = getStripe()
  const summary = await sendDueRenewalNotices({
    listLicenses: listLicenseRecords,
    retrieveSubscription: (subscriptionId) => stripe.subscriptions.retrieve(subscriptionId),
    sendEmail: sendRenewalNoticeEmail,
    saveLicense: saveLicenseRecord,
  })

  console.info('[renewal-notices]', {
    sent: summary.sent,
    failed: summary.failed,
    skipped: summary.skipped,
  })

  if (summary.failed > 0) {
    return jsonResponse(500, {
      error: 'One or more renewal notices failed. Successful notices were recorded and will not be repeated.',
      sent: summary.sent,
      failed: summary.failed,
      skipped: summary.skipped,
    })
  }

  return jsonResponse(200, {
    sent: summary.sent,
    failed: summary.failed,
    skipped: summary.skipped,
  })
}
