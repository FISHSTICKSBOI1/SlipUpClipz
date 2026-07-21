const test = require('node:test')
const assert = require('node:assert/strict')
const { rmSync, existsSync } = require('node:fs')
const { join } = require('node:path')

const {
  claimStripeEvent,
  completeStripeEvent,
  failStripeEvent,
} = require('../../netlify/lib/idempotency.cjs')

const DEV_STORE_DIR = join(__dirname, '../../.netlify/commerce-dev')

function withEnv(overrides, fn) {
  const previous = {}
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key]
    const value = overrides[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    })
}

test('claimStripeEvent uses onlyIfNew so duplicates are not claimed twice', async () => {
  await withEnv({ SITE_ID: undefined, NETLIFY_DEV: 'true' }, async () => {
    const eventId = `evt_claim_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const first = await claimStripeEvent(eventId, 'checkout.session.completed')
    assert.equal(first.claimed, true)

    const second = await claimStripeEvent(eventId, 'checkout.session.completed')
    assert.equal(second.claimed, false)
    assert.equal(second.reason, 'processing')

    await completeStripeEvent(eventId, { licenseKey: 'SLIP-TEST-TEST-TEST' })

    const third = await claimStripeEvent(eventId, 'checkout.session.completed')
    assert.equal(third.claimed, false)
    assert.equal(third.reason, 'completed')
  })
})

test('claimStripeEvent allows retry after a failed claim', async () => {
  await withEnv({ SITE_ID: undefined, NETLIFY_DEV: 'true' }, async () => {
    const eventId = `evt_fail_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const first = await claimStripeEvent(eventId, 'checkout.session.completed')
    assert.equal(first.claimed, true)

    await failStripeEvent(eventId, new Error('simulated handler failure'))

    const retry = await claimStripeEvent(eventId, 'checkout.session.completed')
    assert.equal(retry.claimed, true)
  })
})

test.after(() => {
  if (existsSync(DEV_STORE_DIR)) {
    rmSync(DEV_STORE_DIR, { recursive: true, force: true })
  }
})
