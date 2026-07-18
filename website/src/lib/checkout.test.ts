import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { startProCheckout } from './checkout'
import { normalizeCreatorCode } from './creatorCode'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockCheckout(status: number, body: Record<string, unknown>) {
  globalThis.fetch = async (_input, init) => {
    const requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    ;(globalThis as { __lastCheckoutBody?: Record<string, unknown> }).__lastCheckoutBody =
      requestBody
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

describe('creator code normalization', () => {
  it('trims and uppercases creator codes', () => {
    assert.equal(normalizeCreatorCode('  creator 25 '), 'CREATOR25')
  })
})

describe('startProCheckout', () => {
  it('starts checkout without an affiliate code', async () => {
    mockCheckout(200, { url: 'https://checkout.stripe.test/session' })
    const result = await startProCheckout()
    assert.equal(result.url, 'https://checkout.stripe.test/session')
    assert.equal(
      'affiliateCode' in
        ((globalThis as { __lastCheckoutBody?: Record<string, unknown> }).__lastCheckoutBody || {}),
      false,
    )
  })

  it('submits a creator code', async () => {
    mockCheckout(200, { url: 'https://checkout.stripe.test/session' })
    await startProCheckout('CREATOR25')
    assert.equal(
      (globalThis as { __lastCheckoutBody?: Record<string, unknown> }).__lastCheckoutBody
        ?.affiliateCode,
      'CREATOR25',
    )
  })

  it('surfaces checkout creation errors', async () => {
    mockCheckout(500, { error: 'Unable to start checkout' })
    await assert.rejects(() => startProCheckout(), /Unable to start checkout/)
  })
})
