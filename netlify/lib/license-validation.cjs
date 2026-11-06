const { getStripe, mapSubscriptionStatus } = require('./commerce.cjs')

/**
 * These statuses turn Pro off even if Stripe still reports the subscription as
 * active. Cancellation is not in this set: cancel-at-period-end stays `active`
 * in Stripe until the paid period ends.
 */
const HARD_REVOCATION_STATUSES = new Set(['refunded', 'revoked', 'disputed'])
const ACTIVE_STRIPE_STATUSES = new Set(['active', 'trialing'])

function isHardRevoked(record) {
  return Boolean(record) && typeof record === 'object' && HARD_REVOCATION_STATUSES.has(record.status)
}

function isLicenseRecordRevoked(record) {
  if (!record || typeof record !== 'object') return false
  return isHardRevoked(record) || record.status === 'canceled'
}

function periodStillOpen(expiresAt, now) {
  const expiresMs = Date.parse(expiresAt)
  if (!Number.isFinite(expiresMs)) return false
  return expiresMs > now.getTime()
}

async function resolveStripeSubscriptionStatus(stripeSubscriptionId, stripeClient) {
  if (!stripeSubscriptionId) {
    return null
  }

  const stripe = stripeClient || getStripe()
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const expiresAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null

  return {
    status: mapSubscriptionStatus(subscription.status),
    stripeStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    expiresAt,
    isActive: ACTIVE_STRIPE_STATUSES.has(subscription.status),
  }
}

async function evaluateLicenseRecord(record, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date()

  if (!record) {
    return { valid: false, tier: 'free', rejectionReason: 'record_not_found' }
  }

  if (isHardRevoked(record)) {
    return {
      valid: false,
      tier: 'free',
      status: record.status,
      rejectionReason: `revoked_status:${record.status}`,
    }
  }

  let expiresAt = record.expiresAt || null
  let status = record.status || 'unknown'
  let stripeActive = null
  let cancelAtPeriodEnd = false

  if (record.stripeSubscriptionId) {
    const subscription = await resolveStripeSubscriptionStatus(
      record.stripeSubscriptionId,
      options.stripe,
    )
    if (!subscription) {
      return {
        valid: false,
        tier: 'free',
        status: 'missing_subscription',
        rejectionReason: 'missing_subscription',
      }
    }

    status = subscription.status
    expiresAt = subscription.expiresAt || null
    stripeActive = subscription.isActive
    cancelAtPeriodEnd = subscription.cancelAtPeriodEnd

    if (!expiresAt) {
      return {
        valid: false,
        tier: 'free',
        status,
        expiresAt: null,
        cancelAtPeriodEnd,
        rejectionReason: 'missing_period_end',
      }
    }

    if (!subscription.isActive) {
      return {
        valid: false,
        tier: 'free',
        status,
        expiresAt,
        cancelAtPeriodEnd,
        rejectionReason: `subscription_inactive:${status}`,
      }
    }
  } else if (record.status !== 'active' && record.status !== 'trialing') {
    return {
      valid: false,
      tier: 'free',
      status,
      expiresAt,
      rejectionReason: `inactive_status:${status}`,
    }
  }

  if (!expiresAt) {
    return {
      valid: false,
      tier: 'free',
      status,
      expiresAt: null,
      cancelAtPeriodEnd,
      rejectionReason: 'missing_period_end',
    }
  }

  if (!periodStillOpen(expiresAt, now)) {
    return {
      valid: false,
      tier: 'free',
      status: 'expired',
      expiresAt,
      cancelAtPeriodEnd,
      rejectionReason: 'expired',
    }
  }

  return {
    valid: true,
    tier: 'pro',
    status,
    expiresAt,
    stripeActive,
    cancelAtPeriodEnd,
    rejectionReason: null,
  }
}

module.exports = {
  HARD_REVOCATION_STATUSES,
  evaluateLicenseRecord,
  resolveStripeSubscriptionStatus,
  isLicenseRecordRevoked,
  isHardRevoked,
}
