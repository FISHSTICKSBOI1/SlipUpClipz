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
    let requestBody = ''
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body || '')
      return new Response(JSON.stringify({ url: 'https://checkout.stripe.test/session' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const result = await startProCheckout()
    assert.equal(result.url, 'https://checkout.stripe.test/session')
    assert.equal(requestBody, '{}')
  })

  it('asks checkout to apply SURVEY20 when that code is provided', async () => {
    let requestBody = ''
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body || '')
      return new Response(JSON.stringify({ url: 'https://checkout.stripe.test/discount' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const result = await startProCheckout({ promotionCode: 'SURVEY20' })
    assert.equal(result.url, 'https://checkout.stripe.test/discount')
    assert.deepEqual(JSON.parse(requestBody), { promotionCode: 'SURVEY20' })
  })

  it('surfaces checkout creation errors', async () => {
    mockCheckout(500, { error: 'Unable to start checkout' })
    await assert.rejects(() => startProCheckout(), /Unable to start checkout/)
  })
})
