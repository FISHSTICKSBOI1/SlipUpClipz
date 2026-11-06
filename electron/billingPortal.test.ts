import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  billingPortalEndpoint,
  isStripeBillingPortalUrl,
  requestBillingPortalSession,
} from './billingPortal.ts'

describe('billing portal client', () => {
  it('uses the production site for packaged builds and localhost for development', () => {
    assert.equal(
      billingPortalEndpoint(true),
      'https://slipupclipz.com/.netlify/functions/billing-portal',
    )
    assert.equal(
      billingPortalEndpoint(false),
      'http://localhost:8888/.netlify/functions/billing-portal',
    )
  })

  it('accepts only Stripe billing portal URLs', () => {
    assert.equal(isStripeBillingPortalUrl('https://billing.stripe.com/p/session/test_123'), true)
    assert.equal(isStripeBillingPortalUrl('https://evil.example/billing.stripe.com'), false)
    assert.equal(isStripeBillingPortalUrl('http://billing.stripe.com/p/session/test_123'), false)
  })

  it('returns the portal URL without calling Stripe from this process', async () => {
    const calls: string[] = []
    const result = await requestBillingPortalSession({
      endpoint: 'https://slipupclipz.com/.netlify/functions/billing-portal',
      licenseKey: 'SLIP-TEST-TEST-TEST',
      email: 'buyer@example.com',
      fetchImpl: (async (url: string) => {
        calls.push(String(url))
        return new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/test_123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch,
    })

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.url, 'https://billing.stripe.com/p/session/test_123')
    }
    assert.deepEqual(calls, ['https://slipupclipz.com/.netlify/functions/billing-portal'])
  })

  it('does not follow an unexpected portal address', async () => {
    const result = await requestBillingPortalSession({
      endpoint: 'https://slipupclipz.com/.netlify/functions/billing-portal',
      licenseKey: 'SLIP-TEST-TEST-TEST',
      email: 'buyer@example.com',
      fetchImpl: (async () =>
        new Response(JSON.stringify({ url: 'https://example.com/phish' }), {
          status: 200,
        })) as typeof fetch,
    })
    assert.deepEqual(result, { ok: false, error: 'Billing portal returned an unexpected address.' })
  })
})
