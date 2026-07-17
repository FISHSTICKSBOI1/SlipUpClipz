const { getStripe, mapSubscriptionStatus } = require('./commerce.cjs')

const ACTIVE_LICENSE_STATUSES = new Set(['active', 'trialing'])

function isLicenseRecordRevoked(record) {
  return ['refunded', 'revoked', 'disputed', 'canceled'].includes(record.status)
}

async function resolveStripeSubscriptionStatus(stripeSubscriptionId) {
  if (!stripeSubscriptionId) {
    return null
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

  return {
    status: mapSubscriptionStatus(subscription.status),
    stripeStatus: subscription.status,
    expiresAt: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    isActive: ACTIVE_LICENSE_STATUSES.has(subscription.status),
  }
}

async function evaluateLicenseRecord(record) {
  if (!record) {
    return { valid: false, tier: 'free' }
  }

  if (isLicenseRecordRevoked(record.status)) {
    return {
      valid: false,
      tier: 'free',
      status: record.status,
    }
  }

  let expiresAt = record.expiresAt || null
  let status = record.status || 'unknown'
  let stripeActive = null

  if (record.stripeSubscriptionId) {
    const subscription = await resolveStripeSubscriptionStatus(record.stripeSubscriptionId)
    if (!subscription) {
      return { valid: false, tier: 'free', status: 'missing_subscription' }
    }

    status = subscription.status
    expiresAt = subscription.expiresAt
    stripeActive = subscription.isActive

    if (!subscription.isActive) {
      return {
        valid: false,
        tier: 'free',
        status,
        expiresAt,
      }
    }
  } else if (record.status !== 'active') {
    return {
      valid: false,
      tier: 'free',
      status,
      expiresAt,
    }
  }

  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt)
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
      return {
        valid: false,
        tier: 'free',
        status: 'expired',
        expiresAt,
      }
    }
  }

  return {
    valid: true,
    tier: 'pro',
    status,
    expiresAt,
    stripeActive,
  }
}

module.exports = {
  evaluateLicenseRecord,
  resolveStripeSubscriptionStatus,
  isLicenseRecordRevoked,
}
