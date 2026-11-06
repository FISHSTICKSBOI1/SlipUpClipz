const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  evaluateLicenseRecord,
  isLicenseRecordRevoked,
} = require('../../netlify/lib/license-validation.cjs')

const NOW = new Date('2026-10-23T18:00:00.000Z')
const FUTURE = '2027-10-23T18:00:00.000Z'
const PAST = '2026-10-01T18:00:00.000Z'

function stripeSubscription(overrides = {}) {
  const calls = []
  const subscription = {
    status: 'active',
    cancel_at_period_end: false,
    current_period_end: Math.floor(Date.parse(FUTURE) / 1000),
    ...overrides,
  }
  return {
    calls,
    client: {
      subscriptions: {
        async retrieve(id) {
          calls.push(id)
          return subscription
        },
      },
    },
  }
}

function record(overrides = {}) {
  return {
    licenseKey: 'SLIP-TEST-TEST-TEST',
    status: 'active',
    stripeSubscriptionId: 'sub_test',
    expiresAt: FUTURE,
    ...overrides,
  }
}

describe('license revocation', () => {
  it('rejects a refunded license even when Stripe still says active', async () => {
    const stripe = stripeSubscription()
    const result = await evaluateLicenseRecord(record({ status: 'refunded' }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'revoked_status:refunded')
    assert.equal(stripe.calls.length, 0)
  })

  it('rejects a revoked license even when Stripe still says active', async () => {
    const stripe = stripeSubscription()
    const result = await evaluateLicenseRecord(record({ status: 'revoked' }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'revoked_status:revoked')
    assert.equal(stripe.calls.length, 0)
  })

  it('rejects a disputed license until the dispute is no longer the stored status', async () => {
    const stripe = stripeSubscription()
    const disputed = await evaluateLicenseRecord(record({ status: 'disputed' }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(disputed.valid, false)
    assert.equal(disputed.rejectionReason, 'revoked_status:disputed')

    const restored = await evaluateLicenseRecord(record({ status: 'active' }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(restored.valid, true)
    assert.equal(restored.tier, 'pro')
  })

  it('keeps a paying customer valid while the Stripe subscription is active', async () => {
    const stripe = stripeSubscription()
    const result = await evaluateLicenseRecord(record(), { now: NOW, stripe: stripe.client })
    assert.equal(result.valid, true)
    assert.equal(result.status, 'active')
    assert.equal(result.tier, 'pro')
  })

  it('keeps access through a paid period after cancel-at-period-end', async () => {
    const stripe = stripeSubscription({ cancel_at_period_end: true, status: 'active' })
    const result = await evaluateLicenseRecord(record(), { now: NOW, stripe: stripe.client })
    assert.equal(result.valid, true)
    assert.equal(result.cancelAtPeriodEnd, true)
    assert.equal(result.expiresAt, FUTURE)
  })

  it('does not cut off a paid period when the stored status is canceled but Stripe is still active', async () => {
    const stripe = stripeSubscription({ status: 'active', cancel_at_period_end: true })
    const result = await evaluateLicenseRecord(record({ status: 'canceled' }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(result.valid, true)
    assert.equal(result.cancelAtPeriodEnd, true)
  })

  it('turns Pro off once Stripe reports the subscription canceled', async () => {
    const stripe = stripeSubscription({ status: 'canceled', cancel_at_period_end: false })
    const result = await evaluateLicenseRecord(record({ status: 'active' }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'subscription_inactive:canceled')
  })

  it('turns Pro off for a canceled record that has no Stripe subscription to consult', async () => {
    const result = await evaluateLicenseRecord(
      record({ status: 'canceled', stripeSubscriptionId: null }),
      { now: NOW },
    )
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'inactive_status:canceled')
  })

  it('expires an active subscription whose paid period has ended', async () => {
    const stripe = stripeSubscription({
      current_period_end: Math.floor(Date.parse(PAST) / 1000),
    })
    const result = await evaluateLicenseRecord(record(), { now: NOW, stripe: stripe.client })
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'expired')
  })

  it('does not treat a status string as a license record', () => {
    assert.equal(isLicenseRecordRevoked('refunded'), false)
    assert.equal(isLicenseRecordRevoked({ status: 'refunded' }), true)
    assert.equal(isLicenseRecordRevoked({ status: 'active' }), false)
  })

  it('uses the Stripe period end and does not move it when validation repeats', async () => {
    const periodEnd = Math.floor(Date.parse('2027-11-01T00:00:00.000Z') / 1000)
    const stripe = stripeSubscription({
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: periodEnd,
    })
    const stored = record({
      status: 'active',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })
    const first = await evaluateLicenseRecord(stored, { now: NOW, stripe: stripe.client })
    const second = await evaluateLicenseRecord(stored, { now: NOW, stripe: stripe.client })
    assert.equal(first.valid, true)
    assert.equal(first.expiresAt, '2027-11-01T00:00:00.000Z')
    assert.equal(second.expiresAt, first.expiresAt)
    assert.equal(stripe.calls.length, 2)
  })

  it('rejects a refunded key again even if the stored expiration is still in the future', async () => {
    const result = await evaluateLicenseRecord(
      record({ status: 'refunded', expiresAt: '2099-01-01T00:00:00.000Z' }),
      { now: NOW, stripe: stripeSubscription().client },
    )
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'revoked_status:refunded')
  })

  it('rejects a failed renewal once Stripe marks the subscription past_due', async () => {
    const stripe = stripeSubscription({ status: 'past_due' })
    const result = await evaluateLicenseRecord(record({ status: 'past_due' }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'subscription_inactive:past_due')
  })

  it('rejects an active subscription with no Stripe period end', async () => {
    const stripe = stripeSubscription({ current_period_end: null })
    const result = await evaluateLicenseRecord(record({ expiresAt: FUTURE }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(result.valid, false)
    assert.equal(result.rejectionReason, 'missing_period_end')
  })

  it('does not care which computer asks', async () => {
    const stripe = stripeSubscription()
    const result = await evaluateLicenseRecord(
      record({ deviceCount: 8, devices: ['a', 'b'], customerNote: 'shared' }),
      { now: NOW, stripe: stripe.client },
    )
    assert.equal(result.valid, true)
    assert.equal(result.expiresAt, FUTURE)
  })

  it('extends a renewal only to the new Stripe period end', async () => {
    const renewedEnd = Date.parse('2028-11-01T00:00:00.000Z')
    const stripe = stripeSubscription({ current_period_end: renewedEnd / 1000 })
    const result = await evaluateLicenseRecord(record({ expiresAt: FUTURE }), {
      now: NOW,
      stripe: stripe.client,
    })
    assert.equal(result.valid, true)
    assert.equal(result.expiresAt, '2028-11-01T00:00:00.000Z')
  })

  it('ends exactly at the Stripe period timestamp after cancellation', async () => {
    const end = Date.parse('2027-11-01T00:00:00.000Z')
    const stripe = stripeSubscription({
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: end / 1000,
    })
    const before = await evaluateLicenseRecord(record(), {
      now: new Date(end - 1000),
      stripe: stripe.client,
    })
    const atEnd = await evaluateLicenseRecord(record(), {
      now: new Date(end),
      stripe: stripe.client,
    })
    assert.equal(before.valid, true)
    assert.equal(before.expiresAt, '2027-11-01T00:00:00.000Z')
    assert.equal(atEnd.valid, false)
    assert.equal(atEnd.rejectionReason, 'expired')
  })
})
