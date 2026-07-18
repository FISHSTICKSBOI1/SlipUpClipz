const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')

const {
  escapeHtml,
  normalizeFromAddress,
  buildSupportEmailPayload,
  getSupportToEmail,
} = require('./email.cjs')

const originalEnv = { ...process.env }
const originalFetch = global.fetch

beforeEach(() => {
  process.env = { ...originalEnv }
  delete process.env.SUPPORT_TO_EMAIL
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM_EMAIL
})

afterEach(() => {
  process.env = { ...originalEnv }
  global.fetch = originalFetch
})

describe('email helpers', () => {
  it('escapes user-provided HTML', () => {
    assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('normalizes plain RESEND_FROM_EMAIL into a display-name from address', () => {
    assert.equal(
      normalizeFromAddress('support@slipupclipz.com'),
      'SlipUpClipz Support <support@slipupclipz.com>',
    )
  })

  it('uses SUPPORT_TO_EMAIL as the destination', () => {
    process.env.SUPPORT_TO_EMAIL = 'slipupclipz@gmail.com'
    assert.equal(getSupportToEmail(), 'slipupclipz@gmail.com')

    const payload = buildSupportEmailPayload({
      name: 'Alex',
      email: 'alex@example.com',
      subject: 'Mic issue',
      category: 'Audio capture',
      message: 'Level meter is flat',
      appVersion: '0.1.4',
      windowsVersion: 'Windows 11',
      diagnosticConsent: true,
    })

    assert.ok(payload)
    assert.deepEqual(payload.to, ['slipupclipz@gmail.com'])
    assert.equal(payload.reply_to, 'alex@example.com')
    assert.equal(payload.subject, '[SlipUpClipz Support] Mic issue')
    assert.match(payload.text, /Alex/)
    assert.match(payload.html, /Level meter is flat/)
  })

  it('fails closed when SUPPORT_TO_EMAIL is missing', () => {
    assert.equal(getSupportToEmail(), null)
    assert.equal(
      buildSupportEmailPayload({
        name: 'Alex',
        email: 'alex@example.com',
        subject: 'Mic issue',
        message: 'Hello',
      }),
      null,
    )
  })
})
