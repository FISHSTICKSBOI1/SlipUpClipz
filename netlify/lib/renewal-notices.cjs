/**
 * Annual pre-renewal notice. California Business and Professions Code
 * section 17602(b)(2) requires notice 15 to 45 days before an annual renewal.
 * One email in that window also carries the annual-reminder facts in
 * section 17602(h). Counsel should confirm one message covers both duties.
 * Stripe's generic reminder is not used as the compliance notice.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_LEAD_MS = 15 * DAY_MS
const MAX_LEAD_MS = 45 * DAY_MS
const HARD_STOP = new Set(['refunded', 'revoked', 'disputed', 'canceled'])

function renewalAmountCents(subscription) {
  const amount = subscription?.items?.data?.[0]?.price?.unit_amount
  return Number.isInteger(amount) ? amount : null
}

function shouldSendRenewalNotice(record, subscription, now = new Date()) {
  if (!record?.email || !record.licenseKey) {
    return { send: false, reason: 'missing-contact' }
  }
  if (HARD_STOP.has(record.status)) {
    return { send: false, reason: 'not-renewing' }
  }
  if (!subscription || subscription.id !== record.stripeSubscriptionId) {
    return { send: false, reason: 'missing-subscription' }
  }
  if (subscription.cancel_at_period_end === true) {
    return { send: false, reason: 'cancel-at-period-end' }
  }
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return { send: false, reason: 'inactive-subscription' }
  }

  const endSeconds = subscription.current_period_end
  if (!Number.isInteger(endSeconds)) {
    return { send: false, reason: 'missing-period-end' }
  }
  const lead = endSeconds * 1000 - now.getTime()
  if (lead < MIN_LEAD_MS || lead > MAX_LEAD_MS) {
    return { send: false, reason: 'outside-window' }
  }

  const periodEnd = new Date(endSeconds * 1000).toISOString()
  const sent = (record.renewalNotices || []).some(
    (notice) => notice.periodEnd === periodEnd && notice.status === 'sent',
  )
  if (sent) return { send: false, reason: 'already-sent' }

  const amountCents = renewalAmountCents(subscription)
  if (amountCents == null) return { send: false, reason: 'missing-renewal-amount' }

  return {
    send: true,
    periodEnd,
    amountCents,
    hadIntroDiscount: subscription.metadata?.promotionCode === 'SURVEY20',
  }
}

function withNoticeResult(record, notice) {
  const kept = (record.renewalNotices || []).filter(
    (existing) => !(existing.periodEnd === notice.periodEnd && existing.status === 'failed'),
  )
  return { ...record, renewalNotices: [...kept, notice] }
}

async function sendDueRenewalNotices({
  listLicenses,
  retrieveSubscription,
  sendEmail,
  saveLicense,
  now = new Date(),
}) {
  const records = await listLicenses()
  const results = []

  for (const record of records) {
    let subscription = null
    if (record?.stripeSubscriptionId) {
      try {
        subscription = await retrieveSubscription(record.stripeSubscriptionId)
      } catch (error) {
        results.push({
          licenseKey: record.licenseKey,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'subscription-lookup-failed',
        })
        continue
      }
    }

    const plan = shouldSendRenewalNotice(record, subscription, now)
    if (!plan.send) {
      results.push({ licenseKey: record.licenseKey, status: 'skipped', reason: plan.reason })
      continue
    }

    try {
      const delivery = await sendEmail({
        to: record.email,
        licenseKey: record.licenseKey,
        renewsAt: plan.periodEnd,
        amountCents: plan.amountCents,
        hadIntroDiscount: plan.hadIntroDiscount,
      })
      if (!delivery?.sent) {
        throw new Error(delivery?.reason || 'Renewal notice was not sent')
      }
      await saveLicense(
        withNoticeResult(record, {
          periodEnd: plan.periodEnd,
          status: 'sent',
          sentAt: now.toISOString(),
          amountCents: plan.amountCents,
        }),
      )
      results.push({ licenseKey: record.licenseKey, status: 'sent' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Renewal notice failed'
      await saveLicense(
        withNoticeResult(record, {
          periodEnd: plan.periodEnd,
          status: 'failed',
          failedAt: now.toISOString(),
          error: message,
        }),
      )
      results.push({ licenseKey: record.licenseKey, status: 'failed', reason: message })
    }
  }

  return {
    sent: results.filter((result) => result.status === 'sent').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    results,
  }
}

module.exports = {
  MIN_LEAD_MS,
  MAX_LEAD_MS,
  shouldSendRenewalNotice,
  withNoticeResult,
  sendDueRenewalNotices,
}
