/**
 * Full refund of the current subscription period revokes Pro and cancels that
 * subscription. Partial refunds and refunds of earlier periods do not.
 * This module never creates a refund.
 */

function chargeAmount(charge) {
  return charge?.amount ?? 0
}

function amountRefunded(charge) {
  return charge?.amount_refunded ?? 0
}

function isFullRefund(charge) {
  const amount = chargeAmount(charge)
  return amount > 0 && amountRefunded(charge) >= amount
}

function invoiceSubscriptionId(invoice) {
  if (!invoice?.subscription) return null
  return typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
}

function invoicePeriodEnd(invoice) {
  const line = Array.isArray(invoice?.lines?.data)
    ? invoice.lines.data.find((entry) => entry?.period?.end)
    : null
  return line?.period?.end || invoice?.period_end || null
}

function latestInvoiceId(subscription) {
  if (!subscription?.latest_invoice) return null
  return typeof subscription.latest_invoice === 'string'
    ? subscription.latest_invoice
    : subscription.latest_invoice.id
}

function refundAppliesToCurrentPeriod({ invoice, subscription, license }) {
  if (!license?.stripeSubscriptionId || !subscription) return false
  if (subscription.id !== license.stripeSubscriptionId) return false
  const invoiceSub = invoiceSubscriptionId(invoice)
  if (invoiceSub && invoiceSub !== license.stripeSubscriptionId) return false
  if (invoice?.id && latestInvoiceId(subscription) === invoice.id) return true

  const end = invoicePeriodEnd(invoice)
  const start = subscription.current_period_start
  const periodEnd = subscription.current_period_end
  if (!end || !start || !periodEnd) return false
  return end > start && end <= periodEnd
}

function refundEvents(license) {
  return Array.isArray(license?.refundEvents) ? license.refundEvents : []
}

function priorEvent(license, chargeId) {
  return refundEvents(license).find((event) => event.chargeId === chargeId) || null
}

function cancelSettled(event) {
  return event?.cancelStatus === 'canceled' || event?.cancelStatus === 'already-canceled'
}

function planChargeRefund({ license, charge, invoice, subscription }) {
  const chargeId = charge?.id
  if (!license || !chargeId) {
    return { action: 'skip', reason: 'missing-refund-target' }
  }

  const full = isFullRefund(charge)
  const current = full && refundAppliesToCurrentPeriod({ invoice, subscription, license })
  const prior = priorEvent(license, chargeId)
  const seen = prior?.amountRefunded || 0
  const nextAmount = Math.max(seen, amountRefunded(charge))
  const duplicate = Boolean(prior) && nextAmount === seen && (!current || cancelSettled(prior))

  if (duplicate) {
    return { action: 'skip', reason: 'duplicate-refund', full, current }
  }

  const events = refundEvents(license).filter((event) => event.chargeId !== chargeId)
  const refundedCents =
    events.reduce((sum, event) => sum + (event.amountRefunded || 0), 0) + nextAmount
  const event = {
    chargeId,
    amountRefunded: nextAmount,
    full,
    appliesToCurrentPeriod: current,
    cancelStatus: current ? prior?.cancelStatus || 'pending' : 'not-required',
    updatedAt: new Date().toISOString(),
  }

  const record = {
    ...license,
    refundEvents: [...events, event],
    refundedCents,
    lastRefundAt: event.updatedAt,
    status: current ? 'refunded' : license.status,
  }

  return {
    action: current ? 'revoke-and-cancel' : 'record-only',
    reason: current ? 'current-period-full-refund' : full ? 'not-current-period' : 'partial-refund',
    full,
    current,
    deltaCents: nextAmount - seen,
    record,
  }
}

function attachCancelResult(record, chargeId, cancelResult) {
  const events = refundEvents(record).map((event) => {
    if (event.chargeId !== chargeId) return event
    return {
      ...event,
      cancelStatus: cancelResult.ok
        ? cancelResult.already
          ? 'already-canceled'
          : 'canceled'
        : 'failed',
      cancelError: cancelResult.ok ? null : cancelResult.error || 'cancellation-failed',
    }
  })
  return {
    ...record,
    refundEvents: events,
    subscriptionCancelStatus: cancelResult.ok ? 'canceled' : 'failed',
    subscriptionCancelError: cancelResult.ok ? null : cancelResult.error || 'cancellation-failed',
    subscriptionCanceledAt: cancelResult.ok ? new Date().toISOString() : record.subscriptionCanceledAt || null,
  }
}

async function cancelLicenseSubscription(stripe, subscriptionId) {
  if (!subscriptionId) {
    return { ok: false, error: 'Missing subscription id' }
  }

  const current = await stripe.subscriptions.retrieve(subscriptionId)
  if (current.id !== subscriptionId) {
    return { ok: false, error: 'Refusing to cancel a different subscription' }
  }
  if (current.status === 'canceled') {
    return { ok: true, already: true, status: 'canceled' }
  }

  try {
    const canceled = await stripe.subscriptions.cancel(subscriptionId, {
      prorate: false,
      invoice_now: false,
    })
    if (canceled.status !== 'canceled') {
      return { ok: false, error: `Stripe returned ${canceled.status || 'an unknown status'}` }
    }
    return { ok: true, already: false, status: 'canceled' }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Stripe cancellation failed',
    }
  }
}

module.exports = {
  isFullRefund,
  refundAppliesToCurrentPeriod,
  planChargeRefund,
  attachCancelResult,
  cancelLicenseSubscription,
}
