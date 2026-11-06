const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  planChargeRefund,
  cancelLicenseSubscription,
  attachCancelResult,
} = require('../../netlify/lib/refund-policy.cjs')
const {
  shouldSendRenewalNotice,
  sendDueRenewalNotices,
} = require('../../netlify/lib/renewal-notices.cjs')
const {
  issueBillingRecovery,
  readBillingRecovery,
  markBillingRecoveryUsed,
  consumeRecoveryRateLimit,
} = require('../../netlify/lib/billing-recovery.cjs')
const { buildRenewalNoticeEmail } = require('../../netlify/lib/email.cjs')

const NOW = new Date('2026-10-23T00:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function subscription(overrides = {}) {
  return {
    id: 'sub_current',
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: Math.floor((NOW.getTime() - 200 * DAY) / 1000),
    current_period_end: Math.floor((NOW.getTime() + 160 * DAY) / 1000),
    latest_invoice: 'in_current',
    ...overrides,
  }
}

function license(overrides = {}) {
  return {
    licenseKey: 'SLIP-TEST-TEST-TEST',
    email: 'buyer@example.com',
    status: 'active',
    stripeSubscriptionId: 'sub_current',
    stripeCustomerId: 'cus_current',
    refundEvents: [],
    ...overrides,
  }
}

function charge(overrides = {}) {
  return {
    id: 'ch_current',
    amount: 499,
    amount_refunded: 499,
    invoice: 'in_current',
    ...overrides,
  }
}

function invoice(overrides = {}) {
  return {
    id: 'in_current',
    subscription: 'sub_current',
    period_end: Math.floor((NOW.getTime() + 160 * DAY) / 1000),
    ...overrides,
  }
}

describe('full refund policy', () => {
  it('revokes the current period and asks to cancel only that subscription', () => {
    const plan = planChargeRefund({
      license: license(),
      charge: charge(),
      invoice: invoice(),
      subscription: subscription(),
    })
    assert.equal(plan.action, 'revoke-and-cancel')
    assert.equal(plan.record.status, 'refunded')
  })

  it('does not cancel a subscription for a partial refund', () => {
    const plan = planChargeRefund({
      license: license(),
      charge: charge({ amount_refunded: 100 }),
      invoice: invoice(),
      subscription: subscription(),
    })
    assert.equal(plan.action, 'record-only')
    assert.equal(plan.reason, 'partial-refund')
    assert.equal(plan.record.status, 'active')
  })

  it('does not cancel the current subscription for an earlier period', () => {
    const plan = planChargeRefund({
      license: license(),
      charge: charge({ id: 'ch_old', invoice: 'in_old' }),
      invoice: invoice({
        id: 'in_old',
        period_end: Math.floor((NOW.getTime() - 300 * DAY) / 1000),
      }),
      subscription: subscription(),
    })
    assert.equal(plan.action, 'record-only')
    assert.equal(plan.reason, 'not-current-period')
    assert.equal(plan.record.status, 'active')
  })

  it('does not double-apply a duplicate refund or an older out-of-order amount', () => {
    const first = planChargeRefund({
      license: license(),
      charge: charge({ amount_refunded: 200 }),
      invoice: invoice(),
      subscription: subscription(),
    })
    const duplicate = planChargeRefund({
      license: first.record,
      charge: charge({ amount_refunded: 200 }),
      invoice: invoice(),
      subscription: subscription(),
    })
    assert.equal(duplicate.action, 'skip')

    const older = planChargeRefund({
      license: first.record,
      charge: charge({ amount_refunded: 50 }),
      invoice: invoice(),
      subscription: subscription(),
    })
    assert.equal(older.action, 'skip')
    assert.equal(first.record.refundedCents, 200)
  })

  it('retries cancellation until Stripe reports the subscription canceled', async () => {
    const calls = []
    const stripe = {
      subscriptions: {
        async retrieve() {
          return { id: 'sub_current', status: 'active' }
        },
        async cancel(id, params) {
          calls.push({ id, params })
          return { id, status: 'canceled' }
        },
      },
      refunds: {
        async create() {
          throw new Error('refunds must not be created')
        },
      },
    }
    const result = await cancelLicenseSubscription(stripe, 'sub_current')
    assert.equal(result.ok, true)
    assert.equal(result.already, false)
    assert.equal(calls[0].params.prorate, false)
    assert.equal(calls[0].params.invoice_now, false)

    stripe.subscriptions.retrieve = async () => ({ id: 'sub_current', status: 'canceled' })
    const again = await cancelLicenseSubscription(stripe, 'sub_current')
    assert.equal(again.already, true)
    assert.equal(calls.length, 1)
  })

  it('records a cancellation failure instead of treating it as canceled', () => {
    const plan = planChargeRefund({
      license: license(),
      charge: charge(),
      invoice: invoice(),
      subscription: subscription(),
    })
    const recorded = attachCancelResult(plan.record, 'ch_current', {
      ok: false,
      error: 'Stripe unavailable',
    })
    assert.equal(recorded.subscriptionCancelStatus, 'failed')
    assert.equal(recorded.subscriptionCancelError, 'Stripe unavailable')
    assert.equal(recorded.status, 'refunded')
    const event = recorded.refundEvents.find((entry) => entry.chargeId === 'ch_current')
    assert.equal(event.cancelStatus, 'failed')
  })

  it('refuses to cancel a different subscription id', async () => {
    const stripe = {
      subscriptions: {
        async retrieve() {
          return { id: 'sub_other', status: 'active' }
        },
        async cancel() {
          throw new Error('should not cancel')
        },
      },
    }
    const result = await cancelLicenseSubscription(stripe, 'sub_current')
    assert.equal(result.ok, false)
  })
})

