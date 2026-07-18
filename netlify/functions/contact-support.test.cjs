const { describe, it, beforeEach, afterEach, mock } = require('node:test')
const assert = require('node:assert/strict')

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...originalEnv }
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.RESEND_FROM_EMAIL = 'support@slipupclipz.com'
  process.env.SUPPORT_TO_EMAIL = 'slipupclipz@gmail.com'
})

afterEach(() => {
  process.env = { ...originalEnv }
  mock.restoreAll()
})

describe('contact-support validation', () => {
  it('rejects empty required fields', () => {
    const { validateBody } = require('./contact-support.cjs')
    const { errors } = validateBody({
      name: '',
      email: 'bad',
      subject: '',
      message: '',
    })

    assert.equal(errors.name, 'Name is required.')
    assert.equal(errors.email, 'Enter a valid email address.')
    assert.equal(errors.subject, 'Subject is required.')
    assert.equal(errors.message, 'Message is required.')
  })

  it('accepts a valid payload', () => {
    const { validateBody } = require('./contact-support.cjs')
    const { data, errors } = validateBody({
      name: 'Alex',
      email: 'alex@example.com',
      subject: 'Help',
      message: 'Please help',
      category: 'Other',
    })

    assert.equal(Object.keys(errors).length, 0)
    assert.equal(data.email, 'alex@example.com')
  })
})

describe('contact-support handler', () => {
  it('returns success true when Resend accepts the message', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ id: 'email_123' }),
    }))

    const { handler } = require('./contact-support.cjs')
    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        name: 'Alex',
        email: 'alex@example.com',
        subject: 'Help',
        message: 'Please help',
        category: 'Other',
      }),
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(JSON.parse(response.body), { success: true })
  })

  it('returns success false with a safe error when Resend fails', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 500,
      text: async () => 'upstream failure',
      json: async () => ({}),
    }))

    const { handler } = require('./contact-support.cjs')
    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        name: 'Alex',
        email: 'alex@example.com',
        subject: 'Help',
        message: 'Please help',
        category: 'Other',
      }),
    })

    assert.equal(response.statusCode, 502)
    const body = JSON.parse(response.body)
    assert.equal(body.success, false)
    assert.match(body.error, /could not send/i)
    assert.doesNotMatch(body.error, /re_test_key/)
  })
})
