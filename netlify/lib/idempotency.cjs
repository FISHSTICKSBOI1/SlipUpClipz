const { getCommerceStore } = require('./storage.cjs')

const PROCESSING_STALE_MS = 2 * 60 * 1000

function eventKey(eventId) {
  return `stripe-event:${eventId}`
}

async function claimStripeEvent(eventId, eventType) {
  const store = await getCommerceStore()
  const key = eventKey(eventId)
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
  }

  const claimToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await store.setJSON(key, {
    status: 'processing',
    eventType,
    claimToken,
    claimedAt: new Date().toISOString(),
  })

  const verify = await store.getJSON(key)
  if (!verify || verify.claimToken !== claimToken) {
    return { claimed: false, reason: 'lost-race' }
  }

  return { claimed: true, claimToken }
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