describe('annual renewal notices', () => {
  function annualSubscription(daysUntilRenewal, overrides = {}) {
    return {
      id: 'sub_current',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: Math.floor((NOW.getTime() + daysUntilRenewal * DAY) / 1000),
      items: { data: [{ price: { unit_amount: 499 } }] },
      metadata: {},
      ...overrides,
    }
  }

  it('sends inside the 15 to 45 day window and includes the renewal amount', () => {
    for (const days of [15, 30, 45]) {
      const plan = shouldSendRenewalNotice(license(), annualSubscription(days), NOW)
      assert.equal(plan.send, true, `expected a notice at ${days} days`)
      assert.equal(plan.amountCents, 499)
    }
    const mail = buildRenewalNoticeEmail({
      licenseKey: 'SLIP-TEST-TEST-TEST',
      renewsAt: new Date(NOW.getTime() + 30 * DAY).toISOString(),
      amountCents: 499,
      hadIntroDiscount: true,
    })
    assert.match(mail.text, /\$4\.99/)
    assert.match(mail.text, /pricing#manage/)
    assert.match(mail.text, /one-time discount/)
    assert.match(mail.text, /slipupclipz@gmail.com|Contact:/)
  })

  it('does not send too early, too late, after cancellation, or twice', () => {
    assert.equal(shouldSendRenewalNotice(license(), annualSubscription(14), NOW).reason, 'outside-window')
    assert.equal(shouldSendRenewalNotice(license(), annualSubscription(46), NOW).reason, 'outside-window')
    assert.equal(
      shouldSendRenewalNotice(license(), annualSubscription(30, { cancel_at_period_end: true }), NOW).reason,
      'cancel-at-period-end',
    )
    assert.equal(
      shouldSendRenewalNotice(license({ status: 'canceled' }), annualSubscription(30), NOW).reason,
      'not-renewing',
    )
    const periodEnd = new Date(annualSubscription(30).current_period_end * 1000).toISOString()
    const repeat = shouldSendRenewalNotice(
      license({ renewalNotices: [{ periodEnd, status: 'sent' }] }),
      annualSubscription(30),
      NOW,
    )
    assert.equal(repeat.reason, 'already-sent')
  })

  it('records a failed send and does not mark it sent', async () => {
    const saved = []
    const summary = await sendDueRenewalNotices({
      now: NOW,
      listLicenses: async () => [license()],
      retrieveSubscription: async () => annualSubscription(20),
      sendEmail: async () => ({ sent: false, reason: 'missing_resend_config' }),
      saveLicense: async (record) => {
        saved.push(record)
      },
    })
    assert.equal(summary.failed, 1)
    assert.equal(summary.sent, 0)
    assert.equal(saved[0].renewalNotices[0].status, 'failed')
  })

  it('sends once, then skips the same period', async () => {
    let stored = license()
    const send = async () => ({ sent: true })
    const first = await sendDueRenewalNotices({
      now: NOW,
      listLicenses: async () => [stored],
      retrieveSubscription: async () => annualSubscription(20, { metadata: { promotionCode: 'SURVEY20' } }),
      sendEmail: send,
      saveLicense: async (record) => {
        stored = record
      },
    })
    assert.equal(first.sent, 1)
    assert.equal(stored.renewalNotices[0].status, 'sent')
    const second = await sendDueRenewalNotices({
      now: NOW,
      listLicenses: async () => [stored],
      retrieveSubscription: async () => annualSubscription(20),
      sendEmail: async () => {
        throw new Error('duplicate')
      },
      saveLicense: async () => {
        throw new Error('should not save')
      },
    })
    assert.equal(second.skipped, 1)
  })
})

describe('billing recovery links', () => {
  function memoryStore() {
    const data = new Map()
    return {
      async getJSON(key) {
        return data.has(key) ? structuredClone(data.get(key)) : null
      },
      async setJSON(key, value) {
        data.set(key, structuredClone(value))
        return { modified: true }
      },
    }
  }

  it('accepts a fresh link once and rejects used or expired links', async () => {
    const store = memoryStore()
    const issued = await issueBillingRecovery({
      store,
      license: license(),
      now: NOW,
    })
    const fresh = await readBillingRecovery(store, issued.token, NOW)
    assert.equal(fresh.ok, true)
    assert.equal(fresh.record.stripeCustomerId, 'cus_current')
    await markBillingRecoveryUsed(store, issued.token, NOW)
    const used = await readBillingRecovery(store, issued.token, NOW)
    assert.equal(used.reason, 'used')

    const expiredStore = memoryStore()
    const expired = await issueBillingRecovery({
      store: expiredStore,
      license: license(),
      now: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
    })
    const rejected = await readBillingRecovery(expiredStore, expired.token, NOW)
    assert.equal(rejected.reason, 'expired')
  })

  it('rate limits repeated recovery requests', async () => {
    const store = memoryStore()
    for (let index = 0; index < 5; index += 1) {
      const result = await consumeRecoveryRateLimit(store, 'billing-recovery-rate:email:test', NOW.getTime(), 5)
      assert.equal(result.allowed, true)
    }
    const blocked = await consumeRecoveryRateLimit(store, 'billing-recovery-rate:email:test', NOW.getTime(), 5)
    assert.equal(blocked.allowed, false)
  })
})
