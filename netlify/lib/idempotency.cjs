const { getCommerceStore } = require('./storage.cjs')

const PROCESSING_STALE_MS = 2 * 60 * 1000

function eventKey(eventId) {
  return `stripe-event:${eventId}`
}

async function claimStripeEvent(eventId, eventType) {
  const store = await getCommerceStore()
  const key = eventKey(eventId)
  const claimToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const claim = {
    status: 'processing',
    eventType,
    claimToken,
    claimedAt: new Date().toISOString(),
  }

  // Atomic first-writer-wins claim. Duplicate deliveries see modified: false.
  const write = await store.setJSON(key, claim, { onlyIfNew: true })
  if (write?.modified) {
    return { claimed: true, claimToken }
  }

  const existing = await store.getJSON(key)

  if (existing?.status === 'completed') {
    return { claimed: false, reason: 'completed' }
  }

  if (existing?.status === 'processing') {
    const claimedAt = existing.claimedAt ? Date.parse(existing.claimedAt) : 0
    const age = Date.now() - claimedAt
    if (age >= 0 && age < PROCESSING_STALE_MS) {
      return { claimed: false, reason: 'processing' }
    }

    // Stale in-flight claim (likely a crashed handler). Take over for retry.
    await store.setJSON(key, claim)
    const verify = await store.getJSON(key)
    if (!verify || verify.claimToken !== claimToken) {
      return { claimed: false, reason: 'lost-race' }
    }
    return { claimed: true, claimToken }
  }

  if (existing?.status === 'failed') {
    // Allow Stripe retries after a recorded failure.
    await store.setJSON(key, claim)
    const verify = await store.getJSON(key)
    if (!verify || verify.claimToken !== claimToken) {
      return { claimed: false, reason: 'lost-race' }
    }
    return { claimed: true, claimToken }
  }

  return { claimed: false, reason: 'duplicate' }
}

async function completeStripeEvent(eventId, payload) {
  const store = await getCommerceStore()
  await store.setJSON(eventKey(eventId), {
    status: 'completed',
    ...payload,
    completedAt: new Date().toISOString(),
  })
}

async function failStripeEvent(eventId, error) {
  const store = await getCommerceStore()
  await store.setJSON(eventKey(eventId), {
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
    failedAt: new Date().toISOString(),
  })
}

module.exports = {
  claimStripeEvent,
  completeStripeEvent,
  failStripeEvent,
}
