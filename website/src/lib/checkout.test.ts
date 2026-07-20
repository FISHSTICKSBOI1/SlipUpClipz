import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { startProCheckout } from './checkout'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockCheckout(status: number, body: Record<string, unknown>) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
}

describe('startProCheckout', () => {
  it('starts checkout and returns the Stripe session URL', async () => {
    mockCheckout(200, { url: 'https://checkout.stripe.test/session' })
    const result = await startProCheckout()
    assert.equal(result.url, 'https://checkout.stripe.test/session')
  })

  it('surfaces checkout creation errors', async () => {
    mockCheckout(500, { error: 'Unable to start checkout' })
    await assert.rejects(() => startProCheckout(), /Unable to start checkout/)
  })
})
